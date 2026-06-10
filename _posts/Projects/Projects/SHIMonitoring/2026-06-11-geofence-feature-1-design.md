---
layout: post
title: "Geofence 기능구현 (1): 좌표계 문제와 아키텍처 설계"
date: 2026-06-11
series: "Projects"
category: "Projects"
subcategory: "SHIMonitoring"
tags: [geofence, architecture, turf, gis, cctv, system-design]
description: "사람 탐지는 이미 있는데 구역 기반 알림이 없다 — Geofence 기능을 설계하며 마주친 픽셀 좌표와 GPS 좌표의 단절 문제와 해결 방향을 정리합니다."
image: /assets/img/posts/geofence-feature-thumb.svg
pinned: false
---

## 들어가며

통합 모니터링 관제 시스템에는 이미 YOLO 기반 사람 탐지가 동작하고 있습니다. AI 추론 서버가 카메라 프레임을 분석해 `person`, `fire`, `fall` 같은 클래스를 탐지하고, 백엔드는 이 결과를 받아 알람을 띄우고 화면에 바운딩 박스를 그려줍니다.

이번에 추가하려는 기능은 한 단계 더 나아간 것입니다.

> "사용자가 화면에 구역(Zone)을 미리 그려두면, 그 구역 안에 사람이 들어왔을 때 시각적으로 표시하고 몇 명이 들어왔는지 실시간으로 보여준다."

흔히 **Geofence(지오펜스)** 라고 부르는 기능입니다. 말로는 단순한데, 실제로 설계에 들어가 보면 "탐지 결과와 구역 정의가 서로 다른 좌표계에 살고 있다"는 근본적인 문제를 만나게 됩니다. 이 글에서는 그 문제를 어떻게 풀었는지, 그리고 그 결정이 데이터 모델에 어떻게 반영되는지를 정리합니다.

이 기능은 분량이 많아 3편으로 나눴습니다.

- **(1) 설계** — 좌표계 문제 정의, 아키텍처 결정, 데이터 모델 (이 글)
- **(2) 백엔드** — Zone CRUD API, 인원 판정 로직, Socket.IO 실시간 브로드캐스트
- **(3) 프론트엔드** — 구역 그리기 UI, 실시간 오버레이, 화면 설계

---

## 기존 시스템이 이미 가지고 있는 것

새 기능을 설계할 때 가장 먼저 한 일은 "지금 시스템에 이미 있는 것"을 정리하는 것이었습니다. Geofence는 사실 완전히 새로운 데이터를 만드는 기능이 아니라, **이미 존재하는 두 종류의 데이터를 연결하는 기능**이기 때문입니다.

### ① AI 탐지 이벤트 — 픽셀 좌표 기반

AI 추론 서버는 카메라 프레임마다 탐지 결과를 `POST /api/ai/events`로 백엔드에 전송합니다. 페이로드는 대략 이런 모양입니다.

```json
{
  "alias": "CAM-03",
  "frame_ts": 1718000000000,
  "frame_size": [1920, 1080],
  "detections": [
    {
      "cls": "person",
      "conf": 0.93,
      "bbox": [612, 410, 96, 188],
      "track_id": 214
    },
    {
      "cls": "person",
      "conf": 0.89,
      "bbox": [840, 520, 88, 180],
      "track_id": 215
    }
  ],
  "sent_at": 1718000000123
}
```

여기서 중요한 두 가지를 짚고 넘어가야 합니다.

1. `bbox`는 `[x, y, w, h]` — **카메라 프레임 픽셀 좌표**입니다. `frame_size`도 함께 오기 때문에, 좌표를 `0~1` 사이로 정규화하는 건 어렵지 않습니다.
2. `person` 클래스는 `TARGET_CLASSES`에 이미 포함되어 있어서, 별도 모델 변경 없이 지금도 사람 탐지 결과가 들어오고 있습니다. 즉 **"사람이 어디 있는지"는 이미 알고 있습니다.**

이 데이터에는 위도·경도 같은 GPS 정보가 전혀 없습니다. 카메라가 "지금 보고 있는 화면 안에서" 사람이 어디 있는지만 알 수 있습니다.

### ② 기존 Zone과 위경도 기반 Geofencing

한편 시스템에는 이미 "구역"이라는 개념과, 그 구역에 대한 Geofencing 로직도 존재합니다. 다만 이건 **레이더 타겟**을 위한 것입니다.

