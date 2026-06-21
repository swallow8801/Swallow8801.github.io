/**
 * lightbox.js
 * 프로젝트 상세의 .proj-figure 이미지를 클릭하면 확대 오버레이로 표시한다.
 * ESC / 배경 클릭 / 닫기 버튼으로 닫는다. (스타일은 _sass/_project.scss)
 */
(function () {
  const box = document.getElementById('lightbox');
  const img = document.getElementById('lightboxImg');
  if (!box || !img) return;

  const figures = document.querySelectorAll('.proj-figure img');
  if (!figures.length) return;

  let lastFocus = null;

  function open(src, alt) {
    lastFocus = document.activeElement;
    img.src = src;
    img.alt = alt || '';
    box.hidden = false;
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    box.querySelector('.lightbox__close').focus();
  }

  function close() {
    box.hidden = true;
    box.setAttribute('aria-hidden', 'true');
    img.src = '';
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  figures.forEach(function (el) {
    el.style.cursor = 'zoom-in';
    el.addEventListener('click', function () { open(el.currentSrc || el.src, el.alt); });
  });

  box.addEventListener('click', function (e) {
    if (e.target === box || e.target.classList.contains('lightbox__close')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !box.hidden) close();
  });
})();
