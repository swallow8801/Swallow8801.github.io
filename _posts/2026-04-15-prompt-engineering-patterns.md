---
layout: post
title: "프롬프트 엔지니어링 실전 패턴 10가지 — 코드와 함께"
date: 2026-04-15
series: "Study"
category: "AI"
subcategory: "LLM"
tags: [prompt-engineering, claude-api, llm, cot, few-shot, python]
description: "Chain-of-thought, Few-shot, Role prompting 등 실제 프로덕션에서 효과를 검증한 패턴들. 각 패턴이 왜 동작하는지 원리와 함께 설명합니다."
pinned: false
read_time: 20
---

## 패턴 1: Chain-of-Thought (CoT)

복잡한 추론이 필요한 작업에서 "단계별로 생각해"라고 지시하면 정확도가 크게 올라갑니다.

```python
prompt = """
다음 코드에서 버그를 찾아주세요.

```python
def calculate_average(numbers):
    return sum(numbers) / len(numbers)
```

단계별로 분석해주세요:
1. 함수의 목적 파악
2. 엣지 케이스 확인
3. 버그 식별
4. 수정 방법 제안
"""
```

**왜 동작하나:** LLM이 중간 추론 과정을 토큰으로 생성하면서 다음 토큰 예측이 더 정확해집니다.

---

## 패턴 2: Few-Shot Learning

예시를 보여주면 원하는 출력 형식을 학습합니다.

```python
prompt = """
텍스트에서 기술 스택을 추출해주세요.

예시 1:
입력: "FastAPI와 PostgreSQL로 API를 만들고 Docker로 배포했습니다."
출력: {"backend": ["FastAPI"], "database": ["PostgreSQL"], "infra": ["Docker"]}

예시 2:
입력: "React TypeScript 프로젝트에 Redux를 추가했어요."
출력: {"frontend": ["React", "TypeScript", "Redux"]}

이제 추출해주세요:
입력: "LangChain과 pgvector로 RAG 시스템을 구축하고 AWS Lambda에 올렸습니다."
출력:
"""
```

---

## 패턴 3: Role Prompting

특정 역할을 부여하면 해당 도메인의 지식과 어투를 활용합니다.

```python
system_prompt = """당신은 10년 경력의 시니어 백엔드 개발자입니다.
코드 리뷰 시 다음 기준을 적용합니다:
- 보안 취약점 (SQL Injection, XSS 등)
- 성능 문제 (N+1 쿼리, 불필요한 루프)
- 가독성 (함수 길이, 변수명)
명확한 문제만 지적하고 칭찬은 생략합니다."""
```

---

## 패턴 4: XML 태그로 구조화

XML 태그를 사용하면 LLM이 입력의 각 부분을 더 정확하게 구분합니다.

```python
prompt = """
<task>다음 코드를 리뷰해주세요.</task>

<context>
이 코드는 사용자 인증 API의 일부입니다.
프레임워크: FastAPI, 데이터베이스: PostgreSQL
</context>

<code>
def login(username: str, password: str):
    user = db.execute(f"SELECT * FROM users WHERE username = '{username}'")
    if user and user.password == password:
        return generate_token(user.id)
</code>

<output_format>
보안 이슈, 성능 이슈, 코드 품질 순서로 작성해주세요.
</output_format>
"""
```

---

## 패턴 5: 출력 형식 강제 (JSON Mode)

```python
import anthropic
import json

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system="항상 유효한 JSON만 반환하세요. 다른 텍스트는 포함하지 마세요.",
    messages=[{
        "role": "user",
        "content": f"""
다음 PR 제목에서 정보를 추출하세요.
PR 제목: "feat: 사용자 인증에 JWT 토큰 방식 추가"

반환 형식:
{{"type": "feat|fix|docs|...", "scope": "모듈명", "description": "설명", "breaking": false}}
"""
    }]
)

result = json.loads(response.content[0].text)
```

---

## 패턴 6: 부정 지시보다 긍정 지시

```python
# 나쁜 예 — LLM이 "하지 말라"는 걸 무시하는 경향
bad_prompt = "마케팅 문구 같은 과장된 표현을 쓰지 마세요."

# 좋은 예 — 원하는 것을 직접 명시
good_prompt = "기술적으로 정확한 표현만 사용하세요. 수치와 구체적인 사실을 기반으로 작성하세요."
```

---

## 패턴 7: 사고 과정 분리 (Scratchpad)

```python
prompt = """
<thinking>
먼저 이 문제를 분석해보겠습니다...
[여기서 자유롭게 생각]
</thinking>

<answer>
[최종 답변만 여기에]
</answer>

위 형식으로 다음 질문에 답해주세요:
"1000만 사용자를 지원하는 실시간 채팅 시스템을 어떻게 설계하시겠습니까?"
"""
```

---

## 패턴 8: 자기 검증 (Self-Check)

```python
prompt = """
다음 코드를 작성해주세요: [요구사항]

코드 작성 후, 스스로 다음 항목을 검토하세요:
- [ ] 모든 엣지 케이스 처리됨?
- [ ] 에러 처리 포함됨?
- [ ] 타입 힌트 있음?
- [ ] 시간/공간 복잡도 적절함?

문제가 있으면 수정 후 최종 코드를 제출하세요.
"""
```

---

## 패턴 9: 프롬프트 캐싱 (비용 절감)

```python
# Anthropic의 prompt caching으로 반복 컨텍스트 비용 90% 절감
response = client.messages.create(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    system=[
        {
            "type": "text",
            "text": long_context,  # 반복되는 긴 문서
            "cache_control": {"type": "ephemeral"}  # 캐시 설정
        }
    ],
    messages=[{"role": "user", "content": user_question}]
)
```

---

## 패턴 10: 점진적 상세화

한번에 완성된 결과를 요청하지 말고, 단계적으로 요청합니다.

```python
# 1단계: 큰 구조 잡기
step1 = "사용자 인증 시스템의 전체 아키텍처를 간략히 설명해주세요."

# 2단계: 특정 부분 상세화
step2 = "위 아키텍처에서 JWT 토큰 검증 부분을 코드로 구현해주세요."

# 3단계: 엣지 케이스 추가
step3 = "토큰 만료, 블랙리스트 처리도 추가해주세요."
```

복잡한 작업일수록 한 번의 긴 프롬프트보다 여러 번의 짧은 프롬프트가 품질이 좋습니다.
