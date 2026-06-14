---
layout: post
title: "Geofence 기능구현 (2): Zone CRUD API와 실시간 인원 판정 백엔드 구현"
date: 2026-06-11
series: "Projects"
category: "Projects"
subcategory: "삼성중공업"
tags: [geofence, nodejs, express, turf, socketio, mssql]
description: "Geofence 구역 CRUD API부터 AI 탐지 파이프라인에 끼워 넣는 인원 판정 로직, Socket.IO 실시간 브로드캐스트까지 백엔드 구현을 정리합니다."
image: /assets/img/posts/geofence-feature-thumb.svg
pinned: false
---

## 들어가며

[지난 글](/blog/geofence-feature-1-design/)에서는 "카메라 픽셀 좌표 person 탐지"와 "위경도 기반 zone"이라는 서로 다른 좌표계를 어떻게 연결할지 설계했습니다. 결론은 **카메라-로컬 0~1 정규화 폴리곤**을 새 테이블(`cctv_geofence_zone`, `cctv_geofence_event`)로 만들고, 기존 AI 이벤트의 `bbox`/`frame_size`를 그대로 활용하는 것이었습니다.

이번 글은 그 설계를 실제 코드로 옮기는 과정입니다. 다루는 범위는 다음과 같습니다.

1. 마이그레이션 적용
2. Zone CRUD API (`routes` → `controllers` → `services`)
3. AI 이벤트 파이프라인에 판정 로직 연결
4. Zone Occupancy 상태 관리와 변화 감지
5. Socket.IO 실시간 브로드캐스트
6. 기존 알람 시스템과의 연동
7. 성능 관점에서 고려한 것들

기존 백엔드는 Express + 순수 `mssql` 드라이버(레이어는 `routes → controllers → services → services/query`) + Socket.IO + `@turf/turf` 조합으로 되어 있습니다. 새 코드도 이 구조를 그대로 따릅니다.

---

## 1. DB 반영

(1)편에서 설계한 두 테이블을 그대로 마이그레이션 스크립트로 추가합니다.

```sql
-- 20260611_create_geofence_tables.sql
CREATE TABLE cctv_geofence_zone (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    cctv_alias      VARCHAR(50)   NOT NULL,
    zone_name       NVARCHAR(100) NOT NULL,
    polygon         NVARCHAR(MAX) NOT NULL,
    color           VARCHAR(7)    NOT NULL DEFAULT '#f59e0b',
    target_classes  NVARCHAR(100) NOT NULL DEFAULT 'person',
    max_count       INT           NOT NULL DEFAULT 0,
    enabled         BIT           NOT NULL DEFAULT 1,
    created_at      DATETIME      NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME      NOT NULL DEFAULT GETDATE()
);
CREATE INDEX IX_cctv_geofence_zone_alias ON cctv_geofence_zone(cctv_alias, enabled);

CREATE TABLE cctv_geofence_event (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    zone_id         INT          NOT NULL,
    cctv_alias      VARCHAR(50)  NOT NULL,
    event_type      VARCHAR(20)  NOT NULL,
    track_id        INT          NULL,
    occupant_count  INT          NOT NULL,
    occurred_at     DATETIME     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_geofence_event_zone FOREIGN KEY (zone_id) REFERENCES cctv_geofence_zone(id)
);
CREATE INDEX IX_cctv_geofence_event_zone_time ON cctv_geofence_event(zone_id, occurred_at DESC);
```

---

## 2. Zone CRUD API

### 라우트

기존 `routes/area.js`(레이더 구역 CRUD)와 같은 형태로 `routes/geofence.js`를 추가합니다. 인증은 기존 JWT 미들웨어를 그대로 씁니다.

```js
// routes/geofence.js
const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ctrl = require('../controllers/geofence.controller');

router.get('/zones', auth, ctrl.listZones);          // ?alias=CAM-03
router.post('/zones', auth, ctrl.createZone);
router.put('/zones/:id', auth, ctrl.updateZone);
router.delete('/zones/:id', auth, ctrl.deleteZone);
router.get('/zones/:id/events', auth, ctrl.listZoneEvents); // 이력 조회

module.exports = router;
```

