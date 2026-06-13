---
layout: post
title: "지오펜스 도형 ② 타원: 회전을 더하면 좌표 변환이 필요하다"
date: 2026-06-15
series: "Study"
category: "Backend"
subcategory: "Geofence"
tags: [geofence, geometry, algorithm, javascript, svg]
description: "회전된 타원형 지오펜스를 저장하는 방식과, 점을 타원의 로컬 좌표계로 역회전시켜 포함 여부를 판정하는 공식을 인터랙티브 데모로 정리합니다."
image: /assets/img/posts/geofence-shapes-ellipse.svg
pinned: false
---

## 들어가며

[지난 글](/blog/geofence-shapes-rectangle-circle/)에서는 사각형(AABB)과 원으로 지오펜스를 표현하고, 비교 연산 몇 개로 포함 여부를 판정했습니다. 두 도형에는 공통된 전제가 있었습니다 — **영역이 회전되어 있지 않다**는 것입니다.

실제 현장에는 도로·통로·컨베이어 벨트처럼 어떤 각도로 길게 뻗은 구역이 자주 있습니다. 이런 구역을 사각형이나 원으로 감싸면 실제보다 훨씬 넓은 영역을 잡아야 합니다. 이번 글에서는 회전을 표현할 수 있는 가장 단순한 도형인 **타원**을 통해, 회전이 들어간 영역을 어떻게 저장하고 판정하는지 살펴봅니다.

---

## 타원 저장 형식: 중심·반경·회전각

타원은 중심점, 가로·세로 반경, 회전각 — 다섯 개의 값으로 표현합니다.

```json
{ "type": "ellipse", "cx": 200, "cy": 130, "rx": 140, "ry": 70, "rotation": 25 }
```

`rotation`은 타원의 장축이 x축 기준으로 얼마나 기울어져 있는지를 도(degree) 단위로 나타냅니다. 사각형·원과 비교하면 값이 하나(`rotation`) 늘었을 뿐이지만, 판정 공식에는 **좌표 변환**이라는 단계가 새로 추가됩니다.

---

## 회전이 없는 타원: 원의 판정식을 일반화하기

회전각이 0°인 타원은 사각형·원과 같은 방식으로 단순합니다. 점 `(px, py)`를 중심 기준 좌표 `(dx, dy) = (px-cx, py-cy)`로 옮긴 뒤, 각 축을 반경으로 나눈 값의 제곱합이 1 이하인지 봅니다.

```js
function inEllipse0(px, py, e) {
  var dx = px - e.cx;
  var dy = py - e.cy;
  return (dx / e.rx) * (dx / e.rx) + (dy / e.ry) * (dy / e.ry) <= 1;
}
```

지난 글의 원 판정식(`dx² + dy² <= r²`)을 양변을 `r²`으로 나누면 `(dx/r)² + (dy/r)² <= 1`이 됩니다. 이 식에서 가로·세로 반경을 다르게 쓰면 그대로 타원의 판정식이 됩니다. 문제는 타원이 회전했을 때입니다 — `dx`, `dy`를 그대로 반경으로 나누면, 기울어진 타원을 화면 축에 맞춰 늘린 모양으로 잘못 판정하게 됩니다.

---

## 회전이 있는 타원: 좌표계를 거꾸로 돌린다

해법은 점을 직접 판정하는 대신, **타원이 회전하기 전의 좌표계로 점을 되돌리는** 것입니다. 타원이 각도 θ만큼 회전했다면, 점을 중심 기준으로 `-θ`만큼 회전시키면 "타원이 회전하지 않았던 시절"의 좌표를 얻을 수 있습니다.

```js
function inEllipse(px, py, e) {
  var dx = px - e.cx;
  var dy = py - e.cy;
  var rad = e.rotation * Math.PI / 180;

  // 점을 -rotation만큼 회전 → 타원의 "로컬 좌표계"
  var localX = dx * Math.cos(rad) + dy * Math.sin(rad);
  var localY = -dx * Math.sin(rad) + dy * Math.cos(rad);

  return (localX / e.rx) * (localX / e.rx) +
         (localY / e.ry) * (localY / e.ry) <= 1;
}
```

`localX`, `localY`를 구하고 나면, 앞에서 본 회전 없는 판정식을 그대로 적용할 수 있습니다. 즉 회전이 있는 도형의 판정은 **"좌표를 도형의 로컬 좌표계로 옮긴 뒤, 회전 없는 판정식을 재사용"**하는 두 단계로 나뉩니다.

---

## 인터랙티브 데모: 회전각을 돌리고 점을 옮겨보기

