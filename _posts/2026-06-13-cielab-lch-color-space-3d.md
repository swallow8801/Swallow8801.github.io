---
layout: post
title: "CIELAB·LCh를 3D로 보기: OKLAB이 고친 '파란색 문제'"
date: 2026-06-13
series: "Study"
category: "Frontend"
subcategory: "Color"
tags: [css, color, cielab, lch, oklch]
description: "1976년의 지각 색공간 CIELAB·LCh의 구조를 3D로 살펴보고, 같은 L·C·H 값이 OKLCH에서는 왜 다른 색이 되는지, OKLAB이 고친 '파란색 휴 시프트' 문제를 인터랙티브 데모로 정리합니다."
image: /assets/img/posts/cielab-lch-color-space-3d.svg
pinned: false
---

## 들어가며

[지난 글](/blog/oklch-oklab-color-space-3d/)에서는 OKLAB·OKLCH가 RGB/HSL과 달리 "사람이 느끼는 밝기"를 좌표축으로 삼는다는 점을 살펴봤습니다. 그런데 사실 "지각 균일성을 좌표축으로 삼는다"는 아이디어 자체는 OKLAB이 처음이 아닙니다. 1976년에 정의된 **CIELAB(L\*a\*b\*)** 이 그 원조이고, CSS의 `oklch()`와 거의 같은 모양을 한 `lch()`도 이미 표준에 들어와 있습니다.

그렇다면 궁금해집니다. CIELAB도 지각 기반인데, 왜 2020년에 OKLAB이 또 필요했을까요? 이 글에서는 CIELAB·LCh의 구조를 3D로 띄워보고, 같은 L·C·H 숫자를 CIELAB과 OKLCH에 각각 넣었을 때 왜 다른 색이 나오는지, 그리고 CIELAB의 가장 유명한 약점인 "파란색이 보라색처럼 보이는" 문제를 데모로 직접 확인해 보겠습니다.

---

## CIELAB: 1976년의 지각 색공간

CIELAB은 국제조명위원회(CIE)가 1976년에 발표한 색공간으로, CIE XYZ 표준 관찰자 값을 기준 백색점(웹에서는 보통 D65)에 대한 비율로 바꾸고, 그 비율에 세제곱근 형태의 비선형 압축 함수를 적용해 세 축을 얻습니다.

- **L\*** — 명도(Lightness), 0~100. "균일한 L\* 변화가 균일한 밝기 변화로 느껴지도록" 설계된 값입니다.
- **a\*** — 초록(-) ↔ 빨강(+)
- **b\*** — 파랑(-) ↔ 노랑(+)

눈치챘겠지만 이 구조는 지난 글에서 본 OKLAB의 **L / a / b**와 이름도, 의도도 동일합니다. "명도 축 하나 + 색상을 나타내는 직교 축 두 개"라는 설계 자체를 OKLAB이 그대로 물려받았습니다. 차이는 이 값을 어디서부터 계산하느냐입니다.

- **CIELAB**: CIE XYZ(1931년 표준 관찰자 함수 기반) → 백색점 비율 → 비선형 압축 → L\*a\*b\*
- **OKLAB**: sRGB → 사람 눈의 원뿔세포(L/M/S) 반응에 대응하는 값 → 비선형 압축(세제곱근) → 선형 결합으로 L/a/b

즉 두 공간 모두 "비선형 압축을 거친 명도 + 두 색상 축"이라는 같은 틀을 쓰지만, CIELAB은 XYZ라는 1931년의 색맞춤 함수에서, OKLAB은 LMS라는 원뿔세포 반응 모델에서 출발합니다. CIELAB은 지금도 ICC 색관리(인쇄·사진 파이프라인의 기준 중간 색공간)와 ΔE 색차 계산의 표준으로 널리 쓰입니다.

---

## LCh(ab): CIELAB을 원통으로 펴기

OKLAB의 a/b가 직교좌표라 색을 직접 고르기 어려웠던 것처럼, CIELAB의 a\*/b\*도 마찬가지입니다. 그래서 극좌표로 바꾼 **LCh(ab)** 를 더 자주 씁니다. 변환 자체는 단순한 직교→극좌표 변환입니다.

- **C\*** = √(a\*² + b\*²) — 채도(Chroma)
- **h** = atan2(b\*, a\*) — 색상(Hue, 0~360°)

