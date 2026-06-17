---
layout: post
title: "Edge PC에서 AI 서버 자원 관리하기: GPU 사용량·메모리 가용량 지키기"
date: 2026-06-17
series: "Study"
category: "DevOps"
subcategory: "Resource"
tags: [edge, gpu, memory, resource]
description: "Edge PC처럼 자원이 빠듯한 장비에서 AI 서버를 돌릴 때 GPU 사용량·VRAM 가용량·프로세스를 점검하고 한계를 지키는 방법을 정리합니다."
image: https://cdn.simpleicons.org/nvidia/76B900
pinned: false
---

## 들어가며

클라우드 GPU 서버는 자원이 부족하면 인스턴스를 키우면 됩니다. 하지만 현장에 놓인 **Edge PC**는 다릅니다. GPU 한 장, 정해진 VRAM, 한정된 RAM·디스크가 전부이고, 그 위에서 추론 서버·전처리·스트리밍·로깅이 **동시에** 돌아갑니다. 자원을 더 살 수 없으니, "있는 자원을 넘기지 않게 지키는 것"이 운영의 핵심이 됩니다.

[nvidia-smi로 GPU 상태 읽는 법](/blog/)에서 지표를 어떻게 읽는지는 다뤘으니, 이 글은 한 걸음 더 나가서 **Edge처럼 빠듯한 장비에서 자원을 어떻게 점검하고, 한계를 어떻게 강제할지**를 정리합니다. 수치는 장비마다 다르므로 비워 두고(`<측정값>`) 방법 위주로 적습니다.

---

## 무엇을 지켜봐야 하나: 4개의 자원

Edge에서 터지는 사고는 거의 이 넷 중 하나입니다.

| 자원 | 넘치면 생기는 일 | 빠른 확인 |
|------|-----------------|-----------|
| **VRAM(GPU 메모리)** | CUDA OOM, 프로세스 강제 종료 | `nvidia-smi --query-gpu=memory.used,memory.free` |
| **GPU 연산** | 추론 지연·FPS 하락 | `nvidia-smi -q -d UTILIZATION` |
| **시스템 RAM** | OOM killer가 프로세스 종료 | `free -h`, `top` |
| **디스크** | 로그·영상 적재로 가득 차 기록 실패 | `df -h`, `du -sh` |

가장 자주, 그리고 가장 조용히 터지는 건 **VRAM**입니다. 시스템 RAM과 달리 VRAM은 스왑이 없어서, 한 줄 넘기는 순간 추론이 [CUDA out of memory](/blog/)로 즉사합니다. 그래서 Edge 자원 관리의 절반은 "VRAM 예산을 세우고 그 안에 모델들을 욱여넣는 일"이라고 봐도 됩니다.

---

## VRAM 예산 세우기

Edge PC의 VRAM은 고정값입니다(예: 8GB, 16GB). 여기에 들어가는 것을 빼는 식으로 예산을 짭니다.

```
총 VRAM
  − 모델 가중치(모델 수 × 각 모델 크기)
  − 추론 중 활성 메모리(배치·해상도·중간 텐서)
  − 프레임워크/컨텍스트 오버헤드(CUDA context 등)
  − 안전 여유(스파이크 대비)
= 남는 여유
```

핵심은 **가중치 크기만 보면 안 된다**는 점입니다. 실제로는 입력 해상도와 배치 크기에 따라 추론 중 활성 메모리가 크게 출렁입니다. FHD 한 장과 4K 한 장은 같은 모델이라도 중간 텐서 메모리가 다릅니다. 그래서 예산은 "**최대 부하 시점**(모든 카메라가 동시에 프레임을 밀어 넣는 순간)"을 기준으로 잡아야 합니다(실제 모델별 점유는 장비에서 측정해야 하므로 `<측정값>`).

여유를 확보하는 정공법은 모델 쪽입니다. FP16·INT8 양자화로 가중치와 활성 메모리를 줄이거나([INT8 양자화 글](/blog/) 참고), 한 모델로 여러 클래스를 처리해 모델 개수 자체를 줄이는 식입니다.

---

## 한계를 "강제"하기

점검만으로는 부족합니다. 사람이 안 볼 때 넘치는 게 사고이므로, **자동으로 한계를 거는 장치**가 필요합니다.

### 1) GPU 메모리 상한 고정

