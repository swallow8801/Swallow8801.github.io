---
layout: post
title: "FastAPI로 AI 추론 서버를 만들 때 남기는 운영 체크리스트"
date: 2026-06-04
series: "Study"
category: "Backend"
subcategory: "Serving"
tags: [fastapi, docker, gpu, logging]
description: "AI 모델 추론 API를 FastAPI로 운영할 때 포트, GPU 모니터링, 로그, Docker 구성을 정리합니다."
image: /assets/img/posts/fastapi-infra.svg
pinned: false
---

## 추론 서버의 책임

FastAPI 추론 서버는 모델을 호출하는 엔드포인트만 제공해서는 부족합니다. 모델 로딩, 입력 검증, 배치 처리, GPU 상태 확인, 에러 로그, 헬스체크까지 운영 관점의 책임을 가져야 합니다.

특히 CCTV나 제조 검사처럼 실시간성이 있는 시스템에서는 API 응답 시간과 큐 대기 시간을 분리해서 봐야 합니다.

## 기본 엔드포인트

| 엔드포인트 | 역할 |
| --- | --- |
| `/health` | 서버와 모델 로딩 상태 확인 |
| `/predict` | 단일 이미지 또는 프레임 추론 |
| `/batch-predict` | 여러 입력 배치 추론 |
| `/metrics` | latency, queue, GPU memory 지표 |
| `/reload` | 모델 교체 또는 threshold 갱신 |

## Docker와 GPU

컨테이너 환경에서는 CUDA 버전, 드라이버 버전, PyTorch 빌드 버전이 맞아야 합니다. 배포 전에 `nvidia-smi`와 간단한 torch CUDA 체크를 헬스체크에 포함하면 문제를 빨리 발견할 수 있습니다.

```bash
python -c "import torch; print(torch.cuda.is_available())"
```

## 로그 관리

AI 이벤트 로그에는 요청 시각, 모델 버전, threshold, 추론 결과, latency, 입력 메타데이터를 남깁니다. 장애 분석을 위해 원본 이미지를 항상 저장할 필요는 없지만, 오탐/미탐 분석용 샘플링 저장 정책은 필요합니다.

운영 로그와 학습 개선용 로그를 분리해두면 나중에 데이터셋을 다시 만들 때 훨씬 편합니다.
