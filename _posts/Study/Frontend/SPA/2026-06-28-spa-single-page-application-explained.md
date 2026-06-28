---
layout: post
title: "SPA란 무엇인가: 페이지를 새로고침하지 않는 웹"
date: 2026-06-28
series: "Study"
category: "Frontend"
subcategory: "SPA"
tags: [spa, routing, history-api, csr, frontend]
description: "전통적 MPA와 비교해 SPA가 어떻게 전체 새로고침 없이 화면을 바꾸는지, 라우팅·상태·트레이드오프를 정리합니다."
pinned: false
---

## 들어가며

요즘 웹앱을 쓰다 보면 메뉴를 눌러도 화면이 하얗게 깜빡이며 다시 그려지는 느낌이 없습니다. 주소는 바뀌는데 페이지 전체가 새로 로드되지는 않죠. 이게 **SPA(Single Page Application)** 의 경험입니다.

SPA는 말 그대로 "한 장(page)"으로 동작하는 애플리케이션입니다. 처음에 HTML 한 장과 자바스크립트를 받고 나면, 이후의 화면 전환은 서버에 페이지를 다시 요청하지 않고 **JS가 화면의 일부만 바꿔치기**해서 처리합니다. 이 글은 전통적 방식(MPA)과 비교해 SPA가 무엇을 어떻게 다르게 하는지, 그 대가는 무엇인지 정리합니다.

---

## MPA: 페이지마다 서버에 새로 요청

비교 대상부터 봅시다. 전통적인 **MPA(Multi-Page Application)** 는 링크를 누를 때마다 브라우저가 서버에 새 HTML 문서를 요청하고, 받은 문서로 화면 전체를 갈아엎습니다.

```
/home    클릭 → 서버가 home.html 응답   → 화면 전체 교체
/about   클릭 → 서버가 about.html 응답  → 화면 전체 교체
```

장점은 단순하고, 각 페이지가 독립적이며, 검색 엔진이 읽기 좋다는 점입니다. 단점은 페이지를 옮길 때마다 전체 문서를 다시 받아 다시 그리므로 **전환 사이에 깜빡임과 끊김**이 생기고, 공통 영역(헤더·사이드바)도 매번 다시 그린다는 것입니다.

## SPA: 한 번 받고, 이후엔 JS가 화면을 바꾼다

SPA는 첫 진입에서 앱 전체를 굴릴 JS를 받습니다. 그다음부터 링크 클릭은 서버 왕복 대신 **클라이언트에서 처리**됩니다. 필요한 데이터만 API로 받아, 바뀌어야 할 영역만 다시 그립니다.

```
첫 진입 → index.html + app.js 수신 (앱 부팅)
/about 클릭 → 기본 동작 가로채기 → 주소만 바꾸고
            → 필요한 데이터만 fetch → 본문 영역만 교체
```

헤더·사이드바처럼 공통인 부분은 그대로 두고 본문만 바뀌므로 전환이 매끄럽고, 앱처럼 느껴집니다.

---

## 직접 만져보기: 전환할 때 무슨 일이 일어나나

아래 두 패널은 같은 메뉴를 다르게 처리합니다. 왼쪽(MPA)은 클릭할 때마다 화면 전체가 한 번 "리로드"되는 느낌을, 오른쪽(SPA)은 본문만 바뀌는 느낌을 흉내 냅니다. 차이를 눌러서 비교해 보세요.

<div class="spa-demo" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:640px;">
  <section aria-label="MPA 방식" style="border:1px solid var(--border,#d7dee8);border-radius:12px;background:var(--surface,#fff);overflow:hidden;">
    <header style="background:#0f1f3d;color:#fff;padding:8px 10px;font-size:13px;font-weight:600;">MPA · 전체 새로고침</header>
    <nav style="display:flex;gap:6px;padding:8px;">
      <button type="button" class="mpa-nav" data-p="홈" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">홈</button>
      <button type="button" class="mpa-nav" data-p="소개" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">소개</button>
      <button type="button" class="mpa-nav" data-p="연락처" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">연락처</button>
    </nav>
    <div class="mpa-view" aria-live="polite" style="position:relative;height:96px;margin:0 8px 10px;border-radius:8px;background:#f3f6fb;display:flex;align-items:center;justify-content:center;font-weight:600;color:#0f1f3d;">홈</div>
  </section>

  <section aria-label="SPA 방식" style="border:1px solid var(--border,#d7dee8);border-radius:12px;background:var(--surface,#fff);overflow:hidden;">
    <header style="background:#2563eb;color:#fff;padding:8px 10px;font-size:13px;font-weight:600;">SPA · 본문만 교체</header>
    <nav style="display:flex;gap:6px;padding:8px;">
      <button type="button" class="spa-nav" data-p="홈" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">홈</button>
      <button type="button" class="spa-nav" data-p="소개" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">소개</button>
      <button type="button" class="spa-nav" data-p="연락처" style="flex:1;padding:6px;border:1px solid #c7d2e2;border-radius:6px;background:#eef2f7;cursor:pointer;font-size:12.5px;">연락처</button>
    </nav>
    <div class="spa-view" aria-live="polite" style="position:relative;height:96px;margin:0 8px 10px;border-radius:8px;background:#f3f6fb;display:flex;align-items:center;justify-content:center;font-weight:600;color:#0f1f3d;">홈</div>
  </section>
