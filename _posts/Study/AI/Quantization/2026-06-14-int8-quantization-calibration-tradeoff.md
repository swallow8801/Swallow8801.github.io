---
layout: post
title: "모델을 INT8로 줄인다는 것: 양자화의 원리와 보정, 그리고 정확도 트레이드오프"
date: 2026-06-14
series: "Study"
category: "AI"
subcategory: "Quantization"
tags: [quantization, int8, calibration, inference-optimization]
description: "FP32 가중치를 INT8로 줄이면 메모리와 연산이 함께 줄지만 공짜는 아닙니다. 양자화가 실수 값을 정수 격자에 어떻게 매핑하는지, 보정(calibration)이 왜 필요한지, 정확도 손실을 어디서 점검해야 하는지 인터랙티브 위젯과 함께 정리합니다."
image: https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

모델 경량화를 이야기할 때 가장 자주 듣는 말이 "INT8로 바꾸면 빨라진다"입니다. 틀린 말은 아닙니다. 다만 이 한 문장 뒤에는 "실수(FP32) 값을 정수(INT8) 격자에 욱여넣는다"는 다소 거친 작업이 숨어 있고, 그 과정에서 정보가 깎입니다. 그래서 양자화는 항상 "얼마나 빨라졌나"와 "얼마나 부정확해졌나"를 함께 봐야 하는 작업입니다.

이 글은 INT8 양자화가 값을 어떻게 매핑하는지, 그 매핑을 결정하는 **보정(calibration)** 이 왜 필요한지, 그리고 정확도 손실을 어디서 측정해야 하는지를 정리합니다. 매핑이 직관적으로 와닿도록 본문에 작은 인터랙티브 위젯을 하나 넣었습니다.

---

## 왜 정밀도를 낮추면 빨라지는가

FP32 가중치 하나는 4바이트입니다. 이를 INT8로 바꾸면 1바이트가 됩니다. 같은 모델이 메모리에서 차지하는 공간이 1/4로 줄고, GPU 메모리 대역폭(가중치를 연산 유닛으로 실어 나르는 통로)에 가해지는 부담도 그만큼 줄어듭니다. 또한 최신 GPU에는 정수 연산을 부동소수점보다 더 많이, 더 빠르게 처리하는 전용 경로가 있어, 연산 자체의 처리량도 올라갑니다.

정리하면 이득은 세 갈래입니다.

- **메모리**: 가중치 저장 공간이 약 1/4로 감소
- **대역폭**: 같은 시간에 더 많은 가중치를 옮길 수 있음
- **연산 처리량**: 정수 전용 연산 경로 활용

문제는 이 이득이 "값을 덜 정밀하게 표현하는 대가"로 얻어진다는 점입니다. 그 대가가 정확히 어디서 발생하는지 보려면, 매핑이 실제로 무슨 일을 하는지부터 봐야 합니다.

---

## 양자화는 실수를 정수 격자에 매핑하는 일

INT8은 −128부터 127까지, 256개의 정수 칸만 표현할 수 있습니다. 반면 실제 가중치나 활성값은 연속적인 실수입니다. 양자화는 "이 실수 범위를 256칸에 어떻게 나눠 담을 것인가"를 정하는 일입니다.

가장 기본이 되는 대칭(symmetric) 양자화는 두 개의 값으로 매핑을 정의합니다.

- **scale(s)**: 정수 한 칸이 실수 세계에서 얼마만큼의 폭을 갖는가
- **zero-point(z)**: 실수 0이 정수 격자에서 어디에 놓이는가 (대칭이면 보통 0)

매핑과 복원은 다음과 같습니다.

```python
# 실수 -> 정수
q = round(x / s) + z
q = clip(q, -128, 127)   # 범위를 벗어나면 잘라낸다(saturation)

# 정수 -> 실수(복원)
x_hat = (q - z) * s
```

