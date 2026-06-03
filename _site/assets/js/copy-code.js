/**
 * copy-code.js
 * 코드 블록(.highlight)에 복사 버튼 동적 삽입.
 * 언어 레이블도 함께 표시.
 */
(function () {
  document.querySelectorAll('.post-content .highlight').forEach(function (block) {
    // 언어 레이블 추출 (Rouge가 class="language-xxx"로 생성)
    const code = block.querySelector('code');
    if (code) {
      const langClass = Array.from(code.classList).find(function (c) {
        return c.startsWith('language-');
      });
      if (langClass) {
        const langLabel = document.createElement('span');
        langLabel.className = 'code-lang';
        langLabel.textContent = langClass.replace('language-', '');
        block.appendChild(langLabel);
      }
    }

    // 복사 버튼
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '복사';
    block.appendChild(btn);

    btn.addEventListener('click', function () {
      const text = block.querySelector('pre') ? block.querySelector('pre').innerText : '';
      navigator.clipboard.writeText(text).then(function () {
        btn.textContent = '복사됨!';
        btn.classList.add('copied');
        setTimeout(function () {
          btn.textContent = '복사';
          btn.classList.remove('copied');
        }, 2000);
      });
    });
  });
})();
