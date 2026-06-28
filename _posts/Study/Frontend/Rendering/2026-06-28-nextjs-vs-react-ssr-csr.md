---
layout: post
title: "Next.js vs React: SSR과 CSR, 무엇이 어떻게 다른가"
date: 2026-06-28
series: "Study"
category: "Frontend"
subcategory: "Rendering"
tags: [nextjs, react, ssr, csr, rendering]
description: "React의 CSR과 Next.js의 SSR이 무엇이 다른지, 브라우저가 받는 것과 렌더링 시점을 기준으로 정리합니다."
image: https://upload.wikimedia.org/wikipedia/commons/8/8e/Nextjs-logo.svg
pinned: false
---

## 들어가며

"Next.js랑 React, 뭐가 다른 거예요?"는 프론트엔드를 시작할 때 가장 많이 나오는 질문입니다. 둘은 경쟁 관계가 아니라 **층위가 다릅니다**. React는 화면을 그리는 라이브러리고, Next.js는 그 React를 감싸 라우팅·렌더링·빌드까지 묶어 주는 프레임워크입니다.

그래서 "vs"의 실제 쟁점은 대부분 **렌더링을 어디서, 언제 하느냐**로 좁혀집니다. React 기본은 브라우저에서 그리는 CSR(Client-Side Rendering)이고, Next.js는 서버에서 미리 그려 보내는 SSR(Server-Side Rendering)을 비롯한 여러 방식을 제공합니다. 이 글은 그 차이를 "브라우저가 무엇을 받는가"라는 한 가지 기준으로 정리합니다.

---

## React는 무엇을 하고, Next.js는 무엇을 더하나

React 단독으로 만든 앱(예: Vite + React)은 보통 이런 구조입니다. 서버는 거의 빈 HTML 한 장과 자바스크립트 번들을 내려주고, 화면은 그 번들이 브라우저에서 실행되며 비로소 그려집니다.

```html
<!-- React(CSR)가 처음 받는 HTML: 사실상 빈 껍데기 -->
<body>
  <div id="root"></div>
  <script src="/assets/index-abc123.js"></script>
</body>
```

Next.js는 여기에 라우팅(파일 기반), 서버 렌더링, 데이터 패칭 규약, 번들 최적화, 이미지 최적화 등을 얹습니다. 핵심은 **렌더링 시점을 페이지·컴포넌트 단위로 고를 수 있게 해 준다**는 점입니다. 같은 React 코드를 두고도 "이 페이지는 서버에서 미리 그리고, 저 부분은 브라우저에서 그린다"를 선택할 수 있습니다.

---

## CSR: 브라우저에서 그리기

CSR에서는 첫 응답이 빈 `div` 하나입니다. 브라우저가 JS를 받아 실행해야 화면이 채워집니다. 순서로 보면 이렇습니다.

1. 빈 HTML 수신 → 화면은 백지
2. JS 번들 다운로드
3. JS 실행 → React가 DOM을 만들어 화면을 그림
4. (필요하면) API 호출로 데이터를 받아 다시 그림

장점은 한 번 로드된 뒤의 **화면 전환이 매끄럽다**는 것입니다(서버 왕복 없이 JS가 화면을 바꿈). 단점은 첫 화면이 뜨기까지 JS 실행을 기다려야 하고, JS가 꺼져 있거나 크롤러가 JS를 실행하지 않으면 내용이 비어 보일 수 있다는 점입니다.

## SSR: 서버에서 미리 그려 보내기

SSR에서는 서버가 React 컴포넌트를 **HTML 문자열로 미리 렌더링**해서 내려줍니다. 브라우저는 내용이 채워진 HTML을 먼저 받으므로, JS 실행 전에도 화면이 보입니다. 이후 JS가 로드되면 그 정적 HTML에 이벤트 핸들러를 붙여 "살아 있는" 화면으로 만드는데, 이 과정을 **하이드레이션(hydration)** 이라 합니다.

