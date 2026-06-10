---
layout: post
title: "고반사 금속 표면에서 Vision AI가 헤매는 이유: 이미지 전처리로 반사율 문제 다루기"
date: 2026-04-08
series: "Study"
category: "AI"
subcategory: "VisionAI"
tags: [vision-ai, image-preprocessing, clahe, reflection, industrial]
description: "반사율 높은 금속 표면 이미지에서 AI 모델이 왜 흔들리는지, CLAHE·Contrast Stretching 등 전처리 기법으로 어떻게 대응하는지 정리합니다."
image: https://images.unsplash.com/photo-1747257703654-f80f331fdca7?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

제조업 현장에서 Vision AI로 표면 불량을 검출할 때, 금속 부품을 다루는 라인에서 빠지지 않고 나오는 문제가 있습니다. 학습 데이터에서는 잘 잡아내던 스크래치나 찍힘이, 현장에서는 조명 각도에 따라 탐지율이 크게 달라집니다. 반사가 심한 날에는 불량이 밝은 빛 속에 묻혀버리고, 그늘진 각도에서는 정상 면이 불량처럼 보이기도 합니다.

이 글은 고반사(high-reflectance) 금속 표면 이미지에서 왜 모델이 흔들리는지를 먼저 이해하고, 전처리 단계에서 할 수 있는 대응을 정리합니다.

---

## 왜 반사율이 높으면 모델이 어려워하는가

CNN 기반 분류·탐지 모델은 픽셀 패턴의 **상대적인 명암 차이**를 학습합니다. 불량(스크래치, 눌림, 오염 등)은 대개 주변 정상 표면과의 명암 차이로 표현됩니다.

문제는 금속 표면의 반사가 이 명암 구조를 뒤흔든다는 점입니다.

```
조명 각도 변화 → 표면 반사 위치 변화
  → 스크래치 위에 하이라이트가 올라오면: 불량이 "밝은 정상"처럼 보임
  → 정상 표면에 스페큘러 하이라이트가 생기면: 정상이 "밝은 이상"처럼 보임
```

학습 데이터가 특정 조명 조건 아래서 찍혔다면, 모델은 그 조명 조건의 명암 패턴을 불량의 특징으로 학습합니다. 현장에서 조명 각도나 세기가 조금만 바뀌어도 픽셀 값 분포 자체가 달라지므로, 모델은 "본 적 없는 입력"처럼 처리합니다. 이것이 같은 불량 유형인데도 날씨·시간대·조명 교체 후에 탐지율이 요동치는 원인입니다.

---

## 전처리 접근 1: CLAHE로 국소 대비 끌어올리기

CLAHE(Contrast Limited Adaptive Histogram Equalization)는 이미지를 작은 타일로 나눈 뒤 각 타일 안에서 히스토그램 평탄화를 수행하는 기법입니다. 전역 히스토그램 평탄화와 달리, 하이라이트가 강한 영역과 그늘진 영역을 따로 처리하므로 반사 과포화(overexposure)가 주변으로 번지는 효과를 억제하면서도 어두운 영역의 디테일을 살릴 수 있습니다.

```python
import cv2
import numpy as np

def apply_clahe(image_bgr, clip_limit=2.0, tile_grid=(8, 8)):
    """
    BGR 이미지에 CLAHE를 적용한다.
    clip_limit: 대비 증폭 한계 (높을수록 강하게 적용, 노이즈도 증폭됨)
    tile_grid: 타일 크기. 이미지 해상도 대비 불량 크기에 맞게 조정.
    """
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid)
    l_eq = clahe.apply(l)

    lab_eq = cv2.merge([l_eq, a, b])
    return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)
```

BGR을 LAB 색공간으로 변환 후 L(밝기) 채널에만 CLAHE를 적용하는 것이 일반적입니다. 색조(A, B)는 건드리지 않으므로 색상 기반 불량(오염, 변색 등)도 보존됩니다.

`clip_limit`와 `tile_grid`는 현장 이미지를 직접 보면서 조정해야 합니다. 타일이 너무 크면 전역 평탄화와 다를 바 없고, 너무 작으면 노이즈가 증폭됩니다. 불량이 점 단위라면 타일을 작게, 긁힘처럼 선형이라면 좀 더 크게 잡는 것이 경험적 기준입니다(`<측정값>` — clip_limit/tile_grid 조합별 탐지율 변화).

---

## 전처리 접근 2: Contrast Stretching으로 다이나믹 레인지 정규화

CLAHE가 국소 대비를 끌어올리는 데 집중한다면, Contrast Stretching은 전체 이미지의 밝기 범위를 [0, 255]로 선형 확장합니다. 카메라 노출이 일정하지 않거나 배치 내 이미지마다 전체 밝기 레벨이 들쭉날쭉할 때 입력 분포를 통일시키는 역할을 합니다.