### 컨트롤러

응답 형식은 기존 `{ success, message, data, error_code }` 규약을 그대로 따릅니다. `polygon`은 점 3개 이상이어야 의미 있는 도형이 되므로 입력 검증에서 걸러줍니다.

```js
// controllers/geofence.controller.js
const { ok, fail } = require('../utils/response');
const geofenceService = require('../services/geofence.service');

exports.listZones = async (req, res) => {
  const { alias } = req.query;
  if (!alias) {
    return res.status(400).json(fail('alias 쿼리 파라미터가 필요합니다', 'GEOFENCE_INVALID_PARAM'));
  }

  try {
    const zones = await geofenceService.getZonesByAlias(alias);
    res.json(ok(zones));
  } catch (err) {
    res.status(500).json(fail(err.message, 'GEOFENCE_LIST_FAILED'));
  }
};

exports.createZone = async (req, res) => {
  const { cctv_alias, zone_name, polygon, color, max_count, target_classes } = req.body;

  if (!cctv_alias || !zone_name || !Array.isArray(polygon) || polygon.length < 3) {
    return res.status(400).json(
      fail('cctv_alias, zone_name, polygon(3점 이상)은 필수입니다', 'GEOFENCE_INVALID_PARAM')
    );
  }

  try {
    const zone = await geofenceService.createZone({
      cctv_alias, zone_name, polygon, color, max_count, target_classes,
    });
    res.status(201).json(ok(zone, '구역이 생성되었습니다'));
  } catch (err) {
    res.status(500).json(fail(err.message, 'GEOFENCE_CREATE_FAILED'));
  }
};

exports.updateZone = async (req, res) => {
  const { id } = req.params;
  try {
    const zone = await geofenceService.updateZone(id, req.body);
    if (!zone) return res.status(404).json(fail('구역을 찾을 수 없습니다', 'GEOFENCE_NOT_FOUND'));
    res.json(ok(zone, '구역이 수정되었습니다'));
  } catch (err) {
    res.status(500).json(fail(err.message, 'GEOFENCE_UPDATE_FAILED'));
  }
};

exports.deleteZone = async (req, res) => {
  const { id } = req.params;
  try {
    await geofenceService.deleteZone(id);
    res.json(ok(null, '구역이 삭제되었습니다'));
  } catch (err) {
    res.status(500).json(fail(err.message, 'GEOFENCE_DELETE_FAILED'));
  }
};

exports.listZoneEvents = async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;
  try {
    const events = await geofenceService.getZoneEvents(id, Number(limit));
    res.json(ok(events));
  } catch (err) {
    res.status(500).json(fail(err.message, 'GEOFENCE_EVENTS_FAILED'));
  }
};
```

### 서비스 / 쿼리 계층

`polygon`과 `target_classes`는 DB에는 문자열로 저장하고, 서비스 계층에서 JSON 파싱·조립을 담당합니다. 쿼리 자체는 `services/query/geofence.query.js`에 raw SQL로 분리합니다.

