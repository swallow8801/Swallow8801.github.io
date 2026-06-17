---
layout: post
title: "선체 표면 인식 기반 워터블라스팅 제어 시스템 설계 — 데이터 정제부터 분사 입력 결정까지"
date: 2026-06-14
series: "Study"
category: "AI"
subcategory: "WaterBlasting"
tags: [vision-ai, segmentation, hull, waterblasting, dataset]
description: "선체 표면 영상을 학습해 부식·오염 영역을 구분하고, 그 결과로 워터블라스팅 분사 입력을 결정하는 시스템을 설계 관점에서 정리합니다."
image: /assets/img/posts/hull-waterblasting-vision.svg
pinned: false
---

## 들어가며

선체 표면 워터블라스팅(water-blasting)은 부식·도장·해양 생물 부착(biofouling)을 고압수로 제거하는 작업이다. 사람이 하면 균일하지 않고 위험하다. 자동화하려면 "어디를, 얼마나 세게" 쏠지를 기계가 결정해야 하는데, 이 판단의 입력이 바로 표면 영상이다. 즉 문제는 두 단계로 쪼개진다. **(1) 영상에서 표면 상태를 인식**하고, **(2) 그 결과를 분사 제어 입력으로 변환**한다.

이 글은 학습 데이터 정제부터 분사 입력 결정까지를 설계 관점에서 정리한 스터디 노트다. 실측이 필요한 수치는 지어내지 않고 `<측정값>`으로 비워 둔다.

---

## 문제를 분류가 아니라 세그멘테이션으로 보는 이유

"부식인가 아닌가"를 이미지 단위로 분류하면 어디를 얼마나 쏠지가 안 나온다. 워터블라스팅은 픽셀(영역) 단위 결정이 필요하므로, 표면을 **시맨틱 세그멘테이션**으로 영역별로 나누는 편이 자연스럽다. 클래스는 작업 목적에 맞춰 단순하게 잡는다.

- **유지(coating intact)** — 멀쩡한 도장면. 쏘지 않는다.
- **부식(corrosion)** — 제거 대상. 강하게 쏜다.
- **해양 부착물(marine fouling)** — 제거 대상이지만 부식과 다른 압력 프로파일.
- **배경/비대상** — 마스킹.

이 분야의 선행 연구도 같은 방향이다. 수중 청소 로봇용 biofouling 세그멘테이션 모델(예: MFONet)이나, 워터블라스팅 후 잔존 부식 정도를 CNN으로 평가하는 연구들이 "영역 단위 인식 → 제어"라는 흐름을 공유한다.

---

## 데이터 정제

선체 영상 데이터는 깨끗하지 않다. 정제에서 성패가 갈린다.

### 라벨 설계 먼저

라벨링을 시작하기 전에 클래스 경계 규칙을 문서로 고정한다. "부식 시작점을 어디로 보는가", "도장 들뜸(blistering)은 부식인가 유지인가" 같은 모호한 경계를 작업자마다 다르게 칠하면 모델이 흔들린다. 경계 예시 이미지를 가이드에 넣어 라벨 일관성을 확보한다.

### 조명·반사 보정

금속 선체는 반사가 심하고, 야외/수중 조명이 들쭉날쭉하다. 고반사 영역은 클래스 판별을 망친다. 전처리로 다음을 검토한다.

- **CLAHE / contrast stretching** — 명암 대비를 살려 부식 텍스처를 드러낸다.
- **하이라이트 마스킹** — 포화된 반사 픽셀은 별도 처리하거나 학습에서 가중치를 낮춘다.

### 클래스 불균형

대부분의 면적은 "유지"이고 부식·부착물은 소수다. 불균형을 그대로 두면 모델이 전부 "유지"로 찍는다. 대응책:

- 패치 샘플링으로 부식 영역 비중을 끌어올림
- 손실 함수에 클래스 가중치 또는 Focal Loss 적용
- 부식 패치 위주의 증강(회전·밝기·텍스처)

### 해상도 정책

촬영 해상도와 학습/추론 해상도가 다르면 작은 부식이 사라진다. 학습 해상도와 현장 입력 해상도를 맞추거나, 타일링(tiling)으로 원본 해상도를 보존하는 전략을 택한다. 실제 적용 해상도와 그에 따른 IoU 변화는 `<측정값>`으로 두고 현장에서 측정한다.

---

## 모델 선택 — 용도별 후보

정답 모델은 없고 "정확도 / 속도 / 현장 하드웨어"의 균형으로 고른다. 후보를 성격별로 정리하면:

- **U-Net 계열** — 적은 데이터에서도 안정적이고 의료·산업 결함 세그멘테이션의 기본기. 초기 베이스라인으로 적합.
- **DeepLabv3+** — atrous conv로 넓은 문맥을 보며 경계가 깔끔. 부식 경계가 중요할 때.
- **경량 백본(MobileNet/EfficientNet 기반 세그)** — 현장 Edge PC에서 실시간이 필요할 때.
- **Transformer 계열(SegFormer 등)** — 데이터가 충분하고 정확도를 끝까지 끌어올릴 때. 대신 연산·메모리 비용이 크다.

권장 순서는 "U-Net로 베이스라인 → 데이터·요구 정확도 보고 DeepLab/SegFormer로 승급 → 현장 배포 시 경량 백본으로 다운사이징"이다. 각 모델의 mIoU·FPS·GPU 메모리는 동일 데이터셋에서 직접 비교해 `<측정값>`을 채운다.

---

## 인식 결과를 분사 입력으로 변환

