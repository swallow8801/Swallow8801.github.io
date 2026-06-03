/**
 * toc.js
 * 포스트 내 h2·h3를 스캔해 오른쪽 sticky TOC 생성.
 * 스크롤 위치에 따라 현재 섹션 하이라이팅.
 */
(function () {
  const tocList    = document.getElementById('toc-list');
  const content    = document.querySelector('.post-content');
  if (!tocList || !content) return;

  const headings = content.querySelectorAll('h2, h3');
  if (!headings.length) return;

  // id 자동 부여 + TOC 항목 생성
  headings.forEach(function (h, i) {
    if (!h.id) {
      h.id = 'heading-' + i;
    }

    const li = document.createElement('li');
    li.className = 'toc-item' + (h.tagName === 'H3' ? ' toc-item--h3' : '');

    const a = document.createElement('a');
    a.href = '#' + h.id;
    a.textContent = h.textContent;
    a.addEventListener('click', function (e) {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    li.appendChild(a);
    tocList.appendChild(li);
  });

  // 스크롤 하이라이팅
  const tocItems = tocList.querySelectorAll('.toc-item');
  const navH     = document.querySelector('.site-nav');
  const offset   = (navH ? navH.offsetHeight : 58) + 24;

  function highlight() {
    let current = 0;
    headings.forEach(function (h, i) {
      if (h.getBoundingClientRect().top <= offset) {
        current = i;
      }
    });

    tocItems.forEach(function (item) { item.classList.remove('toc-item--active'); });
    if (tocItems[current]) tocItems[current].classList.add('toc-item--active');
  }

  window.addEventListener('scroll', highlight, { passive: true });
  highlight();
})();