```js
// services/query/geofence.query.js
const { poolPromise, sql } = require('../../config');

async function selectZonesByAlias(alias) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('alias', sql.VarChar, alias)
    .query(`
      SELECT id, cctv_alias, zone_name, polygon, color, target_classes, max_count, enabled
      FROM cctv_geofence_zone
      WHERE cctv_alias = @alias AND enabled = 1
      ORDER BY id
    `);
  return result.recordset;
}

async function insertZone({ cctv_alias, zone_name, polygon, color, target_classes, max_count }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('cctv_alias', sql.VarChar, cctv_alias)
    .input('zone_name', sql.NVarChar, zone_name)
    .input('polygon', sql.NVarChar, JSON.stringify(polygon))
    .input('color', sql.VarChar, color || '#f59e0b')
    .input('target_classes', sql.NVarChar, target_classes || 'person')
    .input('max_count', sql.Int, max_count || 0)
    .query(`
      INSERT INTO cctv_geofence_zone (cctv_alias, zone_name, polygon, color, target_classes, max_count)
      OUTPUT INSERTED.*
      VALUES (@cctv_alias, @zone_name, @polygon, @color, @target_classes, @max_count)
    `);
  return result.recordset[0];
}

async function insertZoneEvent(zoneId, cctvAlias, eventType, trackId, occupantCount) {
  const pool = await poolPromise;
  await pool.request()
    .input('zone_id', sql.Int, zoneId)
    .input('cctv_alias', sql.VarChar, cctvAlias)
    .input('event_type', sql.VarChar, eventType)
    .input('track_id', sql.Int, trackId)
    .input('occupant_count', sql.Int, occupantCount)
    .query(`
      INSERT INTO cctv_geofence_event (zone_id, cctv_alias, event_type, track_id, occupant_count)
      VALUES (@zone_id, @cctv_alias, @event_type, @track_id, @occupant_count)
    `);
}

module.exports = { selectZonesByAlias, insertZone, insertZoneEvent /*, updateZone, deleteZone, ... */ };
```

```js
// services/geofence.service.js
const query = require('./query/geofence.query');
const { invalidateZoneCache } = require('./geofence.cache');

function deserializeZone(row) {
  return {
    ...row,
    polygon: JSON.parse(row.polygon),
    target_classes: row.target_classes.split(',').map(s => s.trim()),
  };
}

async function getZonesByAlias(alias) {
  const rows = await query.selectZonesByAlias(alias);
  return rows.map(deserializeZone);
}

async function createZone(data) {
  const row = await query.insertZone(data);
  invalidateZoneCache(data.cctv_alias);
  return deserializeZone(row);
}

async function logZoneEvent(zoneId, cctvAlias, eventType, trackId, occupantCount) {
  return query.insertZoneEvent(zoneId, cctvAlias, eventType, trackId, occupantCount);
}

module.exports = { getZonesByAlias, createZone, logZoneEvent /*, updateZone, deleteZone, getZoneEvents */ };
```

`updateZone` / `deleteZone` / `getZoneEvents`도 같은 패턴(쿼리 분리 + 캐시 무효화)이라 지면상 생략합니다. 핵심은 **CRUD가 일어날 때마다 `invalidateZoneCache(cctv_alias)`를 호출**한다는 점인데, 이 캐시가 다음 절의 핵심입니다.

---

## 3. Zone 캐시: 매 이벤트마다 DB를 조회하지 않기

AI 이벤트는 카메라당 초당 여러 번 들어옵니다. 그런데 구역 정의(`cctv_geofence_zone`)는 사용자가 설정 화면에서 가끔 바꿀 뿐, 평상시에는 거의 고정되어 있습니다. 매 이벤트마다 `SELECT ... FROM cctv_geofence_zone`을 날리는 건 낭비입니다.

그래서 **카메라 alias 기준 인메모리 캐시**를 두고, CRUD API가 호출될 때만 무효화합니다.

```js
// services/geofence.cache.js
const { getZonesByAlias } = require('./geofence.service');

const cache = new Map(); // alias -> zones[]

async function getZonesCached(alias) {
  if (cache.has(alias)) return cache.get(alias);
  const zones = await getZonesByAlias(alias);
  cache.set(alias, zones);
  return zones;
}

function invalidateZoneCache(alias) {
  cache.delete(alias);
}

module.exports = { getZonesCached, invalidateZoneCache };
```

순환 참조처럼 보이지만(`geofence.service`가 `geofence.cache`를 쓰고, `geofence.cache`도 `geofence.service`를 참조), 실제로는 판정 엔진이 `getZonesCached`를 쓰고 CRUD가 `invalidateZoneCache`를 쓰는 식으로 호출 방향이 분리되어 있어 문제가 되지 않습니다. 다만 가독성을 위해 실제 코드에서는 캐시 모듈이 `geofence.query`를 직접 참조하도록 한 단계 더 정리하는 편이 깔끔합니다.

---

## 4. AI 이벤트 파이프라인에 판정 로직 연결

