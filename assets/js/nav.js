/**
 * nav.js
 * 스크롤이 일정 이상 내려가면 .site-nav에 is-scrolled를 부여해
 * 네비게이션을 축소하고 보더/그림자를 강조한다. (스타일은 _sass/_nav.scss)
 */
(function () {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;

  function onScroll() {
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
  }

  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
})();
