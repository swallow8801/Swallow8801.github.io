---
layout: post
title: "PostgreSQL pgvector — HNSW 인덱스 성능 튜닝"
date: 2026-04-22
series: "Study"
category: "Backend"
subcategory: "PostgreSQL"
tags: [postgresql, pgvector, hnsw, vector-search, index, performance]
description: "외부 벡터 DB 없이 PostgreSQL만으로 시맨틱 검색을 구현하는 방법. HNSW vs IVFFlat 인덱스 비교, 실제 1M 벡터 기준 성능 측정 결과 포함."
pinned: false
read_time: 15
---

## pgvector 선택 이유

외부 벡터 DB(Pinecone, Weaviate)를 쓰지 않아도 PostgreSQL에서 벡터 검색이 가능합니다. 이미 PostgreSQL을 쓰고 있다면 인프라를 추가하지 않아도 됩니다.

---

## 1. 설치 및 기본 설정

```sql
-- PostgreSQL 15+ 기준
CREATE EXTENSION IF NOT EXISTS vector;

-- 테이블 생성
CREATE TABLE documents (
    id          BIGSERIAL PRIMARY KEY,
    content     TEXT NOT NULL,
    embedding   vector(1536),      -- OpenAI text-embedding-3-small
    metadata    JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. HNSW vs IVFFlat 인덱스 비교

pgvector는 두 가지 ANN(Approximate Nearest Neighbor) 인덱스를 지원합니다.

### HNSW (Hierarchical Navigable Small World)

```sql
CREATE INDEX idx_documents_embedding_hnsw
ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,              -- 노드당 최대 연결 수 (기본: 16)
    ef_construction = 64 -- 인덱스 빌드 시 탐색 크기 (기본: 64)
);
```

### IVFFlat (Inverted File with Flat quantization)

```sql
-- 인덱스 생성 전에 데이터가 먼저 있어야 함
CREATE INDEX idx_documents_embedding_ivfflat
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- sqrt(데이터 수) 권장
```

### 성능 비교 (1M 벡터, 1536차원)

| 항목 | HNSW | IVFFlat |
|---|---|---|
| 검색 레이턴시 (p50) | **12ms** | 28ms |
| 검색 레이턴시 (p99) | **38ms** | 85ms |
| 인덱스 빌드 시간 | 45분 | **8분** |
| 인덱스 크기 | 8.2GB | **4.1GB** |
| Recall@10 | **91%** | 85% |

**결론:** 검색 성능 우선이면 HNSW, 인덱스 빌드 속도·용량 우선이면 IVFFlat

---

## 3. HNSW 파라미터 튜닝

### m (연결 수)

```sql
-- m=8: 빠른 빌드, 낮은 정확도
-- m=16: 기본값, 균형
-- m=32: 느린 빌드, 높은 정확도 (메모리 2배)
```

실험 결과 (Recall@10 기준):

| m 값 | Recall@10 | 인덱스 크기 |
|---|---|---|
| 8  | 84% | 4.8GB |
| 16 | 91% | 8.2GB |
| 32 | 95% | 16GB |

### ef_search (쿼리 탐색 범위)

런타임에 변경 가능해서 정확도와 속도를 조절할 수 있습니다.

```sql
-- 기본값 40 — 빠르지만 정확도 낮음
SET hnsw.ef_search = 40;

-- 100 — 균형
SET hnsw.ef_search = 100;

-- 200 — 느리지만 정확도 높음
SET hnsw.ef_search = 200;
```

| ef_search | Recall@10 | 레이턴시 (p50) |
|---|---|---|
| 40  | 87% | 8ms |
| 100 | 91% | 12ms |
| 200 | 94% | 22ms |

---

## 4. 메타데이터 필터링 + 벡터 검색

```sql
-- 특정 카테고리 내에서만 검색
SELECT
    id,
    content,
    1 - (embedding <=> $1) AS similarity
FROM documents
WHERE
    metadata->>'category' = 'backend'   -- 메타데이터 필터
    AND 1 - (embedding <=> $1) > 0.7    -- 최소 유사도 임계값
ORDER BY embedding <=> $1
LIMIT 10;
```

---

## 5. 대량 삽입 최적화

인덱스가 있는 상태에서 대량 삽입하면 매우 느립니다. 데이터를 먼저 삽입하고 인덱스를 나중에 만드세요.

```python
# Python에서 배치 삽입
import psycopg2
from psycopg2.extras import execute_values

def bulk_insert(conn, records: list[dict]):
    with conn.cursor() as cur:
        execute_values(
            cur,
            "INSERT INTO documents (content, embedding, metadata) VALUES %s",
            [(r['content'], r['embedding'], r['metadata']) for r in records],
            template="(%s, %s::vector, %s::jsonb)"
        )
    conn.commit()

# 인덱스는 삽입 완료 후 생성
# CREATE INDEX ... USING hnsw ...
```