아래 데모에서 회전각 슬라이더를 움직이면 타원과 함께 점선으로 표시된 장축·단축도 같이 회전합니다. 점을 드래그해 보면, 같은 위치라도 회전각에 따라 포함 여부가 달라지는 것을 볼 수 있습니다. 카드의 `localX`, `localY` 값은 점을 타원의 로컬 좌표계로 옮긴 결과이고, 그 아래 식이 1 이하인지가 포함 여부를 결정합니다.

<div class="geo-ellipse">
  <svg class="geo-ellipse__svg" id="geoellipse-svg" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
    <g id="geoellipse-group" transform="rotate(25 200 130)">
      <line class="geo-ellipse__axis" x1="60" y1="130" x2="340" y2="130"></line>
      <line class="geo-ellipse__axis" x1="200" y1="60" x2="200" y2="200"></line>
      <ellipse class="geo-ellipse__shape" id="geoellipse-shape" cx="200" cy="130" rx="140" ry="70"></ellipse>
    </g>
    <circle class="geo-ellipse__point" id="geoellipse-point" cx="330" cy="50" r="9"></circle>
  </svg>
  <div class="geo-ellipse__controls">
    <label class="geo-ellipse__field">
      <span>회전각 (rotation) <strong id="geoellipse-angle-out">25°</strong></span>
      <input type="range" id="geoellipse-angle" min="0" max="360" value="25">
    </label>
    <div class="geo-ellipse__card">
      <code class="geo-ellipse__formula" id="geoellipse-formula">(local 84/140)² + (local -127/70)² = 3.68</code>
      <span class="geo-ellipse__badge" id="geoellipse-badge">이탈</span>
    </div>
  </div>
  <p class="geo-ellipse__hint">점선은 타원의 장축·단축(로컬 좌표계의 x·y축)입니다. 회전각을 0°로 두면 화면의 가로·세로와 일치합니다.</p>
</div>