이제 핵심입니다. 기존 `aiEvents.controller.js`의 `createFromAi`(단건 이벤트) / `createFromAiWindow`(윈도우 단위 이벤트) 양쪽 모두 결국 탐지 결과를 `saveRawEvent`로 저장하는데, 그 직후에 Geofence 판정을 호출하는 한 줄을 추가합니다.

```js
// controllers/aiEvents.controller.js (일부)
const { evaluateGeofence } = require('../services/geofence.engine');

exports.createFromAi = async (req, res) => {
  // ... 기존 검증 및 saveRawEvent 호출 ...
  await aiEventsService.saveRawEvent(payload);

  // Geofence 판정은 비동기로 던지고 응답을 막지 않는다
  evaluateGeofence(payload).catch(err => console.error('[geofence] evaluate failed', err));

  res.json(ok(null, 'AI 이벤트가 저장되었습니다'));
};
```

`evaluateGeofence`를 `await` 하지 않고 fire-and-forget으로 처리하는 이유는, Geofence 판정 결과가 AI 이벤트 저장 응답을 지연시킬 이유가 없기 때문입니다. 실패하더라도 원본 이벤트 저장에는 영향을 주지 않아야 합니다.

### bbox → 정규화 좌표 → turf 판정

`geofence.engine.js`가 실제 판정을 담당합니다.

```js
// services/geofence.engine.js
const turf = require('@turf/turf');
const { getZonesCached } = require('./geofence.cache');
const { logZoneEvent } = require('./geofence.service');
const { getIo } = require('../config');
const { getZoneState, setZoneState } = require('./geofence.state');
const { createAlarm } = require('./alarms.service');

function toClosedRing(points) {
  const ring = points.map(p => [p.x, p.y]);
  ring.push(ring[0]); // turf 폴리곤은 첫 점과 끝 점이 같아야 함
  return ring;
}

function bottomCenter(bbox, frameSize) {
  const [x, y, w, h] = bbox;
  const [W, H] = frameSize;
  return [(x + w / 2) / W, (y + h) / H]; // 정규화된 [lng, lat] 형태로 사용
}

async function evaluateGeofence({ alias: cctv_alias, frame_size, detections }) {
  const zones = await getZonesCached(cctv_alias);
  if (zones.length === 0 || !frame_size) return;

  const persons = detections.filter(d => d.cls === 'person');

  for (const zone of zones) {
    if (!zone.target_classes.includes('person')) continue;

    const polygon = turf.polygon([toClosedRing(zone.polygon)]);

    const insideTrackIds = new Set();
    for (const det of persons) {
      const point = turf.point(bottomCenter(det.bbox, frame_size));
      if (turf.booleanPointInPolygon(point, polygon)) {
        insideTrackIds.add(det.track_id);
      }
    }

    await reconcileZoneState(zone, cctv_alias, insideTrackIds);
  }
}

module.exports = { evaluateGeofence };
```

`turf.point([x, y])`는 원래 `[lng, lat]` 순서를 기대하는 함수지만, 여기서는 GPS가 아니라 **0~1 정규화 평면 좌표**를 그대로 넣습니다. turf 입장에서는 그냥 2D 평면 위의 점과 폴리곤일 뿐이라 좌표의 "의미"는 상관하지 않습니다 — `booleanPointInPolygon`은 순수 기하 연산이기 때문입니다.

### Zone Occupancy 상태와 diff

상태는 `Map<zone_id, { trackIds: Set, overCapacity: boolean }>` 형태로 메모리에 둡니다.

```js
// services/geofence.state.js
const states = new Map();

function getZoneState(zoneId) {
  return states.get(zoneId);
}

function setZoneState(zoneId, state) {
  states.set(zoneId, state);
}

module.exports = { getZoneState, setZoneState };
```

`reconcileZoneState`가 이전 상태와 비교해 enter/exit를 계산하고, 변화가 있을 때만 소켓 emit과 DB 로그를 수행합니다.