```python
def contrast_stretch(image_gray, low_pct=2, high_pct=98):
    """
    하위 low_pct%, 상위 high_pct% 픽셀을 기준으로 선형 스트레칭.
    극단적 하이라이트/그림자에 클리핑이 발생하는 트레이드오프가 있다.
    """
    low = np.percentile(image_gray, low_pct)
    high = np.percentile(image_gray, high_pct)
    stretched = np.clip((image_gray - low) / (high - low) * 255, 0, 255)
    return stretched.astype(np.uint8)
```

주의할 점: 하이라이트가 과포화된 영역(픽셀 값 255 포화)은 이 기법으로 살릴 수 없습니다. 이미 정보가 손실된 상태이기 때문입니다. 과포화 픽셀 비율이 높은 이미지는 별도 처리 경로를 두거나 데이터 수집 단계에서 조명·노출을 조정하는 것이 근본 해결에 가깝습니다.

---

## 전처리 접근 3: Retinex 계열로 조명 성분 분리

CLAHE나 Contrast Stretching이 통계적 보정이라면, Retinex 계열 기법은 "이미지 = 조명(illumination) × 반사율(reflectance)"이라는 물리적 모델을 기반으로 조명 성분을 추정해 제거하고 반사율만 남기려는 시도입니다.

```python
def single_scale_retinex(image, sigma=300):
    """
    SSR(Single Scale Retinex) 간단 구현.
    sigma: 조명 추정을 위한 가우시안 블러 커널 크기.
            클수록 넓은 범위의 조명 변화를 추정함.
    """
    image_float = image.astype(np.float32) + 1.0
    blur = cv2.GaussianBlur(image_float, (0, 0), sigma)
    log_retinex = np.log10(image_float) - np.log10(blur)
    result = cv2.normalize(log_retinex, None, 0, 255, cv2.NORM_MINMAX)
    return result.astype(np.uint8)
```

Multi-Scale Retinex(MSR)나 MSRCR이 실무에서 더 많이 쓰이지만, 처리 비용이 높아 실시간 추론 파이프라인에 넣으면 FPS에 영향을 줍니다. 오프라인 학습 데이터 전처리에는 시도해 볼 만하고, 실시간 전처리로 쓸 때는 처리 시간을 반드시 측정해야 합니다(`<측정값>` — CLAHE vs Retinex 전처리 시간 비교).

---

## 학습 데이터 전략: 전처리만큼 중요한 다양성 확보

전처리 기법이 반사 문제를 완화해 주지만, 모델이 조명 변화에 진짜 강건해지려면 **다양한 반사 조건의 데이터를 학습에 포함시키는 것**이 근본적으로 중요합니다.

- **조명 조건별 데이터 수집**: 현장에서 조명 각도·세기를 의도적으로 바꿔가며 촬영. 같은 불량 위치라도 조명에 따라 여러 버전을 확보.
- **Augmentation으로 반사 시뮬레이션**: RandomBrightness, RandomGamma, 또는 무작위 가우시안 하이라이트 오버레이를 학습 파이프라인에 추가. 실제 반사를 완벽히 모사할 수는 없지만 학습 분포를 넓히는 데 기여합니다.
- **Albumentations 활용**: `RandomShadow`, `RandomSunFlare`가 제조업 이미지에 바로 적용하기엔 과할 수 있으나, 커스텀 변환을 추가해 반사 노이즈를 시뮬레이션하는 기반으로 활용 가능합니다.

---

## 정리

고반사 금속 표면 문제의 핵심은 "조명이 모델이 학습한 픽셀 패턴을 바꿔버린다"는 것입니다. 전처리는 이 영향을 줄이는 완화책이지 근본 해결은 아닙니다. CLAHE는 국소 대비 복원에 가장 실용적이고, Contrast Stretching은 배치 간 밝기 분포 정규화에, Retinex는 이론적으로 강하지만 처리 비용이 있습니다. 어떤 기법이 특정 현장에 효과적인지는 실제 이미지로 A/B를 해봐야 알 수 있고, 탐지율과 처리 속도를 같이 측정하는 것이 기준입니다. 전처리에 더해 다양한 조명 조건의 데이터를 학습에 포함시키는 것이 장기적으로 모델을 강건하게 만드는 방법입니다.

---

## 이미지 출처

사진: Josip Ivanković (@piak) / Unsplash (Unsplash License) — https://unsplash.com/photos/reflective-metal-panels-reflect-light-from-a-building-AlNSozwvq4A
