---
layout: post
title: "YOLO와 VLM, 한 모델 서버에서 여러 카메라를 동시에 추론할 수 있을까"
date: 2026-06-10
series: "Study"
category: "AI"
subcategory: "MultiCamInference"
tags: [yolo, vlm, multicam, inference, cctv, batching]
description: "단일 YOLO/VLM 모델 서버에 여러 CCTV 카메라를 연결해 동시 추론하는 구조의 가능성과 한계를 고찰합니다."
image: https://images.unsplash.com/photo-1643123182527-3bd30840e7ed?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

카메라 10대를 관제하는 시스템을 만든다고 생각해 봅시다. GPU 서버를 10대 두기는 부담스럽습니다. "모델 하나에 여러 카메라를 물릴 수 없을까?" 라는 질문이 자연스럽게 나옵니다.

YOLO 계열 객체탐지 모델과 VLM(Visual Language Model), 두 유형은 이 질문에 대한 답이 꽤 다릅니다. 각각의 구조적 특성과 실운영에서의 한계를 정리합니다.

---

## YOLO: 배치 추론으로 가능하다

YOLO는 고정 해상도 이미지를 입력받아 단일 forward pass로 결과를 냅니다. GPU 상에서 배치 처리를 지원하기 때문에, 여러 카메라의 프레임을 하나의 배치로 묶어 한번에 추론할 수 있습니다.

```python
import torch

# 카메라 N대의 프레임을 배치로 묶기
frames = [cam1_frame, cam2_frame, cam3_frame]  # 각 (H, W, C) numpy array
batch = torch.stack([preprocess(f) for f in frames])  # (N, C, H, W)

with torch.inference_mode():
    results = model(batch)  # N개의 결과를 한번에
```

### 실제 가능한 카메라 수는?

배치 크기가 커질수록 GPU 메모리를 더 많이 씁니다. 단순 계산식은 이렇습니다.

```
단일 이미지 추론 메모리 ≈ 입력 텐서 + 중간 활성화 + 출력
배치 N일 때          ≈ 단일 × N (중간 활성화가 N배 늘어남)
```

YOLOv8n 기준 640×640 해상도에서 배치 크기를 늘려가며 측정하면 특정 GPU에서 동시에 처리 가능한 카메라 수를 구할 수 있습니다 — `<측정값>` (GPU 모델·VRAM 크기에 따라 직접 측정 필요).

### 레이턴시 트레이드오프

배치 추론은 처리량(throughput)은 늘어나지만 레이턴시가 늘어납니다. 배치를 채울 때까지 기다려야 하기 때문입니다.

```
단일 추론 레이턴시:    ~<측정값>ms
배치 8 추론 레이턴시:  ~<측정값>ms  (처리량은 더 높음)
```

실시간 관제에서 이벤트 즉시 반응이 중요하다면, 배치 대기 시간에 상한을 두는 **time-bounded batching**을 씁니다 — 최대 N ms 안에 배치를 끊고 추론합니다.

```python
import asyncio

async def batch_worker(queue: asyncio.Queue, model, max_wait_ms=50):
    while True:
        batch, callbacks = [], []
        deadline = asyncio.get_event_loop().time() + max_wait_ms / 1000

        while len(batch) < MAX_BATCH_SIZE:
            timeout = deadline - asyncio.get_event_loop().time()
            if timeout <= 0:
                break
            try:
                frame, cb = await asyncio.wait_for(queue.get(), timeout=timeout)
                batch.append(frame)
                callbacks.append(cb)
            except asyncio.TimeoutError:
                break

        if batch:
            results = model(torch.stack(batch))
            for cb, r in zip(callbacks, results):
                cb(r)
```

---

## VLM: 구조적 한계가 있다

VLM(LLaVA, Qwen-VL, LLaMA 3.2 Vision 등)은 이미지를 토큰 시퀀스로 변환한 뒤, LLM의 자기회귀 생성(autoregressive generation)으로 응답을 만듭니다. 이 구조에서 멀티카메라 동시 추론은 몇 가지 이유로 훨씬 어렵습니다.

**1) 메모리 요구량이 크다**  
7B 파라미터 VLM은 FP16 기준으로 약 14 GB를 차지합니다. 이미지 토큰과 KV 캐시까지 더하면 단일 이미지 추론에도 메모리가 빠듯합니다.

**2) 생성 속도가 느리다**  
토큰을 하나씩 생성하는 구조라 응답 하나를 만드는 데 수백 ms ~ 수 초가 걸립니다. 10개 카메라를 순차 처리하면 총 레이턴시가 수십 초로 늘어납니다.

**3) 배치 추론의 효율 저하**  
VLM도 배치를 지원하지만, 응답 길이가 달라 패딩이 많아지고 효율이 떨어집니다. 실시간으로 흘러들어오는 다채널 스트림에 배치를 맞추기가 YOLO보다 훨씬 복잡합니다.

---

## 현실적인 아키텍처 패턴

두 모델의 특성을 조합한 패턴이 실용적입니다.

```
CCTV 카메라 N대
       │
       ▼
[YOLO 배치 추론]  ← 가볍고 빠름, 모든 프레임 처리
       │
  이벤트 감지 (침입·쓰러짐·화재 등)
       │
       ▼
[이벤트 큐]  ← 이벤트 발생 시에만 VLM 호출
       │
       ▼
[VLM 추론]  ← 상황 설명, 법령 위반 판단 등 고비용 분석
```

YOLO로 모든 카메라를 실시간 감시하고, 이벤트가 감지된 프레임만 VLM에게 넘기는 구조입니다. VLM 호출 빈도를 크게 줄여 실용적인 레이턴시를 얻을 수 있습니다.

---

## 정리

- **YOLO**: 배치 추론으로 여러 카메라 동시 처리 가능. GPU 메모리와 레이턴시 상한을 기준으로 배치 크기를 결정한다. Time-bounded batching으로 최악 레이턴시를 제어한다.
- **VLM**: 단독으로 멀티카메라 실시간 추론은 현실적으로 어렵다. YOLO의 이벤트 필터를 거친 뒤 선택적으로 호출하는 패턴이 효과적이다.
- 핵심은 "VLM을 매 프레임 호출하지 않는 것"이다. 이벤트 필터가 없으면 GPU가 아무리 강해도 실시간을 맞추기 어렵다.

---

## 이미지 출처

사진: Possessed Photography / Unsplash (Unsplash License) — https://unsplash.com/photos/ujSsIk5iZmA
