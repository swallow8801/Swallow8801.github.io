---
layout: post
title: "AI 추론 서비스를 Docker로 컨테이너화하기: 멀티스테이지 빌드와 GPU 런타임"
date: 2026-03-03
series: "Study"
category: "DevOps"
subcategory: "Docker"
tags: [docker, multi-stage, gpu, deploy]
description: "AI 추론 서버를 Docker로 패키징할 때 멀티스테이지 빌드로 이미지 용량을 줄이고 GPU 런타임을 안정적으로 잡는 방법을 정리합니다."
image: https://images.unsplash.com/photo-1465844880937-7c02addc633b?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

AI 추론 서버를 컨테이너로 배포할 때 가장 먼저 부딪히는 문제는 두 가지입니다. 하나는 이미지가 너무 커진다는 것이고, 다른 하나는 컨테이너 안에서 GPU가 잡히지 않는다는 것입니다.

PyTorch·CUDA·각종 빌드 도구를 한 이미지에 다 넣으면 수 GB가 금방 넘어갑니다. 배포할 때마다 이 큰 이미지를 올리고 내리는 비용이 쌓이고, 현장 Edge PC처럼 디스크가 빠듯한 환경에서는 더 부담입니다. 이 글에서는 멀티스테이지 빌드로 이미지를 줄이고, GPU 런타임을 안정적으로 잡는 구성을 정리합니다. (구체 용량·시간 수치는 환경마다 다르므로 `<측정값>`으로 두었습니다 — 직접 측정해 채워 넣으세요.)

---

## 멀티스테이지 빌드로 이미지 줄이기

핵심은 **빌드에만 필요한 것**과 **실행에 필요한 것**을 분리하는 것입니다. 컴파일러, 빌드 의존성, 캐시는 최종 이미지에 들어갈 필요가 없습니다.

```dockerfile
# 1) builder: 의존성 설치/컴파일만 담당
FROM python:3.11-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# 2) runtime: 실행에 필요한 것만 복사
FROM python:3.11-slim AS runtime
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

builder 단계에서 받은 패키지를 runtime 단계로 `COPY --from`만 하면, 빌드 캐시·도구가 빠진 가벼운 이미지가 남습니다. 적용 전후 이미지 용량은 `docker images`로 비교해 기록해 두면 좋습니다(전: `<측정값>` → 후: `<측정값>`).

---

## GPU 런타임 잡기

GPU 추론이면 base 이미지를 CUDA 런타임 이미지로 바꿔야 합니다. 학습용 `devel` 태그가 아니라 **`runtime` 태그**면 충분한 경우가 많습니다.

```dockerfile
FROM nvidia/cuda:12.4.1-runtime-ubuntu22.04
# torch는 CUDA 버전에 맞는 휠로 설치
```

실행 시에는 NVIDIA Container Toolkit이 깔린 호스트에서 `--gpus` 옵션을 줍니다.

```bash
docker run --gpus all -p 8000:8000 my-inference:latest
# 컨테이너 안에서 GPU 인식 확인
docker exec -it <id> python -c "import torch; print(torch.cuda.is_available())"
```

호스트 드라이버 버전, 이미지의 CUDA 버전, torch 빌드 버전 **세 가지가 호환**되어야 합니다. 하나라도 어긋나면 `cuda.is_available()`이 조용히 False가 되므로, 이 체크를 헬스체크에 포함해 두는 편이 안전합니다.

---

## 모델 가중치와 레이어 캐시

큰 모델 가중치를 이미지 안에 굽지 마세요. 이미지가 무거워지고, 모델만 바꿔도 전체를 다시 빌드·배포해야 합니다. 가중치는 **볼륨 마운트**나 **기동 시 다운로드**로 분리하고, `requirements`는 소스보다 먼저 COPY해 레이어 캐시를 살립니다.

```dockerfile
COPY requirements.txt .      # 자주 안 바뀜 → 캐시 적중
RUN pip install ...
COPY app/ ./app/             # 자주 바뀜 → 뒤에
```

`.dockerignore`로 `.git`, 데이터셋, 로컬 가중치, `__pycache__`를 제외하면 빌드 컨텍스트도 가벼워집니다.

---

## 정리

멀티스테이지 빌드로 빌드/런타임을 분리하고, CUDA `runtime` base + `--gpus` + 호환성 체크로 GPU를 잡고, 모델 가중치는 이미지 밖으로 빼는 것이 기본 골격입니다. 적용 후 이미지 용량·기동 시간·추론 latency를 측정해 표로 남겨 두면 다음 최적화의 기준선이 됩니다.

---

## 이미지 출처

사진: Erwan Hesry / Unsplash (Unsplash License) — https://unsplash.com/photos/several-cargo-containers-RJjY5Hpnifk
