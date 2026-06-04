---
layout: post
title: "FastAPI ML 모델 프로덕션 서빙 — 레이턴시 최적화 가이드"
date: 2026-05-08
series: "Study"
category: "Backend"
subcategory: "FastAPI"
tags: [fastapi, python, ml-serving, async, optimization, docker]
description: "모델 웜업·배치 처리·비동기 큐·A/B 테스트까지. 실제 운영에서 찾아낸 레이턴시 단축 노하우를 정리했습니다."
pinned: false
read_time: 14
---

## 시작 전 상황

FastAPI로 텍스트 분류 모델을 서빙하고 있었는데, p99 레이턴시가 2.3초였습니다. 사용자 경험상 허용 가능한 수준은 500ms였습니다. 어떻게 1/5로 줄였는지 정리합니다.

---

## 1. 모델 웜업 (Cold Start 제거)

가장 먼저 확인할 것은 Cold Start입니다. FastAPI 앱이 첫 요청을 받을 때 모델을 로드하면 그 요청이 몇 초씩 걸립니다.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import torch

model = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    # 앱 시작 시 모델 로드
    model = torch.load("model.pt")
    model.eval()

    # 더미 입력으로 JIT 웜업
    dummy = torch.zeros(1, 512)
    with torch.no_grad():
        for _ in range(3):
            model(dummy)

    print("Model warmed up")
    yield
    # 앱 종료 시 정리
    del model

app = FastAPI(lifespan=lifespan)
```

---

## 2. 배치 처리로 처리량 극대화

요청을 하나씩 처리하는 대신, 일정 시간 동안 요청을 모아서 한번에 처리합니다.

```python
import asyncio
from dataclasses import dataclass
from typing import List

@dataclass
class InferenceRequest:
    text: str
    future: asyncio.Future

class BatchProcessor:
    def __init__(self, max_batch_size: int = 32, max_wait_ms: float = 10):
        self.queue: List[InferenceRequest] = []
        self.max_batch_size = max_batch_size
        self.max_wait_ms = max_wait_ms
        self.lock = asyncio.Lock()

    async def add_request(self, text: str) -> str:
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        req = InferenceRequest(text=text, future=future)

        async with self.lock:
            self.queue.append(req)
            if len(self.queue) >= self.max_batch_size:
                await self._process_batch()

        return await future

    async def _process_batch(self):
        if not self.queue:
            return
        batch = self.queue[:self.max_batch_size]
        self.queue = self.queue[self.max_batch_size:]

        texts = [r.text for r in batch]
        results = run_inference_batch(texts)  # 배치 추론

        for req, result in zip(batch, results):
            req.future.set_result(result)
```

---

## 3. 비동기 큐 + 워커 분리

CPU/GPU 집약적인 추론을 메인 이벤트 루프에서 분리합니다.

```python
from fastapi import FastAPI
from concurrent.futures import ProcessPoolExecutor
import asyncio

executor = ProcessPoolExecutor(max_workers=4)

@app.post("/predict")
async def predict(request: PredictRequest):
    loop = asyncio.get_event_loop()
    # CPU 집약 작업을 별도 프로세스에서 실행
    result = await loop.run_in_executor(
        executor,
        run_inference,
        request.text
    )
    return {"result": result}
```

---

## 4. 응답 캐싱

동일한 입력에 대한 반복 요청을 Redis로 캐싱합니다.

```python
import redis
import hashlib
import json

cache = redis.Redis(host="localhost", port=6379, db=0)
CACHE_TTL = 3600  # 1시간

def get_cache_key(text: str) -> str:
    return f"inference:{hashlib.md5(text.encode()).hexdigest()}"

@app.post("/predict")
async def predict(request: PredictRequest):
    cache_key = get_cache_key(request.text)

    # 캐시 확인
    cached = cache.get(cache_key)
    if cached:
        return json.loads(cached)

    result = await run_inference_async(request.text)

    # 캐시 저장
    cache.setex(cache_key, CACHE_TTL, json.dumps(result))
    return result
```

---

## 5. 최적화 결과

| 최적화 항목 | p50 레이턴시 | p99 레이턴시 |
|---|---|---|
| 기본 (최적화 전) | 850ms | 2,300ms |
| + 모델 웜업 | 420ms | 1,100ms |
| + 배치 처리 | 180ms | 380ms |
| + 프로세스 분리 | 140ms | 290ms |
| + Redis 캐싱 | **95ms** | **210ms** |

p99 기준 2,300ms → 210ms, **약 11배 개선**되었습니다.
