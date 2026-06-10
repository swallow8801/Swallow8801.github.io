---
layout: post
title: "Geofence 기능구현 (4): 개발 로드맵, 검증 전략, Side Effect 체크리스트"
date: 2026-06-11
series: "Projects"
category: "Projects"
subcategory: "SHIMonitoring"
tags: [geofence, project-planning, testing, branch-strategy, side-effects, roadmap]
description: "Geofence 기능을 실제로 어떤 순서로 만들고 검증할지, 그리고 기존 백엔드에 끼워 넣을 때 발생할 수 있는 Side Effect를 구현 전에 점검하는 개발 계획서입니다."
image: /assets/img/posts/geofence-feature-thumb.svg
pinned: false
---

## 들어가며

지금까지 세 편에 걸쳐 Geofence 기능을 다뤘습니다.

- **(1) [설계]({{ '/blog/geofence-feature-1-design/' | relative_url }})**: 픽셀 좌표 기반 person 탐지와 위경도 기반 기존 zone 사이의 좌표계 단절 문제를 정리하고, 카메라-로컬 정규화 폴리곤(`cctv_geofence_zone`, `cctv_geofence_event`)을 설계했습니다.
- **(2) [백엔드]({{ '/blog/geofence-feature-2-backend/' | relative_url }})**: Zone CRUD API, `turf.booleanPointInPolygon` 판정 엔진, occupancy 상태 diff, `geofence:status` 소켓 브로드캐스트, 기존 알람 파이프라인 연동까지 구현했습니다.
- **(3) [프론트엔드]({{ '/blog/geofence-feature-3-frontend/' | relative_url }})**: 구역 설정 UI, 실시간 오버레이, 상태 동기화 훅을 구현했습니다.

1~3편은 전부 "무엇을, 어떻게 만들 것인가"였습니다. 이번 글은 다릅니다. 코드는 거의 없습니다. 대신 다음 질문에 답합니다.

- 실제로 어떤 **순서**로 작업해야 운영 중인 시스템을 망가뜨리지 않을까?
- 각 단계가 끝났다는 걸 어떻게 **검증**할까?
- 지금 당장 보이지 않지만 나중에 터질 수 있는 **Side Effect**는 무엇일까?

운영 중인 백엔드(`shii-backend`)에 새 기능을 끼워 넣는 작업이라, "잘 만드는 것"보다 "기존 걸 안 망가뜨리면서 만드는 것"이 더 어렵습니다. 이 글은 구현에 들어가기 전에 한 번 점검하는 체크리스트입니다.

---

## 0. 시작점: `feature/geofence-zone` 브랜치 만들기

`shii-backend`는 `main` 브랜치 단일 운영이고, 커밋 메시지는 `helmet add`, `bike add & bugfix`처럼 짧은 한/영 혼용 스타일을 씁니다. PR 템플릿이나 브랜치 네이밍 규칙 문서는 따로 없으므로, 이번 작업부터 다음 규칙을 정하고 시작합니다.

```bash
git checkout main
git pull origin main
git checkout -b feature/geofence-zone
```

브랜치 하나에 전부 욱여넣지 않고, **Phase 단위로 커밋을 쌓습니다.**

```text
geofence: cctv_geofence_zone/event 테이블 추가
geofence: zone CRUD API 추가 (route/controller/service)
geofence: AI 이벤트 파이프라인에 판정 로직 연결
geofence: geofence:status 소켓 브로드캐스트 + 알람 연동
geofence: 프론트엔드 구역 설정 UI
geofence: 프론트엔드 실시간 오버레이
```

왜 백엔드, 그리고 DB부터 시작하는가:

- `cctv_geofence_zone`/`cctv_geofence_event` 스키마가 API·판정 엔진·프론트 전부의 기반이라, 여기서 흔들리면 뒤 단계가 전부 다시 흔들립니다.
- 백엔드의 CRUD API까지만 먼저 끝내면, 프론트엔드 작업자는 Swagger로 실제 API를 호출해보면서 화면을 만들 수 있습니다(목업 데이터에 의존하지 않음).
- 가장 위험한 작업(AI 이벤트 파이프라인 연동, 6장)을 가장 늦게, 가장 작은 변경으로 가져갈 수 있습니다.

---

## 1. 개발 순서 — 8단계 로드맵