```js
// services/geofence.engine.js (이어서)
async function reconcileZoneState(zone, cctv_alias, insideTrackIds) {
  const prev = getZoneState(zone.id);
  const prevTrackIds = prev?.trackIds ?? new Set();

  const entered = [...insideTrackIds].filter(id => !prevTrackIds.has(id));
  const exited = [...prevTrackIds].filter(id => !insideTrackIds.has(id));

  if (entered.length === 0 && exited.length === 0 && prev) {
    return; // 변화 없음 — 아무 것도 하지 않는다
  }

  const count = insideTrackIds.size;
  const overCapacity = zone.max_count > 0 && count > zone.max_count;

  getIo().emit('geofence:status', {
    cctv_alias,
    zone_id: zone.id,
    zone_name: zone.zone_name,
    color: zone.color,
    count,
    max_count: zone.max_count,
    occupant_track_ids: [...insideTrackIds],
    over_capacity: overCapacity,
    ts: Date.now(),
  });

  for (const id of entered) await logZoneEvent(zone.id, cctv_alias, 'enter', id, count);
  for (const id of exited) await logZoneEvent(zone.id, cctv_alias, 'exit', id, count);

  if (overCapacity && !prev?.overCapacity) {
    await logZoneEvent(zone.id, cctv_alias, 'overcrowd', null, count);
    await createAlarm({
      type: 'geofence_overcrowd',
      cctv_alias,
      message: `${zone.zone_name} 인원 초과 (${count}/${zone.max_count})`,
    });
  }

  setZoneState(zone.id, { trackIds: insideTrackIds, overCapacity });
}
```

---

## 5. Socket.IO 실시간 브로드캐스트

`getIo().emit('geofence:status', ...)`는 기존 `radar:targets`, `cctv:updated`와 동일하게 전체 브로드캐스트입니다. 페이로드는 **구역 단위**로 보냅니다 — 카메라 한 대에 구역이 여러 개일 수 있고, 변화가 없는 구역까지 매번 묶어 보낼 필요가 없기 때문입니다.

```jsonc
// 'geofence:status' 페이로드 예시
{
  "cctv_alias": "CAM-03",
  "zone_id": 7,
  "zone_name": "자재 적치장",
  "color": "#f59e0b",
  "count": 2,
  "max_count": 5,
  "occupant_track_ids": [214, 215],
  "over_capacity": false,
  "ts": 1718000000456
}
```

프론트엔드는 이 이벤트를 구독해 `zone_id` 기준으로 자신이 들고 있는 상태를 갱신합니다. 구체적인 수신·렌더링 로직은 (3)편에서 다룹니다.

---

## 6. 기존 알람 시스템과의 연동

`max_count`를 초과하는 순간(`overCapacity`가 `false → true`로 바뀌는 트랜지션)에만 `createAlarm`을 호출합니다. 기존 알람 파이프라인이 `adia_alarm` 류 테이블에 INSERT 후 `alarm:new`를 emit하는 구조이므로, Geofence도 같은 함수를 재사용합니다.

```js
// services/alarms.service.js (기존 함수 재사용 예시)
async function createAlarm({ type, cctv_alias, message }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('type', sql.VarChar, type)
    .input('cctv_alias', sql.VarChar, cctv_alias)
    .input('message', sql.NVarChar, message)
    .query(`
      INSERT INTO adia_alarm (alarm_type, cctv_alias, message, ack, occurred_at)
      OUTPUT INSERTED.*
      VALUES (@type, @cctv_alias, @message, 0, GETDATE())
    `);

  const alarm = result.recordset[0];
  getIo().emit('alarm:new', alarm);
  return alarm;
}
```

`alarm_type = 'geofence_overcrowd'`로 들어온 알람은 프론트엔드의 알람 목록·배너에서 기존 `fire`, `fall` 등과 동일하게 취급됩니다. **새 알람 타입을 추가했을 뿐, 알람을 표시하는 UI 코드는 손댈 필요가 없습니다** — 기존 시스템을 재사용하는 설계의 이점이 여기서 드러납니다.

