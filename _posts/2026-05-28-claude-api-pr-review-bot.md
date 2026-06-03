---
layout: post
title: "Claude API로 GitHub PR 자동 리뷰 봇 만들기"
date: 2026-05-28
series: "Study"
category: "AI·LLM"
tags: [claude-api, tool-use, github-actions, fastapi]
description: "Tool Use와 GitHub Actions를 연결해 PR이 열리면 자동으로 코드 리뷰가 달리는 시스템을 구축했습니다. 팀 컨벤션을 학습시키는 방법까지."
pinned: false
read_time: 12
---

## 만들게 된 이유

코드 리뷰는 중요하지만 시간이 많이 걸립니다. 특히 반복적인 스타일 이슈(변수명, 함수 길이, 에러 처리 누락 등)는 자동화하면 팀 리뷰어의 시간을 아낄 수 있습니다.

Claude API의 **Tool Use** 기능을 활용하면 PR의 diff를 분석하고, GitHub API를 호출해 리뷰 코멘트를 달 수 있습니다.

---

## 아키텍처

```
GitHub PR 생성
    ↓
GitHub Actions (webhook trigger)
    ↓
FastAPI 서버 (리뷰 봇)
    ↓
Claude API (Tool Use로 GitHub API 호출)
    ↓
PR에 자동 코멘트 게시
```

---

## 1. Tool 정의

Claude에게 GitHub API를 도구로 제공합니다.

```python
tools = [
    {
        "name": "get_pr_diff",
        "description": "PR의 변경된 파일과 diff를 가져옵니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "pr_number": {"type": "integer"},
                "repo": {"type": "string"}
            },
            "required": ["pr_number", "repo"]
        }
    },
    {
        "name": "post_review_comment",
        "description": "PR의 특정 라인에 리뷰 코멘트를 달아줍니다.",
        "input_schema": {
            "type": "object",
            "properties": {
                "body": {"type": "string", "description": "코멘트 내용"},
                "path": {"type": "string", "description": "파일 경로"},
                "line": {"type": "integer", "description": "라인 번호"}
            },
            "required": ["body", "path", "line"]
        }
    }
]
```

---

## 2. 리뷰 실행

```python
import anthropic

client = anthropic.Anthropic()

def run_pr_review(pr_number: int, repo: str) -> None:
    system_prompt = """당신은 시니어 개발자입니다. PR diff를 분석하고
    다음 항목을 중심으로 리뷰하세요:
    1. 버그 가능성이 있는 코드
    2. 에러 처리 누락
    3. 성능 문제
    4. 팀 컨벤션 위반
    명확한 문제가 있을 때만 코멘트를 달고, 사소한 스타일은 무시하세요."""

    messages = [{
        "role": "user",
        "content": f"PR #{pr_number} ({repo})를 리뷰해주세요."
    }]

    # Tool Use 루프
    while True:
        response = client.messages.create(
            model="claude-opus-4-8",
            max_tokens=4096,
            system=system_prompt,
            tools=tools,
            messages=messages
        )

        if response.stop_reason == "end_turn":
            break

        # Tool 호출 처리
        tool_results = []
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result
                })

        messages.append({"role": "assistant", "content": response.content})
        messages.append({"role": "user", "content": tool_results})
```

---

## 3. GitHub Actions 연동

`.github/workflows/pr-review.yml`:

```yaml
name: AI Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review Bot
        run: |
          curl -X POST ${{ secrets.REVIEW_BOT_URL }}/review \
            -H "Authorization: Bearer ${{ secrets.BOT_TOKEN }}" \
            -d '{"pr_number": ${{ github.event.number }}, "repo": "${{ github.repository }}"}'
```

---

## 팀 컨벤션 학습

매번 같은 지적을 받지 않도록, 팀 컨벤션 문서를 시스템 프롬프트에 포함했습니다.

```python
with open("CONTRIBUTING.md") as f:
    conventions = f.read()

system_prompt = f"""
{base_system_prompt}

## 우리 팀 컨벤션
{conventions}
"""
```

컨벤션 문서가 길어지면 RAG로 관련 부분만 추출하는 방식으로 확장할 수 있습니다.

---

## 결과

- PR 당 평균 리뷰 시간: 45분 → 20분 단축
- 반복적 스타일 코멘트: 주 평균 12개 → 2개로 감소
- 팀 만족도: "사소한 것 지적 안 해서 좋다"는 피드백 다수
