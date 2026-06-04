---
layout: post
title: "pgvector 설치부터 HNSW 인덱스 생성까지 Quick Guide"
date: 2026-05-25
series: "DevNotes"
category: "Snippets"
tags: [pgvector, postgresql, snippet, vector-search, hnsw]
description: "PostgreSQL에 pgvector를 붙이고 HNSW 인덱스를 생성하는 핵심 명령어만 정리. 매번 찾아보는 게 귀찮아서 기록."
pinned: false
read_time: 3
---

매번 검색하는 pgvector 세팅 명령어를 한 곳에 정리합니다.

## 설치

```bash
# Ubuntu/Debian
sudo apt install postgresql-15-pgvector

# macOS (Homebrew)
brew install pgvector

# Docker
docker pull pgvector/pgvector:pg15
```

## 확장 활성화

```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- 확인
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## 테이블 + 인덱스

```sql
-- 1536차원 벡터 컬럼 추가
ALTER TABLE documents ADD COLUMN embedding vector(1536);

-- HNSW 인덱스 (권장)
CREATE INDEX ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 검색
SET hnsw.ef_search = 100;
SELECT id, content, 1 - (embedding <=> $1::vector) AS score
FROM documents
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

## 거리 함수 종류

| 연산자 | 함수명 | 설명 |
|---|---|---|
| `<=>` | cosine distance | 방향 유사도 (텍스트 임베딩에 추천) |
| `<->` | L2 distance | 유클리드 거리 |
| `<#>` | inner product | 내적 (정규화된 벡터에서 cosine과 동일) |

## Python에서 삽입

```python
import psycopg2

conn = psycopg2.connect("postgresql://user:pass@localhost/db")
cur = conn.cursor()

embedding = [0.1, 0.2, ...]  # list of float
cur.execute(
    "UPDATE documents SET embedding = %s WHERE id = %s",
    (embedding, doc_id)
)
conn.commit()
```
