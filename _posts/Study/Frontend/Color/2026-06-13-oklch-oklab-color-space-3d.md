---
layout: post
title: "RGB로는 안 보이는 색: OKLAB·OKLCH·HSV 색상 공간을 3D로 보기"
date: 2026-06-13
series: "Study"
category: "Frontend"
subcategory: "Color"
tags: [css, color, oklch, oklab, design-system]
description: "RGB·HSV가 프론트엔드 색상 작업에서 직관과 어긋나는 이유와, OKLAB·OKLCH 색공간이 어떻게 다른지를 인터랙티브 3D 시각화와 함께 정리합니다."
image: /assets/img/posts/oklch-oklab-color-space-3d.svg
pinned: false
---

## 들어가며

디자인 토큰에 `#2563eb` 하나를 정해두고, 거기서 hover 색·dark 색·5단계 톤 스케일을 뽑아본 적이 있다면 한 번쯔음 겪는 문제가 있습니다. HSL에서 `lightness`만 올렸는데 어떤 색은 거의 흰색이 되고 어떤 색은 여전히 쨍하게 남아 있는 것, 그리고 브랜드 컬러 A와 B를 `linear-gradient`로 이으면 중간 지점이 탁한 회갈색으로 죽어버리는 것입니다.

원인은 우리가 색을 다룰 때 가장 많이 쓰는 RGB/HSL이 "사람이 색을 인지하는 방식"과 좌표계가 다르기 때문입니다. 이 글에서는 RGB → HSV/HSB → OKLAB/OKLCH 순으로 좌표계가 어떻게 다른지를 살펴보고, CSS에 이미 들어와 있는 `oklch()`를 이용해 이 차이를 화면에서 직접 움직여 보는 인터랙티브 데모 4개를 붙였습니다. 마지막 데모는 OKLCH의 원통형 구조를 3D로 회전시켜 보는 시각화입니다.

---

## RGB·sRGB: "빛을 얼마나 섞을지"의 좌표일 뿐

`#2563eb`나 `rgb(37, 99, 235)`는 모니터의 빨강·초록·파랑 발광 소자를 얼마나 켤지를 적은 값입니다. 디스플레이 입장에서는 정확한 명세지만, "이 색이 얼마나 밝게 보이는가", "이 두 색의 중간색은 무엇인가" 같은 질문에는 답을 주지 않습니다.

대표적인 증상이 그라디언트입니다. 두 색을 RGB 채널별로 단순 평균하면, 그 평균값이 사람 눈에 "중간 밝기"로 보인다는 보장이 없습니다. 채널 하나가 0으로 떨어지는 순간 명도와 채도가 함께 무너지면서 칙칙한 색이 끼어듭니다.

직접 비교해 보겠습니다. 같은 빨강·초록 두 색을 `linear-gradient`로 잇되, 하나는 기본(sRGB) 보간, 다른 하나는 `linear-gradient(in oklch ...)`로 OKLCH 공간에서 보간한 것입니다.

<div class="gradient-compare">
  <div class="gradient-compare__row">
    <span class="gradient-compare__label">sRGB 보간</span>
    <div class="gradient-compare__bar gradient-compare__bar--rgb"></div>
  </div>
  <div class="gradient-compare__row">
    <span class="gradient-compare__label">OKLCH 보간</span>
    <div class="gradient-compare__bar gradient-compare__bar--oklch"></div>
  </div>
</div>

