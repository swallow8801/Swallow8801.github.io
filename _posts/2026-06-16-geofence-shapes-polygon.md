---
layout: post
title: "지오펜스 도형 ③ 폴리곤: ray-casting과 winding number"
date: 2026-06-16
series: "Study"
category: "Backend"
subcategory: "Geofence"
tags: [geofence, geometry, algorithm, javascript, svg]
description: "임의의 폴리곤 지오펜스를 좌표 배열로 저장하고, ray-casting·winding number로 점의 포함 여부를 판정하는 알고리즘을 인터랙티브 데모와 함께 정리하고 SHIMonitoring 구현과 비교합니다."
image: /assets/img/posts/geofence-shapes-polygon.svg
pinned: false
---

## 들어가며

[1편](/blog/geofence-shapes-rectangle-circle/)에서는 사각형과 원, [2편](/blog/geofence-shapes-ellipse/)에서는 회전이 들어간 타원과 OBB를 다뤘습니다. 두 글 모두 "도형의 종류가 미리 정해져 있다"는 전제가 있었습니다. 사각형이면 네 개의 모서리, 타원이면 정해진 곡률을 가진 형태입니다.

폴리곤은 이 전제를 없앤 도형입니다. 꼭짓점을 몇 개든 자유롭게 둘 수 있고, 오목한(non-convex) 형태도 표현할 수 있습니다. 그 대신 판정 알고리즘은 사각형·원·타원보다 한 단계 복잡해집니다. 이 글에서는 가장 널리 쓰이는 두 알고리즘인 ray-casting과 winding number를 살펴보고, 이 블로그의 SHIMonitoring 프로젝트에서 실제로 어떻게 썼는지 연결해 봅니다.

---

## 폴리곤 저장 형식: 좌표 배열

사각형·원·타원은 `x`, `cx`, `rx`, `rotation`처럼 의미가 정해진 키-값으로 도형을 표현했습니다. 폴리곤은 다릅니다. 꼭짓점 좌표를 순서대로 나열한 **배열**, 단 하나의 값으로 도형을 표현합니다.

```json
{ "type": "polygon", "points": [[60,40],[340,40],[340,100],[200,100],[200,160],[340,160],[340,220],[60,220]] }
```

키가 고정되어 있지 않으니 꼭짓점이 3개든 30개든 같은 형식으로 저장할 수 있고, 사용자가 화면에 점을 찍어 영역을 그리는 편집 UI와도 잘 맞습니다. 점을 시계 방향으로 나열하든 반시계 방향으로 나열하든 도형의 모양 자체는 같고, 아래에서 볼 ray-casting 판정 결과도 방향에 영향을 받지 않습니다.

---

## Ray-casting: 오른쪽으로 그은 직선과 변의 교차 횟수

Ray-casting(또는 crossing number) 알고리즘의 아이디어는 단순합니다. 점에서 한쪽 방향, 흔히 오른쪽으로 무한히 뻗는 직선을 긋고, 그 직선이 폴리곤의 변과 몇 번 교차하는지 셉니다. **교차 횟수가 홀수면 점은 폴리곤 내부, 짝수면 외부**입니다.

직관적으로 보면, 내부의 한 점에서 출발한 직선은 폴리곤 경계를 "나가면서" 한 번 교차합니다. 외부의 점에서 출발한 직선은 폴리곤에 "들어갔다 나가는" 짝을 이루며 짝수 번 교차합니다.

```js
function inPolygonRayCast(px, py, points) {
  var inside = false;
  for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
    var xi = points[i][0], yi = points[i][1];
    var xj = points[j][0], yj = points[j][1];

    var crosses = (yi > py) !== (yj > py);
    if (crosses) {
      var ix = (xj - xi) * (py - yi) / (yj - yi) + xi;
      if (px < ix) inside = !inside;
    }
  }
  return inside;
}
```

`(yi > py) !== (yj > py)`는 변의 두 끝점이 점의 y좌표를 기준으로 서로 다른 쪽에 있는지, 즉 이 변이 점이 그은 수평선과 교차하는지를 봅니다. 교차한다면 교차점의 x좌표(`ix`)를 구하고, 그 교차점이 점보다 오른쪽에 있을 때(`px < ix`)만 `inside`를 뒤집습니다. 모든 변에 대해 이 토글을 반복하면, 최종 `inside` 값은 "오른쪽 교차 횟수의 홀짝"과 정확히 같아집니다.