CSS에서는 `lch(L C H)`로 씁니다. `oklch(L C H)`와 인자 개수·순서가 완전히 같습니다.

```css
/* 구조는 같고, 계산 기준만 다르다 */
.box { background: lch(60% 50 280); }     /* CIELAB 기반 */
.box { background: oklch(60% 0.18 264); } /* OKLAB 기반 */
```

겉모습이 같으니 "그럼 그냥 OKLCH 대신 LCh를 써도 되지 않을까?"라는 질문이 자연스럽게 나옵니다. 답을 보기 전에, 먼저 LCh도 OKLCH처럼 원통(cylinder) 구조라는 걸 3D로 확인해 보겠습니다.

---

## 3D로 보는 CIELAB·LCh

지난 글의 OKLCH 원통 데모와 같은 구조입니다. 높이 축이 명도(L), 반지름이 채도(C), 둘레가 색상(H)입니다. 이번에는 채도(C 45)를 고정한 채 LCh로 4개 층을 쌓았습니다. 드래그(또는 터치)로 회전시켜 보세요.

<div class="lab-3d">
  <div class="lab-3d__scene" id="lab3d-scene">
    <div class="lab-3d__cylinder" id="lab3d-cylinder"></div>
  </div>
  <div class="lab-3d__footer">
    <div class="lab-3d__legend" id="lab3d-legend"></div>
    <button type="button" class="lab-3d__toggle" id="lab3d-toggle">자동 회전 끄기</button>
  </div>
  <p class="lab-3d__hint">드래그(또는 터치)로 회전 · 같은 층(링) 안에서는 L\*과 C\*가 같고 색상(h)만 바뀝니다.</p>
</div>

