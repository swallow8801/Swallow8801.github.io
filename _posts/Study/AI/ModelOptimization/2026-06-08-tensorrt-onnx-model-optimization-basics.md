---
layout: post
title: "TensorRT와 ONNX로 추론 모델 가볍게 만들기: 변환부터 정밀도 최적화까지"
date: 2026-06-08
series: "Study"
category: "AI"
subcategory: "ModelOptimization"
tags: [tensorrt, onnx, quantization, inference-optimization]
description: "실운영 AI 추론 서버에서 모델을 가볍고 빠르게 만들기 위해 ONNX로 변환하고 TensorRT로 최적화하는 과정과, 정밀도를 낮출 때 함께 따라오는 트레이드오프를 정리합니다."
image: https://images.unsplash.com/photo-1603732551681-2e91159b9dc2?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

학습 단계에서는 정확도가 거의 유일한 기준입니다. 그런데 운영 단계로 넘어가면 질문이 바뀝니다. "이 모델이 한 장을 처리하는 데 몇 ms가 걸리는가", "GPU 메모리에 모델을 몇 개나 동시에 올릴 수 있는가" 같은, 정확도 못지않게 무게와 속도가 중요한 질문들이 끼어듭니다. 학습 프레임워크에서 막 뽑아낸 모델을 그대로 운영에 올리면 이런 질문들 앞에서 자주 막힙니다.

이 글은 ONNX로 모델을 변환하고 TensorRT로 최적화하는 과정이 실제로 무엇을 바꾸는지, 그리고 그 과정에서 정밀도를 낮출 때 함께 따라오는 트레이드오프를 정리합니다.

---

## 학습 프레임워크 그대로 운영에 올리기 어려운 이유

PyTorch 같은 학습 프레임워크는 "다양한 모델 구조를 빠르게 실험하는 것"에 최적화되어 있습니다. 반대로 운영 환경에서 필요한 것은 "정해진 모델 구조를 최대한 빠르고 가볍게 반복 실행하는 것"입니다. 이 둘은 우선순위가 다르기 때문에, 학습 때 쓰던 형태를 그대로 서비스에 올리면 다음과 같은 비효율이 그대로 남습니다.

- 연산 그래프가 실험 편의를 위해 구성되어 있어, 실행 시점에 합칠 수 있는 연산들이 따로따로 실행됩니다.
- 모델 가중치가 32비트 부동소수점(FP32)으로 저장되어 있어, 메모리도 연산량도 필요 이상으로 큽니다.
- 특정 하드웨어(GPU 세대·아키텍처)에 맞춘 실행 경로가 아니라 범용 경로로 동작합니다.

ONNX와 TensorRT는 이 문제를 각각 다른 층위에서 풀어 줍니다.

---

## ONNX: 프레임워크 사이를 잇는 표준 규격

ONNX(Open Neural Network Exchange)는 "어떤 프레임워크로 학습했든 같은 형식으로 모델을 표현하자"는 표준 규격입니다. PyTorch로 학습한 모델을 ONNX로 변환해 두면, 그다음 단계(최적화·배포 도구)는 PyTorch를 몰라도 ONNX 형식만 이해하면 됩니다.

```python
import torch

model.eval()
dummy_input = torch.randn(1, 3, 640, 640)

torch.onnx.export(
    model, dummy_input, "model.onnx",
    input_names=["images"], output_names=["output"],
    opset_version=17,
    dynamic_axes={"images": {0: "batch"}, "output": {0: "batch"}},
)
```

여기서 자주 막히는 부분은 변환 자체보다 **변환 후 검증**입니다. 변환 과정에서 일부 연산이 ONNX가 지원하는 형태로 정확히 매핑되지 않으면, 변환은 성공해도 결과값이 원본 모델과 미묘하게 달라질 수 있습니다. 같은 입력을 원본 모델과 변환된 모델에 동시에 넣어 출력을 비교하는 검증 단계를 건너뛰지 않는 편이 안전합니다.