다만 한 가지 확인이 필요한 부분이 있습니다. 기존 알람 처리 로직 문서(`AI_ALARM_LOGIC.md`)와 실제 코드 사이에 일부 불일치가 있었던 것으로 기억하는데, 새 알람 타입을 추가하기 전에 **알람 ack 처리·중복 억제(debounce) 로직이 `geofence_overcrowd`에도 동일하게 적용되는지** 점검이 필요합니다. 인원수는 1~2명 단위로 자주 오르내릴 수 있어서, 초과/정상을 반복할 때마다 알람이 반복 생성되면 알람 목록이 금방 도배될 수 있습니다 — 이 부분은 실제 운영 데이터를 보면서 디바운스 시간을 조정해야 합니다(`<측정값>` — 초과 상태 지속 시간 분포를 보고 결정).

---

## 7. 성능 관점에서 고려한 것들

- **turf 연산 비용**: `booleanPointInPolygon`은 폴리곤 정점 수에 비례한 단순 기하 연산입니다. 구역당 정점 5~8개, 카메라당 구역 2~3개, 프레임당 person 탐지 수 개 수준이라면 연산량 자체는 무시할 만한 수준입니다. 다만 카메라 수와 구역 수가 늘어나면 `evaluateGeofence`가 모든 활성 카메라의 모든 이벤트마다 호출되므로, 실제 운영 부하에서 AI 이벤트 처리 루프에 추가되는 지연을 확인해야 합니다(`<측정값>`).
- **상태 변화가 없으면 아무 것도 하지 않는다**: 4절의 diff 로직이 가장 큰 최적화입니다. turf 판정 자체는 매 이벤트마다 돌지만, 그 결과로 인한 **소켓 emit과 DB write는 enter/exit/overcrowd 트랜지션에만** 발생합니다. 카메라 한 대에 사람이 한동안 머물러 있으면 추가 비용이 거의 없습니다.
- **윈도우 프로토콜(V4)과의 관계**: `createFromAiWindow`는 일정 구간의 탐지를 모아 보내는 경로입니다. 프레임 단위로 너무 자주 판정하는 것이 부담스럽다면, `evaluateGeofence` 호출을 윈도우 단위 이벤트에서만 수행하도록 옮기는 것도 선택지입니다. 다만 그러면 "구역 진입"이 윈도우 주기만큼 늦게 반영되므로, 실시간성과 부하 사이의 트레이드오프입니다 — 처음에는 단건 이벤트(`createFromAi`)에 연결해 두고, 부하를 보면서 윈도우 쪽으로 옮길지 결정하는 편이 안전합니다.
- **메모리 상태의 휘발성**: `geofence.state.js`의 `Map`은 프로세스 재시작 시 초기화됩니다. 재시작 직후에는 모든 구역이 "빈 상태"에서 다시 시작하므로, 재시작 시점에 구역 안에 실제로 사람이 있었다면 그 사람의 "enter" 이벤트가 누락될 수 있습니다. 이력 정확도가 중요해지면 재시작 시 최근 AI 이벤트를 한 번 리플레이해 상태를 복원하는 절차를 추가할 수 있습니다 — 지금 단계에서는 실시간 표시가 우선이라 범위 밖으로 두었습니다.

---

## 정리

- Zone CRUD는 기존 `routes → controllers → services → services/query` 4계층, `{success, message, data, error_code}` 응답 규약을 그대로 따라 구현했습니다.
- 판정 로직(`geofence.engine.js`)은 **bbox 하단 중심점 → 정규화 좌표 → `turf.booleanPointInPolygon`** 세 단계로, AI 이벤트 저장 직후 비동기로 호출됩니다.
- `Map<zone_id, {trackIds, overCapacity}>` 상태와 diff를 통해 **변화가 있을 때만** Socket.IO emit / DB 로그 / 알람 생성이 일어나도록 했습니다.
- 알람은 새 타입(`geofence_overcrowd`)만 추가하고 기존 알람 파이프라인(`adia_alarm` INSERT + `alarm:new` emit)을 재사용했습니다.
- 다음 글(3편)에서는 이 `geofence:status` 이벤트를 받아 화면에 그리는 프론트엔드 — 구역 그리기 UI, 실시간 오버레이, 인원수 배지를 다룹니다.