<style>
.lab-3d { margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.lab-3d__scene {
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
.lab-3d__scene:active { cursor: grabbing; }
.lab-3d__cylinder { position: relative; width: 1px; height: 1px; transform-style: preserve-3d; }
.lab-3d__ring { position: absolute; top: 0; left: 0; width: 0; height: 0; transform-style: preserve-3d; }
.lab-3d__chip {
  position: absolute;
  top: -15px; left: -15px;
  width: 30px; height: 30px;
  border-radius: 6px;
  box-shadow: inset 0 0 0 1px rgba(15,31,61,.1);
}
.lab-3d__footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 8px; }
.lab-3d__legend { display: flex; gap: 12px; flex-wrap: wrap; }
.lab-3d__legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #4a6080; font-weight: 600; }
.lab-3d__legend-swatch { display: inline-block; width: 14px; height: 14px; border-radius: 4px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.1); }
.lab-3d__toggle {
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
.lab-3d__toggle:hover { border-color: #2563eb; color: #2563eb; }
.lab-3d__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
@media (max-width: 600px) {
  .lab-3d__scene { height: 320px; }
}
</style>

<script>
(function () {
  var cylinder = document.getElementById('lab3d-cylinder');
  var scene = document.getElementById('lab3d-scene');
  var legend = document.getElementById('lab3d-legend');
  var toggleBtn = document.getElementById('lab3d-toggle');
  if (!cylinder || !scene) return;

  var L_LEVELS = [85, 65, 45, 25];
  var HUE_STEPS = 16;
  var CHROMA = 45;
  var RADIUS = 120;
  var RING_GAP = 64;

  L_LEVELS.forEach(function (L, i) {
    var ring = document.createElement('div');
    ring.className = 'lab-3d__ring';
    var y = (i - (L_LEVELS.length - 1) / 2) * RING_GAP;
    ring.style.transform = 'translateY(' + y + 'px)';

    for (var j = 0; j < HUE_STEPS; j++) {
      var hue = (360 / HUE_STEPS) * j;
      var chip = document.createElement('div');
      chip.className = 'lab-3d__chip';
      chip.style.background = 'lch(' + L + '% ' + CHROMA + ' ' + hue + ')';
      chip.style.transform = 'rotateY(' + hue + 'deg) translateZ(' + RADIUS + 'px)';
      ring.appendChild(chip);
    }
    cylinder.appendChild(ring);

    if (legend) {
      var item = document.createElement('div');
      item.className = 'lab-3d__legend-item';
      var sw = document.createElement('span');
      sw.className = 'lab-3d__legend-swatch';
      sw.style.background = 'lch(' + L + '% ' + CHROMA + ' 250)';
      item.appendChild(sw);
      item.appendChild(document.createTextNode('L* ' + L));
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

지난 글의 OKLCH 원통과 나란히 놓고 보면 구조가 똑같다는 걸 알 수 있습니다. 층(L) · 반지름(C) · 각도(H)로 이루어진 원통이라는 점은 두 색공간이 동일합니다. 다만 같은 "L 85, C 45, H 0" 같은 숫자를 넣어도, CIELAB과 OKLCH는 서로 다른 계산식을 거치기 때문에 화면에 나오는 색은 다릅니다. 다음 데모에서 직접 비교해 보겠습니다.

---

## 같은 L·C·H, 다른 색 — CIELAB과 OKLCH 비교

`lch()`와 `oklch()`는 문법이 같지만 좌표계는 다릅니다. 아래 슬라이더는 **명도(L)·채도 강도(%)·색상(H)** 를 하나씩만 두고, 이 값을 각 모델의 스케일에 맞춰 `lch()`와 `oklch()`에 각각 적용합니다(CIELAB의 채도 C\*는 대략 0~120, OKLCH의 채도 C는 대략 0~0.4 범위를 씁니다). 같은 슬라이더 위치에서 출발해도 두 swatch의 색이 어떻게 달라지는지 확인해 보세요.

<div class="lab-compare">
  <div class="lab-compare__swatches">
    <div class="lab-compare__cell">
      <div class="lab-compare__swatch" id="labcmp-swatch-lab"></div>
      <code class="lab-compare__value" id="labcmp-value-lab">lch(60% 60 280)</code>
      <span class="lab-compare__tag">CIELAB · lch()</span>
    </div>
    <div class="lab-compare__cell">
      <div class="lab-compare__swatch" id="labcmp-swatch-ok"></div>
      <code class="lab-compare__value" id="labcmp-value-ok">oklch(60% 0.2 280)</code>
      <span class="lab-compare__tag">OKLAB · oklch()</span>
    </div>
  </div>
  <div class="lab-compare__controls">
    <label class="lab-compare__field">
      <span>L (명도) <strong id="labcmp-l-out">60%</strong></span>
      <input type="range" id="labcmp-l" min="0" max="100" value="60">
    </label>
    <label class="lab-compare__field">
      <span>채도 강도 <strong id="labcmp-c-out">50%</strong></span>
      <input type="range" id="labcmp-c" min="0" max="100" value="50">
    </label>
    <label class="lab-compare__field">
      <span>H (색상) <strong id="labcmp-h-out">280°</strong></span>
      <input type="range" id="labcmp-h" min="0" max="360" value="280">
    </label>
  </div>
  <p class="lab-compare__hint">L·H는 두 모델에 같은 숫자를 그대로 넣고, 채도 강도(%)만 각 모델의 채도 범위(lch ≈ 0~120, oklch ≈ 0~0.4)로 환산합니다.</p>
</div>

<style>
.lab-compare { display: flex; flex-direction: column; gap: 18px; margin: 24px 0; padding: 20px; background: #f4f7fb; border: 1px solid #d8e3f0; border-radius: 12px; }
.lab-compare__swatches { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.lab-compare__cell { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
.lab-compare__swatch { width: 100%; height: 88px; border-radius: 10px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
.lab-compare__value { white-space: nowrap; }
.lab-compare__tag { font-size: 12px; color: #8fa3bf; font-weight: 600; }
.lab-compare__controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.lab-compare__field { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #4a6080; font-weight: 600; }
.lab-compare__field span { display: flex; justify-content: space-between; }
.lab-compare__field strong { color: #0f1f3d; font-weight: 700; }
.lab-compare__field input[type="range"] { width: 100%; accent-color: #2563eb; }
.lab-compare__hint { font-size: 13px; color: #8fa3bf; margin: 0; }
@media (max-width: 600px) {
  .lab-compare__swatches { grid-template-columns: 1fr; }
  .lab-compare__controls { grid-template-columns: 1fr; }
}
</style>

<script>
(function () {
  var lInput = document.getElementById('labcmp-l');
  var cInput = document.getElementById('labcmp-c');
  var hInput = document.getElementById('labcmp-h');
  var lOut = document.getElementById('labcmp-l-out');
  var cOut = document.getElementById('labcmp-c-out');
  var hOut = document.getElementById('labcmp-h-out');
  var swatchLab = document.getElementById('labcmp-swatch-lab');
  var swatchOk = document.getElementById('labcmp-swatch-ok');
  var valueLab = document.getElementById('labcmp-value-lab');
  var valueOk = document.getElementById('labcmp-value-ok');
  if (!lInput || !swatchLab || !swatchOk) return;

  function update() {
    var L = lInput.value;
    var cPct = parseInt(cInput.value, 10);
    var H = hInput.value;
    var cLab = Math.round(cPct * 1.2);
    var cOk = (cPct / 100 * 0.4).toFixed(2);

    var cssLab = 'lch(' + L + '% ' + cLab + ' ' + H + ')';
    var cssOk = 'oklch(' + L + '% ' + cOk + ' ' + H + ')';

    swatchLab.style.background = cssLab;
    swatchOk.style.background = cssOk;
    valueLab.textContent = cssLab;
    valueOk.textContent = cssOk;
    lOut.textContent = L + '%';
    cOut.textContent = cPct + '%';
    hOut.textContent = H + '°';
  }

  [lInput, cInput, hInput].forEach(function (el) {
    el.addEventListener('input', update);
  });
  update();
})();
</script>

H를 0~120° 부근(빨강~노랑~초록 계열)에 두면 두 swatch가 비교적 비슷한 색으로 보입니다. 그런데 H를 240~300° 부근(파랑~보라 계열)으로 옮기고 채도 강도를 올려보면, 같은 L·H인데도 `lch()` 쪽이 `oklch()`보다 눈에 띄게 보라색 쪽으로 기우는 것을 볼 수 있습니다. 다음 섹션에서 이 현상을 좀 더 정면으로 들여다봅니다.

---

## 파란색이 보라색이 되는 순간

CIELAB의 가장 유명한 약점은 **파란색 영역에서 "일정한 색상(h)"이 실제로는 일정하게 보이지 않는다**는 점입니다. h를 고정한 채 명도(L\*)만 바꿔도, 파란 계열은 명도가 올라갈수록 점점 보라/자주 쪽으로 기우는 것처럼 보입니다. 이는 CIELAB이 1931년 CIE 표준 관찰자 함수(XYZ)를 기반으로 만들어졌고, 색상-명도 사이의 상호작용을 충분히 보정하지 못했기 때문입니다.

OKLAB은 이 문제를 정면으로 겨냥해 만들어졌습니다. XYZ가 아니라 사람 눈의 원뿔세포(LMS) 반응에서 시작하고, 현대적인 색채 지각 데이터셋(CAM16 계열)에 맞춰 계수를 다시 피팅해서, "h를 고정하면 L이 바뀌어도 같은 색상으로 보인다"는 성질이 파란색 영역에서도 훨씬 잘 유지되도록 설계되었습니다.

아래 데모는 위 줄을 `lch()`, 아래 줄을 `oklch()`로 그렸습니다. 둘 다 **h(색상)와 C(채도)는 고정**하고 **L(명도)만** 20%에서 90%까지 8단계로 올렸습니다.

<div class="hue-drift">
  <div class="hue-drift__row">
    <div class="hue-drift__label">LCh<br><small>C 50 · h 280</small></div>
    <div class="hue-drift__swatches">
      <div class="hue-drift__chip" style="background: lch(20% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(30% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(40% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(50% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(60% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(70% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(80% 50 280)"></div>
      <div class="hue-drift__chip" style="background: lch(90% 50 280)"></div>
    </div>
  </div>
  <div class="hue-drift__row">
    <div class="hue-drift__label">OKLCH<br><small>C 0.18 · H 264</small></div>
    <div class="hue-drift__swatches">
      <div class="hue-drift__chip" style="background: oklch(20% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(30% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(40% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(50% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(60% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(70% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(80% 0.18 264)"></div>
      <div class="hue-drift__chip" style="background: oklch(90% 0.18 264)"></div>
    </div>
  </div>
  <p class="hue-drift__hint">L 20% → 90%로 올릴 때, 위(LCh) 줄은 점차 보라/자주 쪽으로 기우는 느낌이 강해지고, 아래(OKLCH) 줄은 파란 계열의 색상감을 좀 더 일관되게 유지합니다.</p>
</div>

<style>
.hue-drift { margin: 24px 0; }
.hue-drift__row { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
.hue-drift__label { flex: 0 0 130px; font-size: 13px; color: #4a6080; font-weight: 600; line-height: 1.5; }
.hue-drift__label small { color: #8fa3bf; font-size: 11px; font-weight: 500; }
.hue-drift__swatches { display: flex; flex: 1; gap: 4px; }
.hue-drift__chip { flex: 1; height: 48px; border-radius: 6px; box-shadow: inset 0 0 0 1px rgba(15,31,61,.08); }
.hue-drift__hint { font-size: 13px; color: #8fa3bf; margin: 8px 0 0; }
@media (max-width: 600px) {
  .hue-drift__row { flex-direction: column; align-items: flex-start; gap: 8px; }
  .hue-drift__label { flex: none; }
  .hue-drift__swatches { width: 100%; }
}
</style>

h와 C라는 "같은 숫자"를 고정했는데도 L이 바뀌면 보이는 색상이 흔들린다는 것은, LCh의 h 좌표가 "사람이 느끼는 색상"을 끝까지 일정하게 표현하지 못한다는 뜻입니다. 디자인 토큰에서 "이 브랜드 컬러의 명도만 낮춰서 다크 모드 색을 만든다"처럼 **H를 고정하고 L만 바꾸는 작업**을 한다면, 이 흔들림은 곧 "명도만 낮췄는데 색이 미묘하게 달라 보인다"는 결과로 이어집니다. OKLCH가 디자인 토큰용으로 더 추천되는 이유 중 하나가 여기에 있습니다.

---

## 실전: CIELAB·LCh를 언제 쓸까

그렇다고 CIELAB·LCh가 쓸모없는 것은 아닙니다. 용도가 다릅니다.

- **CIELAB(Lab)** — ICC 색관리, 인쇄·사진 파이프라인, ΔE 기반 색차 계산처럼 "기존 표준·도구 생태계와 맞춰야 하는" 영역에서는 여전히 사실상 표준입니다. 카메라·프린터 프로파일, 이미지 처리 라이브러리의 색차 함수 대부분이 Lab을 기준으로 합니다.
- **OKLCH** — 디자인 토큰, 톤 스케일, 그라디언트, hover/active 색 보정처럼 "L을 고정하고 H·C만 조정"하는 UI 작업에는 OKLCH가 더 예측 가능합니다(지난 글 참고).

CSS 차원에서는 `lab()`/`lch()`와 `oklab()`/`oklch()`가 같은 세대에 표준화되어 브라우저 지원 범위도 동일합니다(최신 Chrome·Edge·Safari·Firefox). `color-mix()`와 `linear-gradient(in lch, ...)`도 동일하게 동작하며, 채도(C\*)가 sRGB로 표현 가능한 범위를 넘으면 OKLCH와 마찬가지로 gamut mapping으로 잘립니다.

```css
/* 이미지 파이프라인 등에서 Lab 기준 값을 그대로 써야 한다면 */
.swatch { background: lab(54% 22 -50); }

/* UI 디자인 토큰은 OKLCH로 */
:root { --brand-500: oklch(55% 0.18 261); }
```

---

## 정리

CIELAB은 OKLAB보다 40년 이상 먼저 "명도 축 + 색상을 나타내는 두 직교 축"이라는 지각 기반 색공간의 틀을 만들었고, 이를 극좌표로 펼친 LCh는 구조적으로 OKLCH와 동일합니다. 다만 CIELAB은 CIE XYZ(1931년 표준 관찰자)에서 출발했기 때문에, 특히 파란색 영역에서 "색상(h)을 고정해도 명도가 바뀌면 보이는 색이 흔들리는" 한계가 있습니다.

OKLAB·OKLCH는 같은 틀을 LMS 원뿔세포 반응과 현대 색채 지각 데이터셋 위에서 다시 만들어, 이 흔들림을 줄였습니다. CIELAB·LCh는 인쇄·색관리처럼 기존 표준이 요구되는 곳에서 계속 쓰이고, UI 디자인 토큰처럼 "L을 고정하고 H를 돌리는" 작업에는 OKLCH가 더 안정적인 선택입니다. 두 글의 데모를 나란히 띄워두고 같은 L·H 값을 넣어보면, 색공간을 바꾼다는 것이 단순한 "함수 이름 변경"이 아니라는 점을 눈으로 확인할 수 있습니다.