```jsx
// Next.js(App Router): 서버에서 데이터까지 받아 HTML로 그려 보냄
export default async function Page() {
  const data = await fetchFromDB();   // 서버에서 실행
  return <Report rows={data} />;       // HTML로 직렬화되어 전달
}
```

순서로 보면 이렇습니다.

1. 내용이 채워진 HTML 수신 → 화면이 바로 보임
2. JS 번들 다운로드
3. 하이드레이션 → 버튼·입력 등 인터랙션이 동작

장점은 **첫 화면이 빠르게 보이고**(특히 느린 기기·네트워크에서 체감), HTML에 내용이 있어 **SEO·미리보기에 유리**하다는 점입니다. 대가는 매 요청마다 서버가 렌더링 비용을 치른다는 것입니다(캐싱·정적화로 줄일 수 있음).

---

## 직접 만져보기: 브라우저가 받는 것

같은 화면이라도 CSR과 SSR은 "첫 응답"이 전혀 다릅니다. 아래에서 두 방식을 눌러 비교해 보세요. 첫 HTML에 내용이 들어 있는지, 그리고 화면이 보이기까지 어떤 단계를 거치는지가 핵심입니다.

<div class="rmode" style="border:1px solid var(--border,#d7dee8);border-radius:12px;padding:16px;background:var(--surface,#fff);max-width:600px;">
  <div role="group" aria-label="렌더링 방식 선택" style="display:flex;gap:8px;margin-bottom:12px;">
    <button type="button" class="rmode-btn" data-mode="csr" aria-pressed="true"
      style="flex:1;padding:8px 10px;border:1px solid #c7d2e2;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;cursor:pointer;">CSR (React 기본)</button>
    <button type="button" class="rmode-btn" data-mode="ssr" aria-pressed="false"
      style="flex:1;padding:8px 10px;border:1px solid #c7d2e2;border-radius:8px;background:#eef2f7;color:#0f1f3d;font-weight:600;cursor:pointer;">SSR (Next.js)</button>
  </div>

  <p style="font-size:13px;color:var(--t2,#5a6b85);margin:0 0 6px;">① 서버가 보낸 첫 HTML</p>
  <pre id="rmodeHtml" aria-live="polite" style="margin:0 0 12px;padding:10px;background:#0f1f3d;color:#dbe6ff;border-radius:8px;font-size:12.5px;overflow:auto;white-space:pre-wrap;"></pre>

  <p style="font-size:13px;color:var(--t2,#5a6b85);margin:0 0 6px;">② 화면이 보이기까지의 단계</p>
  <ol id="rmodeSteps" aria-live="polite" style="margin:0;padding-left:20px;font-size:13.5px;color:var(--t1,#0f1f3d);line-height:1.7;"></ol>
</div>

<style>
  .rmode .rmode-step { transition: opacity .25s ease; }
  @media (prefers-reduced-motion: reduce) {
    .rmode .rmode-step { transition: none; }
  }
</style>

<script>
(function () {
  var root = document.currentScript.previousElementSibling;     // <style>
  // 위젯 컨테이너를 안전하게 찾는다 (이 글에서만 동작하도록 스코프)
  var box = document.querySelector('.rmode');
  if (!box) return;
  var htmlOut = box.querySelector('#rmodeHtml');
  var stepsOut = box.querySelector('#rmodeSteps');
  var btns = box.querySelectorAll('.rmode-btn');

  var data = {
    csr: {
      html: '<body>\n  <div id="root"></div>   <!-- 비어 있음 -->\n  <script src="/index.js"><\/script>\n</body>',
      steps: [
        '빈 화면(백지) — 아직 그릴 내용이 없음',
        'JS 번들 다운로드',
        'JS 실행 → React가 DOM을 만들어 화면을 그림',
        '필요 시 API 호출 후 다시 그림'
      ]
    },
    ssr: {
      html: '<body>\n  <div id="root">\n    <h1>분기 리포트</h1>\n    <table>…내용이 이미 채워짐…</table>\n  </div>\n  <script src="/index.js"><\/script>\n</body>',
      steps: [
        '내용이 채워진 화면이 바로 보임',
        'JS 번들 다운로드',
        '하이드레이션 → 버튼·입력 등 인터랙션 활성화'
      ]
    }
  };

  function render(mode) {
    var d = data[mode];
    htmlOut.textContent = d.html;
    stepsOut.innerHTML = '';
    d.steps.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'rmode-step';
      li.textContent = s;
      stepsOut.appendChild(li);
    });
    btns.forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.style.background = on ? '#2563eb' : '#eef2f7';
      b.style.color = on ? '#fff' : '#0f1f3d';
    });
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () { render(b.getAttribute('data-mode')); });
  });
  render('csr');
})();
</script>

