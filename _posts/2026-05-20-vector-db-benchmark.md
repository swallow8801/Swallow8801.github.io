---
layout: post
title: "Vector DB 비교: Pinecone vs Weaviate vs pgvector 실전 벤치마크"
date: 2026-05-20
series: "Study"
category: "AI·LLM"
tags: [vector-db, pinecone, weaviate, pgvector, benchmark, rag]
description: "같은 데이터셋으로 세 가지 벡터 DB를 직접 벤치마킹했습니다. 비용, 검색 속도, 정확도 비교와 상황별 선택 기준 정리."
pinned: false
read_time: 16
---

## 왜 직접 벤치마킹했나

RAG 시스템을 프로덕션에 올리면서 가장 많이 받는 질문이 "벡터 DB 뭐 써요?"입니다. 블로그 글들을 읽어보면 모두 다른 말을 하고, 대부분은 특정 벤더의 자료를 기반으로 합니다. 그래서 직접 같은 조건으로 측정해봤습니다.

**테스트 환경**
- 데이터셋: 사내 기술 문서 1,024,000개 청크 (avg 512 tokens)
- 임베딩: `text-embedding-3-small` (1536 dim)
- 서버: AWS c5.2xlarge (8 vCPU, 16GB)
- 평가 기준: 검색 레이턴시, Recall@10, 월 비용

---

## 결과 요약

| 항목 | pgvector (HNSW) | Weaviate | Pinecone |
|---|---|---|---|
| 검색 레이턴시 p50 | **12ms** | 28ms | 45ms |
| 검색 레이턴시 p99 | **38ms** | 92ms | 124ms |
| Recall@10 | 91% | 93% | **94%** |
| 월 비용 (1M 벡터) | **~$30** | ~$140 | ~$240 |
| 운영 복잡도 | 중간 | 높음 | **낮음** |

---

## 1. pgvector + HNSW

PostgreSQL의 확장으로, 기존 DB 인프라에 벡터 검색을 추가할 수 있습니다.

```sql
-- 확장 설치
CREATE EXTENSION vector;

-- 1536차원 벡터 컬럼 추가
ALTER TABLE documents ADD COLUMN embedding vector(1536);

-- HNSW 인덱스 생성 (m=16, ef_construction=64)
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 검색
SELECT id, content, 1 - (embedding <=> $1) AS score
FROM documents
ORDER BY embedding <=> $1
LIMIT 10;
```

**HNSW 파라미터 튜닝:**
- `m`: 노드당 연결 수. 높을수록 정확도↑, 메모리↑ (기본 16)
- `ef_construction`: 인덱스 빌드 시 탐색 범위. 높을수록 정확도↑, 빌드 시간↑ (기본 64)
- `ef_search`: 쿼리 시 탐색 범위. 런타임에 조정 가능

```sql
-- 쿼리 시 ef_search 동적 조정
SET hnsw.ef_search = 100;
```

**장점:** 기존 PostgreSQL 인프라 활용, 별도 서비스 불필요, 저렴한 비용  
**단점:** 대규모(수억 벡터)에서 성능 저하, 수평 확장 어려움

---

## 2. Weaviate

GraphQL/REST API를 제공하는 오픈소스 벡터 DB입니다.

```python
import weaviate

client = weaviate.Client("http://localhost:8080")

# 스키마 생성
client.schema.create_class({
    "class": "Document",
    "vectorizer": "none",
    "properties": [
        {"name": "content", "dataType": ["text"]},
    ]
})

# 데이터 삽입
client.data_object.create(
    {"content": "문서 내용"},
    "Document",
    vector=[0.1, 0.2, ...]
)

# 검색
result = client.query.get("Document", ["content"]) \
    .with_near_vector({"vector": query_embedding}) \
    .with_limit(10) \
    .do()
```

**장점:** 풍부한 필터링 기능, 하이브리드 검색(BM25 + 벡터) 지원  
**단점:** 운영 복잡도 높음, 메모리 사용량 큼

---

## 3. Pinecone

완전 관리형 SaaS 벡터 DB입니다.

```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_API_KEY")
index = pc.Index("my-index")

# 업서트
index.upsert(vectors=[
    {"id": "doc-1", "values": embedding, "metadata": {"content": "..."}}
])

# 검색
results = index.query(
    vector=query_embedding,
    top_k=10,
    include_metadata=True
)
```

**장점:** 운영 부담 없음, 수억 벡터 수평 확장, 안정적인 레이턴시  
**단점:** 비용이 가장 비쌈, 데이터가 외부로 나감

---

## 선택 기준

```
데이터 규모 < 500만 벡터
  AND 기존 PostgreSQL 사용 중
  → pgvector

데이터 규모 > 500만 벡터
  AND 운영 팀 없음
  → Pinecone

하이브리드 검색(키워드 + 벡터) 필요
  → Weaviate
```

대부분의 스타트업/사이드 프로젝트에는 **pgvector**로 시작하는 걸 추천합니다. Pinecone으로 옮기는 건 규모가 커진 후 해도 늦지 않습니다.
