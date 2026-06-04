---
layout: post
title: "CCTV 기반 실시간 AI 관제 시스템 구조"
date: 2026-06-03
series: "Projects"
category: "Projects"
subcategory: "AI Control"
tags: [cctv, rtsp, yolo, alarm]
description: "RTSP 스트림 입력부터 AI 추론, 이벤트 저장, 실시간 알림까지의 관제 시스템 흐름을 정리합니다."
image: /assets/img/posts/cctv-ai-control.svg
pinned: false
---

## 전체 흐름

CCTV AI 관제는 단순히 모델을 붙이는 작업이 아닙니다. 영상 수집, 프레임 샘플링, AI 추론, 알람 조건, 이벤트 저장, 화면 표시가 하나의 흐름으로 이어져야 합니다.

기본 구조는 RTSP 스트림을 받아 디코딩하고, 필요한 프레임만 모델에 넣고, 결과를 이벤트로 변환한 뒤 웹 대시보드와 알림 시스템에 전달하는 방식입니다.

## 시스템 구성

| 영역 | 역할 |
| --- | --- |
| RTSP Client | 카메라 영상 수신 |
| Media Server | 스트림 중계와 재전송 |
| Inference Worker | YOLO, CLIP, VLM 등 모델 추론 |
| Alarm Logic | AND/OR 조건, ROI, threshold 처리 |
| Event API | 이벤트 저장과 조회 |
| Dashboard | 실시간 상태와 알람 확인 |

## 알람 로직 설계

YOLO 탐지 결과만으로 알람을 만들면 오탐이 많아질 수 있습니다. 예를 들어 화재 탐지는 불꽃처럼 보이는 조명, 용접 불꽃, 반사광을 구분해야 합니다.

이럴 때 YOLO 결과와 CLIP/VLM 결과를 결합한 hybrid alarm logic을 사용할 수 있습니다. 탐지 모델이 후보를 만들고, 멀티모달 모델이 상황 설명이나 재확인을 맡는 구조입니다.

## ROI와 Geofencing

침입 감지에서는 전체 화면보다 관심 영역이 중요합니다. ROI를 설정하면 사람이 지나가도 무시할 구역과 반드시 감지할 구역을 나눌 수 있습니다.

운영 UI에서는 ROI를 쉽게 그릴 수 있어야 하고, 알람 이벤트에는 어떤 ROI에서 발생했는지 같이 저장해야 합니다.