| Phase | 작업 | 주요 산출물 | 기존 코드 영향 | 위험도 |
|---|---|---|---|---|
| 0 | 브랜치/환경 준비 | `feature/geofence-zone` | 없음 | - |
| 1 | DB 스키마 | `cctv_geofence_zone`, `cctv_geofence_event` 테이블 | 없음 (신규 테이블) | 낮음 |
| 2 | Zone CRUD API | `routes/geofence.js`, `controllers/geofence.controller.js`, `services/geofence.service.js`, `services/query/geofence.query.js`, Swagger 문서 | 없음 (신규 파일) | 낮음 |
| 3 | AI 이벤트 파이프라인 연동 | `geofence.engine.js`, `geofence.cache.js`, `geofence.state.js` + `aiEvents.controller.js` 훅 | **있음** (`createFromAi` 수정) | 높음 |
| 4 | Socket.IO + 알람 연동 | `geofence:status` emit, `alarm_type: geofence_overcrowd` | 있음 (alarm 관련 매핑) | 중간 |
| 5 | 프론트엔드 | 설정 UI, 실시간 오버레이, `useGeofenceStatus` | 없음 (신규 컴포넌트) | 낮음 |
| 6 | 통합·부하·회귀 테스트 | 테스트 스크립트, 베이스라인 비교 리포트 | - | - |
| 7 | 배포 + 모니터링 | 배포, `GEOFENCE_ENABLED` 운영 가이드 | - | - |

### 0~2단계: 비침습 구간부터 끝낸다

Phase 0~2는 전부 **새 파일을 추가하는 작업**입니다. 라우트가 새로 등록되긴 하지만 기존 어떤 흐름도 호출하지 않으므로, 이 상태로 머지해도 운영 중인 AI 이벤트 처리·알람·소켓 동작은 100% 동일합니다.

이 구간의 목표는 "Zone을 등록/수정/삭제/조회할 수 있다"까지입니다. Swagger 문서화까지 끝내고, Postman으로 CRUD가 정상 동작하는지 확인한 뒤 머지하는 걸 권장합니다. 이 시점엔 zone을 아무리 만들어도 화면이나 알람에는 아무 변화가 없는 게 정상입니다(아직 판정 로직이 연결 안 됐으므로).

### 3단계: 가장 위험한 연결 고리

전체 로드맵에서 유일하게 **기존 파일을 수정**하는 단계입니다. `aiEvents.controller.js`의 `createFromAi()`에 geofence 판정을 끼워 넣는 작업인데, 이 함수는 이미 RAW 이벤트 저장 → 알람 판정 → 캐싱까지 동기로 처리하고 응답을 보내는 함수입니다. 여기에 다섯 번째 단계를 더하는 거라, 다음 원칙을 지킵니다.

- **환경변수로 on/off**: `GEOFENCE_ENABLED=true`일 때만 판정 로직 진입. 문제가 생기면 코드 롤백 없이 환경변수만 바꿔서 끌 수 있어야 합니다.
- **person이 아니면 즉시 스킵**: zone 평가 자체를 호출하지 않습니다.
- **DB 쓰기는 fire-and-forget**: `cctv_geofence_event` INSERT는 응답을 막지 않습니다. 실패해도 로그만 남기고 응답은 그대로 나갑니다.
- **zone 목록은 캐시에서만 읽기**: 이 경로에서 DB SELECT가 추가되면 안 됩니다(2편의 `geofence.cache.js`).

이 원칙들의 구체적인 근거는 6장(Side Effect)에서 실제 코드를 인용하며 설명합니다.

### 4~5단계: 화면까지 연결

판정 로직이 상태 변화를 감지하면 `geofence:status`를 소켓으로 쏘고, 정원 초과 시 기존 알람 테이블에 `alarm_type: 'geofence_overcrowd'`로 적재합니다(2편). 프론트엔드는 이 둘을 구독해 구역 설정 UI(3편)와 실시간 오버레이(3편)를 붙입니다. 이 단계부터는 "기존 기능을 건드리지 않으면서 새 기능을 추가"하는 일반적인 작업이라 위험도가 다시 낮아집니다.

### 6~7단계: 검증과 배포

다음 장에서 단계별로 다룹니다.

---

## 2. 검증 전략

`shii-backend`에는 현재 테스트 프레임워크가 전혀 없습니다(`package.json` devDependencies엔 `nodemon`만 존재, `.test.js`/`.spec.js` 파일 0개, `test` 스크립트 없음). 처음부터 모든 코드에 테스트를 강제하기보다, **순수 함수 → API → 통합 → 부하 → 실환경** 순서로 검증 난이도를 높여가며 필요한 만큼만 도구를 추가하는 쪽이 현실적입니다.

### 단위 테스트 — 순수 함수부터 (Jest 신설)

`geofence.engine.js`의 `bottomCenter`, `toClosedRing`, `evaluateGeofence`(2편)는 DB·네트워크·소켓에 의존하지 않는 순수 함수입니다. 이 프로젝트에 처음 테스트를 도입하기에 가장 부담이 적은 지점입니다.

