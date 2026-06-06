---
layout: post
title: "추론 중 CUDA out of memory: 원인 추적과 해결 메모"
date: 2026-06-04
series: "DevNotes"
category: "Errors"
subcategory: "CUDA"
tags: [cuda, gpu, oom, pytorch]
description: "추론 서버에서 반복되는 CUDA out of memory 에러의 원인을 좁히고 해결한 과정을 정리합니다."
image: https://images.unsplash.com/photo-1555618565-9f2b0323a10d?auto=format&fit=crop&w=1200&q=80
pinned: true
---

## 상황

추론 서버를 띄워 두면 처음엔 잘 돌다가, 동시 요청이 몰리거나 몇 시간 지난 뒤 `RuntimeError: CUDA out of memory.` 가 터지는 경우가 있습니다. 메시지는 보통 이런 모양입니다.

```text
RuntimeError: CUDA out of memory. Tried to allocate 512.00 MiB
(GPU 0; 24.00 GiB total capacity; 22.6 GiB already allocated;
 120.00 MiB free; 23.1 GiB reserved in total by PyTorch)
```

핵심은 "GPU가 작아서"가 아니라 **피크 메모리 또는 누수**가 원인인 경우가 많다는 점입니다. 원인을 좁혀 가며 해결한 과정을 메모로 남깁니다.

---

## 먼저 확인한 것

지금 GPU 메모리를 누가, 얼마나 쓰고 있는지부터 봅니다.

```bash
nvidia-smi
watch -n 1 nvidia-smi   # 요청을 흘리며 메모리 곡선 관찰
```

여기서 두 가지를 구분합니다. (1) 평상시에도 메모리가 거의 꽉 차 있는지, (2) 요청이 들어올 때마다 **계단식으로 늘어나 안 내려오는지**. 후자라면 누수에 가깝고, 전자라면 모델·배치 자체가 가용 메모리에 비해 큰 것입니다.

---

## 원인 후보를 좁히기

### 1) 추론인데 그래디언트가 쌓이는 경우

가장 흔한 실수입니다. 추론 경로에서 autograd가 켜져 있으면 중간 텐서가 계속 메모리에 남습니다. 추론은 반드시 그래디언트를 끕니다.

```python
with torch.inference_mode():   # torch.no_grad() 보다 강한 보장
    out = model(x)
```

### 2) 응답에 GPU 텐서를 그대로 들고 있는 경우

로깅·후처리에서 GPU 텐서를 리스트에 계속 모으면 참조가 남아 해제되지 않습니다. 경계에서 CPU로 내리고 참조를 끊습니다.

```python
result = out.detach().to("cpu")
del out
```

### 3) 입력 크기가 들쭉날쭉할 때의 피크 메모리

배치 크기나 해상도가 요청마다 다르면, **가장 큰 입력**이 순간 피크 메모리를 정합니다. 평균이 아니라 최악의 입력을 기준으로 잡아야 합니다.

---

## 실제로 해결한 방법

여러 개를 같이 적용했습니다.

```python
# 1) 추론 모드 고정
with torch.inference_mode():
    out = model(x)

# 2) 입력 상한을 강제 — 너무 큰 요청은 자르거나 거절
#    (최대 배치/해상도를 고정해 피크 메모리를 예측 가능하게)

# 3) 동시 처리 수 제한 — 세마포어로 in-flight 요청 수를 묶음
```

조각화(fragmentation)로 "여유는 있는데 연속 공간이 없어" 실패하는 경우에는 PyTorch 할당자 옵션이 도움이 됩니다.

```bash
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

`torch.cuda.empty_cache()` 는 캐시된 미사용 블록을 돌려줄 뿐 진짜 부족을 해결하지 못합니다. 임시방편으로는 쓸 수 있어도 근본 대책은 **피크 메모리를 예측 가능하게 만드는 것**(입력 상한 + 동시성 제한)이었습니다.

---

## 메모

- OOM은 대개 "GPU가 작다"가 아니라 **피크 메모리 문제**다. 최악의 입력 기준으로 메모리를 잡는다.
- 추론 경로엔 `torch.inference_mode()` 를 반드시 건다. 이것만으로 해결되는 경우가 의외로 많다.
- `empty_cache()` 는 만능이 아니다. 누수·피크를 못 잡으면 잠시 미룰 뿐이다.
- 동시성 제한으로 in-flight 요청 수를 묶으면 피크가 예측 가능해진다.
- 단일 요청 최대 메모리와 안전한 동시 요청 수는 환경마다 다르므로 직접 측정해 상한을 정한다(`<측정값>` — GPU·모델별 측정 필요).

---

## 이미지 출처

사진: Christian Wiediger / Unsplash (Unsplash License) — https://unsplash.com/photos/a-close-up-of-a-graphics-card-on-a-table-TErYPw4o1KM
