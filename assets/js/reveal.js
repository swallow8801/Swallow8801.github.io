/**
 * reveal.js
 * 스크롤 진입 시 `.reveal` 요소에 `is-visible` 클래스를 부여해
 * 페이드업 트랜지션을 트리거한다. (스타일은 _sass/_base.scss 참조)
 *
 * prefers-reduced-motion: reduce 환경에서는 IntersectionObserver를
 * 생성하지 않고 모든 대상에 즉시 is-visible을 부여한다.
 */
(function () {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion) {
    targets.forEach(function (el) {
      el.classList.add('is-visible');
    });
    return;
  }

  const observer = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -40px 0px'
  });

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