<style>
.gradient-compare { display: flex; flex-direction: column; gap: 14px; margin: 24px 0; }
.gradient-compare__row { display: flex; align-items: center; gap: 16px; }
.gradient-compare__label { flex: 0 0 96px; font-size: 13px; color: #4a6080; font-weight: 600; }
.gradient-compare__bar { flex: 1; height: 56px; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
.gradient-compare__bar--rgb { background: linear-gradient(to right, #dc2626, #16a34a); }
.gradient-compare__bar--oklch { background: linear-gradient(in oklch to right, #dc2626, #16a34a); }
@media (max-width: 600px) {
  .gradient-compare__row { flex-direction: column; align-items: flex-start; gap: 6px; }
  .gradient-compare__bar { width: 100%; }
}
</style>

위쪽 sRGB 보간은 중간 지점에서 채도와 명도가 함께 빠지면서 탁한 갈색·회색 영역을 지나갑니다. 아래쪽 OKLCH 보간은 같은 두 색을 잇지만 중간에서도 색이 죽지 않습니다. 코드 차이는 `in oklch` 한 단어뿐입니다.

```css
.bar--rgb   { background: linear-gradient(to right, #dc2626, #16a34a); }
.bar--oklch { background: linear-gradient(in oklch to right, #dc2626, #16a34a); }
```

---

## HSV/HSB: 색상환은 직관적인데, "명도"는 거짓말을 한다

색을 고를 때 RGB 슬라이더보다 익숙한 건 컬러 피커의 원형 휠 + 채도/명도 사각형, 즉 HSV(HSB) 모델입니다. H(색상, 0~360°), S(채도), V(명도/밝기)는 "빨강 계열에서 좀 더 어둡게" 같은 요청을 직관적으로 표현합니다.

문제는 V(Value/Brightness)의 정의입니다. HSV에서 V는 **RGB 세 채널 중 최댓값**을 기준으로 정해질 뿐, 사람이 실제로 느끼는 밝기(luminance)와는 별개입니다. 똑같이 "S 100%, V 100%"인 순색이라도, 노란색과 파란색은 전혀 다른 밝기로 보입니다. sRGB에서 상대 휘도는 초록 채널의 가중치(약 0.7152)가 빨강(약 0.2126)·파랑(약 0.0722)보다 훨씬 크기 때문에, 초록·노란 계열은 밝게, 파랑·보라 계열은 어둡게 느껴집니다.

아래는 H를 30°씩 12단계로 돌리면서, 위 줄은 `hsl(H, 100%, 50%)`(= HSV의 S 100%·V 100%와 같은 RGB값), 아래 줄은 `oklch(75%, 0.15, H)`로 그린 띠입니다. CSS에는 `hsv()` 함수가 없어 동일한 RGB 결과를 내는 `hsl()`로 대신했습니다.

<div class="color-strip">
  <div class="color-strip__row">
    <div class="color-strip__label">HSL / HSV<br><small>S 100% · L(V) 100%</small></div>
    <div class="color-strip__swatches">
      <div class="color-strip__chip" style="background: hsl(0, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(30, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(60, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(90, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(120, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(150, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(180, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(210, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(240, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(270, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(300, 100%, 50%)"></div>
      <div class="color-strip__chip" style="background: hsl(330, 100%, 50%)"></div>
    </div>
  </div>
  <div class="color-strip__row">
    <div class="color-strip__label">OKLCH<br><small>L 75% · C 0.15</small></div>
    <div class="color-strip__swatches">
      <div class="color-strip__chip" style="background: oklch(75% 0.15 0)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 30)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 60)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 90)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 120)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 150)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 180)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 210)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 240)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 270)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 300)"></div>
      <div class="color-strip__chip" style="background: oklch(75% 0.15 330)"></div>
    </div>
  </div>
</div>

<style>
.color-strip { display: flex; flex-direction: column; gap: 16px; margin: 24px 0; }
.color-strip__row { display: flex; align-items: center; gap: 16px; }
.color-strip__label { flex: 0 0 130px; font-size: 13px; color: #4a6080; font-weight: 600; line-height: 1.5; }
.color-strip__label small { color: #8fa3bf; font-size: 11px; font-weight: 500; }
.color-strip__swatches { display: flex; flex: 1; gap: 4px; }
.color-strip__chip { flex: 1; height: 48px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
@media (max-width: 600px) {
  .color-strip__row { flex-direction: column; align-items: flex-start; gap: 8px; }
  .color-strip__label { flex: none; }
  .color-strip__swatches { width: 100%; }
}
</style>

위 줄에서는 노란색(H 60°) 주변이 눈에 확 들어오고 파란색·보라색(H 240~270°) 주변은 상대적으로 무겁게 가라앉아 보입니다. 분명 "같은 V"인데도 그렇습니다. 아래 줄은 L을 75%로 고정했을 뿐인데, 12개 색이 훨씬 비슷한 밝기로 늘어서 있습니다. 디자인 시스템에서 "강조색의 명도만 낮춰서 보조색을 만든다" 같은 규칙을 HSL로 적용하면 색상마다 결과가 들쭐날쭐한 이유가 여기에 있습니다.

---

## OKLAB·OKLCH: 인지를 좌표축으로 삼은 색공간

OKLAB은 2020년 Björn Ottosson이 발표한 색공간으로, sRGB 값을 사람 눈의 원뿔세포(L/M/S) 반응에 대응하는 값으로 변환하고, 비선형 압축(세제곱근)을 거쳐 다시 선형 결합해 세 축을 얻습니다.

- **L** — 지각 명도(Lightness). 0(검정)~1(흰색).
- **a** — 초록(-) ↔ 빨강(+)
- **b** — 파랑(-) ↔ 노랑(+)

`a`, `b`는 직교좌표라 색을 직접 고르기는 어렵습니다. 그래서 CSS에서는 이를 극좌표로 바꾼 **OKLCH**를 더 자주 씁니다.

- **L** — 명도 (0~100%)
- **C** — 채도(Chroma). 0에 가까울수록 무채색.
- **H** — 색상(Hue, 0~360°)

형태만 보면 HSL과 똑같이 "명도·채도·색상"이지만, L과 C가 **사람의 인지 모델을 거쳐 계산된 값**이라는 점이 다릅니다. 그래서 앞의 데모처럼 L을 고정하면 H를 무엇으로 바꿔도 비슷한 밝기로 보입니다. CSS Color Module 4에서 `oklab()`/`oklch()` 함수로 표준화되었고, 최신 Chrome·Safari·Firefox에서 모두 사용할 수 있습니다.

```css
/* 같은 파란 계열을 세 방식으로 표현 */
.btn { background: #2563eb; }                 /* RGB: 빛의 배합표 */
.btn { background: hsl(221, 83%, 53%); }       /* HSL: 색상환, 명도는 인지와 별개 */
.btn { background: oklch(55% 0.18 261); }      /* OKLCH: L을 고정하면 인지 밝기도 고정 */
```

---

## 3D로 보는 OKLCH 색공간

OKLCH는 구조상 **원통(cylinder)**입니다. 높이 축이 명도(L), 반지름이 채도(C), 둘레를 따라 도는 각도가 색상(H)입니다. 아래 데모는 C를 0.13으로 고정한 채 L이 다른 4개의 "층"을 쌓고, 각 층에서 H를 16단계로 둘러놓은 것을 CSS 3D transform으로 회전시킵니다. 드래그하면 자유롭게 돌려볼 수 있습니다.

<div class="oklch-3d">
  <div class="oklch-3d__scene" id="oklch3d-scene">
    <div class="oklch-3d__cylinder" id="oklch3d-cylinder"></div>
  </div>
  <div class="oklch-3d__footer">
    <div class="oklch-3d__legend" id="oklch3d-legend"></div>
    <button type="button" class="oklch-3d__toggle" id="oklch3d-toggle">자동 회전 끄기</button>
  </div>
  <p class="oklch-3d__hint">드래그(또는 터치)로 회전 · 같은 층(링) 안에서는 명도(L)가 같고 색상(H)만 바뀝니다.</p>
</div>

<style>
.oklch-3d { margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.oklch-3d__scene {
  position: relative;
  width: 100%;
  height: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  perspective: 1000px;
  touch-action: none;
  cursor: grab;
}
.oklch-3d__scene:active { cursor: grabbing; }
.oklch-3d__cylinder { position: relative; width: 1px; height: 1px; transform-style: preserve-3d; }
.oklch-3d__ring { position: absolute; top: 0; left: 0; width: 0; height: 0; transform-style: preserve-3d; }
.oklch-3d__chip {
  position: absolute;
  top: -15px; left: -15px;
  width: 30px; height: 30px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(15,31,61,.1);
}
.oklch-3d__footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.oklch-3d__legend { display: flex; gap: 12px; flex-wrap: wrap; }
.oklch-3d__legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4a6080; font-weight: 600; }
.oklch-3d__legend-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.1); }
.oklch-3d__toggle {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1.5px solid #d8e3f0;
  background: transparent;
  color: #0f1f3d;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color .15s, color .15s;
}
.oklch-3d__toggle:hover { border-color: #2563eb; color: #2563eb; }
.oklch-3d__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
@media (max-width: 600px) {
  .oklch-3d__scene { height: 320px; }
}
</style>

<script>
(function () {
  var cylinder = document.getElementById('oklch3d-cylinder');
  var scene = document.getElementById('oklch3d-scene');
  var legend = document.getElementById('oklch3d-legend');
  var toggleBtn = document.getElementById('oklch3d-toggle');
  if (!cylinder || !scene) return;

  var L_LEVELS = [88, 72, 56, 40];
  var HUE_STEPS = 16;
  var CHROMA = 0.13;
  var RADIUS = 120;
  var RING_GAP = 64;

  L_LEVELS.forEach(function (L, i) {
    var ring = document.createElement('div');
    ring.className = 'oklch-3d__ring';
    var y = (i - (L_LEVELS.length - 1) / 2) * RING_GAP;
    ring.style.transform = 'translateY(' + y + 'px)';

    for (var j = 0; j < HUE_STEPS; j++) {
      var hue = (360 / HUE_STEPS) * j;
      var chip = document.createElement('div');
      chip.className = 'oklch-3d__chip';
      chip.style.background = 'oklch(' + L + '% ' + CHROMA + ' ' + hue + ')';
      chip.style.transform = 'rotateY(' + hue + 'deg) translateZ(' + RADIUS + 'px)';
      ring.appendChild(chip);
    }
    cylinder.appendChild(ring);

    if (legend) {
      var item = document.createElement('div');
      item.className = 'oklch-3d__legend-item';
      var sw = document.createElement('span');
      sw.className = 'oklch-3d__legend-swatch';
      sw.style.background = 'oklch(' + L + '% ' + CHROMA + ' 250)';
      item.appendChild(sw);
      item.appendChild(document.createTextNode('L ' + L + '%'));
      legend.appendChild(item);
    }
  });

  var rotX = -16;
  var rotY = 0;
  var autoRotate = true;
  var dragging = false;
  var lastX = 0, lastY = 0, lastTime = null;

  function apply() {
    cylinder.style.transform = 'rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
  }

  function frame(t) {
    if (lastTime === null) lastTime = t;
    var dt = t - lastTime;
    lastTime = t;
    if (autoRotate && !dragging) {
      rotY = (rotY + dt * 0.012) % 360;
      apply();
    }
    requestAnimationFrame(frame);
  }
  apply();
  requestAnimationFrame(frame);

  scene.addEventListener('pointerdown', function (e) {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    scene.setPointerCapture(e.pointerId);
  });
  scene.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    rotY += dx * 0.4;
    rotX = Math.max(-80, Math.min(10, rotX - dy * 0.3));
    apply();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    scene.addEventListener(ev, function () { dragging = false; });
  });

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      autoRotate = !autoRotate;
      toggleBtn.textContent = autoRotate ? '자동 회전 끄기' : '자동 회전 켜기';
    });
  }
})();
</script>

회전시켜 보면 같은 링 위의 색은 채도(C 0.13)와 명도(L)가 동일하고 색상(H)만 도는데, 색이 서로 비슷한 무게감으로 보입니다. 반면 링을 위아래로 비교하면(L 88% → 40%) 모든 색상이 함께 어두워집니다. RGB 큐브에서는 "밝기를 유지하면서 색상만 바꾸기"가 채널 세 개를 동시에 계산해야 하는 일이지만, OKLCH에서는 H 하나만 바꾸는 것으로 끝납니다.

---

## 실전: oklch()로 톤 스케일·팔레트 만들기

디자인 토큰을 만들 때 흔한 작업은 "브랜드 컬러 하나로 50~900 단계의 톤 스케일을 만드는 것"입니다. OKLCH에서는 H와 C를 고정하고 L만 단계적으로 바꾸면 됩니다. 아래 슬라이더로 L·C·H를 직접 바꿔보고, 같은 H·C에서 L만 7단계로 늘어놓은 팔레트를 확인해 보세요.

<div class="oklch-play">
  <div class="oklch-play__preview">
    <div class="oklch-play__swatch" id="oklchplay-swatch"></div>
    <code class="oklch-play__value" id="oklchplay-value">oklch(70% 0.15 250)</code>
  </div>
  <div class="oklch-play__controls">
    <label class="oklch-play__field">
      <span>L (명도) <strong id="oklchplay-l-out">70%</strong></span>
      <input type="range" id="oklchplay-l" min="0" max="100" value="70">
    </label>
    <label class="oklch-play__field">
      <span>C (채도) <strong id="oklchplay-c-out">0.15</strong></span>
      <input type="range" id="oklchplay-c" min="0" max="0.37" step="0.01" value="0.15">
    </label>
    <label class="oklch-play__field">
      <span>H (색상) <strong id="oklchplay-h-out">250°</strong></span>
      <input type="range" id="oklchplay-h" min="0" max="360" value="250">
    </label>
  </div>
  <div class="oklch-play__palette" id="oklchplay-palette"></div>
  <p class="oklch-play__hint">같은 H·C에서 L만 95% → 12%로 7단계 변화한 팔레트입니다.</p>
</div>

<style>
.oklch-play { display: flex; flex-direction: column; gap: 18px; margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.oklch-play__preview { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.oklch-play__swatch { width: 64px; height: 64px; border-radius: 10px; flex: 0 0 auto; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
.oklch-play__value { white-space: nowrap; }
.oklch-play__controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.oklch-play__field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #4a6080; font-weight: 600; }
.oklch-play__field span { display: flex; justify-content: space-between; }
.oklch-play__field strong { color: #0f1f3d; font-weight: 700; }
.oklch-play__field input[type="range"] { width: 100%; accent-color: #2563eb; }
.oklch-play__palette { display: flex; gap: 6px; }
.oklch-play__palette-chip { flex: 1; height: 36px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
.oklch-play__hint { font-size: 13px; color: #8fa3bf; margin: 0; }
@media (max-width: 600px) {
  .oklch-play__controls { grid-template-columns: 1fr; }
}
</style>

<script>
(function () {
  var lInput = document.getElementById('oklchplay-l');
  var cInput = document.getElementById('oklchplay-c');
  var hInput = document.getElementById('oklchplay-h');
  var lOut = document.getElementById('oklchplay-l-out');
  var cOut = document.getElementById('oklchplay-c-out');
  var hOut = document.getElementById('oklchplay-h-out');
  var swatch = document.getElementById('oklchplay-swatch');
  var valueEl = document.getElementById('oklchplay-value');
  var palette = document.getElementById('oklchplay-palette');
  if (!lInput || !swatch) return;

  var STEPS = [95, 85, 70, 55, 40, 25, 12];

  function update() {
    var L = lInput.value;
    var C = parseFloat(cInput.value).toFixed(2);
    var H = hInput.value;
    var css = 'oklch(' + L + '% ' + C + ' ' + H + ')';

    swatch.style.background = css;
    valueEl.textContent = css;
    lOut.textContent = L + '%';
    cOut.textContent = C;
    hOut.textContent = H + '°';

    palette.innerHTML = '';
    STEPS.forEach(function (stepL) {
      var chip = document.createElement('div');
      chip.className = 'oklch-play__palette-chip';
      var chipCss = 'oklch(' + stepL + '% ' + C + ' ' + H + ')';
      chip.style.background = chipCss;
      chip.title = chipCss;
      palette.appendChild(chip);
    });
  }

  [lInput, cInput, hInput].forEach(function (el) {
    el.addEventListener('input', update);
  });
  update();
})();
</script>

이렇게 얻은 값을 CSS 커스텀 프로퍼티로 옮기면 그대로 디자인 토큰이 됩니다.

```css
:root {
  --brand-h: 250;
  --brand-c: 0.15;

  --brand-50:  oklch(95% var(--brand-c) var(--brand-h));
  --brand-300: oklch(70% var(--brand-c) var(--brand-h));
  --brand-500: oklch(55% var(--brand-c) var(--brand-h));
  --brand-700: oklch(40% var(--brand-c) var(--brand-h));
  --brand-900: oklch(12% var(--brand-c) var(--brand-h));
}
```

hover·active 같은 상태 색도 `color-mix()`로 OKLCH 공간에서 섞으면 톤이 자연스럽게 이어집니다.

```css
.btn          { background: var(--brand-500); }
.btn:hover    { background: color-mix(in oklch, var(--brand-500) 85%, white); }
.btn:active   { background: color-mix(in oklch, var(--brand-500) 85%, black); }
```

---

## 브라우저 지원과 주의할 점

`oklch()`/`oklab()`과 `in oklch` 보간, `color-mix()`는 최신 Chrome·Edge·Safari·Firefox에서 동작합니다. 구형 브라우저를 지원해야 한다면 `@supports`로 기존 색을 폴백으로 두고 덮어쓰는 패턴이 안전합니다.

```css
.btn { background: #2563eb; }

@supports (color: oklch(0% 0 0)) {
  .btn { background: oklch(55% 0.18 261); }
}
```

한 가지 주의할 점은 **채도(C) 값이 sRGB 표현 범위를 넘어설 수 있다**는 것입니다. L·H 조합에 따라 sRGB로 표현 가능한 최대 C가 다르고, 이를 넘는 값은 브라우저가 화면이 표현할 수 있는 색으로 잘라냅니다(gamut mapping). 위 플레이그라운드에서 C를 0.3 이상으로 올리고 H를 바꿔보면, 일부 색상에서 채도가 더 늘지 않고 멈추는 걸 볼 수 있습니다. 디자인 토큰용 팔레트라면 C를 0.1~0.2 사이로 두는 편이 sRGB 화면에서 예측 가능한 결과를 줍니다.

---

## 정리

RGB/hex는 디스플레이가 빛을 섞는 양을 적은 값일 뿐, 사람이 느끼는 밝기·균일성과는 거리가 있습니다. HSV/HSL은 색상환 형태라 고르기는 쉽지만, "명도(V/L)"가 색상마다 다른 무게로 느껴지는 문제는 그대로입니다. OKLCH는 같은 원통형 구조(L·C·H)를 갖되, L과 C가 인지 모델을 거쳐 계산되어 **L을 고정하면 H를 바꿔도 밝기가 비슷하게 유지**됩니다.

그라디언트가 탁해지는 문제, 톤 스케일을 만들 때 색상마다 결과가 들쭐날쭐한 문제, hover/active 색을 자연스럽게 섞는 문제 모두 `oklch()` + `color-mix(in oklch, ...)`로 단순해집니다. 이번 글의 데모 코드를 그대로 자신의 디자인 토큰 파일에 옮겨서, 지금 쓰고 있는 브랜드 컬러로 톤 스케일을 다시 뽑아보는 것을 추천합니다.