```bash
npm install --save-dev jest
```

```javascript
// services/geofence.engine.test.js
const { bottomCenter, evaluateGeofence } = require('./geofence.engine');

describe('geofence.engine', () => {
  const zoneA = {
    zone_id: 1,
    polygon: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ],
  };

  test('bbox 하단 중심이 zone 내부면 inside=true', () => {
    const bbox = [0.4, 0.4, 0.1, 0.4]; // x, y, w, h (정규화 좌표)
    const point = bottomCenter(bbox);  // (0.45, 0.8) → 경계선 위
    const result = evaluateGeofence(point, [zoneA]);
    expect(result[0].inside).toBe(true);
  });

  test('bbox 하단 중심이 zone 밖이면 inside=false', () => {
    const bbox = [0.85, 0.85, 0.1, 0.1];
    const point = bottomCenter(bbox);
    const result = evaluateGeofence(point, [zoneA]);
    expect(result[0].inside).toBe(false);
  });

  test('두 zone이 겹치면 둘 다 inside=true로 판정된다', () => {
    const zoneB = { zone_id: 2, polygon: [
      { x: 0.4, y: 0.4 }, { x: 0.9, y: 0.4 }, { x: 0.9, y: 0.9 }, { x: 0.4, y: 0.9 },
    ]};
    const bbox = [0.55, 0.55, 0.05, 0.1];
    const point = bottomCenter(bbox);
    const result = evaluateGeofence(point, [zoneA, zoneB]);
    expect(result.filter(r => r.inside)).toHaveLength(2);
  });
});
```

여기서 짚어야 할 경계 케이스:

- **경계선 위의 점**: `turf.booleanPointInPolygon`은 기본적으로 경계를 "포함"으로 처리하지 않을 수 있습니다(옵션에 따라 다름). zone 가장자리에 서 있는 사람이 in/out을 반복(flickering)하지 않도록 옵션을 명시적으로 테스트로 고정해둡니다.
- **frame_size가 다른 두 카메라**: 정규화 좌표를 쓰므로 이론상 영향이 없어야 하지만, 실제로 두 카메라의 `frame_size`를 다르게 넣은 입력으로 한 번은 검증합니다.
- **zone 폴리곤이 self-intersecting인 경우**: 사용자가 설정 UI에서 선을 꼬아 그리면 turf가 예외를 던질 수 있습니다. 이 경우 "해당 zone은 평가에서 제외하고 나머지는 정상 처리"하도록 try/catch로 격리합니다.

### API 레벨 — 기존 Swagger 패턴에 맞추기

`shii-backend`는 API 문서를 Swagger UI(`http://localhost:8000/api-docs`)로 운영합니다. Zone CRUD 라우트도 같은 방식으로 문서화하고, Swagger UI에서 직접 호출해 응답 형태(`{success, message, data, error_code}`)가 기존 API들과 동일한지 확인합니다. 이 단계에서 AI 이벤트 파이프라인은 전혀 건드리지 않으므로, 운영 중인 다른 기능에 영향을 줄 걱정 없이 자유롭게 테스트할 수 있습니다.

### 통합 테스트 — AI 이벤트를 모킹해서 끝까지 흘려보기

Phase 3을 검증하는 핵심 단계입니다. 실제 AI 추론 서버 없이, person bbox가 zone 안/밖에 있는 가짜 페이로드를 직접 보내서 판정 → DB 적재 → 소켓 브로드캐스트까지 한 번에 확인합니다.

```bash
curl -X POST http://localhost:8000/api/ai/events \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "CAM-03",
    "frame_size": [1920, 1080],
    "detections": [
      { "class": "person", "track_id": 501, "prob": 0.92, "bbox": [800, 400, 120, 260] }
    ]
  }'
```

같은 `track_id`로 bbox 좌표만 zone 밖으로 바꿔서 한 번 더 보내면 `enter` 다음에 `exit` 이벤트가 기록되는지 확인할 수 있습니다.

소켓 브로드캐스트는 임시 클라이언트 스크립트로 확인합니다.

```javascript
// scripts/check-geofence-socket.js (임시 점검용, 커밋 X)
const { io } = require('socket.io-client');

const socket = io('http://localhost:8000');
socket.on('connect', () => console.log('connected:', socket.id));
socket.on('geofence:status', (payload) => console.log('geofence:status', payload));
```

이 스크립트를 켜둔 채로 위 curl을 두세 번 다른 좌표로 호출해보면, `count`/`occupant_track_ids`/`over_capacity`가 기대한 대로 바뀌는지 눈으로 바로 확인됩니다.

