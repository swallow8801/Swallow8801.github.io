/**
 * reading-progress.js
 * .post-content 영역을 기준으로 읽기 진행률을 계산해
 * .reading-progress__bar에 transform: scaleX(progress)로 반영.
 * 또한 일정 스크롤 이상에서 .back-to-top 버튼을 표시한다.
 */
(function () {
  const content = document.querySelector('.post-content');
  if (!content) return;

  const bar  = document.querySelector('.reading-progress__bar');
  const toTop = document.querySelector('.back-to-top');

  const prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SHOW_THRESHOLD = 400;

  let ticking = false;

  function update() {
    ticking = false;

    if (bar) {
      const rect = content.getBoundingClientRect();
      const contentTop    = rect.top + window.scrollY;
      const contentHeight = rect.height;
      const viewportHeight = window.innerHeight;

      const denom = contentHeight - viewportHeight;
      let progress;
      if (denom <= 0) {
        progress = window.scrollY > contentTop ? 1 : 0;
      } else {
        progress = (window.scrollY - contentTop) / denom;
      }
      progress = Math.min(Math.max(progress, 0), 1);

      bar.style.transform = 'scaleX(' + progress + ')';
    }

    if (toTop) {
      toTop.classList.toggle('is-visible', window.scrollY > SHOW_THRESHOLD);
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (toTop) {
    toTop.addEventListener('click', function () {
      if (prefersReducedMotion) {
        window.scrollTo(0, 0);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  update();
})();
