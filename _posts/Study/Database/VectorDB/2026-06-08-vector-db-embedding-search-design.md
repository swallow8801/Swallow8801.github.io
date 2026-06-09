---
layout: post
title: "텍스트를 '의미'로 찾는다는 것: Vector DB 설계와 임베딩 검색 구조 정리"
date: 2026-06-08
series: "Study"
category: "Database"
subcategory: "VectorDB"
tags: [vectordb, embedding, similarity-search, rag]
description: "키워드 일치가 아니라 '의미'로 문서를 찾는 임베딩 검색의 원리와, 이를 서비스로 만들 때 Vector DB를 어떻게 설계하는지 정리합니다."
image: https://images.unsplash.com/photo-1644088379091-d574269d422f?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

"오류 로그"를 검색했는데 "에러 메시지"라고 적힌 문서를 못 찾는 경우를 본 적이 있을 겁니다. 전통적인 키워드 검색은 글자가 정확히 일치해야 찾아내지만, 사람은 "비슷한 의미"로 찾고 싶어 합니다. 이 간극을 메우는 기술이 임베딩(embedding)과 이를 저장·검색하는 Vector DB입니다.

이 글은 임베딩이 '의미'를 어떻게 숫자로 표현하는지, 그리고 이를 서비스에 들이려 할 때 Vector DB를 어떻게 고르고 설계하는지를 정리합니다.

---

## 임베딩: 의미를 좌표로 바꾸기

임베딩 모델은 문장을 수백~수천 차원의 숫자 벡터로 바꿉니다. 핵심은 **의미가 비슷한 문장일수록 벡터 공간에서 가까운 위치에 놓인다**는 점입니다. "오류 로그를 어디서 보나요"와 "에러 메시지는 어디서 확인하나요"는 글자가 다르지만 벡터는 가깝게 매핑됩니다.

```python
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("intfloat/multilingual-e5-base")
vecs = model.encode([
    "오류 로그를 어디서 보나요",
    "에러 메시지는 어디서 확인하나요",
    "오늘 점심 메뉴 추천",
])
# 코사인 유사도: 1·2번 문장은 가깝게, 3번 문장은 멀게 나온다
```

검색은 결국 "질문 벡터와 가장 가까운 문서 벡터를 찾는" 최근접 이웃(nearest neighbor) 문제로 바뀝니다. 문서가 수백 건이면 전수 비교로도 충분하지만, 수백만 건이 되면 매 질의마다 전체를 비교할 수 없으므로 전용 인덱스 구조가 필요해집니다. 여기서 Vector DB가 등장합니다.

---

## Vector DB는 무엇을 대신 해 주는가

Vector DB의 핵심 역할은 **근사 최근접 이웃 검색(ANN)**을 빠르게 해 주는 것입니다. 정확히 가장 가까운 것을 찾는 대신, "거의 가장 가까운 것"을 훨씬 빠르게 찾아 줍니다. 대표적인 인덱스 구조 두 가지를 알아 두면 선택 기준이 보입니다.

| 인덱스 | 동작 방식 | 특징 |
| --- | --- | --- |
| HNSW | 벡터를 계층적 그래프로 연결해 탐색 | 검색이 빠르고 정확도 높음, 메모리 사용량 큼 |
| IVF | 벡터를 클러스터로 나눠 후보군만 탐색 | 메모리 효율적, 클러스터 수 튜닝 필요 |

선택지는 크게 세 갈래입니다. 이미 PostgreSQL을 쓰고 있다면 `pgvector` 확장으로 같은 DB 안에서 시작할 수 있고, 검색 자체가 핵심이라면 Milvus·Qdrant·Weaviate 같은 전용 Vector DB가 기능이 풍부합니다. 운영 부담을 줄이고 싶다면 Pinecone 같은 매니지드 서비스도 선택지입니다.

```sql
-- pgvector 예시: 기존 테이블에 벡터 컬럼을 더해 시작하기
ALTER TABLE documents ADD COLUMN embedding vector(768);
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);

SELECT id, content
FROM documents
ORDER BY embedding <=> '[0.012, -0.034, ...]'
LIMIT 5;
```

---

## 검색 품질은 인덱스 너머에서 갈린다

Vector DB를 연결했다고 검색 품질이 바로 좋아지지는 않습니다. 실제로 결과를 좌우하는 건 그 앞뒤 단계입니다.

- **청크 분할(chunking)**: 문서를 너무 길게 넣으면 벡터가 "전체의 평균적인 의미"가 되어 버려 정밀한 질문에 약해집니다. 의미 단위로 적당히 쪼개 넣는 편이 검색 정밀도에 유리합니다.
- **하이브리드 검색**: 의미 검색은 "정확한 코드명·에러 코드"처럼 글자 그대로 일치해야 하는 질의에는 약합니다. 키워드 검색(BM25 등)과 벡터 검색을 함께 쓰고 점수를 합치는 하이브리드 구성이 실무에서 흔히 더 안정적입니다.
- **재순위화(reranking)**: 1차로 후보를 넉넉히 가져온 뒤, 더 정교한 모델로 상위 결과만 다시 순위를 매기면 최종 품질이 올라갑니다.

이 세 가지를 얼마나 적용할지는 질의 패턴과 응답 속도 요구치에 따라 달라지므로, 검색 결과의 정답률과 응답 시간을 같은 질의셋으로 비교하며 단계적으로 늘려가는 것이 안전합니다(`<측정값>` — 청크 크기·top-k·재순위화 적용 전후의 정답률 비교는 직접 측정).

---

## 정리

Vector DB 도입의 핵심은 (1) 임베딩이 의미를 벡터 공간의 거리로 바꾼다는 원리를 이해하고, (2) HNSW·IVF 같은 인덱스 특성과 운영 부담을 보고 pgvector·전용 Vector DB·매니지드 서비스 중 고르며, (3) 청크 분할·하이브리드 검색·재순위화처럼 인덱스 바깥의 디테일이 실제 품질을 가른다는 점을 놓치지 않는 것입니다. 도입 효과는 항상 같은 질의셋에서 정답률과 응답 시간을 비교해 판단하세요.

---

## 이미지 출처

사진: Conny Schneider / Unsplash (Unsplash License) — https://unsplash.com/photos/a-blue-background-with-lines-and-dots-xuTJZ7uD7PI