곱셈과 나눗셈만으로 이루어져 있고, 변의 개수만큼 반복하는 O(n) 연산입니다. 사각형·원의 O(1)보다는 느리지만, 꼭짓점이 수십 개인 폴리곤이라도 한 점을 판정하는 데 걸리는 시간은 여전히 마이크로초 단위입니다.

---

## 인터랙티브 데모: 오목한 폴리곤에서 ray-casting 확인하기

아래 도형은 "C"자 모양의 오목한 폴리곤입니다. 오른쪽 중앙이 안쪽으로 패여 있어, 폴리곤을 감싸는 사각형 안에 있다고 해서 폴리곤 내부에 있는 것은 아닙니다.

흰 점을 드래그하면 점에서 오른쪽으로 그은 점선(ray)이 그려지고, 그 점선이 폴리곤 변과 만나는 교차점이 파란 점으로 표시됩니다. 교차점 개수가 홀수면 포함, 짝수면 이탈입니다. 점을 오른쪽 중앙의 패인 부분(노치) 안으로 옮겨 보세요. 교차점이 0개가 되면서 "이탈"로 바뀝니다 — 사각형 안쪽처럼 보이는 위치라도 폴리곤 경계 밖일 수 있다는 뜻입니다.

<div class="geo-polygon">
  <svg class="geo-polygon__svg" id="geopolygon-svg" viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg">
    <polygon class="geo-polygon__shape" id="geopolygon-shape" points="60,40 340,40 340,100 200,100 200,160 340,160 340,220 60,220"></polygon>
    <circle class="geo-polygon__vertex" cx="60" cy="40" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="340" cy="40" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="340" cy="100" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="200" cy="100" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="200" cy="160" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="340" cy="160" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="340" cy="220" r="3"></circle>
    <circle class="geo-polygon__vertex" cx="60" cy="220" r="3"></circle>
    <line class="geo-polygon__ray" id="geopolygon-ray" x1="100" y1="130" x2="400" y2="130"></line>
    <g id="geopolygon-hits"></g>
    <circle class="geo-polygon__point" id="geopolygon-point" cx="100" cy="130" r="9"></circle>
  </svg>
  <div class="geo-polygon__status">
    <div class="geo-polygon__card">
      <div class="geo-polygon__card-title">오른쪽 교차 횟수</div>
      <code class="geo-polygon__formula" id="geopolygon-count">교차점 1개 → 홀수</code>
    </div>
    <div class="geo-polygon__card">
      <div class="geo-polygon__card-title">판정 결과</div>
      <span class="geo-polygon__badge is-in" id="geopolygon-badge">포함</span>
    </div>
  </div>
  <p class="geo-polygon__hint">점을 드래그하면 점에서 오른쪽으로 그은 점선(ray)과, 그 선이 폴리곤 변과 만나는 교차점(파란 점)이 함께 표시됩니다.</p>
</div>