### 부하·회귀 테스트 — "느려지지 않았는가"가 핵심

Phase 3은 운영 중인 `/api/ai/events`의 응답 시간에 직접 영향을 줄 수 있는 유일한 단계입니다. 따라서 **적용 전/후 응답 시간을 비교하는 것** 자체가 가장 중요한 테스트입니다.

1. `feature/geofence-zone` 브랜치에서 Phase 3 적용 **전** 커밋으로 체크아웃해 베이스라인을 측정합니다.
2. `autocannon`(또는 `ab`)으로 동일한 페이로드를 일정 시간 반복 전송하며 평균/p95 응답시간을 기록합니다.

```bash
npx autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -b '{"alias":"CAM-03","frame_size":[1920,1080],"detections":[{"class":"person","track_id":501,"prob":0.92,"bbox":[800,400,120,260]}]}' \
  http://localhost:8000/api/ai/events
```

3. Phase 3 적용 **후** 동일하게 측정합니다. 평균 응답시간 증가가 `<측정값>`ms 이내인지 확인합니다(허용치는 실제 운영 트래픽과 협의해서 정합니다).
4. zone 개수를 1개 → 5개 → 20개로 늘려가며 같은 부하 테스트를 반복해, zone 수가 응답시간에 어떻게 영향을 주는지 곡선을 확보합니다. `evaluateGeofence`는 zone마다 한 번씩 호출되므로 zone 수에 비례해 비용이 증가하는 게 정상이며, 이 비례 상수가 허용 범위인지 확인하는 것이 목적입니다.

회귀 테스트는 별도 도구가 필요 없습니다. 같은 부하 테스트를 **person 탐지가 zone과 전혀 무관한 페이로드**로도 한 번 돌려서, 기존 알람 판정(`evaluateAlarmV3`)이나 캐싱(`setLatest`) 동작·응답이 Phase 3 적용 전후로 동일한지 확인하면 됩니다.

### 실환경 검증 — 스테이징 카메라

curl로는 좌표 계산이 맞는지까지만 확인할 수 있습니다. 실제로 "사람이 들어왔을 때 카운트가 맞는가"는 스테이징 카메라 한 대에 zone 1~2개를 그려두고 직접 확인해야 합니다.

- 한 사람이 zone에 들어가고 나올 때 `enter`/`exit`가 각각 한 번씩만 기록되는지 (track_id가 끊겨서 중복 기록되지 않는지)
- 화면에 표시되는 인원수와 실제 인원수가 일치하는지
- 여러 명이 동시에 zone 경계를 넘나들 때도 카운트가 어긋나지 않는지
- 정원 초과(`over_capacity`) 알람이 실제로 정원을 넘긴 시점에만 발생하는지, 경계에서 깜빡이며 여러 번 발생하지는 않는지

### 롤백 계획

- **즉시 비활성화**: `GEOFENCE_ENABLED=false`로 환경변수만 변경하면 Phase 3의 판정 로직 진입 자체가 막힙니다. 배포(코드 변경) 없이 운영 이슈에 대응할 수 있습니다.
- **DB 롤백**: Phase 1에서 추가한 테이블은 `cctv_geofence_zone`, `cctv_geofence_event` 둘뿐이고 기존 테이블은 전혀 변경하지 않으므로, 문제가 생기면 이 두 테이블만 DROP하면 기존 시스템은 영향받지 않습니다.

---

## 3. 고려해야 할 사항

- **멀티 카메라/멀티 Zone 확장성**: 연산량은 "카메라 수 × fps × zone 수 × 프레임당 person 수"에 비례합니다. 카메라 한두 대로 테스트할 때는 문제없던 것이 카메라가 늘어나면서 누적될 수 있으므로, 부하 테스트 단계에서 zone 수를 늘려가며 미리 곡선을 확보해둡니다.
- **좌표 정규화와 frame_size 일관성**: 정규화 좌표(0~1)는 해상도 자체가 바뀌어도(예: 1920×1080 → 1280×720) 비율이 같으면 영향이 없습니다. 다만 **종횡비가 바뀌는 경우**(예: 16:9 → 4:3으로 카메라 교체) 기존에 그려둔 폴리곤이 의도와 다른 영역을 가리킬 수 있습니다. 카메라 교체 시 zone을 다시 그려야 한다는 점을 운영 가이드에 명시합니다.
- **track_id 안정성**: AI 트래커가 추적을 놓치면 같은 사람이 새 `track_id`로 재할당될 수 있습니다. 이 경우 기존 occupancy 상태(2편의 `Map<zone_id, {trackIds, ...}>`)에는 이전 track_id가 남아있고 새 track_id가 또 `enter`로 잡혀, 실제보다 인원이 많게 카운트될 수 있습니다. 1차 구현에서는 이 한계를 그대로 두되, 운영 데이터를 보면서 "일정 시간 갱신되지 않은 track_id는 자동 제거" 같은 보정 로직 추가 여부를 다음 단계로 남겨둡니다.
- **PTZ 카메라는 지원 범위 밖**: 화면이 움직이거나 줌이 바뀌는 카메라는 정규화 좌표의 의미가 매 프레임 달라지므로 이번 설계로는 지원하지 않습니다. 설정 UI에서 "고정 카메라만 zone 설정 가능" 같은 안내를 넣을지 검토합니다.
- **person 외 클래스로의 확장 가능성**: 1편에서 `cctv_geofence_zone`에 `target_classes` 필드를 이미 넣어뒀으므로, 나중에 차량(`car`) 등으로 확장할 때 스키마 변경 없이 가능합니다. 다만 1차 구현 범위는 `person`으로 한정합니다.

