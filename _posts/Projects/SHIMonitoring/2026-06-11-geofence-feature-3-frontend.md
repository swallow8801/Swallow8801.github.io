---
layout: post
title: "Geofence 기능구현 (3): Zone 설정 UI와 실시간 시각화 프론트엔드 구현"
date: 2026-06-11
series: "Projects"
category: "Projects"
subcategory: "삼성중공업"
tags: [geofence, react, leaflet, ui-ux, socketio, frontend]
description: "카메라 화면 위에 구역을 그리는 설정 UI부터 실시간 인원 오버레이·초과 알람까지, Geofence 프론트엔드 구현과 화면 설계를 정리합니다."
image: /assets/img/posts/geofence-feature-thumb.svg
pinned: false
---

## 들어가며

[(1)편](/blog/geofence-feature-1-design/)에서 카메라-로컬 정규화 폴리곤으로 구역을 정의하기로 했고, [(2)편](/blog/geofence-feature-2-backend/)에서는 백엔드가 AI 탐지 결과를 받아 `geofence:status` 소켓 이벤트로 구역별 인원수를 실시간 브로드캐스트하도록 만들었습니다.

이번 글은 그 데이터를 사용자가 실제로 보고 조작하는 화면입니다. 두 가지 화면이 필요합니다.

1. **구역 설정 화면**: 카메라 화면 위에 폴리곤을 그려 구역을 등록·수정
2. **실시간 모니터링 화면**: 등록된 구역을 오버레이로 표시하고, 인원수·초과 알람을 실시간 갱신

기존 프론트엔드(React 19 + Vite + Leaflet/react-leaflet + Socket.IO client)에는 이미 레이더용 구역 설정 화면(`RadarZoneSettingPane.jsx` + `RadarZoneLayer.jsx`)과 탐지 박스 오버레이(`AiOverlay.jsx`)가 있습니다. 새 컴포넌트는 이 둘의 패턴을 그대로 가져오되, **좌표계가 위경도가 아니라 0~1 정규화 평면**이라는 점만 다릅니다.

---

## 1. API 클라이언트: `src/api/geofence.js`

기존 `src/api/mapPlaces.js`와 동일한 `fetch` + `credentials: 'include'` 패턴입니다.

```js
// src/api/geofence.js
const BASE = '/api/geofence';

async function handleJson(res) {
  const body = await res.json();
  if (!res.ok || body.success === false) {
    throw new Error(body.message || `요청 실패 (${res.status})`);
  }
  return body.data;
}

export function getZones(alias) {
  return fetch(`${BASE}/zones?alias=${encodeURIComponent(alias)}`, {
    credentials: 'include',
  }).then(handleJson);
}

export function createZone(payload) {
  return fetch(`${BASE}/zones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).then(handleJson);
}

export function updateZone(id, payload) {
  return fetch(`${BASE}/zones/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  }).then(handleJson);
}

export function deleteZone(id) {
  return fetch(`${BASE}/zones/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  }).then(handleJson);
}
```

---

## 2. 구역 설정 UI

### 화면 구성

`GeofenceSettingsPane.jsx`는 `SettingsPage.jsx`의 탭 중 하나로 들어갑니다. 왼쪽은 카메라 라이브 화면, 오른쪽은 구역 정보 폼과 등록된 구역 목록입니다.

![Geofence 구역 설정 화면 목업](/assets/img/posts/geofence-zone-setting-mockup.svg)

핵심은 **카메라 화면 위에 클릭으로 폴리곤을 그리는 것**입니다. `RadarZoneSettingPane.jsx`가 Leaflet 지도 위에서 `useMapEvents`의 클릭 좌표(위경도)를 점으로 쌓던 것과 같은 흐름인데, 여기서는 지도가 아니라 `<video>` 또는 스냅샷 `<img>` 위에 SVG 오버레이를 얹고, 클릭 좌표를 컨테이너 크기로 나눠 정규화합니다.

### 클릭으로 폴리곤 그리기 (정규화 좌표)

```jsx
// src/pages/settings/panes/GeofenceSettingsPane.jsx (발췌)
import { useRef, useState } from 'react';

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