<style>
.geo-polygon { margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.geo-polygon__svg { width: 100%; height: auto; touch-action: none; display: block; }
.geo-polygon__shape { fill: rgba(37,99,235,.08); stroke: #2563eb; stroke-width: 2; transition: fill .15s; }
.geo-polygon__shape.is-active { fill: rgba(37,99,235,.28); }
.geo-polygon__vertex { fill: #ffffff; stroke: #8fa3bf; stroke-width: 1.5; }
.geo-polygon__ray { stroke: #4a6080; stroke-width: 1.5; stroke-dasharray: 4 4; }
.geo-polygon__hit { fill: #2563eb; }
.geo-polygon__point { fill: #ffffff; stroke: #0f1f3d; stroke-width: 2.5; cursor: grab; }
.geo-polygon__point:active { cursor: grabbing; }
.geo-polygon__status { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
.geo-polygon__card { padding: 12px 14px; background: #ffffff; border: 1px solid #d8e3f0; border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.geo-polygon__card-title { font-size: 13px; color: #0f1f3d; font-weight: 700; }
.geo-polygon__formula { font-size: 12px; }
.geo-polygon__badge { align-self: flex-start; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: #f4f7fb; color: #8fa3bf; }
.geo-polygon__badge.is-in { background: #2563eb; color: #ffffff; }
.geo-polygon__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
@media (max-width: 600px) {
  .geo-polygon__status { grid-template-columns: 1fr; }
}
</style>

<script>
(function () {
  var svg = document.getElementById('geopolygon-svg');
  var shape = document.getElementById('geopolygon-shape');
  var point = document.getElementById('geopolygon-point');
  var ray = document.getElementById('geopolygon-ray');
  var hits = document.getElementById('geopolygon-hits');
  var countEl = document.getElementById('geopolygon-count');
  var badge = document.getElementById('geopolygon-badge');
  if (!svg || !shape || !point) return;

  var POLY = [[60,40],[340,40],[340,100],[200,100],[200,160],[340,160],[340,220],[60,220]];
  var pos = { x: 100, y: 130 };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function update() {
    point.setAttribute('cx', pos.x);
    point.setAttribute('cy', pos.y);
    ray.setAttribute('x1', pos.x);
    ray.setAttribute('y1', pos.y);
    ray.setAttribute('x2', 400);
    ray.setAttribute('y2', pos.y);

    while (hits.firstChild) hits.removeChild(hits.firstChild);

    var inside = false;
    var count = 0;
    for (var i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
      var xi = POLY[i][0], yi = POLY[i][1];
      var xj = POLY[j][0], yj = POLY[j][1];
      if ((yi > pos.y) !== (yj > pos.y)) {
        var ix = (xj - xi) * (pos.y - yi) / (yj - yi) + xi;
        if (pos.x < ix) {
          inside = !inside;
          count++;
          var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          dot.setAttribute('cx', ix);
          dot.setAttribute('cy', pos.y);
          dot.setAttribute('r', 4);
          dot.setAttribute('class', 'geo-polygon__hit');
          hits.appendChild(dot);
        }
      }
    }

    shape.classList.toggle('is-active', inside);
    countEl.textContent = '교차점 ' + count + '개 → ' + (count % 2 === 1 ? '홀수' : '짝수');
    badge.textContent = inside ? '포함' : '이탈';
    badge.classList.toggle('is-in', inside);
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

---

## winding number: 자기교차 폴리곤에서 달라지는 결과

또 다른 접근은 **winding number**입니다. 점을 중심으로 폴리곤의 경계를 한 바퀴 따라갈 때, 경계가 점 주위를 몇 번 감는지를 셉니다. winding number가 0이면 점은 폴리곤 바깥, 0이 아니면 안쪽입니다.

```js
function isLeft(a, b, p) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (p[0] - a[0]) * (b[1] - a[1]);
}

function windingNumber(px, py, points) {
  var wn = 0;
  var p = [px, py];
  for (var i = 0; i < points.length; i++) {
    var a = points[i];
    var b = points[(i + 1) % points.length];
    if (a[1] <= py) {
      if (b[1] > py && isLeft(a, b, p) > 0) wn++;
    } else {
      if (b[1] <= py && isLeft(a, b, p) < 0) wn--;
    }
  }
  return wn;
}
```

`isLeft`는 변 `a→b`를 기준으로 점 `p`가 왼쪽에 있는지 오른쪽에 있는지를 부호로 알려줍니다. 변이 점의 y좌표를 위에서 아래로 가로지르면서 점이 왼쪽에 있으면 `wn`을 증가시키고, 아래에서 위로 가로지르면서 점이 오른쪽에 있으면 감소시킵니다.

단순 폴리곤(변이 서로 교차하지 않는 폴리곤)에서는 ray-casting과 winding number의 결과가 항상 같습니다. 차이는 **변이 스스로 교차하는(self-intersecting) 폴리곤**에서 드러납니다. ray-casting은 교차 횟수의 홀짝만 보기 때문에, 어떤 영역을 두 번 감는 자기교차 폴리곤에서는 그 영역을 짝수 번 교차하는 외부로 판정합니다. winding number는 감긴 횟수를 그대로 누적하므로, 두 번 감긴 영역을 0이 아닌 값(예: 2)으로 구분해 내부로 판정할 수 있습니다.

지오펜스로 쓰는 폴리곤은 대부분 사용자가 화면에서 그린, 변이 서로 교차하지 않는 단순 폴리곤이므로 이 차이가 실제로 영향을 주는 경우는 드뭅니다. 다만 폴리곤 편집 UI에서 사용자가 변을 꼬아서 그릴 수 있다면, 어떤 알고리즘을 쓰느냐에 따라 같은 모양이 다르게 판정될 수 있다는 점은 알아둘 만합니다.

---

## 실전 라이브러리: turf.js의 booleanPointInPolygon

실무에서는 위 알고리즘을 직접 구현하기보다 `@turf/turf`의 `booleanPointInPolygon` 같은 라이브러리를 쓰는 경우가 많습니다. 내부적으로 ray-casting 계열 알고리즘을 쓰면서, 경계선 위에 정확히 놓인 점 같은 부동소수점 엣지 케이스를 함께 처리해 줍니다.

```js
import * as turf from '@turf/turf';

const point = turf.point([px, py]);
const polygon = turf.polygon([ring]); // ring: 첫 점과 마지막 점이 같아야 하는 "닫힌" 배열

turf.booleanPointInPolygon(point, polygon); // true | false
```

`turf.polygon`에 넘기는 `ring`은 첫 번째 점과 마지막 점이 같아야 하는 "닫힌" 배열이어야 합니다. 위 데모나 앞서 본 저장 형식의 `points` 배열은 마지막 점을 생략한 형태이므로, 라이브러리에 넘기기 전에 첫 점을 배열 끝에 한 번 더 추가해 닫아주는 변환이 필요합니다.

---

## SHIMonitoring 구현과 비교

이 블로그의 [SHIMonitoring geofence 구현 글](/blog/geofence-feature-2-backend/)에서는 정확히 이 패턴을 씁니다. `cctv_geofence_zone.polygon` 컬럼에 `[[x,y], ...]` 형태의 정규화 좌표 배열을 JSON 문자열로 저장하고, 판정 시점에 `toClosedRing()`으로 첫 점을 끝에 추가해 닫은 뒤 `turf.booleanPointInPolygon`으로 사람의 바운딩 박스 하단 중심점이 구역 안에 있는지 확인합니다.

차이가 있다면 좌표의 "의미"입니다. 이 글의 데모는 화면 픽셀 좌표를 그대로 쓰지만, SHIMonitoring에서는 카메라 프레임 기준 0~1 정규화 좌표를 씁니다. `booleanPointInPolygon`은 순수 기하 연산이라 좌표가 무엇을 의미하는지는 신경 쓰지 않습니다. 1편에서 본 `inRect`, `inCircle`과 마찬가지로, 입력이 어떤 단위든 같은 판정 로직을 그대로 쓸 수 있다는 뜻입니다.

---

## 정리

3편에 걸쳐 사각형(AABB)·원 → 회전 타원·OBB → 폴리곤 순으로 지오펜스 도형을 살펴봤습니다. 공통점은 "점이 도형 안에 있는가"라는 같은 질문에 대해, 도형이 단순해질수록 판정식도 단순해진다는 것입니다.

- **사각형·원**([1편](/blog/geofence-shapes-rectangle-circle/)): 비교 연산 몇 개로 끝나는 O(1) 판정
- **타원·OBB**([2편](/blog/geofence-shapes-ellipse/)): 점을 로컬 좌표계로 변환한 뒤 같은 비교를 적용
- **폴리곤**(이 글): 변의 개수에 비례하는 O(n) 판정, ray-casting 또는 winding number

실제 시스템을 설계할 때는 "구역이 어떤 모양이 될 수 있는가"를 먼저 정하고, 그에 맞는 가장 단순한 도형을 고르는 것이 좋습니다. 모든 경우를 표현할 수 있는 폴리곤이 항상 정답은 아닙니다. 사각형 한 칸이면 충분한 구역까지 좌표 배열로 관리하면, 편집 UI도 판정 로직도 불필요하게 복잡해집니다.