프레임워크가 VRAM을 필요한 만큼 야금야금 늘려 잡으면, 여러 프로세스가 공존하는 Edge에서 충돌이 납니다. 프로세스별로 **상한을 못박는** 편이 안전합니다.

```python
# PyTorch: 이 프로세스가 쓸 VRAM 비율을 고정
import torch
torch.cuda.set_per_process_memory_fraction(0.5, device=0)  # 50%로 제한
```

```python
# TensorFlow: 메모리를 미리 다 잡지 않고 필요분만 점진 할당
import tensorflow as tf
for gpu in tf.config.list_physical_devices('GPU'):
    tf.config.experimental.set_memory_growth(gpu, True)
```

### 2) 컨테이너 레벨 자원 제한

추론을 컨테이너로 띄운다면, 시스템 RAM·CPU는 컨테이너 런타임에서 못박을 수 있습니다. 한 컨테이너가 폭주해 Edge 전체를 마비시키는 걸 막습니다.

```bash
docker run --gpus all \
  --memory=4g --memory-swap=4g \   # 시스템 RAM 상한 (스왑까지 제한)
  --cpus=2.0 \                     # CPU 코어 상한
  inference-server:latest
```

GPU 자체를 여러 컨테이너가 나눠 쓰는 경우의 한계는 [멀티스트림 추론 컨테이너 글](/blog/)에서 다룬 주제와 이어집니다.

### 3) 워치독: 임계 초과 시 행동

마지막 방어선은 **주기적으로 자원을 보고 임계를 넘으면 무언가를 하는** 작은 감시자입니다. 알람을 쏘거나, 신규 요청을 거절하거나, 오래된 작업을 버리는 식입니다.

```bash
#!/usr/bin/env bash
# 1분마다 VRAM 사용률 점검 (개념용 예시)
USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)
TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits)
PCT=$(( USED * 100 / TOTAL ))
if [ "$PCT" -ge 90 ]; then
  logger "VRAM ${PCT}% — 임계 초과"
  # TODO: 알람 전송 / 신규 추론 일시 차단 등
fi
```

임계값(여기선 90%)은 장비·모델 스파이크 폭에 맞춰 정해야 합니다. 너무 빡빡하면 정상 변동에도 울리고, 너무 느슨하면 OOM 직전에야 알립니다(적정 임계는 `<측정값>` — 부하 테스트로 확인).

---

## 자원을 늘 보이게 두기

Edge는 화면을 자주 안 보는 장비라, **지표를 어딘가로 계속 흘려보내** 두는 게 중요합니다. 가장 가벼운 방법은 `nvidia-smi`의 CSV·반복 출력을 파일이나 수집기로 보내는 것입니다.

```bash
# 5초마다 핵심 지표를 CSV로 누적 (간이 로깅)
nvidia-smi --query-gpu=timestamp,utilization.gpu,memory.used,memory.free,temperature.gpu \
  --format=csv -l 5 >> /var/log/gpu_metrics.csv
```

규모가 커지면 이 값을 Prometheus 같은 수집기로 보내 시계열로 쌓고, 임계 초과를 알람으로 받는 구조로 발전시킵니다. 다만 Edge에서는 **수집기 자체도 자원을 먹는다**는 점을 잊으면 안 됩니다 — 관제 대상이 자원을 잡아먹어 본말이 전도되지 않도록, 수집 주기와 보관 기간을 보수적으로 잡습니다.

---

## 정리

Edge PC의 자원 관리는 "더 사면 되는" 문제가 아니라 **정해진 예산 안에서 지키는** 문제입니다. VRAM·GPU 연산·RAM·디스크 넷 중 VRAM이 가장 조용히 터지므로, 최대 부하 기준으로 VRAM 예산을 세우고, 양자화·모델 통합으로 여유를 만든 뒤, 프로세스 상한·컨테이너 제한·워치독으로 한계를 **강제**하는 순서가 안전합니다.

그리고 화면을 안 보는 장비인 만큼 지표를 늘 흘려보내 두는 게 사고를 줄입니다. 다음 단계로는 본인 장비에서 모델별 VRAM 점유와 최대 부하 시 스파이크를 실제로 측정해, 위 예산표와 임계값을 구체 숫자로 채워보는 것을 권합니다.

---

## 이미지 출처

로고: NVIDIA (Simple Icons)