---

## 4. 주의해야 할 점

- **"추가만, 수정은 최소로"**: 이번 작업에서 기존 파일을 수정하는 곳은 원칙적으로 `aiEvents.controller.js`(Phase 3, 판정 훅 삽입) 한 곳뿐이어야 합니다. 그 외 모든 결과물(라우트, 컨트롤러, 서비스, 엔진, 캐시, 상태, 컴포넌트)은 신규 파일입니다. 코드 리뷰에서 "이 PR이 기존 파일 몇 개를 건드렸는가"를 위험도 신호로 사용할 수 있습니다.
- **DB 마이그레이션은 별도 `.sql` 파일로 관리**: `cctv_geofence_zone`/`cctv_geofence_event` 생성 스크립트를 레포에 파일로 남겨두고, 운영 DB에 직접 실행하기 전에 스테이징 DB에서 먼저 검증합니다.
- **Swagger 문서 갱신**: Zone CRUD API를 추가했는데 Swagger에 반영하지 않으면, 다음에 이 코드를 보는 사람(미래의 본인 포함)이 API 존재 자체를 모를 수 있습니다.
- **환경변수 추가 시 문서화**: `GEOFENCE_ENABLED` 같은 새 환경변수를 추가하면, 배포 환경(서버)에도 동일하게 설정해야 동작합니다. 로컬에서만 켜두고 배포 시 깜빡하면 "로컬에서는 되는데 운영에서는 안 되는" 상황이 됩니다.

---

## 5. 기존 시스템과의 관계에서 고려할 점

`shii-backend`에는 이미 "구역"이라는 개념이 존재합니다(`radar.worker.js` + `adia_area_map`). 새로 만드는 Geofence와 이름·개념이 겹치지 않도록 명확히 구분해야 합니다.

| 항목 | 기존: 레이더 Geofencing | 신규: CCTV Geofence |
|---|---|---|
| 데이터 소스 | 실외 레이더 (GPS) | CCTV + AI person 탐지 (픽셀 bbox) |
| 좌표계 | 위경도 (lat/lng) | 카메라-로컬 정규화 (0~1) |
| 테이블 | `adia_area_map` | `cctv_geofence_zone`, `cctv_geofence_event` |
| 판정 라이브러리 | `@turf/turf` (`booleanPointInPolygon`) | `@turf/turf` (동일 함수, 다른 좌표계) |
| 캐시 갱신 | 1분 주기 polling (`refreshForbiddenZones`) | CRUD 직후 즉시 invalidate |
| 소켓 이벤트 | `radar:targets` | `geofence:status` |

같은 `@turf/turf`를 같은 함수(`booleanPointInPolygon`)로 쓰지만 좌표계가 다르다는 점이 가장 헷갈리기 쉬운 부분입니다. 코드 리뷰나 문서에서 "이 폴리곤은 위경도인가, 정규화 좌표인가"를 변수명이나 주석으로 항상 구분해야 합니다.

캐시 갱신 방식의 차이(1분 polling vs 즉시 invalidate)도 의도적인 설계 차이입니다. `radar.worker.js`의 1분 주기는 레이더 데이터 특성상 구역이 자주 바뀌지 않는다는 전제가 있지만, Geofence는 "구역을 그리고 바로 화면에서 확인"하는 UX가 필요하므로 같은 패턴을 가져오면 안 됩니다.

