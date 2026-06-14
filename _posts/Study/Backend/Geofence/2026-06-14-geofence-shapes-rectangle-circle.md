---
layout: post
title: "지오펜스 도형 ① 사각형·원: 가장 단순한 포함 판정"
date: 2026-06-14
series: "Study"
category: "Backend"
subcategory: "Geofence"
tags: [geofence, geometry, algorithm, javascript, svg]
description: "지오펜스를 사각형(AABB)·원으로 저장할 때의 데이터 형식과, 점이 그 안에 있는지 판정하는 point-in-rect·point-in-circle 공식을 인터랙티브 데모로 정리합니다."
image: /assets/img/posts/geofence-shapes-rectangle-circle.svg
pinned: false
---

## 들어가며

이번 글부터 3편에 걸쳐 **지오펜스(geofence)를 어떤 도형으로 저장하고, 점이 그 도형 안에 들어왔는지를 어떻게 판정하는지**를 정리합니다. 1편은 가장 단순한 사각형(AABB)·원, 2편은 회전이 들어간 타원, 3편은 임의의 폴리곤(ray-casting·winding number)을 다룹니다. 3편에서는 이 블로그에 올린 SHIMonitoring 프로젝트의 폴리곤 기반 지오펜스 구현과도 연결합니다.

포함 판정(point-in-shape)은 모니터링·출입 통제·근접 알람 같은 서비스에서 매 프레임·매 이벤트마다 반복되는 연산입니다. 도형을 어떻게 고르느냐에 따라 저장해야 하는 값의 개수와 판정 공식의 복잡도가 달라집니다. 가장 단순한 두 도형, 사각형과 원부터 시작합니다.

---

## 사각형(AABB): 네 번의 비교로 끝나는 판정

축에 정렬된 사각형, 즉 **AABB(Axis-Aligned Bounding Box)**는 회전이 없는 가장 단순한 지오펜스 형태입니다. 좌상단 좌표와 너비·높이, 또는 두 꼭짓점만 있으면 영역이 정해집니다.

```json
{ "type": "rect", "x": 30, "y": 25, "width": 160, "height": 110 }
```

판정 공식은 x축·y축 범위에 점이 들어가는지를 각각 확인하는 것뿐입니다.

```js
function inRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width &&
         py >= rect.y && py <= rect.y + rect.height;
}
```

곱셈도, 제곱근도 없이 비교 연산 네 번으로 끝나는 O(1) 연산입니다. 건물 평면도의 방·매대·창고 구역처럼 축에 정렬된 영역을 표현할 때 가장 먼저 떠올리게 되는 도형입니다.

---

## 원: 중심과 반경만으로 충분하다

원은 중심점 `(cx, cy)`와 반경 `r`, 단 세 개의 값으로 영역을 표현합니다.

```json
{ "type": "circle", "cx": 290, "cy": 160, "r": 75 }
```

판정은 점과 중심 사이의 거리가 반경 이하인지를 보면 됩니다.

```js
function inCircle(px, py, circle) {
  var dx = px - circle.cx;
  var dy = py - circle.cy;
  return (dx * dx + dy * dy) <= circle.r * circle.r;
}
```

"특정 장비 반경 5m 이내 접근 감지"처럼 거리 기반 규칙을 그대로 표현할 수 있다는 게 원의 장점입니다. 사각형보다 저장해야 할 값이 하나 적고, 회전이라는 개념 자체가 없어 항상 같은 모양을 유지합니다.

---

## 인터랙티브 데모: 점을 옮겨 포함 여부 확인하기

아래 데모에는 사각형 구역 하나와 원 구역 하나가 있습니다. 가운데의 흰 점을 드래그(또는 터치)해서 옮겨보세요. 점이 각 구역에 들어가면 구역이 파랗게 채워지고, 아래 카드의 판정식 값과 "포함/이탈" 표시가 실시간으로 바뀝니다.

