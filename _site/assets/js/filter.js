/**
 * filter.js
 * 블로그: series(대분류) + category(소분류) 2단계 필터
 * 포트폴리오: type(카테고리) 1단계 필터
 */
(function () {

  // ── 블로그 2단계 필터 ──────────────────────────
  const blogBar   = document.querySelector('.blog-cat-bar');
  const allBtn    = blogBar && blogBar.querySelector('.blog-cat-bar__all');
  const catBtns   = blogBar ? blogBar.querySelectorAll('.blog-cat-bar__btn') : [];
  const blogCards = document.querySelectorAll('.posts-grid .post-card');

  function blogFilter(series, category) {
    // 버튼 active
    if (allBtn) allBtn.classList.toggle('blog-cat-bar__all--active', !series);
    catBtns.forEach(function (b) { b.classList.remove('blog-cat-bar__btn--active'); });
    if (series) {
      catBtns.forEach(function (b) {
        if (b.dataset.series === series && b.dataset.category === category) {
          b.classList.add('blog-cat-bar__btn--active');
        }
      });
    }
    // 카드 show/hide
    blogCards.forEach(function (card) {
      var show = !series ||
        (card.dataset.series === series && card.dataset.category === category);
      card.style.display = show ? '' : 'none';
    });
  }

  if (allBtn) allBtn.addEventListener('click', function () { blogFilter(null, null); });
  catBtns.forEach(function (b) {
    b.addEventListener('click', function () { blogFilter(b.dataset.series, b.dataset.category); });
  });

  // 사이드바 카테고리 트리 클릭도 필터 연동
  document.querySelectorAll('.cat-tree__item[data-series]').forEach(function (item) {
    item.addEventListener('click', function () {
      blogFilter(item.dataset.series, item.dataset.category);
    });
  });

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
