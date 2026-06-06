/**
 * filter.js
 * 포트폴리오: type(카테고리) 1단계 필터
 *
 * 블로그 필터는 blog/index.html 내부 스크립트가 독립 처리한다.
 * (.blog-cat-bar DOM이 존재하지 않으므로 이 파일에서는 포트폴리오만 담당)
 */
(function () {

  // ── 포트폴리오 1단계 필터 ─────────────────────
  const portFilter = document.querySelector('.port-filter');
  if (portFilter) {
    const portBtns  = portFilter.querySelectorAll('.port-filter__btn');
    const portCards = document.querySelectorAll('[data-category].proj-card, [data-category].proj-featured');

    portBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        portBtns.forEach(function (b) { b.classList.remove('port-filter__btn--active'); });
        btn.classList.add('port-filter__btn--active');
        var f = btn.dataset.filter;
        portCards.forEach(function (card) {
          card.style.display = (f === 'all' || card.dataset.category === f) ? '' : 'none';
        });
      });
    });
  }

})();