<style>
.geo-ellipse { margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.geo-ellipse__svg { width: 100%; height: auto; touch-action: none; display: block; }
.geo-ellipse__shape { fill: rgba(37,99,235,.08); stroke: #2563eb; stroke-width: 2; stroke-dasharray: 6 4; transition: fill .15s; }
.geo-ellipse__shape.is-active { fill: rgba(37,99,235,.28); }
.geo-ellipse__axis { stroke: #8fa3bf; stroke-width: 1; stroke-dasharray: 3 3; }
.geo-ellipse__point { fill: #ffffff; stroke: #0f1f3d; stroke-width: 2.5; cursor: grab; }
.geo-ellipse__point:active { cursor: grabbing; }
.geo-ellipse__controls { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 16px; align-items: stretch; }
.geo-ellipse__field { display: flex; flex-direction: column; gap: 8px; font-size: 13px; color: #4a6080; font-weight: 600; justify-content: center; }
.geo-ellipse__field span { display: flex; justify-content: space-between; }
.geo-ellipse__field strong { color: #0f1f3d; font-weight: 700; }
.geo-ellipse__field input[type="range"] { width: 100%; accent-color: #2563eb; }
.geo-ellipse__card { padding: 12px 14px; background: #ffffff; border: 1px solid #d8e3f0; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; justify-content: center; }
.geo-ellipse__formula { font-size: 12px; }
.geo-ellipse__badge { align-self: flex-start; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #f4f7fb; color: #8fa3bf; }
.geo-ellipse__badge.is-in { background: #2563eb; color: #ffffff; }
.geo-ellipse__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
@media (max-width: 600px) {
  .geo-ellipse__controls { grid-template-columns: 1fr; }
}
</style>

<script>
(function () {
  var svg = document.getElementById('geoellipse-svg');
  var group = document.getElementById('geoellipse-group');
  var shape = document.getElementById('geoellipse-shape');
  var point = document.getElementById('geoellipse-point');
  var angleInput = document.getElementById('geoellipse-angle');
  var angleOut = document.getElementById('geoellipse-angle-out');
  var formula = document.getElementById('geoellipse-formula');
  var badge = document.getElementById('geoellipse-badge');
  if (!svg || !group || !point) return;

  var CX = 200, CY = 130, RX = 140, RY = 70;
  var pos = { x: 330, y: 50 };
  var angle = 25;

  function update() {
    group.setAttribute('transform', 'rotate(' + angle + ' ' + CX + ' ' + CY + ')');
    point.setAttribute('cx', pos.x);
    point.setAttribute('cy', pos.y);

    var rad = angle * Math.PI / 180;
    var dx = pos.x - CX;
    var dy = pos.y - CY;
    var localX = dx * Math.cos(rad) + dy * Math.sin(rad);
    var localY = -dx * Math.sin(rad) + dy * Math.cos(rad);
    var value = (localX / RX) * (localX / RX) + (localY / RY) * (localY / RY);
    var inside = value <= 1;

    shape.classList.toggle('is-active', inside);
    formula.textContent =
      '(local ' + localX.toFixed(0) + '/' + RX + ')² + (local ' + localY.toFixed(0) + '/' + RY + ')² = ' + value.toFixed(2);
    badge.textContent = inside ? '포함' : '이탈';
    badge.classList.toggle('is-in', inside);
    angleOut.textContent = angle + '°';
  }

  function clientToSvg(evt) {
    var box = svg.getBoundingClientRect();
    return {
      x: (evt.clientX - box.left) * (400 / box.width),
      y: (evt.clientY - box.top) * (260 / box.height)
    };
  }

  angleInput.addEventListener('input', function () {
    angle = parseFloat(angleInput.value);
    update();
  });

  var dragging = false;
  point.addEventListener('pointerdown', function (e) {
    dragging = true;
    point.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var p = clientToSvg(e);
    pos.x = Math.max(9, Math.min(391, p.x));
    pos.y = Math.max(9, Math.min(251, p.y));
    update();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    point.addEventListener(ev, function () { dragging = false; });
  });

  update();
})();
</script>

회전각을 0°로 돌리면 점선 축이 화면의 가로·세로와 일치하고, `localX`/`localY`가 `dx`/`dy`와 같아집니다. 즉 회전이 없는 경우는 이 판정식의 특수한 형태(θ=0)일 뿐입니다.

---

## 같은 방법으로: 회전된 사각형(OBB)

이 좌표 변환 기법은 타원에만 한정되지 않습니다. 회전된 사각형, 즉 **OBB(Oriented Bounding Box)**도 같은 방식으로 판정합니다. 점을 사각형의 로컬 좌표계로 옮긴 뒤, 1편의 `inRect`를 절댓값 비교 형태로 바꿔 적용하면 됩니다.

```js
function inOBB(px, py, box) {
  var dx = px - box.cx;
  var dy = py - box.cy;
  var rad = box.rotation * Math.PI / 180;
  var localX = dx * Math.cos(rad) + dy * Math.sin(rad);
  var localY = -dx * Math.sin(rad) + dy * Math.cos(rad);

  return Math.abs(localX) <= box.width / 2 &&
         Math.abs(localY) <= box.height / 2;
}
```

좌표 변환 단계(`dx, dy` → `localX, localY`)는 도형이 바뀌어도 그대로이고, 그 뒤에 적용하는 판정식만 도형의 형태에 따라 달라집니다. 회전을 지원하려는 도형이 늘어나도 "로컬 좌표계로 변환"이라는 공통 단계는 재사용할 수 있습니다.

---

## 실전: 좁고 긴 통로 같은 구역

회전 타원이나 OBB는 도로·복도·컨베이어 벨트처럼 어떤 각도로 길게 뻗은 구역을 표현할 때 사각형·원보다 실제 형태에 훨씬 가깝습니다. 같은 너비의 통로를 AABB로 감싸면 회전각이 클수록 실제 통로보다 훨씬 넓은 사각형이 되고, 통로 옆 공간까지 구역에 포함되면서 오탐이 늘어납니다. 회전을 표현할 수 있는 도형을 쓰면 이 여유 공간을 줄일 수 있습니다.

다만 타원과 OBB도 여전히 "정해진 형태"라는 한계가 있습니다. 꺾인 통로나 비정형 매장처럼 직선·곡선이 섞인 경계는 이 두 도형으로 표현하기 어렵습니다. 다음 글(3편)에서는 꼭짓점을 자유롭게 추가할 수 있는 **폴리곤**으로 이 문제를 다룹니다.

---

## 정리

회전이 들어간 도형을 판정하는 핵심은 **점을 도형의 로컬 좌표계로 옮기는 것**입니다. 점을 중심 기준으로 `-θ`만큼 회전시키면, 회전이 없는 도형의 판정식을 그대로 재사용할 수 있습니다. 이 기법은 타원뿐 아니라 회전된 사각형(OBB)에도 동일하게 적용됩니다.

그래도 도형의 "종류"는 미리 정해야 한다는 제약은 남습니다. 다음 글에서는 꼭짓점 개수에 제한이 없는 폴리곤으로, 임의의 형태를 어떻게 저장하고 ray-casting·winding number로 판정하는지 살펴봅니다.
