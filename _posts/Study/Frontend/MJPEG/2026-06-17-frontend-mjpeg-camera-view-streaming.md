---
layout: post
title: "RTSP는 백엔드, 화면엔 MJPEG: 프론트엔드 카메라 뷰를 가볍게 띄우기"
date: 2026-06-17
series: "Study"
category: "Frontend"
subcategory: "MJPEG"
tags: [mjpeg, streaming, camera, frontend]
description: "RTSP를 브라우저에서 바로 못 트는 이유와, 관제 화면에 카메라 다수를 가볍게 띄우기 위한 MJPEG(서버 변환) 구성을 정리합니다."
image: https://images.unsplash.com/photo-1557597774-9d273605dfa9?fm=jpg&q=60&w=3000&auto=format&fit=crop
pinned: false
---

## 들어가며

관제 화면을 만들다 보면 "영상은 RTSP로 잘 들어오는데, 정작 브라우저에 띄우는 게 제일 골치"라는 순간이 옵니다. RTSP·WebRTC·HLS의 역할 분담은 [별도 글](/blog/)에서 정리했는데, 거기서 한 가지 선택지를 일부러 비워뒀습니다. 바로 **MJPEG**입니다.

WebRTC는 1초 미만 지연이 강점이지만 STUN/TURN·SDP·ICE까지 얹어야 하고, 카메라가 늘어날수록 연결 관리가 무거워집니다. 반면 관제 벽면에 카메라 9개·16개를 **동시에 한 화면에 깔아두고 상황만 살피는** 용도라면, 프레임당 100~300ms 지연은 대개 허용됩니다. 이럴 때 MJPEG는 "프론트엔드에서 가장 적은 코드로 여러 카메라를 띄우는" 현실적인 선택이 됩니다.

이 글은 RTSP를 브라우저가 직접 못 여는 이유부터, 서버에서 MJPEG로 바꿔 `<img>` 한 줄로 받는 구성, 그리고 카메라가 많아질 때 주의할 점을 정리합니다.

---

## 브라우저는 왜 RTSP를 직접 못 여는가

먼저 짚을 점은 `<video src="rtsp://...">`가 동작하지 않는다는 사실입니다. 이유는 단순합니다. 브라우저는 HTTP(S)·WebSocket·WebRTC 같은 **웹 표준 전송 계층**만 말할 줄 압니다. RTSP는 카메라와 미디어 서버 사이의 프로토콜이라 브라우저의 네트워크 스택에 들어 있지 않습니다.

그래서 RTSP를 화면에 띄우려면 **반드시 서버가 한 번 받아서 웹이 이해하는 형태로 바꿔줘야** 합니다. 변환 결과를 무엇으로 내보내느냐가 곧 프론트엔드 구현 난이도를 결정합니다.

| 출력 형식 | 프론트엔드 코드 | 지연 | 비고 |
|-----------|----------------|------|------|
| HLS (`.m3u8`) | `hls.js` 또는 네이티브 | 보통 5~30s | 다시보기·대규모 배포에 유리 |
| WebRTC | RTCPeerConnection 협상 | <1s | 실시간성 최고, 구성 복잡 |
| **MJPEG** | `<img src="...">` | 보통 0.1~0.3s | 가장 단순, CPU·대역폭 비용 큼 |

MJPEG의 매력은 마지막 줄입니다. **프론트엔드 코드가 `<img>` 태그 하나**로 끝납니다.

---

## MJPEG의 정체: 끝나지 않는 멀티파트 JPEG

MJPEG(Motion JPEG)는 거창한 코덱이 아닙니다. **JPEG 한 장 한 장을 계속 이어 붙여 보내는 스트림**입니다. 서버는 `multipart/x-mixed-replace`라는 오래된 HTTP 응답 형식으로, 한 연결 위에 JPEG 프레임을 무한히 흘려보냅니다.

```
HTTP/1.1 200 OK
Content-Type: multipart/x-mixed-replace; boundary=frame

--frame
Content-Type: image/jpeg
Content-Length: 48213

<...JPEG 바이트...>
--frame
Content-Type: image/jpeg
Content-Length: 47980

<...다음 JPEG 바이트...>
--frame
...
```

`x-mixed-replace`의 의미 그대로, 브라우저는 새 파트가 도착할 때마다 **이전 이미지를 교체**합니다. 그래서 `<img>`가 가만히 있어도 그림이 계속 갱신되는 것처럼 보입니다. 아래 위젯으로 그 동작을 직접 만져볼 수 있습니다 — 프레임이란 결국 "교체되는 정지 이미지"라는 감각을 잡는 용도입니다.