</div>
<p class="spa-caption" style="font-size:13px;color:var(--t2,#5a6b85);max-width:640px;margin:8px 0 0;">MPA는 전환 때마다 패널이 한 번 번쩍이고, SPA는 본문 글자만 부드럽게 바뀝니다.</p>

<style>
  .spa-demo .flash { animation: spaFlash .5s ease; }
  .spa-demo .swap  { animation: spaSwap .28s ease; }
  @keyframes spaFlash { 0%{background:#fff;opacity:.2} 100%{opacity:1} }
  @keyframes spaSwap  { 0%{opacity:0;transform:translateY(4px)} 100%{opacity:1;transform:none} }
  @media (prefers-reduced-motion: reduce) {
    .spa-demo .flash, .spa-demo .swap { animation: none; }
  }
</style>

<script>
(function () {
  var demo = document.querySelector('.spa-demo');
  if (!demo) return;                       // 이 글에서만 동작하도록 스코프

  var mpaView = demo.querySelector('.mpa-view');
  demo.querySelectorAll('.mpa-nav').forEach(function (b) {
    b.addEventListener('click', function () {
      // MPA: 화면 전체가 리로드되는 느낌 (번쩍임)
      mpaView.classList.remove('flash'); void mpaView.offsetWidth;
      mpaView.classList.add('flash');
      mpaView.textContent = b.getAttribute('data-p');
    });
  });

  var spaView = demo.querySelector('.spa-view');
  demo.querySelectorAll('.spa-nav').forEach(function (b) {
    b.addEventListener('click', function () {
      // SPA: 본문만 부드럽게 교체
      spaView.classList.remove('swap'); void spaView.offsetWidth;
      spaView.classList.add('swap');
      spaView.textContent = b.getAttribute('data-p');
    });
  });
})();
</script>

차이는 작아 보여도, 페이지를 자주 오가는 앱일수록 이 "끊김 없는 전환"이 사용 경험을 크게 바꿉니다.

---

## 라우팅은 어떻게 동작하나

SPA의 마법은 대부분 **History API** 위에 있습니다. 링크의 기본 동작(서버로 새 문서 요청)을 가로채고, `history.pushState`로 주소만 바꾼 뒤 화면을 직접 갱신합니다.

```javascript
// 가장 단순한 클라이언트 라우팅의 뼈대
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-spa]');
  if (!link) return;
  e.preventDefault();                    // 서버로의 전체 요청 차단
  const path = link.getAttribute('href');
  history.pushState({}, '', path);       // 주소만 변경
  renderRoute(path);                     // 본문만 다시 그림
});

window.addEventListener('popstate', () => renderRoute(location.pathname)); // 뒤로가기
```

실제로는 React Router, Vue Router, 또는 Next.js 같은 프레임워크가 이 처리를 대신 해 줍니다. 주소가 바뀌니 **뒤로가기·북마크·새로고침**도 자연스럽게 동작합니다(서버가 어떤 경로로 들어와도 같은 index.html을 주도록 설정하는 것이 전제입니다).

---

## SPA의 대가, 그리고 보완

SPA는 공짜가 아닙니다. 대표적인 트레이드오프는 이렇습니다.

먼저 **초기 로딩**입니다. 앱 전체를 굴릴 JS를 처음에 받아야 하므로, 첫 진입이 무거워질 수 있습니다. 코드 스플리팅(라우트별로 번들을 쪼개 필요한 것만 로드)으로 완화합니다.

다음은 **SEO와 첫 화면**입니다. 첫 HTML이 비어 있는 CSR 기반 SPA는 검색 크롤러나 링크 미리보기가 내용을 못 읽을 수 있습니다. 이때는 SSR/SSG를 곁들이거나(예: Next.js), 프리렌더링을 도입합니다. 즉 "SPA냐 SSR이냐"는 양자택일이 아니라 **섞어 쓰는** 경우가 많습니다.

마지막으로 **상태·메모리 관리**입니다. 페이지가 리로드되지 않으니 메모리·이벤트 리스너가 계속 쌓일 수 있어, 정리(cleanup)에 신경 써야 합니다. 첫 로딩 체감과 번들 크기는 앱 규모에 따라 천차만별이라 측정이 필요합니다(`<측정값>` — 라우트별 번들 크기와 초기 로드 시간, 확인 필요).

---

## 정리

SPA는 "한 장의 HTML을 받아 두고, 이후 화면 전환을 JS가 처리하는" 웹앱 구조입니다. MPA의 페이지 단위 새로고침 대신 본문만 갈아끼우므로 전환이 매끄럽고 앱처럼 느껴집니다. 그 핵심은 History API 기반 클라이언트 라우팅이고, 대가는 초기 번들 무게와 SEO 부담입니다. 그래서 현실의 선택지는 "순수 SPA"와 "SSR" 사이 어딘가에서, 코드 스플리팅·서버 렌더링을 섞어 균형을 맞추는 쪽으로 갑니다.
