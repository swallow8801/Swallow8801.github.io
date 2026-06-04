---
layout: post
title: "현장 적용을 위한 VLM 모델 경량화 실험 메모"
date: 2026-06-02
series: "Study"
category: "AI"
subcategory: "Optimization"
tags: [vlm, lora, quantization, edge-ai]
description: "LoRA rank, FP16, INT8, 백본 교체를 기준으로 모델 용량과 추론 속도를 줄이는 방법을 정리합니다."
image: /assets/img/posts/model-optimization.svg
pinned: false
---

## 경량화 목표를 먼저 숫자로 정하기

모델 경량화는 "작게 만들기"가 아니라 운영 장비에서 필요한 속도와 메모리를 맞추는 작업입니다. Edge PC에서 CCTV 영상을 처리한다면 FPS, latency, GPU memory, 동시 스트림 수를 먼저 정해야 합니다.

예를 들어 4채널 실시간 분석이 목표라면 단일 이미지 추론 속도보다 배치 구성, 디코딩 비용, 후처리 비용까지 함께 봐야 합니다.

## 실험 축

| 실험 | 기대 효과 | 주의점 |
| --- | --- | --- |
| LoRA rank 감소 | 어댑터 용량 감소 | 표현력이 줄어 성능 하락 가능 |
| FP16 변환 | VRAM 사용량 감소 | 일부 연산에서 수치 안정성 확인 필요 |
| INT8 Quantization | 메모리와 속도 개선 | calibration 데이터 품질이 중요 |
| Backbone 교체 | 추론량 감소 | feature 품질 저하 여부 확인 |
| ONNX/TensorRT | 배포 최적화 | 변환 가능한 연산인지 사전 확인 |

## LoRA rank를 줄일 때 보는 지표

rank를 줄이면 어댑터 파라미터 수는 줄지만, 실제 운영 성능은 데이터 분포에 따라 달라집니다. 단순 정확도보다 불량 recall, 설명 품질, 오탐 케이스를 같이 비교해야 합니다.

실험표에는 rank, checkpoint size, VRAM peak, 평균 latency, p95 latency를 함께 남깁니다. 평균만 보면 실시간 시스템에서 순간 지연이 감춰질 수 있습니다.

## Edge AI 배포 관점

현장 장비는 GPU 메모리뿐 아니라 발열, 전원, 네트워크 상태도 영향을 줍니다. 모델 최적화와 함께 입력 해상도, 프레임 샘플링, ROI crop, 알람 조건을 같이 조정하면 더 큰 효과가 나는 경우가 많습니다.

가장 좋은 경량화는 모델 하나를 억지로 줄이는 것이 아니라 시스템 전체 계산량을 줄이는 것입니다.
