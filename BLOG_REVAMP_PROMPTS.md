# 블로그 리뉴얼 — Claude Code 지시 프롬프트 (헤더·리네임·디자인·접근성·이미지)

> 대상: **블로그**(목록·글·헤더)와 **인트로 랜딩**(`index.html`).
> 사용법: 아래 프롬프트를 **하나씩** Claude Code에 복붙. 대부분 "design-reviewer 점검 → frontend-engineer 구현 → `bundle exec jekyll build` 검증" 흐름이다. 큰 변경 전 `git commit`, 복잡한 디자인은 `/model`로 Opus 권장.
> 권장 순서: **1 → 2 → 3 → 4 → 5** (헤더·리네임 먼저, 그다음 디자인/접근성, 마지막에 이미지 교체).

## 공통 제약 (모든 프롬프트에 암묵 적용)
- 색·폰트·간격은 `_sass/_variables.scss` 토큰만(랜딩 `index.html` 다크 인라인 스타일은 의도된 예외).
- 반응형 `$tablet 900px`·`$mobile 600px` 유지. 접근성: 대비·포커스·의미적 heading, 애니메이션은 `@media (prefers-reduced-motion: reduce)`에서 끄기.
- `toc.js`는 본문 h2/h3 의존(마크업 위계 유지), 내부 링크·에셋은 `{{ '/path' | relative_url }}`.
- 외부 라이브러리 최소화, 변경 후 `bundle exec jekyll build` 무에러. **한 번에 하나씩.**
- 에이전트: 점검=design-reviewer, 프런트 구현=frontend-engineer, 이미지 수집=image-curator, 글 검증=post-validator.

---

## 1. 카테고리·프로젝트 헤더 커버 연결 (이미 만든 이미지 사용)
```
헤더 커버 이미지가 이미 assets/img/category/header/ 에 준비돼 있어. 새로 생성하지 말고 이걸 블로그 카테고리/프로젝트 헤더에 연결해줘.

파일 매핑:
- AI→ai-header.png, Backend→backend-header.png, Frontend→frontend-header.png,
  DevOps→devops-header.png, Database→database-header.png, Snippets→snippets-header.png, Errors→errors-header.png
- 프로젝트(삼성중공업)→shi-header.png

요구사항:
- blog/index.html에서 카테고리(또는 프로젝트)를 선택하면 글 목록 상단에 해당 커버가 "제목 + 설명 + 포스트 수 + 태그"와 함께 배너로 뜨게 한다. 전체(필터 해제)면 숨김.
- 스타일/마크업은 CATEGORY_LOGO_PROMPTS.md의 .category-cover / .project-cover 스펙을 사용한다(프로젝트 헤더는 .project-cover로 카테고리와 다른 무드).
- 텍스트는 이미지 위에 HTML로 올린다(이미지 자체엔 글자 없음). 좌측 가독용 그라디언트 오버레이 포함.
- 디자인 토큰 사용, $tablet/$mobile 반응형, 접근성(제목은 진짜 heading으로, 충분한 대비; 배경이미지는 장식이므로 정보는 텍스트로 제공).

먼저 design-reviewer로 blog/index.html의 어느 지점에 어떻게 끼울지 점검 → frontend-engineer로 구현 → bundle exec jekyll build로 검증.
```

## 2. 프로젝트 분류 'SHIMonitoring' → '삼성중공업' 리네임
```
블로그 프로젝트 분류 이름 'SHIMonitoring'을 '삼성중공업'으로 바꿔줘.

- 대상: _posts/Projects/SHIMonitoring/ 의 모든 글 + subcategory가 "SHIMonitoring"인 다른 글 전부. front matter의 subcategory: "SHIMonitoring" → "삼성중공업"으로 변경.
- 사이드바·소분류 필터·헤더에 표시되는 이름도 '삼성중공업'으로 보이게 한다. 헤더 커버는 shi-header.png 매핑을 유지.
- 폴더명 _posts/Projects/SHIMonitoring 는 영문 경로라 그대로 둬도 된다(경로 변경 시 링크/참조 깨짐 주의 → 바꾸려면 신중히).
- .claude/settings.json 등 'SHIMonitoring'을 참조하는 다른 위치도 함께 확인·정리.

design-reviewer로 'SHIMonitoring'이 쓰인 모든 위치를 먼저 grep으로 찾고 → frontend-engineer로 일괄 변경 → post-validator로 글 규격 점검 → build 검증.
```