레이더는 카메라와 달리 거리·방위각으로 타겟을 탐지하기 때문에, 카메라 GPS 좌표 + 거리/각도 계산으로 타겟의 위경도를 바로 구할 수 있습니다. 이렇게 구한 위경도 점이 사용자가 지도 위에 그려둔 폴리곤(`adia_area_map`) 안에 있는지를 [Turf.js](https://turfjs.org/)의 `booleanPointInPolygon`으로 판정하는 워커가 이미 돌고 있습니다.

```js
// 기존 레이더 워커의 흐름을 단순화한 의사코드
const point = turf.point([target.lng, target.lat]); // turf는 [lng, lat] 순서

for (const zone of forbiddenZones) {
  const polygon = turf.polygon([zone.points.map(p => [p.lng, p.lat])]);
  if (turf.booleanPointInPolygon(point, polygon)) {
    // 금지구역 진입 처리
  }
}
```

즉, **"폴리곤 안에 점이 있는가"를 판정하는 인프라(turf, 폴리곤 CRUD, 지도 위 폴리곤 그리기 UI)는 이미 한 번 만들어 본 경험이 있다**는 뜻입니다. Geofence 기능은 이 경험을 재사용하는 것이 목표지만, 입력으로 들어오는 "점"의 좌표계가 다릅니다.

---

## 핵심 문제: 두 좌표계의 단절

정리하면 이렇습니다.

```
[AI 탐지]  사람 위치 = 카메라 프레임 픽셀 좌표 (x, y) — 0 ~ frame_size 범위
[Zone]     기존 구역  = 위경도 좌표 (lat, lng) — 지도 좌표계
```

레이더처럼 "거리 + 방위각 → 위경도" 변환 공식이 있다면 좋겠지만, 카메라 영상에서 픽셀 좌표를 위경도로 바꾸려면 **호모그래피(Homography) 변환** 또는 **카메라 캘리브레이션**이 필요합니다. 카메라마다 지면 위 4개 이상의 기준점을 실측하고, 픽셀 좌표 ↔ 실세계 좌표 변환 행렬을 구해야 합니다.

이 작업 자체가 작지 않은 별도 프로젝트입니다. 카메라 설치 각도가 바뀌거나 줌 배율이 바뀌면 캘리브레이션을 다시 해야 하고, 광각 렌즈의 왜곡 보정까지 고려하면 정확도를 담보하기도 쉽지 않습니다.

그런데 한 걸음 물러나서 **이번에 요구된 기능이 진짜로 필요로 하는 것**이 무엇인지 다시 보면:

- "지도 위 정확한 GPS 좌표에 구역을 그리고 싶다" — (X, 이번 요구사항 아님)
- "**이 카메라가 보여주는 화면 안에서**, 사용자가 지정한 영역에 사람이 들어오면 알려달라" — (O, 실제 요구사항)

즉 우리에게 필요한 건 **카메라 화면이라는 닫힌 좌표계 안에서의 점-폴리곤 판정**이지, 지도 좌표계로의 변환이 아닙니다. 이 관찰이 설계 방향을 결정합니다.

---

## 설계 결정: 카메라-로컬 정규화 폴리곤

세 가지 방식을 놓고 비교했습니다.

| 방식 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 카메라-로컬 정규화 폴리곤** | 구역을 카메라 프레임 기준 `0~1` 좌표로 저장. person bbox도 같은 좌표계로 정규화해서 비교 | 기존 AI 파이프라인과 좌표계 일치, 변환 로직 불필요, 구현 난이도 낮음 | 카메라가 PTZ로 움직이면 zone 재설정 필요, 지도 위 통합 뷰 불가 |
| **B. Homography 변환 후 GIS 폴리곤** | 카메라 픽셀 → 위경도로 변환해 기존 `adia_area_map`과 통합 | 지도에서 모든 구역을 한 번에 조망 가능, 기존 레이더 인프라 재사용 | 카메라별 캘리브레이션 선행 필요, 구현·검증 비용 큼, 광각 왜곡 보정 별도 과제 |
| **C. 레이더 방식 그대로 차용** | person 탐지에도 거리/각도 기반 위경도 계산을 적용 | 코드 재사용 최대화 | 카메라는 거리·각도를 직접 측정하지 않음 — 적용 불가 |

C는 카메라 탐지가 거리 정보를 주지 않기 때문에 사실상 선택지가 아니었고, 남은 건 A와 B였습니다.

**최종 선택은 A, 카메라-로컬 정규화 폴리곤**입니다. 이유는 다음과 같습니다.

1. **기존 데이터와 좌표계가 같다.** AI 이벤트의 `bbox`와 `frame_size`만으로 정규화 좌표를 바로 구할 수 있습니다. 변환 단계가 추가되지 않으니 버그 표면적이 줄어듭니다.
2. **프론트엔드 오버레이 규약과도 일치한다.** 화면에 탐지 박스를 그릴 때도 `bbox / frame_size`로 정규화해 `%` 단위로 그리는 방식을 이미 쓰고 있습니다. Zone 폴리곤도 같은 방식으로 그리면 박스와 구역이 항상 같은 비율로 정렬됩니다.
3. **점진적으로 확장 가능하다.** 지금은 카메라별 닫힌 좌표계로 시작하고, 나중에 Homography 캘리브레이션이 준비되면 "카메라-로컬 폴리곤 → 위경도 변환"을 추가해 지도 통합 뷰로 확장할 수 있습니다. 즉 B를 나중에 A 위에 얹는 구조가 가능합니다.

물론 한계도 명확히 해두었습니다.

- **PTZ(Pan-Tilt-Zoom) 카메라**는 화면이 바뀌면 구역도 무의미해지므로, 이번 기능은 **고정(Fixed) 카메라**를 전제로 합니다.
- 같은 물리적 영역을 여러 카메라가 비추는 경우, 구역은 카메라마다 각각 정의해야 합니다. "지도에서 한 번 그리면 모든 카메라에 적용"은 이번 범위 밖입니다.

---

## 데이터 모델 설계

설계 방향이 정해지면 테이블 구조는 자연스럽게 따라옵니다. 기존 `adia_area_map`을 변형하기보다 **새 테이블을 분리**하기로 했습니다 — 위경도 폴리곤(레이더용)과 정규화 폴리곤(카메라용)은 의미가 다른 데이터라서, 같은 테이블에 욱여넣으면 나중에 조회 조건이 지저분해질 것이 뻔했기 때문입니다.

### `cctv_geofence_zone` — 구역 정의

```sql
CREATE TABLE cctv_geofence_zone (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    cctv_alias      VARCHAR(50)   NOT NULL,         -- 카메라 alias (예: CAM-03)
    zone_name       NVARCHAR(100) NOT NULL,         -- 사용자 정의 구역 이름
    polygon         NVARCHAR(MAX) NOT NULL,         -- JSON: [{"x":0~1,"y":0~1}, ...]
    color           VARCHAR(7)    NOT NULL DEFAULT '#f59e0b',
    target_classes  NVARCHAR(100) NOT NULL DEFAULT 'person',
    max_count       INT           NOT NULL DEFAULT 0,  -- 0 = 카운트만, 임계치 알람 없음
    enabled         BIT           NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME      NOT NULL DEFAULT GETDATE()
);

CREATE INDEX IX_cctv_geofence_zone_alias ON cctv_geofence_zone(cctv_alias, enabled);
```

`polygon` 컬럼은 정규화 좌표 배열을 JSON 문자열로 저장합니다. 예를 들어 1920×1080 프레임에서 `(384, 270)` 지점은 `{"x": 0.2, "y": 0.25}`로 저장됩니다 — 프레임 해상도가 바뀌어도 폴리곤 모양이 그대로 유지됩니다.

```json
[
  { "x": 0.21, "y": 0.25 },
  { "x": 0.50, "y": 0.21 },
  { "x": 0.59, "y": 0.52 },
  { "x": 0.38, "y": 0.75 },
  { "x": 0.18, "y": 0.57 }
]
```

`target_classes`는 기본값을 `person`으로 두되 콤마로 구분된 문자열을 허용해, 나중에 "이 구역에 차량(`car`)이 들어오면 알림" 같은 확장도 같은 테이블 구조로 커버할 수 있게 했습니다. `max_count = 0`은 "임계치 알람 없이 인원수만 시각화"를 의미하는 값으로 정의했습니다 — 모든 구역이 알람용은 아니고, 단순히 "지금 몇 명 있는지 보고 싶다"는 요구도 있었기 때문입니다.

### `cctv_geofence_event` — 진입/퇴장/초과 이력

```sql
CREATE TABLE cctv_geofence_event (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    zone_id         INT          NOT NULL,
    cctv_alias      VARCHAR(50)  NOT NULL,
    event_type      VARCHAR(20)  NOT NULL,   -- 'enter' | 'exit' | 'overcrowd'
    track_id        INT          NULL,
    occupant_count  INT          NOT NULL,
    occurred_at     DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_geofence_event_zone
        FOREIGN KEY (zone_id) REFERENCES cctv_geofence_zone(id)
);

CREATE INDEX IX_cctv_geofence_event_zone_time
    ON cctv_geofence_event(zone_id, occurred_at DESC);
```

`event_type`은 세 가지로 단순화했습니다.

- `enter` / `exit`: 특정 `track_id`가 구역에 들어오거나 나갈 때마다 한 행씩 기록
- `overcrowd`: `max_count`를 초과하는 순간(0→초과로 바뀌는 트랜지션)에만 기록 — 매 프레임마다 쌓이지 않도록 "상태 변화 시점"만 남기는 것이 핵심입니다.

이 이력 테이블은 (2)편에서 만들 통계/조회 API의 기반이 됩니다. "어제 오후에 A구역에 사람이 가장 많이 몰렸던 시간대"같은 질문에 답하려면 결국 이 로그가 있어야 합니다.

---

## Geofence 서비스 흐름

지금까지의 설계를 하나의 흐름으로 정리하면 다음과 같습니다. AI 탐지 결과가 들어와서 화면에 반영되기까지의 전체 경로입니다.

![Geofence 서비스 흐름도](/assets/img/posts/geofence-service-flow.svg)

핵심은 가운데 있는 **"Geofence 판정 엔진"** 입니다. 이 엔진은:

1. AI 이벤트의 `person` 탐지 결과에서 **bbox 하단 중심점**을 계산합니다. bbox 중심점이 아니라 **하단 중심점**을 쓰는 이유는, 사람의 "발 위치"가 실제로 바닥(구역) 위에 있는지를 더 잘 표현하기 때문입니다 — 머리는 구역 경계선 위로 튀어나와 보일 수 있지만, 발은 바닥에 닿아 있습니다.
2. 이 점을 `frame_size`로 나눠 `0~1` 정규화 좌표로 바꿉니다.
3. 같은 카메라에 등록된 모든 활성(`enabled=1`) 구역에 대해 `turf.booleanPointInPolygon`으로 포함 여부를 판정합니다.
4. 구역별 "현재 안에 있는 `track_id` 집합"을 갱신하고, 직전 상태와 비교해 변화가 있을 때만 다음 단계(Socket 브로드캐스트, DB 로그, 알람)를 진행합니다.

이 "변화가 있을 때만" 부분이 실무적으로 중요합니다. AI 이벤트는 초당 여러 번 들어오는데, 매번 인원이 그대로라면 굳이 소켓을 또 쏘거나 DB에 또 쓸 필요가 없습니다. 상태를 메모리에 들고 있다가 **diff가 있을 때만 비용이 드는 작업을 수행**하는 것이 (2)편에서 다룰 백엔드 구현의 핵심 설계 포인트입니다.

---

## 다음 글에서 다룰 내용

설계는 정리됐으니, 다음 글부터는 실제 구현으로 들어갑니다.

- **(2) 백엔드**: `cctv_geofence_zone` CRUD API(라우트/컨트롤러/서비스 3계층), AI 이벤트 파이프라인에 끼워 넣는 판정 로직, `Map<zone_id, Set<track_id>>` 기반 occupancy 상태 관리, `geofence:status` Socket.IO 이벤트, 기존 알람 시스템과의 연동
- **(3) 프론트엔드**: 카메라 화면 위에 폴리곤을 그리는 구역 설정 UI, 실시간 인원 오버레이와 카운트 배지, 초과 알람 표시까지 — 화면 목업과 함께 정리합니다

---

## 정리

- 새로 추가하려는 Geofence 기능은 **새 데이터를 만드는 게 아니라, 이미 존재하는 두 데이터(픽셀 좌표 person 탐지 / 위경도 zone)를 연결하는 문제**였습니다.
- 두 좌표계를 GPS 기준으로 통일하려면 카메라 캘리브레이션(Homography)이 필요한데, 이번 요구사항의 본질은 "카메라 화면 안에서의 구역 판정"이라 그 비용을 들일 필요가 없다고 판단했습니다.
- 그래서 **카메라-로컬 0~1 정규화 폴리곤**을 새 테이블(`cctv_geofence_zone`, `cctv_geofence_event`)로 설계했고, 기존 AI 이벤트의 `bbox`/`frame_size`와 그대로 맞물립니다.
- 판정 로직의 핵심은 **bbox 하단 중심점 + turf.booleanPointInPolygon + 상태 diff** 세 가지입니다. 다음 글(2편)에서 이 로직을 실제 코드로 풀어봅니다.
