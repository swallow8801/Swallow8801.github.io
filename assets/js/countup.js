/**
 * countup.js
 * [data-count] 요소가 뷰포트에 들어오면 0→목표값으로 숫자를 카운트업한다.
 * prefers-reduced-motion: reduce 환경에서는 즉시 최종값으로 고정한다.
 * (no-JS 시 HTML에 이미 최종값이 들어있어 안전)
 */
(function () {
  const els = document.querySelectorAll('[data-count]');
  if (!els.length) return;

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 모션 최소화 환경: 스크롤 없이도 즉시 최종값을 보여준다 (0으로 비우지 않음)
  if (reduced) {
    els.forEach(function (el) { el.textContent = el.dataset.count; });
    return;
  }

  function run(el) {
    const target = parseFloat(el.dataset.count) || 0;

    const dur = 1000;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      el.textContent = Math.round(target * eased);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  if (!('IntersectionObserver' in window)) {
    els.forEach(run);
    return;
  }

  const io = new IntersectionObserver(function (entries, obs) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        run(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  els.forEach(function (el) { el.textContent = '0'; io.observe(el); });
})();