export default function GeofenceSettingsPane() {
  const viewRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [drawing, setDrawing] = useState(true);

  const handleViewClick = (e) => {
    if (!drawing) return;
    const rect = viewRef.current.getBoundingClientRect();
    const x = clamp01((e.clientX - rect.left) / rect.width);
    const y = clamp01((e.clientY - rect.top) / rect.height);
    setPoints((prev) => [...prev, { x, y }]);
  };

  return (
    <div className="geofence-settings">
      <div className="geofence-settings__view" ref={viewRef} onClick={handleViewClick}>
        {/* 카메라 라이브 화면 (video 또는 스냅샷 img) */}
        <CameraLiveView alias={selectedAlias} />

        {/* 폴리곤 드로잉 오버레이 */}
        <svg className="geofence-draw-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          {points.length > 1 && (
            <polygon
              points={points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              fill={color}
              fillOpacity={0.2}
              stroke={color}
              strokeWidth={0.5}
              strokeDasharray="2 1.5"
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 100}
              cy={p.y * 100}
              r={1.2}
              fill="#fff"
              stroke={color}
              strokeWidth={0.6}
              onMouseDown={(ev) => startDragPoint(i, ev)}
            />
          ))}
        </svg>
      </div>

      <ZoneFormPanel
        points={points}
        onUndo={() => setPoints((prev) => prev.slice(0, -1))}
        onReset={() => setPoints([])}
        /* ...색상/이름/최대인원 등은 다음 절 */
      />
    </div>
  );
}
```

`viewBox="0 0 100 100"` + `preserveAspectRatio="none"` 조합이 핵심입니다. 폴리곤 좌표를 `0~1` 대신 `0~100`으로 그리면 그대로 **퍼센트 좌표**가 되어, 컨테이너 크기가 반응형으로 바뀌어도 다시 계산할 필요 없이 항상 같은 비율로 그려집니다. `AiOverlay.jsx`가 탐지 박스를 `%` 단위로 그리는 것과 같은 원리이고, 그 덕분에 **Zone 폴리곤과 탐지 박스가 항상 같은 좌표계 위에서 정렬**됩니다.

### 점 드래그로 위치 조정

마지막에 찍은 점의 위치가 살짝 어긋났을 때, 다시 처음부터 그릴 필요 없이 점을 드래그로 옮길 수 있게 했습니다.

```jsx
function startDragPoint(index, ev) {
  ev.stopPropagation(); // 드래그 시작이 새 점 추가로 이어지지 않도록
  const rect = viewRef.current.getBoundingClientRect();

  const onMove = (moveEvent) => {
    const x = clamp01((moveEvent.clientX - rect.left) / rect.width);
    const y = clamp01((moveEvent.clientY - rect.top) / rect.height);
    setPoints((prev) => prev.map((p, i) => (i === index ? { x, y } : p)));
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}
```

`ev.stopPropagation()`을 빼먹으면 드래그를 시작하자마자 컨테이너의 `onClick`이 한 번 더 발생해 점이 추가로 찍히는 버그가 생깁니다 — 실제로 처음 구현했을 때 겪었던 문제라 주석으로 남겨둘 만합니다.

### 구역 정보 폼과 목록

폼은 이름·색상·최대 허용 인원·활성화 토글로 단순합니다. "저장"을 누르면 `points`(정규화 좌표 배열)를 그대로 `polygon`에 담아 `createZone` / `updateZone`을 호출합니다.

```jsx
async function handleSave() {
  if (points.length < 3) {
    alert('구역은 점 3개 이상으로 그려야 합니다');
    return;
  }

  const payload = {
    cctv_alias: selectedAlias,
    zone_name: name,
    polygon: points,
    color,
    max_count: Number(maxCount) || 0,
  };

  if (editingId) {
    await updateZone(editingId, payload);
  } else {
    await createZone(payload);
  }

  await refreshZones();
  resetForm();
}
```

목록의 각 행은 `RadarZoneSettingPane.jsx`의 구역 목록과 동일하게 색상 점 + 이름 + 현재 인원/최대인원 + 수정/삭제 아이콘으로 구성합니다. "현재 인원"은 다음 절에서 만들 실시간 상태(`useGeofenceStatus`)를 설정 화면에서도 함께 구독해 표시합니다 — 구역을 그리면서 바로 "지금 몇 명이 이 안에 있는지" 확인할 수 있어 편집 중 검증에 도움이 됩니다.

---

## 3. 실시간 시각화: `GeofenceOverlay`

설정이 끝나면 실시간 모니터링 화면에 구역과 인원수가 표시되어야 합니다. 기존 `AiOverlay.jsx`가 탐지 박스를 그리는 레이어 위에, Zone 폴리곤과 인원 배지를 그리는 `GeofenceOverlay.jsx`를 추가 레이어로 얹습니다.

![Geofence 실시간 모니터링 화면 목업](/assets/img/posts/geofence-monitoring-mockup.svg)

목업에서 두 가지를 표현했습니다.

- **A구역(자재 적치장)**: 정원 5명 중 2명 — 정상 범위. 구역 안의 사람은 빨간 박스로 강조되고, 구역 밖의 사람은 초록 박스(기존 `AiOverlay` 기본 색상)로 그대로 표시됩니다.
- **B구역(크레인 작업반경)**: 정원 1명인데 2명이 들어와 **초과 상태**. 구역 테두리가 빨간색으로 바뀌고, 배지에 경고 표시가 추가되며, 화면 상단에 알람 배너가 뜹니다.

### Zone 폴리곤 + 인원수 배지 렌더링

```jsx
// src/components/GeofenceOverlay.jsx (발췌)
function polygonCentroid(points) {
  const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return { x, y };
}

export default function GeofenceOverlay({ zones }) {
  return (
    <>
      <svg className="geofence-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
        {zones.map((zone) => (
          <polygon
            key={zone.id}
            points={zone.polygon.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill={zone.over_capacity ? '#dc2626' : zone.color}
            fillOpacity={0.2}
            stroke={zone.over_capacity ? '#dc2626' : zone.color}
            strokeWidth={zone.over_capacity ? 0.8 : 0.5}
          />
        ))}
      </svg>

      {zones.map((zone) => {
        const c = polygonCentroid(zone.polygon);
        return (
          <div
            key={zone.id}
            className={`geofence-badge${zone.over_capacity ? ' is-over' : ''}`}
            style={% raw %}{{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, '--zone-color': zone.color }}{% endraw %}
          >
            <span className="geofence-badge__name">{zone.zone_name}</span>
            <span className="geofence-badge__count">
              {zone.count} / {zone.max_count || '∞'}
              {zone.over_capacity && ' ⚠'}
            </span>
          </div>
        );
      })}
    </>
  );
}
```

폴리곤 정점 좌표를 단순 평균 낸 값을 배지 위치로 쓰고 있습니다. 凹(오목) 다각형에서는 평균점이 폴리곤 바깥으로 나갈 수도 있지만, 실제 구역은 대부분 볼록(convex)에 가까운 사각형~오각형이라 큰 문제가 되지 않았습니다. 더 정확한 중심이 필요하면 `turf.centroid`를 프론트에서도 동일하게 쓸 수 있습니다(turf는 순수 JS라 브라우저에서도 동작).

### 탐지 박스 색상 분기 (구역 안/밖)

`AiOverlay.jsx`는 원래 클래스(`person`, `fire`, `fall`...)별로 박스 색을 정합니다. Geofence가 활성화된 경우, **`person`이면서 어떤 구역의 `occupant_track_ids`에 포함된 `track_id`는 색을 빨간색으로 덮어씁니다.**

```jsx
// src/components/AiOverlay.jsx 일부 수정
const insideZoneTrackIds = useMemo(() => {
  const set = new Set();
  geofenceZones.forEach((z) => z.occupant_track_ids?.forEach((id) => set.add(id)));
  return set;
}, [geofenceZones]);

// 박스 렌더링 부분
const isHighlighted = det.cls === 'person' && insideZoneTrackIds.has(det.track_id);
const boxColor = isHighlighted ? '#dc2626' : (CLASS_COLORS[det.cls] ?? '#16a34a');
```

이 부분이 (2)편에서 백엔드가 `geofence:status`에 `occupant_track_ids`를 함께 보내도록 설계한 이유입니다 — 프론트는 별도 좌표 계산 없이 **백엔드가 이미 판정한 결과(track_id 목록)를 그대로 신뢰**하기만 하면 됩니다. 같은 판정을 프론트에서 다시 하면 좌표 변환 로직이 두 곳에 중복되고, 백엔드와 결과가 미묘하게 어긋날 위험도 생깁니다.

### 초과 알람 배너

`over_capacity: true`인 구역이 하나라도 있으면 화면 상단에 배너를 띄웁니다. 알람 자체는 (2)편에서 기존 알람 파이프라인(`alarm:new`)에 실려 가므로, 이 배너는 **그 카메라 화면을 보고 있는 사용자에게 즉시 시각적으로 알려주는 보조 표시**입니다.

```jsx
{zones.some((z) => z.over_capacity) && (
  <div className="geofence-alert-banner">
    {zones
      .filter((z) => z.over_capacity)
      .map((z) => `${z.zone_name} 인원 초과 (${z.count}/${z.max_count})`)
      .join(' · ')}
  </div>
)}
```

---

## 4. 실시간 상태 동기화: `useGeofenceStatus` 훅

설정 화면과 모니터링 화면 모두 같은 형태의 상태(구역 목록 + 실시간 인원수)가 필요합니다. `useActiveAlarms.js`의 폴링 패턴 대신, 여기서는 (2)편에서 만든 `geofence:status` 소켓 이벤트를 구독하는 훅을 만듭니다.

```js
// src/hooks/useGeofenceStatus.js
import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { getZones } from '../api/geofence';

export function useGeofenceStatus(alias) {
  const socket = useSocket();
  const [zones, setZones] = useState([]);

  const refresh = useCallback(async () => {
    if (!alias) return;
    const data = await getZones(alias);
    setZones(data.map((z) => ({
      ...z,
      count: 0,
      occupant_track_ids: [],
      over_capacity: false,
    })));
  }, [alias]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (status) => {
      if (status.cctv_alias !== alias) return;
      setZones((prev) =>
        prev.map((z) => (z.id === status.zone_id ? { ...z, ...status } : z))
      );
    };

    socket.on('geofence:status', handleStatus);
    return () => socket.off('geofence:status', handleStatus);
  }, [socket, alias]);

  return { zones, refresh };
}
```

- 초기 구역 목록(폴리곤, 색상, 최대인원)은 REST API(`getZones`)로 가져옵니다 — 소켓은 "이미 그려진 구역의 상태 변화"만 알려주지, 구역 정의 자체를 보내지 않습니다.
- 이후 `geofence:status` 이벤트가 올 때마다 해당 `zone_id`의 카운트/점유 정보만 갱신합니다.
- `refresh`를 외부로 노출해, 설정 화면에서 구역을 새로 만들거나 삭제한 직후 목록을 다시 불러올 수 있게 했습니다.

`GeofenceSettingsPane`과 모니터링 화면(`MapView` 또는 `CctvSlot`) 양쪽에서 `useGeofenceStatus(selectedAlias)` 하나만 호출하면 폴리곤·배지·강조색 렌더링에 필요한 데이터가 모두 준비됩니다.

---

## 5. 설정 페이지 탭 연결

마지막으로 `SettingsPage.jsx`의 탭 배열에 항목을 추가합니다. `RadarZoneSettingPane`이 등록된 방식과 동일합니다.

```jsx
// src/pages/settings/SettingsPage.jsx (탭 배열 발췌)
{
  key: 'geofence',
  label: 'Geofence 구역 설정',
  path: '/settings/geofence',
  group: '카메라',
  render: () => <GeofenceSettingsPane />,
}
```

스타일은 기존 `radar-zone-config.scss`를 참고해 같은 톤으로 맞춥니다.

```scss
// src/styles/pages/settings/geofence-zone-config.scss
.geofence-draw-overlay,
.geofence-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.geofence-draw-overlay circle {
  pointer-events: all;
  cursor: grab;
}

.geofence-badge {
  position: absolute;
  transform: translate(-50%, -50%);
  background: rgba(15, 23, 42, 0.85);
  border: 2px solid var(--zone-color, $sam-blue);
  border-radius: 8px;
  padding: 4px 10px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  &.is-over {
    border-color: $c-danger;
    color: $c-danger;
    animation: geofence-pulse 1s ease-in-out infinite;
  }
}

.geofence-alert-banner {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(254, 242, 242, 0.95);
  border: 1px solid $c-danger;
  color: $c-danger;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 8px;
}

@keyframes geofence-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.5); }
  50% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
}
```

---

## 정리 — 시리즈를 마치며

3편에 걸쳐 Geofence 기능을 설계부터 구현까지 정리했습니다.

- **(1) 설계**: person 탐지(픽셀 좌표)와 zone(위경도)의 좌표계가 다르다는 문제를 발견하고, **카메라-로컬 0~1 정규화 폴리곤**으로 새 데이터 모델(`cctv_geofence_zone`, `cctv_geofence_event`)을 설계했습니다.
- **(2) 백엔드**: Zone CRUD API와 캐시, AI 이벤트 파이프라인에 연결한 `turf.booleanPointInPolygon` 판정 엔진, `Map<zone_id, {trackIds, overCapacity}>` 상태 diff, `geofence:status` 소켓 브로드캐스트, 기존 알람 파이프라인 연동까지 구현했습니다.
- **(3) 프론트엔드**: 카메라 화면 위에서 클릭/드래그로 폴리곤을 그리는 설정 UI, `viewBox 0 0 100 100` 트릭으로 탐지 박스와 정렬되는 Zone 오버레이, 백엔드가 보내준 `occupant_track_ids`를 그대로 신뢰하는 색상 강조, 초과 알람 배너까지 만들었습니다.

설계 글에서 미뤄둔 과제도 남아 있습니다. 지금은 **고정 카메라 + 카메라별 닫힌 좌표계**를 전제로 하고 있어서, "지도 위에서 모든 카메라의 구역을 한 번에 보기"는 안 됩니다. 이걸 풀려면 카메라별 Homography 캘리브레이션을 거쳐 정규화 좌표를 위경도로 변환하는 작업이 필요한데, 이번 구조 위에 변환 레이어 하나를 더 얹는 형태로 확장할 수 있도록 `polygon`을 정규화 좌표로 저장해 둔 것이 이후 작업의 발판이 될 것입니다.

당장은 "카메라 화면에서 구역을 그리고, 거기 들어온 사람 수를 실시간으로 본다"는 요구사항을 가장 적은 변경으로 충족하는 데 집중했고, 다음 단계는 실제 운영 데이터를 보면서 임계치·디바운스 값을 튜닝하는 것이 될 것 같습니다.