---

## TensorRT: 하드웨어에 맞춰 한 번 더 깎아내기

ONNX가 "형식을 통일하는" 단계라면, TensorRT는 "그 모델을 특정 GPU에서 최대한 빠르게 돌도록 다시 빌드하는" 단계입니다. 변환이라기보다 **컴파일**에 가깝습니다. 빌드 과정에서 TensorRT는 다음과 같은 일을 자동으로 수행합니다.

```python
import tensorrt as trt

logger = trt.Logger(trt.Logger.WARNING)
builder = trt.Builder(logger)
network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
parser = trt.OnnxParser(network, logger)

with open("model.onnx", "rb") as f:
    parser.parse(f.read())

config = builder.create_builder_config()
config.set_flag(trt.BuilderFlag.FP16)   # 정밀도를 낮춰 빌드
engine = builder.build_serialized_network(network, config)
```

빌드 과정에서 연산을 합치고(layer fusion), 지금 GPU에서 가장 빠른 커널을 골라 두기 때문에 같은 모델이라도 "어떤 GPU에서 빌드했는가"에 따라 결과 엔진이 달라집니다. 즉 **TensorRT 엔진은 빌드한 하드웨어에 종속적**입니다. GPU를 교체하거나 운영 환경을 늘릴 때는 새 하드웨어에서 다시 빌드해야 한다는 점을 미리 계획에 넣어 둬야 합니다.

---

## 정밀도를 낮추는 만큼 따라오는 것

TensorRT에서 가장 큰 속도·메모리 이득은 보통 정밀도를 낮출 때 나옵니다. FP32 대신 FP16이나 INT8로 추론하면 메모리 사용량과 연산 시간이 함께 줄어듭니다. 다만 공짜는 아닙니다.

| 정밀도 | 특징 | 신경 쓸 점 |
| --- | --- | --- |
| FP32 | 학습 때와 동일한 정밀도, 가장 안전 | 가장 느리고 메모리도 가장 많이 씀 |
| FP16 | 대부분의 경우 정확도 손실이 거의 눈에 띄지 않음 | 일부 연산에서 수치 불안정 가능 |
| INT8 | 속도·메모리 이득이 가장 큼 | 보정(calibration) 데이터로 값의 분포를 미리 측정해야 함 |

특히 INT8은 "모델이 실제로 어떤 범위의 값을 다루는지"를 대표 데이터로 미리 측정해 두는 보정 과정이 필요합니다. 이 보정에 쓰는 데이터가 실제 운영 데이터의 분포와 다르면, 벤치마크에서는 빨라 보여도 실제 입력에서는 정확도가 눈에 띄게 떨어질 수 있습니다. 정밀도를 낮춘 뒤에는 반드시 같은 검증 데이터셋으로 변환 전후의 정확도 차이를 측정해 "이 정도 속도 이득에 이 정도 정확도 손실이면 받아들일 수 있는가"를 판단해야 합니다(`<측정값>` — 정밀도별 추론 속도·메모리 사용량·정확도 변화는 실제 모델·데이터로 측정).

---

## 정리

추론 모델을 가볍게 만드는 작업의 핵심은 (1) 학습 프레임워크와 운영 환경이 추구하는 목표가 다르다는 점을 이해하고, (2) ONNX로 프레임워크 의존성을 걷어낸 뒤 TensorRT로 특정 하드웨어에 맞춰 한 번 더 최적화하며, (3) 정밀도를 낮출수록 속도와 메모리는 좋아지지만 정확도 손실 가능성도 함께 커진다는 트레이드오프를 같은 검증 데이터로 직접 확인하는 데 있습니다. "얼마나 빨라졌는가"와 "얼마나 정확도를 잃었는가"는 항상 같은 기준으로 함께 측정하세요.

---

## 이미지 출처

사진: Sahand Babali / Unsplash (Unsplash License) — https://unsplash.com/photos/blue-and-black-circuit-board-owjrvbyXYyc