## 3. 디자인 개선 — 덜 정적·오프화이트·가독성 (절제된 모션)
```
블로그와 인트로(index.html)를 덜 정적이고, 너무 흰 바탕이 아니며, 가독성이 우수하게 개선해줘. 과도한 애니메이션은 지양하고 절제된 모션만.

- 배경: 순수 흰색·완전 평면 지양. _sass/_variables.scss의 $bg(오프화이트)에 아주 옅은 그라디언트/섹션 구분/미세 질감을 더해 깊이감을 준다. 카드 표면($surface)과 배경 대비를 살짝 높여 입체감.
- 타이포: 본문 17~18px, line-height 1.7 전후, h1~h3 위계를 시각적으로 명확히(가독성 최우선). 모바일은 clamp()로.
- 모션: 스크롤 진입 페이드/슬라이드업, 카드·링크 호버 마이크로 인터랙션 정도만. 반드시 prefers-reduced-motion에서 끈다. 무거운 라이브러리 금지(순수 CSS/소량 JS).
- 디자인 토큰만 사용, 반응형 유지, toc.js/filter.js/copy-code.js 동작 유지.

먼저 design-reviewer로 "정적·평면적인 지점 + 가독성 약점" 점검 리포트 → frontend-engineer로 한 번에 한 영역씩(배경 → 타이포 → 모션) 구현 → build + 모바일 확인.
```

## 4. 접근성 점검·개선
```
블로그(목록·글·헤더)와 인트로의 접근성을 점검하고 개선해줘.

점검 항목: 색 대비(WCAG AA 이상), 키보드 포커스 가시성, 의미적 heading 순서(toc.js 의존 유지), 이미지 alt, 인터랙티브 요소의 aria·역할·라벨, 링크 텍스트 명확성, prefers-reduced-motion 준수, 폼/버튼 라벨.

design-reviewer로 접근성 감사 리포트를 심각도별(🔴 Blocker / 🟡 Warning / ⚪ Nit)로 받은 뒤 → frontend-engineer로 Blocker·Warning을 수정 → build 검증. 수정 전후 핵심 항목을 간단히 비교해줘.
```

## 5. 자체 SVG 썸네일 → 실제 이미지로 교체 (+ 향후 정책)
```
이미지 정책이 바뀌었다: 무료 라이선스 제한 없이 주제에 가장 적합한 이미지(공식 로고·다이어그램 포함)를 쓴다. 새로 추가된 image-curator 에이전트가 이 역할을 한다.

요청: 기존 글들이 쓰는 자체 제작 SVG 썸네일(assets/img/posts/*.svg)을 주제에 더 잘 맞는 실제 이미지로 교체해줘.
예: Docker 글 → Docker 고래 로고, PostgreSQL 글 → 코끼리 로고, FastAPI 글 → FastAPI 로고, React 글 → React 로고 등.

- image-curator로 각 글 주제에 맞는 공식 로고/다이어그램/사진을 신뢰할 수 있는 출처(공식 사이트·프레스킷·위키미디어)에서 가져와 assets/img/posts/ 에 저장하고, 글 front matter의 image: 를 교체한다.
- 로고는 변형·왜곡·리컬러 금지, 선명·고해상. 출처 표기는 선택.
- 한 번에 5~6개씩 진행하고 교체 목록(글 → 새 이미지)을 보고해줘. build로 깨짐 확인. 더는 안 쓰는 SVG 정리는 내 확인 후.

향후 새 글도 같은 방식(실제 이미지 우선)으로 채운다.
```

---

## 부록 A. 이미지 생성은 GPT? Claude?

- **헤더 커버**: 이미 외부에서 만들어 `assets/img/category/header/`에 넣었으니 추가 생성 불필요(작업 1에서 연결만).
- **로고·실제 이미지 수집**(작업 5): "생성"이 아니라 **수집**이다. 웹에서 가져오면 되고, Claude Code의 image-curator가 처리한다.
- **새 일러스트/이미지를 굳이 생성한다면**: 사진·로고 합성 같은 **래스터 이미지 생성은 GPT(ChatGPT / DALL·E·GPT-4o image)가 더 강하다.** Claude는 래스터 이미지를 생성하지 않는다(코드 기반 SVG·다이어그램은 Claude가 잘 만든다). → **생성은 GPT, 코드형 SVG·수집·연결·구현은 Claude.**

## 부록 B. 에이전트·스킬 현황

이번에 **image-curator** 에이전트를 추가했고, 기존 정책 문서(blog-post-candidates 스킬·post-ideator 에이전트·INDEX·가이드·자정 스케줄러)의 "무료 라이선스만" 규칙을 **"주제에 가장 적합한 이미지 자유 수집(공식 로고 포함)"** 으로 전면 수정했다. 작업 1~5에는 추가 에이전트가 더 필요하지 않다(design-reviewer·frontend-engineer·image-curator·post-validator로 충분). 새 워크플로가 반복되며 부족함이 보이면 그때 보강.