또한, Socket.IO는 네임스페이스/룸 구분 없이 `io.emit()`으로 전체 브로드캐스트하는 단일 구조입니다(`radar:targets`, `ai:disconnected`, `cctv:updated` 모두 동일 패턴). `geofence:status`도 같은 패턴을 따르면 기존 클라이언트는 이 이벤트를 모르는 채로 무시하므로 안전하지만, 반대로 **프론트엔드에 핸들러를 등록하지 않으면 "백엔드는 분명히 보내는데 화면엔 아무 변화가 없는"** 상태가 되어 디버깅이 까다로울 수 있습니다. Phase 4와 Phase 5는 같은 PR/스프린트에서 함께 진행하는 걸 권장합니다.

---

## 6. (중요) 현재 백엔드 시스템 Side Effect 체크리스트

이 장이 이번 글의 핵심입니다. Phase 3~4(기존 코드를 수정하는 단계)에서 실제로 마주칠 수 있는 8가지 Side Effect를 코드 인용과 함께 정리합니다. **Phase 3~4 코드 리뷰 체크리스트로 그대로 사용**할 수 있도록 작성했습니다.

### 6-1. AI 이벤트 동기 파이프라인 — 응답 지연

`controllers/aiEvents.controller.js`의 `createFromAi()`는 1) RAW 이벤트 저장 → 2) 임계값 조회 → 3) 알람 판정 → 4) 캐싱까지 **전부 동기로 끝낸 뒤** 응답합니다.

```javascript
// controllers/aiEvents.controller.js
exports.createFromAi = async (req, res) => {
  const payload = req.body || {};
  const alias = payload.alias;
  if (!alias) return res.status(400).json(fail('alias is required', 1001));

  try {
    const { id: rawId, frameTime, receivedAt } = await aiEventsService.saveRawEvent(payload);
    const aiConfig = await aiEventsService.getAiThresholdsForAlias(alias).catch(() => null);
    await evaluateAlarmV3(payload, rawId, frameTime, aiConfig);

    const normalized = normalizeAiEvent(payload, frameTime, receivedAt, aiConfig);
    setLatest(alias, normalized);

    return res.status(201).json(ok('event accepted', { id: rawId }));
  } catch (err) {
    console.error('v3 createFromAi Error:', err);
    return res.status(400).json(fail(err.message || 'invalid payload', 1002));
  }
};
```

geofence 판정을 다섯 번째 단계로 추가하면, 이 함수의 실행 시간이 그대로 늘어나고 AI 추론 서버는 이 응답을 기다리는 구조이므로 지연이 누적될 수 있습니다. 카메라당 초당 5~30fps가 들어온다고 가정하면, 한 번의 처리당 지연 증가가 작아 보여도 누적되면 무시할 수 없습니다.

**대응**: 1단계 로드맵에서 정한 원칙(person 아니면 스킵 / 캐시에서만 조회 / DB 쓰기는 fire-and-forget)을 그대로 적용하고, geofence 판정 블록 전체를 try/catch로 감싸 **여기서 에러가 나도 기존 4단계 응답에는 영향이 없도록** 합니다.

### 6-2. DB 커넥션 풀 — 고갈 위험

`config.js`의 `connectDB()`는 mssql 풀을 전역 1개로 재사용하지만, 풀 크기를 명시적으로 설정하지 않아 mssql 기본값(10)을 그대로 사용합니다.

```javascript
// config.js
async function connectDB() {
  const dbConfig = {
    user: config.database.user,
    password: config.database.password,
    server: config.database.host,
    database: config.database.name,
    port: parseInt(config.database.port),
    options: { encrypt: false, enableArithAbort: false },
  };

  if (globalPoolPromise) return globalPoolPromise;

  globalPoolPromise = sql.connect(dbConfig)
    .then(pool => pool)
    .catch(err => { globalPoolPromise = null; throw err; });

  return await globalPoolPromise;
}
```

이미 AI 이벤트 1건당 RAW INSERT, 임계값 SELECT, 알람 UPSERT까지 최대 3개 쿼리가 실행됩니다. 여기에 geofence 판정이 매 이벤트마다 zone 목록을 DB에서 SELECT하거나, 상태 변화가 없는데도 매번 `cctv_geofence_event`에 INSERT한다면 풀 10개가 빠르게 소진될 수 있습니다.

**대응**: zone 목록은 절대 매 이벤트마다 조회하지 않고 `geofence.cache.js`의 메모리 캐시만 사용합니다. `cctv_geofence_event` 적재는 **상태가 실제로 바뀐 경우(diff)에만** 수행합니다.

### 6-3. "즉시 알람" 구조와 디바운스 부재

`AI_ALARM_LOGIC.md`에는 원래 OR 규칙에 2초 대기 후 알람이라는 디바운스가 설계돼 있었지만, 실제 구현은 AND/OR 모두 즉시 `triggerAlarm`을 호출하도록 변경되어 있습니다.