여기서 두 종류의 오차가 생깁니다. 하나는 `round`로 인한 **반올림 오차**(실수를 가장 가까운 칸으로 욱여넣을 때 생기는 잔차), 다른 하나는 `clip`으로 인한 **포화 오차**(범위 바깥의 큰 값이 -128/127로 잘려 나갈 때 생기는 손실)입니다. 이 둘은 서로 당기는 관계입니다. 범위를 넓게 잡으면 포화는 줄지만 칸 하나의 폭이 커져 반올림 오차가 커지고, 범위를 좁게 잡으면 반대가 됩니다.

아래 위젯에서 범위(clip 한계)를 직접 움직여 보면, 같은 값들이 INT8 격자에 어떻게 다시 놓이고 어디서 오차가 커지는지 감을 잡을 수 있습니다.

<div class="q8-widget" role="group" aria-label="INT8 양자화 매핑 시각화">
  <div class="q8-row">
    <label for="q8-range">클립 범위 |x| ≤ <span id="q8-rangeval">4.0</span></label>
    <input id="q8-range" type="range" min="1" max="8" step="0.1" value="4" aria-describedby="q8-readout">
  </div>
  <div class="q8-row">
    <label for="q8-bits">정수 비트수: <span id="q8-bitsval">8</span> bit (<span id="q8-levels">256</span> levels)</label>
    <input id="q8-bits" type="range" min="2" max="8" step="1" value="8">
  </div>
  <svg id="q8-svg" viewBox="0 0 520 140" width="100%" role="img" aria-label="실수 값이 정수 격자에 매핑되는 모습"></svg>
  <p id="q8-readout" class="q8-readout" aria-live="polite"></p>
  <style>
    .q8-widget{border:1px solid rgba(37,99,235,.25);border-radius:12px;padding:16px;margin:18px 0;background:rgba(37,99,235,.04)}
    .q8-widget .q8-row{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;font-size:.9rem}
    .q8-widget input[type=range]{width:100%;accent-color:#2563eb}
    .q8-widget .q8-readout{font-size:.85rem;margin:8px 0 0;color:#0f1f3d}
    .q8-widget .q8-dot{fill:#2563eb}
    .q8-widget .q8-dot.sat{fill:#dc2626}
    .q8-widget .q8-grid{stroke:#94a3b8;stroke-width:1}
    .q8-widget .q8-axis{stroke:#475569;stroke-width:1.5}
    .q8-widget .q8-lbl{fill:#475569;font-size:10px}
  </style>
  <script>
  (function(){
    var svg=document.getElementById('q8-svg');
    if(!svg)return;
    var rEl=document.getElementById('q8-range'),bEl=document.getElementById('q8-bits');
    var rv=document.getElementById('q8-rangeval'),bv=document.getElementById('q8-bitsval'),lv=document.getElementById('q8-levels');
    var out=document.getElementById('q8-readout');
    var SVGNS='http://www.w3.org/2000/svg';
    // 고정된 샘플 값들(실수 분포 흉내) - 매번 같게.
    var samples=[-7.1,-4.6,-3.2,-2.1,-1.4,-0.6,-0.2,0.3,0.9,1.5,2.4,3.6,5.0,6.8];
    var W=520,H=140,padX=30,midY=64,trackY=110;
    function clear(){while(svg.firstChild)svg.removeChild(svg.firstChild);}
    function line(x1,y1,x2,y2,cls){var l=document.createElementNS(SVGNS,'line');l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);l.setAttribute('class',cls);svg.appendChild(l);}
    function txt(x,y,s){var t=document.createElementNS(SVGNS,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.setAttribute('class','q8-lbl');t.setAttribute('text-anchor','middle');t.textContent=s;svg.appendChild(t);}
    function render(){
      var R=parseFloat(rEl.value), bits=parseInt(bEl.value,10);
      var levels=Math.pow(2,bits), half=levels/2; // -half..half-1
      var s=R/(half); // scale: 양수쪽 R을 half칸으로
      rv.textContent=R.toFixed(1); bv.textContent=bits; lv.textContent=levels;
      clear();
      var plotW=W-padX*2;
      function sx(x){return padX+(x+8)/16*plotW;} // x in [-8,8]
      // 상단 실수 축
      line(padX,midY-30,W-padX,midY-30,'q8-axis');
      txt(W/2,midY-38,'실수 값(FP32)');
      // 하단 정수 격자 축
      line(padX,trackY,W-padX,trackY,'q8-axis');
      txt(W/2,trackY+22,'INT8 격자(복원값)');
      // 격자 눈금: 클립 범위 안의 대표 칸 표시(최대 17개로 제한)
      var step=Math.max(1,Math.round((half)/8));
      var maxErr=0,satCount=0;
      for(var q=-half;q<=half-1;q+=step){
        var xr=q*s; if(xr<-8||xr>8)continue;
        line(sx(xr),trackY-5,sx(xr),trackY+5,'q8-grid');
      }
      // 샘플 매핑
      samples.forEach(function(x){
        var sat=false;
        var q=Math.round(x/s);
        if(q>half-1){q=half-1;sat=true;} if(q<-half){q=-half;sat=true;}
        var xhat=q*s;
        var err=Math.abs(x-xhat); if(err>maxErr)maxErr=err; if(sat)satCount++;
        var x1=sx(x), x2=sx(xhat);
        line(x1,midY-30,x2,trackY,'q8-grid');
        var d1=document.createElementNS(SVGNS,'circle');
        d1.setAttribute('cx',x1);d1.setAttribute('cy',midY-30);d1.setAttribute('r',4);
        d1.setAttribute('class','q8-dot'+(sat?' sat':''));svg.appendChild(d1);
        var d2=document.createElementNS(SVGNS,'circle');
        d2.setAttribute('cx',x2);d2.setAttribute('cy',trackY);d2.setAttribute('r',4);
        d2.setAttribute('class','q8-dot'+(sat?' sat':''));svg.appendChild(d2);
      });
      out.textContent='scale ≈ '+s.toFixed(3)+' (칸 하나의 폭) · 최대 복원 오차 ≈ '+maxErr.toFixed(3)
        +' · 범위를 벗어나 잘린(saturated) 샘플 '+satCount+'개(빨강). 범위를 좁히면 칸이 촘촘해져 반올림 오차는 줄지만 큰 값이 더 많이 잘립니다.';
    }
    function reduced(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
    rEl.addEventListener('input',render); bEl.addEventListener('input',render);
    render();
  })();
  </script>
</div>

위젯에서 확인할 수 있는 핵심은 "정답인 범위는 없다"는 점입니다. 좋은 범위는 결국 **그 모델이 실제로 다루는 값의 분포**에 달려 있습니다. 이 분포를 어떻게 알아내느냐가 바로 보정입니다.

---

## 보정(calibration): 범위를 데이터로 정하기

가중치는 학습이 끝나면 고정된 값이라 분포를 직접 들여다볼 수 있습니다. 그런데 활성값(레이어를 통과하는 중간 출력)은 입력에 따라 매번 달라집니다. 그래서 "활성값이 보통 어느 범위에 분포하는가"를 알아내려면 **대표 입력 데이터를 모델에 흘려보내 실제 값의 분포를 측정**해야 합니다. 이 과정이 보정이고, 여기서 각 레이어의 scale과 clip 범위가 정해집니다.

보정에서 가장 중요한 결정은 "꼬리를 어디서 자를 것인가"입니다. 분포의 양 끝에는 드물게 나타나는 큰 값들이 있는데, 이를 모두 담으려고 범위를 넓히면 정작 값이 몰려 있는 가운데 영역의 칸이 듬성듬성해집니다. 그래서 실무 보정 기법들은 극단값을 어느 정도 포기하고 가운데를 촘촘하게 잡는 쪽을 택합니다.

- **min-max**: 관측된 최소·최대를 그대로 범위로. 단순하지만 이상치(outlier) 하나에 범위가 휘둘립니다.
- **percentile**: 상·하위 일부 퍼센트를 잘라내고 범위를 잡아 이상치 영향을 줄입니다.
- **entropy(KL)**: 양자화 전후 분포의 차이가 가장 작아지는 지점을 찾아 범위를 정합니다. TensorRT의 기본 보정이 이 계열입니다.

여기서 반드시 짚어야 할 함정: **보정 데이터가 실제 운영 입력과 분포가 다르면, 벤치마크에서는 멀쩡해 보여도 현장에서 정확도가 무너집니다.** 보정용 데이터는 운영에서 실제로 들어올 이미지와 같은 성격(조도·해상도·대상 분포)을 갖도록 골라야 합니다.

---

## PTQ와 QAT: 두 가지 길

INT8로 가는 길은 크게 둘입니다.

| 구분 | 방식 | 장점 | 비용 |
| --- | --- | --- | --- |
| PTQ (학습 후 양자화) | 학습 끝난 모델에 보정만 적용 | 빠르고 재학습 불필요 | 정확도 손실이 클 수 있음 |
| QAT (양자화 인지 학습) | 학습 중 양자화 오차를 흉내 내며 다시 학습 | 정확도 손실 최소화 | 재학습 비용·시간 |

실무에서는 보통 PTQ부터 시도합니다. PTQ만으로 정확도 손실이 허용 범위 안이면 거기서 끝내고, 손실이 크면 QAT로 넘어가는 순서가 비용 대비 합리적입니다. 처음부터 QAT를 잡는 것은 대개 과한 투자입니다.

---

## 무엇을, 어디서 측정할 것인가

양자화의 성패는 "빨라졌다"가 아니라 "이 정도 속도 이득에 이 정도 정확도 손실이면 받아들일 만한가"로 판단합니다. 그래서 양자화 전후를 **같은 검증 데이터셋**으로 나란히 측정해야 합니다.

- **정확도**: 운영에서 쓰는 지표 그대로(예: 검출 mAP, 분류 정확도). FP32 기준 대비 하락폭 (`<측정값>` — 실제 모델·데이터로 측정)
- **지연(latency)**: 한 장 처리 시간, 가능하면 p50/p95 (`<측정값>`)
- **처리량(throughput)**: 초당 처리 장수(FPS) (`<측정값>`)
- **메모리**: 모델·런타임 메모리 사용량 (`<측정값>`)

> 확인 필요: 위 수치는 모델 구조·GPU·배치 크기·보정 데이터에 따라 크게 달라지므로, 일반화된 숫자를 적지 않고 실제 측정값으로 채웁니다. 특히 정확도 하락폭은 클래스 불균형이 심한 불량 검출에서는 전체 정확도보다 클래스별(특히 소수 불량 클래스) 지표를 따로 봐야 합니다.

---

## 정리

INT8 양자화는 "실수 분포를 256칸 정수 격자에 어떻게 나눠 담을 것인가"라는 한 문제로 압축됩니다. scale을 작게 잡으면 촘촘하지만 큰 값이 잘리고, 크게 잡으면 반대입니다. 이 균형점을 데이터로 찾는 일이 보정이며, 보정 데이터가 운영 분포와 닮아야 현장에서도 정확도가 유지됩니다.

순서로 정리하면, 먼저 PTQ + 적절한 보정 기법으로 빠르게 시도하고, 같은 검증셋으로 정확도·지연·메모리를 측정해 트레이드오프를 확인한 뒤, 손실이 크면 QAT로 넘어갑니다. 핵심은 속도 숫자만 보지 않고 정확도 손실을 항상 짝으로 기록하는 습관입니다.

---

## 이미지 출처

사진: Alexandre Debiève / Unsplash (Unsplash License) — https://unsplash.com/photos/FO7JIlwjOtU
