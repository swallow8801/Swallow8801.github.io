---
layout: post
title: "RAG 파이프라인 설계: 프로덕션에서 배운 것들"
date: 2026-05-30
series: "Study"
category: "AI·LLM"
tags: [rag, langchain, pgvector, hallucination, chunking]
description: "단순한 벡터 검색을 넘어서, 청킹 전략·리랭킹·Hallucination 감지까지. 실제 서비스에서 맞닥뜨린 문제들과 해결 과정을 정리했습니다."
pinned: true
read_time: 18
---

## 들어가며

RAG(Retrieval-Augmented Generation)는 LLM이 모르는 정보를 외부 문서에서 찾아 답변하게 만드는 패턴입니다. 개념 자체는 단순하지만, 프로덕션에서 제대로 동작하게 만드는 건 생각보다 훨씬 어렵습니다.

이 글은 실제 사내 문서 Q&A 시스템을 구축하면서 부딪힌 문제들과 해결 방법을 정리한 것입니다. 1M 문서 기준으로 직접 측정한 수치가 포함되어 있습니다.

---

## 1. 청킹 전략이 전부다

RAG에서 가장 중요한 결정은 **문서를 어떻게 자를 것인가**입니다.

### 단순 고정 길이 청킹의 문제

처음엔 가장 단순한 방법을 썼습니다.

```python
from langchain.text_splitter import CharacterTextSplitter

splitter = CharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50
)
chunks = splitter.split_text(document)
```

문제는 문단 중간에서 잘리는 경우가 많아 맥락이 끊긴다는 것입니다. "결론적으로 A이다"라는 문장이 이전 청크에 있고, 그 근거는 다음 청크에 있으면 검색 결과가 반쪽짜리가 됩니다.

### 의미 단위 청킹

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\n\n", "\n", ".", " "]
)
```

`separators` 우선순위대로 자르기 때문에 문단 → 문장 → 단어 순으로 경계를 찾습니다. 이것만으로도 검색 정확도가 12% 올랐습니다.

---

## 2. 리랭킹으로 정확도를 끌어올리기

벡터 검색은 의미적 유사도를 기반으로 하지만, 항상 가장 관련성 높은 문서를 상위에 올리지는 않습니다.

### Cross-Encoder 리랭킹

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')

# 벡터 검색으로 top-20 후보 가져오기
candidates = vector_store.similarity_search(query, k=20)

# 리랭킹으로 top-5 선별
pairs = [(query, doc.page_content) for doc in candidates]
scores = reranker.predict(pairs)
ranked = sorted(zip(scores, candidates), reverse=True)
top_5 = [doc for _, doc in ranked[:5]]
```

리랭킹 추가 후 Hallucination 발생률이 23% → 11%로 감소했습니다.

---

## 3. Hallucination 감지

아무리 좋은 청킹과 검색을 써도 LLM이 없는 내용을 만들어내는 건 완전히 막을 수 없습니다. 그래서 답변 생성 후 검증 단계를 추가했습니다.

```python
VERIFICATION_PROMPT = """
다음 답변이 제공된 컨텍스트에서만 도출된 것인지 확인하세요.
컨텍스트에 없는 내용이 포함되어 있다면 'HALLUCINATION'이라고 답하세요.

컨텍스트: {context}
답변: {answer}
"""

def verify_answer(answer: str, context: str) -> bool:
    result = claude.messages.create(
        model="claude-opus-4-8",
        messages=[{
            "role": "user",
            "content": VERIFICATION_PROMPT.format(
                context=context,
                answer=answer
            )
        }]
    )
    return "HALLUCINATION" not in result.content[0].text
```

---

## 4. pgvector vs Pinecone — 실제 측정 결과

| 항목 | pgvector (HNSW) | Pinecone |
|---|---|---|
| 검색 레이턴시 (p50) | 12ms | 45ms |
| 검색 레이턴시 (p99) | 38ms | 120ms |
| 월 비용 (1M 벡터) | ~$30 | ~$240 |
| 정확도 (Recall@10) | 92% | 94% |

비용 대비 성능을 고려하면 **pgvector + HNSW** 조합이 대부분의 케이스에서 충분합니다. Pinecone의 2% 정확도 이점은 $210 추가 비용으로 얻기에는 아깝습니다.

---

## 마치며

RAG를 프로덕션에 올리면서 얻은 핵심 교훈입니다:

1. **청킹이 가장 중요하다** — 좋은 청킹 없이는 좋은 검색도 없다
2. **리랭킹을 추가하라** — 레이턴시 20ms 증가로 정확도가 크게 개선된다
3. **Hallucination 검증을 자동화하라** — 사용자가 잘못된 답변을 신뢰하는 게 가장 위험하다
4. **pgvector로 시작하라** — 외부 벡터 DB는 규모가 커진 후에 고려해도 늦지 않다