```javascript
// controllers/aiEvents.controller.js
if (yoloHit && clipHit) {
  await aiEventsService.triggerAlarm({ alias, targetClass, prob: Math.max(yoloMax, clipMax), rule: "AND", rawId, frameTime });
} else if (yoloHit || clipHit) {
  // OR 규칙: 과거엔 2초 대기였으나 현재는 즉시
  await aiEventsService.triggerAlarm({ alias, targetClass, prob: Math.max(yoloMax, clipMax), rule: "OR_INSTANT", rawId, frameTime });
}
```

geofence_overcrowd 알람도 같은 "즉시" 패턴을 그대로 따르면, 사람이 zone 경계에서 살짝 움직이는 것만으로 `enter`→`exit`→`enter`가 반복되며 알람이 짧은 시간에 여러 번 발생할 수 있습니다. 2편에서 설계한 occupancy diff(`Map<zone_id, {trackIds, overCapacity}>`)가 1차 방어선이지만, 이는 "직전 프레임과 다른가"만 보기 때문에 경계에서의 빠른 깜빡임 자체를 막지는 못합니다.

**대응**: `geofence.state.js`에 zone별로 "정원 초과 상태가 `<측정값>`초 이상 유지될 때만" 알람을 발생시키는 최소 유지 시간을 추가하는 작업을 Phase 3 작업 항목에 포함합니다. 정확한 임계값은 실환경 검증(2장)에서 깜빡임 빈도를 관찰한 뒤 정합니다.

### 6-4. `alarm_type` 하드코딩 동기화

`services/alarms.service.js`의 `upsertActiveAlarm`은 `alarm_type`이 `person`/`car`/`bike`이면 **테이블에 저장하지 않고 조용히 리턴**하는 방어 로직을 가지고 있습니다.

```javascript
// services/alarms.service.js
exports.upsertActiveAlarm = async (alarm) => {
  const { alarm_type, ... } = alarm;
  const t = String(alarm_type || "").toLowerCase();

  // person/car/bike는 알람 테이블에 저장하지 않음
  if (t === "person" || t === "car" || t === "bike") {
    return;
  }
  // ... INSERT/UPDATE
};
```

`geofence_overcrowd`는 이 세 값에 해당하지 않으므로 이 필터는 통과합니다. 하지만 **반대 방향의 위험**이 있습니다. `alarm_type` 값들은 백엔드의 이런 필터 코드와, 프론트엔드의 알람 아이콘/라벨 매핑 테이블 양쪽에 흩어져 하드코딩돼 있습니다. 백엔드에서 `geofence_overcrowd`를 발생시켜 DB에는 정상 적재되더라도, 프론트엔드 매핑 테이블에 추가하지 않으면 화면에는 "알 수 없는 알람"으로 표시되거나 아예 누락될 수 있습니다.

**대응**: Phase 4에서 백엔드(`geofence_overcrowd` 발생 코드)와 프론트엔드(알람 타입 → 라벨/아이콘 매핑)를 **같은 PR**에서 함께 수정합니다.

### 6-5. 단일 프로세스 재시작 — in-memory 상태 초기화

`package.json`의 시작 스크립트는 PM2나 cluster 없이 단일 프로세스로 동작합니다.

```json
"scripts": {
  "start": "start /b node index.js",
  "dev": "nodemon index.js"
}
```

멀티 워커 간 캐시 불일치 같은 문제는 없지만(2편의 in-memory 캐시/상태 설계에 유리), 프로세스 재시작 시점에 챙겨야 할 게 두 가지 있습니다.

- **zone 캐시**: 재시작 직후 비어있는 상태이므로, 부팅 시 `cctv_geofence_zone`을 1회 읽어 캐시를 채우는 초기화 코드가 필수입니다. (`radar.worker.js`의 1분 polling과 달리, "부팅 시 1회 로드 + CRUD 시 즉시 갱신" 조합으로 구현)
- **occupancy 상태**: 재시작 직후 `Map`이 비어있으므로, 실제로는 이미 zone 안에 있던 사람들이 전부 "새로 진입(enter)"으로 다시 잡힙니다. 재시작 직후 잠깐 enter 이벤트/카운트가 튀는 것은 이 설계상 자연스러운 현상이라는 점을 운영진에게 미리 공지하거나, 재시작 후 첫 `<측정값>`프레임은 이벤트 기록 없이 상태만 채우는 워밍업 구간을 둘지 검토합니다.

### 6-6. 기존 `radar.worker.js`와의 캐시 갱신 방식 차이

`radar.worker.js`는 `refreshForbiddenZones()`를 1분 주기로 호출해 `adia_area_map`을 다시 읽는 polling 방식입니다.