<div class="mjpeg-demo" data-mjpeg-demo>
  <div class="mjpeg-stage" role="img" aria-label="모의 카메라 프레임 미리보기" aria-live="off">
    <span class="mjpeg-frame-label" data-frame-label>FRAME 0</span>
    <span class="mjpeg-cam">CAM&nbsp;01 · LIVE</span>
  </div>
  <div class="mjpeg-controls">
    <button type="button" data-toggle aria-pressed="false">▶ 재생</button>
    <label>프레임레이트
      <input type="range" min="1" max="15" value="6" step="1" data-fps aria-label="초당 프레임 수">
    </label>
    <span class="mjpeg-readout"><span data-fps-val>6</span> fps · 받은 프레임 <span data-count>0</span></span>
  </div>
  <p class="mjpeg-note">각 프레임은 독립된 JPEG입니다. fps를 올리면 더 부드럽지만, 그만큼 매초 보내는 이미지 수(=대역폭·CPU)도 같이 늘어납니다.</p>
</div>

<style>
.mjpeg-demo{border:1px solid rgba(15,31,61,.12);border-radius:12px;padding:16px;margin:20px 0;background:var(--surface,#fff)}
.mjpeg-demo .mjpeg-stage{position:relative;height:160px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  background:repeating-linear-gradient(45deg,#1b2942,#1b2942 14px,#223150 14px,#223150 28px);overflow:hidden}
.mjpeg-demo .mjpeg-frame-label{font:600 28px/1 ui-monospace,Menlo,monospace;color:#eaf0ff;letter-spacing:1px}
.mjpeg-demo .mjpeg-cam{position:absolute;top:8px;left:10px;font:600 11px/1 ui-monospace,monospace;color:#7fe0a8}
.mjpeg-demo .mjpeg-controls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:12px;font-size:14px;color:var(--t1,#0f1f3d)}
.mjpeg-demo button[data-toggle]{padding:6px 14px;border:0;border-radius:6px;background:var(--blue,#2563eb);color:#fff;font-size:14px;cursor:pointer}
.mjpeg-demo button[data-toggle]:focus-visible{outline:3px solid rgba(37,99,235,.45);outline-offset:2px}
.mjpeg-demo input[type=range]{vertical-align:middle}
.mjpeg-demo label{display:inline-flex;gap:6px;align-items:center}
.mjpeg-demo .mjpeg-readout{font:500 13px/1.4 ui-monospace,monospace;color:#48566f}
.mjpeg-demo .mjpeg-note{margin:10px 0 0;font-size:13px;color:#56607a}
</style>

<script>
(function(){
  var root=document.querySelector('[data-mjpeg-demo]'); if(!root) return;
  var label=root.querySelector('[data-frame-label]'),
      btn=root.querySelector('[data-toggle]'),
      fps=root.querySelector('[data-fps]'),
      fpsVal=root.querySelector('[data-fps-val]'),
      count=root.querySelector('[data-count]'),
      stage=root.querySelector('.mjpeg-stage');
  var n=0,timer=null,
      reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var palette=['#1b2942','#23324f','#2b3c5e','#1f3350'];
  function tick(){
    n++; label.textContent='FRAME '+n; count.textContent=n;
    stage.style.background='repeating-linear-gradient(45deg,'+palette[n%4]+','+palette[n%4]+' 14px,#223150 14px,#223150 28px)';
  }
  function stop(){ if(timer){clearInterval(timer);timer=null;} btn.textContent='▶ 재생'; btn.setAttribute('aria-pressed','false'); }
  function start(){
    stop(); var rate=parseInt(fps.value,10)||6;
    timer=setInterval(tick,1000/rate);
    btn.textContent='⏸ 일시정지'; btn.setAttribute('aria-pressed','true');
    if(reduce){ stop(); tick(); } // 모션 최소화 환경: 한 프레임만 갱신
  }
  btn.addEventListener('click',function(){ timer?stop():start(); });
  fps.addEventListener('input',function(){ fpsVal.textContent=fps.value; if(timer) start(); });
})();
</script>

---

## 프론트엔드: `<img>` 한 줄과 그리드

서버가 MJPEG 엔드포인트(`/stream/cam01`)를 제공한다면, 프론트엔드는 정말로 이게 전부입니다.

```html
<img src="https://media.example.com/stream/cam01" alt="카메라 01" />
```

여러 대를 한 화면에 까는 관제 벽면도 CSS Grid로 단순하게 구성됩니다.

```html
<div class="cam-grid">
  <img src="/stream/cam01" alt="카메라 01">
  <img src="/stream/cam02" alt="카메라 02">
  <!-- ... -->
</div>

<style>
.cam-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cam-grid img{width:100%;aspect-ratio:16/9;object-fit:cover;background:#111}
</style>
```

WebRTC라면 카메라 1대마다 PeerConnection을 맺고 ICE를 처리해야 하지만, MJPEG는 그냥 `<img>`를 늘리면 됩니다. **상태 관리·연결 수립 코드가 0에 가깝다**는 게 관제 UI에서 MJPEG를 쓰는 가장 큰 이유입니다.

### 끊겼을 때 다시 붙이기

다만 MJPEG 연결은 네트워크가 흔들리면 조용히 멈춥니다(이미지가 마지막 프레임에서 얼어붙음). `onerror`와 주기적 새로고침으로 자가 복구를 넣어주는 편이 안전합니다.

```js
function attach(img, url){
  img.onerror = () => {
    // 캐시 무력화용 쿼리스트링을 바꿔 강제 재연결
    setTimeout(() => { img.src = url + '?t=' + Date.now(); }, 1000);
  };
  img.src = url + '?t=' + Date.now();
}
```

"프레임이 멈췄는지"를 감지하려면 별도의 헬스 신호(예: 워치독 타임스탬프)가 필요합니다. `<img>`만으로는 "느려진 것"과 "멈춘 것"을 구분하기 어렵기 때문입니다. 이 부분은 [실시간 상태 표시 UI](/blog/) 쪽 패턴과 묶어서 다루면 좋습니다.

---

## 공짜는 아니다: MJPEG의 비용

MJPEG가 단순한 대신, 비용은 다른 곳에서 치릅니다.

프레임마다 **완전한 JPEG를 통째로** 보냅니다. H.264처럼 프레임 간 차이만 보내는 코덱과 달리, 화면이 거의 안 변해도 매 프레임 전체 용량을 전송합니다. 그래서 같은 화질·프레임레이트라면 MJPEG의 대역폭이 H.264 계열보다 크게 높습니다(정확한 배수는 해상도·장면 복잡도에 따라 다르므로 `<측정값>` — 운영 카메라로 실측 필요).

서버 쪽 CPU도 신경 써야 합니다. RTSP(H.264)를 받아 JPEG로 다시 인코딩하면 카메라 수만큼 디코딩+JPEG 인코딩 부하가 쌓입니다. 카메라가 많을수록 이 변환 비용이 병목이 되기 쉽습니다.

정리하면 MJPEG는 이런 자리에 맞습니다.

- 카메라 다수를 **한눈에 깔아두는 관제 그리드** — 개별 화질·실시간성보다 "전체 상황 파악"이 목적일 때
- **저지연이 그렇게까지 중요하지 않은** 모니터링(0.1~0.3s 허용)
- 프론트엔드를 **최대한 단순하게** 유지하고 싶을 때

반대로 정밀한 실시간 확인(예: 특정 카메라를 크게 띄워 1초 미만으로 보는 화면)은 WebRTC로, 다시보기·대규모 동시 시청은 HLS로 분리하는 하이브리드가 현실적입니다.

---

## 서버 쪽 변환은 어떻게 (개요)

프론트엔드 글이라 서버는 개요만 적습니다. RTSP→MJPEG 변환은 보통 FFmpeg나 미디어 서버(MediaMTX 등)로 처리하고, 그 앞단에 작은 HTTP 게이트웨이를 둬 `multipart/x-mixed-replace`로 흘려보냅니다.

```bash
# 개념용 예시 — 실제 파라미터는 카메라/부하에 맞게 조정
ffmpeg -rtsp_transport tcp -i rtsp://camera_ip:554/stream \
  -f mpjpeg -q:v 7 -r 6 \   # MJPEG, 품질·프레임레이트로 부하 조절
  pipe:1
```

핵심 손잡이는 두 개입니다. **`-r`(프레임레이트)** 와 **`-q:v`(JPEG 품질)**. 둘 다 낮추면 대역폭·CPU가 내려가는 대신 화질·부드러움이 떨어집니다. 카메라 대수와 Edge PC 자원에 맞춰 이 두 값으로 균형을 잡는 게 운영의 대부분입니다(권장 시작값은 환경마다 다르므로 `<측정값>` — 현장 검증 필요).

---

## 정리

RTSP는 브라우저가 직접 못 엽니다. 그래서 항상 서버가 한 번 변환해야 하고, **무엇으로 변환하느냐가 프론트엔드 난이도를 정합니다.** 그중 MJPEG는 `<img>` 한 줄로 받을 수 있어, 카메라 다수를 한 화면에 까는 관제 그리드에 잘 맞습니다. 대신 프레임마다 전체 JPEG를 보내므로 대역폭·서버 CPU 비용이 크다는 점을 받아들여야 합니다.

실무에서는 한 프로토콜로 통일하기보다, "전체 상황은 MJPEG 그리드, 정밀 확인은 WebRTC, 다시보기는 HLS"처럼 화면 목적에 따라 나누는 편이 깔끔합니다. 다음 단계로는 끊김 감지(워치독)와 카메라 수 증가 시의 서버 부하 측정을 실제 값으로 채워보는 게 좋겠습니다.

---

## 이미지 출처

사진: Lianhao Qu / Unsplash
