---
layout: post
title: "React에서 LLM 스트리밍 응답 처리 — SSE와 AbortController"
date: 2026-05-14
series: "Study"
category: "Frontend"
subcategory: "React"
tags: [react, sse, streaming, llm, abortcontroller, typescript]
description: "ChatGPT처럼 글자가 하나씩 출력되는 UI를 어떻게 구현하는지, 스트림 중단 처리와 에러 복구까지 실전 코드와 함께 설명합니다."
pinned: false
read_time: 10
---

## 스트리밍 UI가 필요한 이유

LLM API는 응답 생성에 수 초~수십 초가 걸립니다. 모든 응답을 받고 나서 한번에 보여주면 사용자 입장에서는 그 시간 동안 아무것도 없는 화면만 보게 됩니다.

스트리밍은 토큰이 생성되는 즉시 화면에 출력해서 체감 대기 시간을 크게 줄여줍니다. Claude, ChatGPT 모두 이 방식을 사용합니다.

---

## 1. 백엔드 — FastAPI SSE 스트리밍

먼저 서버에서 SSE(Server-Sent Events) 형식으로 응답을 스트리밍합니다.

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import anthropic

app = FastAPI()
client = anthropic.Anthropic()

async def stream_response(message: str):
    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": message}]
    ) as stream:
        for text in stream.text_stream:
            # SSE 형식: "data: {text}\n\n"
            yield f"data: {text}\n\n"
    yield "data: [DONE]\n\n"

@app.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        stream_response(request.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )
```

---

## 2. 프론트엔드 — React 훅

```typescript
import { useState, useRef, useCallback } from 'react';

interface UseStreamingReturn {
  text: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (message: string) => Promise<void>;
  stopStream: () => void;
}

export function useStreaming(apiUrl: string): UseStreamingReturn {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async (message: string) => {
    // 이전 스트림 중단
    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setText('');
    setIsStreaming(true);
    setError(null);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('ReadableStream 미지원');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') return;
          setText(prev => prev + data);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // 사용자가 중단
      setError((err as Error).message);
    } finally {
      setIsStreaming(false);
    }
  }, [apiUrl]);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { text, isStreaming, error, startStream, stopStream };
}
```

---

## 3. 컴포넌트 사용

```tsx
function ChatUI() {
  const [input, setInput] = useState('');
  const { text, isStreaming, error, startStream, stopStream } = useStreaming('/api/chat');

  return (
    <div>
      <div className="response">
        {text}
        {isStreaming && <span className="cursor">|</span>}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="input-row">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !isStreaming && startStream(input)}
          placeholder="메시지를 입력하세요..."
        />
        {isStreaming
          ? <button onClick={stopStream}>중단</button>
          : <button onClick={() => startStream(input)}>전송</button>
        }
      </div>
    </div>
  );
}
```

---

## 4. 커서 깜빡이기 CSS

```css
.cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: currentColor;
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
```

---

## 주의사항

1. **CORS 설정**: SSE 스트리밍에서 CORS 헤더가 올바르지 않으면 연결이 즉시 끊깁니다.
2. **nginx 버퍼링**: `X-Accel-Buffering: no` 헤더를 반드시 설정해야 nginx가 SSE를 버퍼링하지 않습니다.
3. **React Strict Mode**: 개발 환경에서 훅이 두 번 실행되면서 중복 요청이 발생할 수 있습니다. `AbortController`로 이전 요청을 취소하는 로직이 필수입니다.
