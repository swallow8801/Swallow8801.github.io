/**
 * copy-code.js
 * 코드 블록(.highlight)에 복사 버튼 동적 삽입.
 * 언어 레이블도 함께 표시.
 */
(function () {
  // Rouge language-xxx → 표시용 친화적 이름 매핑.
  // 매핑에 없는 언어는 원래 문자열을 toUpperCase()로 표시.
  const LANG_LABELS = {
    js: 'JavaScript',
    javascript: 'JavaScript',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    jsx: 'JSX',
    tsx: 'TSX',
    py: 'Python',
    python: 'Python',
    bash: 'Shell',
    sh: 'Shell',
    shell: 'Shell',
    zsh: 'Shell',
    yml: 'YAML',
    yaml: 'YAML',
    json: 'JSON',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    sass: 'Sass',
    md: 'Markdown',
    markdown: 'Markdown',
    sql: 'SQL',
    dockerfile: 'Dockerfile',
    ruby: 'Ruby',
    plaintext: 'Plain Text',
    text: 'Plain Text'
  };

  const ICON_COPY =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="9" y="9" width="13" height="13" rx="2"></rect>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>' +
    '</svg>';

  const ICON_CHECK =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="20 6 9 17 4 12"></polyline>' +
    '</svg>';

  function getLangLabel(langClass) {
    const raw = langClass.replace('language-', '').toLowerCase();
    return LANG_LABELS[raw] || raw.toUpperCase();
  }

  // navigator.clipboard.writeText가 없거나 실패할 때의 폴백.
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    let success = false;
    try {
      success = document.execCommand('copy');
    } catch (err) {
      success = false;
    }

    document.body.removeChild(textarea);
    return success;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text)
          ? Promise.resolve()
          : Promise.reject(new Error('copy failed'));
      });
    }
    return fallbackCopy(text)
      ? Promise.resolve()
      : Promise.reject(new Error('copy failed'));
  }

  document.querySelectorAll('.post-content div.highlight').forEach(function (block) {
    // 언어 레이블 추출 (kramdown+Rouge가 class="language-xxx"를
    // <code>가 아닌 바깥쪽 <div class="language-xxx highlighter-rouge">에 부여)
    const wrapper = block.closest('[class*="language-"]');
    if (wrapper) {
      const langClass = Array.from(wrapper.classList).find(function (c) {
        return c.startsWith('language-');
      });
      if (langClass) {
        const langLabel = document.createElement('span');
        langLabel.className = 'code-lang';
        langLabel.textContent = getLangLabel(langClass);
        block.appendChild(langLabel);
      }
    }

    // 복사 버튼
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', '코드 복사');
    btn.innerHTML = ICON_COPY + '<span>복사</span>';
    block.appendChild(btn);

    let resetTimer = null;

    btn.addEventListener('click', function () {
      const text = block.querySelector('pre') ? block.querySelector('pre').innerText : '';

      copyText(text).then(function () {
        if (resetTimer) clearTimeout(resetTimer);
        btn.classList.remove('copy-btn--error');
        btn.classList.add('copied');
        btn.innerHTML = ICON_CHECK + '<span>복사됨!</span>';
        btn.setAttribute('aria-label', '코드가 복사되었습니다');

        resetTimer = setTimeout(function () {
          btn.classList.remove('copied');
          btn.innerHTML = ICON_COPY + '<span>복사</span>';
          btn.setAttribute('aria-label', '코드 복사');
        }, 2000);
      }).catch(function () {
        if (resetTimer) clearTimeout(resetTimer);
        btn.classList.remove('copied');
        btn.classList.add('copy-btn--error');
        btn.innerHTML = '<span>복사 실패</span>';
        btn.setAttribute('aria-label', '코드 복사에 실패했습니다');

        resetTimer = setTimeout(function () {
          btn.classList.remove('copy-btn--error');
          btn.innerHTML = ICON_COPY + '<span>복사</span>';
          btn.setAttribute('aria-label', '코드 복사');
        }, 2000);
      });
    });
  });
})();