```javascript
// services/radar.worker.js
let forbiddenZones = [];

async function refreshForbiddenZones() {
  const pool = await connectDB();
  const result = await pool.request().query("SELECT * FROM adia_area_map WHERE visible = 'Y'");
  forbiddenZones = result.recordset.map(row => {
    const points = JSON.parse(row.points);
    return { id: row.num, title: row.areaTitle, polygon: turf.polygon([points.map(p => [p.lng, p.lat])]) };
  });
}
// setInterval(refreshForbiddenZones, 60 * 1000) 형태로 1분마다 호출
```

Geofence는 "구역을 설정하면 바로 화면/판정에 반영"되는 UX가 필요하므로 이 polling 패턴을 그대로 가져오면 최대 1분의 지연이 생깁니다. `geofence.cache.js`는 Zone CRUD 컨트롤러에서 변경 직후 직접 `invalidate()`를 호출하는 explicit invalidation으로 구현합니다(2편에서 이미 이렇게 설계했습니다 — 여기서는 "왜 기존 패턴을 따르지 않는지"를 의식적으로 남겨두는 차원입니다).

### 6-7. Socket.IO CORS 화이트리스트

`index.js`의 Socket.IO 설정은 origin을 배열로 하드코딩하고 있습니다.

```javascript
// index.js
const ioInstance = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://60.100.51.212"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

Geofence 설정 화면을 새 포트나 스테이징 도메인에서 띄우는 경우, `geofence:status` 이벤트가 브라우저 콘솔에서 CORS 에러로 조용히 막힐 수 있습니다. 증상은 "API 호출은 다 되는데 실시간 갱신만 안 된다"로 나타나서 원인 파악에 시간이 걸리기 쉽습니다. 새 프론트엔드 출처를 추가할 때 이 배열도 함께 수정해야 한다는 걸 Phase 5 체크리스트에 명시합니다.

### 6-8. AI 이벤트 빈도 × Zone 수 — 연산 비용

카메라당 초당 5~30fps로 들어오는 이벤트마다, 등록된 모든 zone에 대해 `evaluateGeofence`를 호출하면 연산량은 "카메라 수 × fps × zone 수 × 프레임당 person 수"에 비례해 늘어납니다. 카메라 한두 대, zone 한두 개로는 체감되지 않다가 운영 규모(다수 카메라, zone당 여러 개)에서 누적될 수 있는 항목입니다.

**대응**: 1차 완화책은 이미 1편/Phase 3 설계에 포함되어 있는 "person이 아닌 클래스는 평가 자체를 스킵"입니다. 추가로, 2-4의 부하 테스트에서 zone 수를 늘려가며 측정한 곡선을 바탕으로, 카메라/zone 수가 일정 임계를 넘으면 평가 주기를 프레임마다가 아니라 `<측정값>`프레임마다로 낮추는 옵션을 Phase 6 결과에 따라 검토합니다.

---

## 마무리 — 다음 액션

1~3편이 "무엇을 어떻게 만들 것인가"였다면, 이번 글은 "어떤 순서로, 어떻게 검증하면서, 무엇을 조심하며 만들 것인가"였습니다. 정리하면 다음 순서로 시작하면 됩니다.

1. `shii-backend`에서 `feature/geofence-zone` 브랜치를 만든다.
2. Phase 0~2(DB 스키마 + Zone CRUD API + Swagger 문서)를 끝내고, 이 시점에 한 번 머지한다 — 기존 시스템에 영향이 전혀 없는 구간이므로 가장 빠르게 검증·머지할 수 있다.
3. Phase 3(AI 이벤트 파이프라인 연동)은 `GEOFENCE_ENABLED` 플래그 뒤에서, 6장의 8가지 Side Effect 체크리스트를 코드 리뷰 기준으로 삼아 작업한다.
4. Phase 4~5(알람/소켓 연동 + 프론트엔드)는 같은 PR/스프린트에서 함께 진행해 "백엔드는 보내는데 화면엔 안 뜨는" 상태를 방지한다.
5. Phase 6(부하·회귀 테스트)에서 적용 전/후 응답시간 차이와 zone 수에 따른 비용 곡선을 확보한 뒤, 그 결과를 바탕으로 Phase 3의 디바운스·평가 주기 같은 임계값들을 확정한다.
6. `GEOFENCE_ENABLED=false` 롤백 경로를 항상 열어둔 채로 배포한다.

설계(1편)부터 구현(2~3편), 그리고 이번 계획(4편)까지 — 이제 실제로 `feature/geofence-zone` 브랜치에서 Phase 0을 시작하는 일만 남았습니다.
