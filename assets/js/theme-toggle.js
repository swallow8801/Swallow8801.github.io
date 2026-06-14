/**
 * theme-toggle.js
 * 다크/라이트 테마 토글.
 * - 클릭 시 <html data-theme="...">를 light↔dark로 전환하고 localStorage에 저장.
 * - 사용자가 수동 전환한 적 없을 때(localStorage 미설정)만
 *   OS의 prefers-color-scheme 변경에 따라 자동으로 테마를 갱신한다.
 * - localStorage 접근 실패(예: Safari 프라이빗 모드)에도 테마 전환 자체는 동작해야 한다.
 */
(function () {
  const root = document.documentElement;
  const toggle = document.getElementById('themeToggle');

  function updateToggleA11y(theme) {
    if (!toggle) return;
    const isDark = theme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
  }

  // 초기 상태 동기화
  updateToggleA11y(root.getAttribute('data-theme'));

  if (toggle) {
    toggle.addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      updateToggleA11y(next);
      try {
        localStorage.setItem('theme', next);
      } catch (e) {
        // 저장 실패는 무시 — 테마 전환 자체는 정상 동작
      }
    });
  }

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', function (e) {
      let stored = null;
      try {
        stored = localStorage.getItem('theme');
      } catch (err) {
        stored = null;
      }
      if (stored) return;
      const next = e.matches ? 'dark' : 'light';
      root.setAttribute('data-theme', next);
      updateToggleA11y(next);
    });
  }
})();
