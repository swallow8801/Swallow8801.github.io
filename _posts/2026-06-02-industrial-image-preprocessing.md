---
layout: post
title: "산업 이미지 전처리: CLAHE, Retinex, Contrast Stretching"
date: 2026-06-02
series: "Study"
category: "AI"
subcategory: "Preprocessing"
tags: [clahe, retinex, augmentation, focal-loss]
description: "조명 변화와 명암 차이가 큰 산업 이미지에서 전처리와 증강을 어떻게 실험할지 정리합니다."
image: /assets/img/posts/image-preprocessing.svg
pinned: false
---

## 전처리는 성능 개선보다 분포 안정화가 목표

산업 이미지는 조명과 표면 상태에 따라 픽셀 분포가 크게 달라집니다. CLAHE, Contrast Stretching, Retinex 같은 기법은 모델이 결함 자체에 집중하도록 입력을 안정화하는 데 사용할 수 있습니다.

전처리는 무조건 넣는 기능이 아닙니다. 원본과 전처리본을 나란히 두고 결함 정보가 살아있는지 확인해야 합니다.

## 대표 기법 비교

| 기법 | 사용 목적 | 주의점 |
| --- | --- | --- |
| CLAHE | 국소 대비 향상 | 노이즈도 같이 강조될 수 있음 |
| Contrast Stretching | 전체 명암 범위 보정 | 과한 보정은 하이라이트 손실 가능 |
| Retinex | 조명 변화 완화 | 파라미터에 따라 색감이 크게 변함 |
| Gaussian Blur | 노이즈 완화, 비식별화 | 작은 결함이 사라질 수 있음 |
| Mosaic/MixUp | 일반화 강화 | 탐지 박스 품질과 함께 확인 필요 |

## 불균형 데이터와 Focal Loss

불량 이미지가 적으면 모델은 정상으로만 예측해도 높은 accuracy를 얻을 수 있습니다. 이때 Focal Loss는 어려운 샘플에 더 큰 가중치를 주는 방식으로 불균형 문제를 완화할 수 있습니다.

다만 loss만 바꿔서 해결하려고 하면 위험합니다. 샘플링 전략, class weight, hard negative mining, threshold 조정까지 함께 실험해야 합니다.

## 실험 기록 방식

전처리 실험은 원본 이미지, 전처리 이미지, 모델 예측 결과, Grad-CAM 또는 detection 결과를 한 화면에 묶어 비교하는 것이 좋습니다. 나중에 현장 담당자와 이야기할 때 숫자보다 사례 이미지가 더 빠르게 합의를 만듭니다.

## 전처리 파이프라인을 고정하기

전처리는 학습과 운영에서 완전히 같아야 합니다. 학습 때 CLAHE를 적용했는데 운영에서는 빠졌거나, 운영에서만 다른 normalize가 들어가면 성능이 흔들립니다. 전처리 코드는 실험 노트가 아니라 배포 코드의 일부로 관리해야 합니다.

가능하면 전처리 설정값도 모델 버전과 함께 저장합니다. CLAHE clip limit, tile size, Retinex scale, blur kernel size 같은 값이 바뀌면 사실상 입력 분포가 바뀐 것입니다.

## 과한 보정의 위험

전처리가 눈으로 보기 좋다고 모델에 항상 좋은 것은 아닙니다. 대비를 과하게 올리면 노이즈나 반사광이 결함처럼 강조될 수 있고, blur를 과하게 넣으면 작은 결함이 사라질 수 있습니다.

그래서 전처리 결과는 정상 이미지와 불량 이미지 양쪽에서 확인해야 합니다. 불량만 좋아 보이고 정상에서 오탐 후보를 늘리는 전처리는 운영에서 문제가 될 수 있습니다.

## Augmentation과 전처리 분리

전처리는 운영 입력에도 적용되는 변환이고, augmentation은 학습 중 일반화를 위해 임시로 적용되는 변환입니다. 둘을 섞어서 생각하면 실험 해석이 어려워집니다.

로그에는 preprocessing config와 augmentation config를 따로 남깁니다. 그래야 성능이 좋아졌을 때 운영에도 적용 가능한 개선인지, 학습 과정에서만 쓰는 개선인지 구분할 수 있습니다.
