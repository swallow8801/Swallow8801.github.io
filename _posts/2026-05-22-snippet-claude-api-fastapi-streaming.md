---
layout: post
title: "Claude API 스트리밍 응답 FastAPI 보일러플레이트"
date: 2026-05-22
series: "DevNotes"
category: "Snippets"
tags: [claude-api, fastapi, streaming, sse, python, snippet]
description: "Claude API SSE 스트리밍을 FastAPI에서 바로 쓸 수 있는 재사용 코드 조각. 복붙용."
pinned: false
read_time: 2
---

Claude API 스트리밍 + FastAPI SSE 응답을 매번 처음부터 작성하기 귀찮아서 정리합니다.

## 코드

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic

app = FastAPI()
client = anthropic.Anthropic()  # ANTHROPIC_API_KEY 환경변수 자동 사용

class ChatRequest(BaseModel):
    message: str
    system: str = "You are a helpful assistant."
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 2048

async def stream_claude(req: ChatRequest):
    """SSE 형식으로 Claude 응답 스트리밍"""
    with client.messages.stream(
        model=req.model,
        max_tokens=req.max_tokens,
        system=req.system,
        messages=[{"role": "user", "content": req.message}]
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {text}\n\n"
    yield "data: [DONE]\n\n"

@app.post("/chat")
async def chat(req: ChatRequest):
    return StreamingResponse(
        stream_claude(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # nginx 버퍼링 비활성화
        }
    )
```

## React에서 소비

```typescript
const response = await fetch('/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: userInput }),
});

const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value, { stream: true });
  for (const line of chunk.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const text = line.slice(6);
    if (text === '[DONE]') return;
    setOutput(prev => prev + text);
  }
}
```

## CORS 설정 추가 시

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)
```