CSR은 "빈 화면 → JS가 채움", SSR은 "채워진 화면 → JS가 살림"입니다. 같은 React 컴포넌트라도 어디서 그리느냐에 따라 사용자가 처음 보는 것이 달라집니다.

---

## 그래서 무엇을 언제 쓰나

정답은 "상황에 따라"지만, 판단 기준은 비교적 분명합니다.

**CSR(React 단독)이 잘 맞는 경우**는 로그인 뒤에서 동작하는 대시보드·관제 화면·사내 도구처럼 SEO가 필요 없고, 한 번 로드한 뒤 인터랙션이 잦은 앱입니다. 검색 노출이 의미 없고 사용자가 오래 머무는 화면이라면 CSR의 매끄러운 전환이 강점입니다.

**SSR(Next.js)이 잘 맞는 경우**는 검색 노출·링크 미리보기가 중요한 공개 페이지(랜딩, 블로그, 커머스 상품 페이지)나, 느린 기기에서도 첫 화면이 빨리 떠야 하는 서비스입니다.

체감 지표(첫 화면 표시 시간, 상호작용 가능 시점 등)는 코드·네트워크·기기에 따라 크게 달라지므로 일반화된 수치를 외우기보다 **직접 측정**하는 편이 맞습니다(`<측정값>` — 동일 페이지를 CSR/SSR로 빌드해 FCP·TTI 비교, 확인 필요).

---

## Next.js의 렌더링은 SSR만이 아니다

오해하기 쉬운 부분인데, Next.js = SSR이 아닙니다. Next.js는 여러 렌더링 방식을 페이지·컴포넌트 단위로 섞을 수 있습니다.

- **SSG(Static Site Generation)**: 빌드 시점에 HTML을 미리 만들어 두는 방식. 내용이 자주 바뀌지 않는 페이지에 가장 빠릅니다.
- **ISR(Incremental Static Regeneration)**: 정적 페이지를 일정 주기로 백그라운드 재생성. 정적의 속도와 최신성을 절충합니다.
- **RSC(React Server Components)**: App Router에서 컴포넌트를 서버 전용/클라이언트 전용으로 나눠, 클라이언트로 보내는 JS 자체를 줄이는 방향입니다.

즉 "React냐 Next.js냐"는 라이브러리 선택이라기보다, **렌더링 시점을 내가 직접 고를 수 있는 도구를 갖느냐**의 문제에 가깝습니다.

---

## 정리

React는 화면을 그리는 라이브러리, Next.js는 그 React에 라우팅·렌더링·빌드를 얹은 프레임워크입니다. 둘의 실질적 차이는 "브라우저가 무엇을 받느냐"로 드러납니다. CSR은 빈 화면을 받아 JS로 채우고, SSR은 채워진 화면을 받아 JS로 살립니다. SEO·첫 로딩이 중요하면 SSR 계열(Next.js), 로그인 뒤 인터랙션 중심이면 CSR(React 단독)이 출발점으로 합리적입니다. 다만 Next.js는 SSR뿐 아니라 SSG·ISR·RSC까지 섞을 수 있으므로, 실제로는 "프레임워크를 쓰되 페이지마다 알맞은 렌더링을 고르는" 형태로 수렴하는 경우가 많습니다.

---

## 이미지 출처

Next.js 공식 로고 — Wikimedia Commons (File:Nextjs-logo.svg, 원형 유지) — https://commons.wikimedia.org/wiki/File:Nextjs-logo.svg