<div class="geo-shapes">
  <svg class="geo-shapes__svg" id="geoshapes-svg" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
    <rect class="geo-shapes__zone" id="geoshapes-rect" x="30" y="25" width="160" height="110" rx="6"></rect>
    <circle class="geo-shapes__zone" id="geoshapes-circle" cx="290" cy="160" r="75"></circle>
    <circle class="geo-shapes__point" id="geoshapes-point" cx="110" cy="80" r="9"></circle>
  </svg>
  <div class="geo-shapes__status">
    <div class="geo-shapes__card">
      <div class="geo-shapes__card-title">사각형 (AABB)</div>
      <code class="geo-shapes__formula" id="geoshapes-rect-formula">30 ≤ 110 ≤ 190 &amp; 25 ≤ 80 ≤ 135</code>
      <span class="geo-shapes__badge" id="geoshapes-rect-badge">포함</span>
    </div>
    <div class="geo-shapes__card">
      <div class="geo-shapes__card-title">원</div>
      <code class="geo-shapes__formula" id="geoshapes-circle-formula">dx²+dy² = 38800 vs r² = 5625</code>
      <span class="geo-shapes__badge" id="geoshapes-circle-badge">이탈</span>
    </div>
  </div>
  <p class="geo-shapes__hint">점을 드래그하면 두 구역의 포함 여부와 판정식 값이 함께 바뀝니다.</p>
</div>