세그멘테이션 마스크가 곧 제어 입력은 아니다. 마스크를 노즐이 이해하는 값으로 바꾸는 결정 단계가 필요하다.

1. **클래스 → 기본 압력 매핑** — 유지=0(미분사), 부식=고압, 부착물=중압처럼 클래스별 기준 압력을 둔다.
2. **심각도 가중** — 같은 부식이라도 면적·밀도에 따라 압력·체류시간(dwell time)을 키운다.
3. **경로 생성** — 제거 대상 픽셀을 묶어 노즐 이동 경로와 분사 on/off 구간으로 변환한다.
4. **피드백 루프** — 재촬영해 잔존 부식을 다시 세그멘테이션하고, 남아 있으면 해당 구역만 재분사한다. 선행 연구에서 강화학습으로 "완전 제거를 위한 최적 경로"를 학습시킨 접근이 이 피드백 단계에 해당한다.

아래는 클래스·심각도에서 분사 입력이 어떻게 나오는지 감을 잡기 위한 작은 위젯이다. 실제 압력·체류시간 값은 장비 사양에 맞춰 `<측정값>`으로 교체해야 한다.

<div id="wb-demo" style="border:1px solid var(--border,#d4dbe6);border-radius:12px;padding:16px;background:var(--surface,#fff);max-width:520px;">
  <p style="margin:0 0 12px;font-weight:600;color:var(--t1,#0f1f3d);">분사 입력 미리보기 (개념용)</p>
  <label style="display:block;margin-bottom:6px;color:var(--t1,#0f1f3d);">표면 클래스</label>
  <select id="wb-cls" aria-label="표면 클래스" style="width:100%;padding:8px;margin-bottom:14px;border:1px solid var(--border,#d4dbe6);border-radius:8px;">
    <option value="keep">유지 (도장 정상)</option>
    <option value="foul">해양 부착물</option>
    <option value="rust" selected>부식</option>
  </select>
  <label for="wb-sev" style="display:block;margin-bottom:6px;color:var(--t1,#0f1f3d);">심각도: <span id="wb-sevv">60</span>%</label>
  <input id="wb-sev" type="range" min="0" max="100" value="60" step="5" aria-label="심각도" style="width:100%;">
  <div style="margin-top:14px;display:flex;gap:12px;flex-wrap:wrap;">
    <div style="flex:1;min-width:120px;background:var(--bg,#eef2f7);border-radius:8px;padding:10px;">
      <div style="font-size:12px;color:#5b6b86;">분사 압력</div>
      <div id="wb-press" style="font-size:20px;font-weight:700;color:var(--blue,#2563eb);">—</div>
    </div>
    <div style="flex:1;min-width:120px;background:var(--bg,#eef2f7);border-radius:8px;padding:10px;">
      <div style="font-size:12px;color:#5b6b86;">체류시간(상대)</div>
      <div id="wb-dwell" style="font-size:20px;font-weight:700;color:var(--blue,#2563eb);">—</div>
    </div>
  </div>
  <p id="wb-note" style="margin:12px 0 0;font-size:13px;color:#5b6b86;"></p>
</div>
<script>
(function(){
  var root=document.getElementById('wb-demo'); if(!root) return;
  var cls=root.querySelector('#wb-cls'), sev=root.querySelector('#wb-sev'),
      sevv=root.querySelector('#wb-sevv'), press=root.querySelector('#wb-press'),
      dwell=root.querySelector('#wb-dwell'), note=root.querySelector('#wb-note');
  var base={keep:0, foul:0.5, rust:1.0};
  function pct(v){return Math.round(v)+'%';}
  function update(){
    var s=Number(sev.value), b=base[cls.value];
    sevv.textContent=s;
    if(b===0){
      press.textContent='미분사'; dwell.textContent='0';
      note.textContent='정상 도장면은 분사하지 않습니다 (오버블라스팅 방지).';
      sev.disabled=true; return;
    }
    sev.disabled=false;
    var p=Math.round((0.4+0.6*(s/100))*b*100);  // 개념용 상대 압력
    var d=Math.round((0.3+0.7*(s/100))*b*100);  // 개념용 상대 체류시간
    press.textContent=pct(p); dwell.textContent=pct(d);
    note.textContent='상대값(개념용). 실제 bar·초 단위는 장비 사양에 맞춰 보정 필요.';
  }
  cls.addEventListener('change',update);
  sev.addEventListener('input',update);
  update();
})();
</script>

---

## 정리

선체 워터블라스팅 자동화는 "영상 인식 → 분사 제어"의 두 단계 문제다. 인식은 클래스를 단순화한 시맨틱 세그멘테이션으로 풀고, 성패는 라벨 일관성·반사 보정·클래스 불균형 같은 **데이터 정제**에서 갈린다. 모델은 U-Net 베이스라인에서 시작해 정확도·속도 요구에 맞춰 승급/경량화한다. 마지막으로 마스크를 클래스·심각도 기반의 압력·체류시간·경로로 변환하고, 재촬영 피드백으로 잔존부를 다시 처리한다.

다음 단계는 작은 라벨링 가이드와 U-Net 베이스라인으로 mIoU·FPS를 실측해 이 글의 `<측정값>`들을 채우는 것이다.

> 확인 필요: 모든 압력·체류시간·해상도·정확도 수치는 실제 장비/데이터셋에서 측정해 교체할 것. 본문 위젯의 매핑은 개념 설명용이며 제어 파라미터가 아니다.

---

## 이미지 출처

직접 제작한 도식(SVG) — `/assets/img/posts/hull-waterblasting-vision.svg`. 클래스 세그멘테이션과 노즐 압력 매핑 개념을 표현.