<style>
.geo-shapes { margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.geo-shapes__svg { width: 100%; height: auto; touch-action: none; display: block; }
.geo-shapes__zone { fill: rgba(37,99,235,.08); stroke: #2563eb; stroke-width: 2; stroke-dasharray: 6 4; transition: fill .15s; }
.geo-shapes__zone.is-active { fill: rgba(37,99,235,.28); }
.geo-shapes__point { fill: #ffffff; stroke: #0f1f3d; stroke-width: 2.5; cursor: grab; }
.geo-shapes__point:active { cursor: grabbing; }
.geo-shapes__status { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
.geo-shapes__card { padding: 12px 14px; background: #ffffff; border: 1px solid #d8e3f0; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.geo-shapes__card-title { font-size: 13px; color: #0f1f3d; font-weight: 700; }
.geo-shapes__formula { font-size: 12px; }
.geo-shapes__badge { align-self: flex-start; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #f4f7fb; color: #8fa3bf; }
.geo-shapes__badge.is-in { background: #2563eb; color: #ffffff; }
.geo-shapes__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
@media (max-width: 600px) {
  .geo-shapes__status { grid-template-columns: 1fr; }
}
</style>

<script>
(function () {
  var svg = document.getElementById('geoshapes-svg');
  var point = document.getElementById('geoshapes-point');
  var rectEl = document.getElementById('geoshapes-rect');
  var circleEl = document.getElementById('geoshapes-circle');
  var rectFormula = document.getElementById('geoshapes-rect-formula');
  var circleFormula = document.getElementById('geoshapes-circle-formula');
  var rectBadge = document.getElementById('geoshapes-rect-badge');
  var circleBadge = document.getElementById('geoshapes-circle-badge');
  if (!svg || !point) return;

  var RECT = { x: 30, y: 25, width: 160, height: 110 };
  var CIRCLE = { cx: 290, cy: 160, r: 75 };
  var pos = { x: 110, y: 80 };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function update() {
    point.setAttribute('cx', pos.x);
    point.setAttribute('cy', pos.y);

    var inRect = pos.x >= RECT.x && pos.x <= RECT.x + RECT.width &&
                  pos.y >= RECT.y && pos.y <= RECT.y + RECT.height;
    var dx = pos.x - CIRCLE.cx;
    var dy = pos.y - CIRCLE.cy;
    var distSq = dx * dx + dy * dy;
    var radiusSq = CIRCLE.r * CIRCLE.r;
    var inCircle = distSq <= radiusSq;

    rectEl.classList.toggle('is-active', inRect);
    circleEl.classList.toggle('is-active', inCircle);

    rectFormula.textContent =
      RECT.x + ' ≤ ' + Math.round(pos.x) + ' ≤ ' + (RECT.x + RECT.width) +
      ' & ' + RECT.y + ' ≤ ' + Math.round(pos.y) + ' ≤ ' + (RECT.y + RECT.height);
    circleFormula.textContent =
      'dx²+dy² = ' + Math.round(distSq) + ' vs r² = ' + radiusSq;

    rectBadge.textContent = inRect ? '포함' : '이탈';
    rectBadge.classList.toggle('is-in', inRect);
    circleBadge.textContent = inCircle ? '포함' : '이탈';
    circleBadge.classList.toggle('is-in', inCircle);
  }

  function clientToSvg(evt) {
    var box = svg.getBoundingClientRect();
    return {
      x: (evt.clientX - box.left) * (400 / box.width),
      y: (evt.clientY - box.top) * (260 / box.height)
    };
  }

  var dragging = false;
  point.addEventListener('pointerdown', function (e) {
    dragging = true;
    point.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var p = clientToSvg(e);
    pos.x = clamp(p.x, 9, 391);
    pos.y = clamp(p.y, 9, 251);
    update();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    point.addEventListener(ev, function () { dragging = false; });
  });

  update();
})();
</script>

원의 판정식이 `dx²+dy²`와 `r²`을 그대로 비교하고 있다는 점에 주목해 주세요. 거리를 직접 비교하려면 `Math.sqrt(dx*dx + dy*dy) <= r`처럼 제곱근을 계산해야 하지만, 양쪽을 제곱한 값으로 비교해도 결과는 같습니다.

---

## 왜 `Math.sqrt`를 피하는가

거리 비교에서 제곱근이 필요한 이유는 "거리"라는 개념 자체가 `sqrt(dx² + dy²)`로 정의되기 때문입니다. 하지만 두 값을 비교하는 것이 목적이라면, 두 변의 제곱을 비교해도 대소 관계는 바뀌지 않습니다. `sqrt`는 단조증가 함수이기 때문입니다.

```js
// 이렇게 쓰지 않고
Math.sqrt(dx * dx + dy * dy) <= r

// 이렇게 쓴다
(dx * dx + dy * dy) <= r * r
```

점 하나, 원 하나를 비교할 때는 차이가 미미하지만, 한 프레임에서 여러 사람의 위치와 여러 구역을 동시에 비교하는 모니터링 파이프라인처럼 "점 N개 × 원형 구역 M개"를 매번 반복하는 상황에서는 `sqrt` 호출 횟수가 N×M만큼 누적됩니다. 제곱 비교로 바꾸면 이 호출을 전부 없앨 수 있습니다.

---

## 실전: 어떤 구역에 어떤 도형을 쓸까

- **사각형(AABB)**: 방·매대·창고 구역처럼 축에 정렬된 직사각형 영역. 저장 값이 4개뿐이고 판정도 가장 단순해서, 별도 요구사항이 없다면 기본값으로 삼기 좋습니다.
- **원**: "이 지점 반경 Xm 이내"처럼 거리 기반 규칙을 그대로 표현해야 할 때. 장비 주변 위험구역, 특정 좌표 근접 알람 등에 적합합니다.

다만 실제 현장에는 기둥이나 경사로 때문에 축에 정렬되지 않은 구역, 또는 좁고 긴 통로처럼 사각형도 원도 잘 맞지 않는 형태가 자주 등장합니다. 다음 글에서는 **회전이 들어간 타원**으로 이런 형태를 표현하고 판정하는 방법을 다룹니다.

---

## 정리

사각형(AABB)과 원은 저장 값이 3~4개뿐이고, 판정도 비교 연산 몇 번으로 끝나는 O(1) 연산입니다. 거리 기반 판정에서는 `Math.sqrt`를 피하고 제곱 값을 비교하는 것만으로도 반복 연산의 비용을 줄일 수 있습니다.

그러나 두 도형 모두 "회전이 없다"는 전제를 깔고 있습니다. 다음 글(2편)에서는 이 전제가 깨졌을 때 — 즉 영역이 어떤 각도로 기울어져 있을 때 — 좌표를 어떻게 변환해서 같은 방식으로 판정할 수 있는지, 타원을 예로 살펴봅니다.
