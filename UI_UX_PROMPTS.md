# 블로그·인트로 UI/UX 개선 — Claude Code 프롬프트 모음

> 대상: **블로그**(`blog/index.html`, `_layouts/post.html`, `_sass/_blog.scss`, `_sass/_post.scss`)와 **인트로 랜딩**(`index.html`)만.
> 사용법: 아래 프롬프트를 **하나씩** Claude Code에 복붙. 대부분 "design-reviewer로 점검 → frontend-engineer로 구현 → 빌드 검증" 흐름을 탄다.
> 큰 변경 전엔 `git commit`으로 되돌릴 지점을 만들고, 복잡한 디자인 작업은 `/model`로 Opus로 올리면 결과가 더 좋다.

## 추천 순서
0. 점검·플랜 → 1. 타이포/가독성 → 2. 블로그 목록 → 3. 글 본문 → 4. 인터랙티브 애니메이션 → 5. 인트로 랜딩 → 6. 기능 추가 → 7. 최종 검증

## 공통 규칙 (모든 프롬프트에 암묵 적용 — 에이전트가 이미 알지만 강조용)
- 색·폰트·간격은 `_sass/_variables.scss` 토큰만, 하드코딩 금지. **단 `index.html` 랜딩의 다크 인라인 스타일은 의도된 예외.**
- 반응형 `$tablet 900px`·`$mobile 600px` 유지, 모바일에서 깨지지 않게.
- 접근성: 색 대비, 포커스 표시, 의미적 heading, **애니메이션은 `@media (prefers-reduced-motion: reduce)`에서 끄기.**
- `toc.js`는 본문 **h2/h3 구조에 의존** → 마크업 위계 변경 금지. 내부 링크·에셋은 `{{ '/path' | relative_url }}`.
- 무거운 외부 라이브러리 지양(순수 CSS/소량 JS 우선), 변경 후 `bundle exec jekyll build` 무에러 확인. **한 번에 하나씩.**

---

## 0. 점검 · 개선 플랜 (먼저)
```
이 저장소의 블로그(blog/index.html, _layouts/post.html, _sass/_blog.scss, _sass/_post.scss)와
인트로 랜딩(index.html)만 대상으로 UI/UX를 개선하려고 해. design-reviewer로 이 두 영역을 점검해줘:
- 타이포(글자 크기·행간·위계)와 가독성, 색 대비/접근성
- 반응형($tablet 900px, $mobile 600px)에서 깨지거나 답답한 곳
- 밋밋해서 애니메이션/인터랙션을 넣으면 좋을 지점 후보
- 디자인 토큰(_sass/_variables.scss) 미사용·하드코딩 지점
수정은 하지 말고, 우선순위가 매겨진 개선 플랜을 리포트로 줘. 각 항목에 영향 파일과 난이도를 표시해줘.
```

## 1. 타이포그래피 · 가독성 (사용자 친화적 글자 크기)
```
frontend-engineer로 블로그와 랜딩의 타이포그래피를 사용자 친화적으로 개선해줘.
- _sass/_variables.scss에 타입 스케일 토큰(예: --fs-1~--fs-6)과 본문 기준 크기·행간을 정의.
- 글 본문(_sass/_post.scss) 기본 글자 크기를 키우고(약 17~18px), line-height 1.7 전후로 가독성 확보.
- clamp()로 반응형 타입을 적용해 모바일에서도 너무 작지 않게.
- 제목 h1~h3 위계를 시각적으로 명확히 (단 본문 heading 마크업 구조는 toc.js 의존이라 유지).
토큰만 사용, 변경 후 jekyll build로 검증. 이 타이포 작업만 한 번에 진행해줘.
```

## 2. 블로그 목록 UI (카드 · 사이드바 · 필터)
```
frontend-engineer로 블로그 목록(blog/index.html, _sass/_blog.scss) 카드 UI를 더 풍성하게 개선해줘.
- 포스트 카드: 호버 시 살짝 떠오르는 효과(transform+shadow), 썸네일·제목·태그 정렬 정돈, 이미지 없는 글의 폴백 처리.
- 카테고리 사이드바·소분류 필터 바: 활성 상태와 전환을 부드럽게, 클릭 영역·포커스 표시 개선.
- 카드 show/hide 필터 동작(blog/index.html 내부 스크립트의 data-category/data-subcategory)은 깨지 않게.
토큰·반응형·접근성 유지, build 검증.
```

## 3. 글 본문 읽기 경험 (post)
```
frontend-engineer로 글 본문 읽기 경험(_layouts/post.html, _sass/_post.scss)을 개선해줘.
- 본문 최대 폭과 여백을 읽기 좋은 measure(약 65~75ch)로, 코드블록·표·이미지·인용구 스타일 정돈.
- copy-code.js 복사 버튼, toc.js 우측 TOC 동작은 유지하되 TOC 스크롤 하이라이트 전환을 부드럽게.
- 이미지에 라운드/그림자, '이미지 출처' 캡션 스타일.
heading 구조 변경 금지(toc.js 의존), 토큰·반응형·접근성 유지, build 검증.
```

## 4. 인터랙티브 애니메이션 (스크롤 · 호버 · 전환)
```
frontend-engineer로 블로그와 랜딩에 절제된 인터랙티브 애니메이션을 추가해줘.
- 스크롤 진입 시 섹션·카드가 페이드/슬라이드업으로 나타나는 효과(IntersectionObserver 기반 가벼운 순수 JS).
- 링크·버튼·카드 호버 마이크로 인터랙션과 부드러운 트랜지션.
- 반드시 @media (prefers-reduced-motion: reduce)에서 모든 애니메이션을 끄기(접근성).
무거운 라이브러리 금지, 성능 영향 최소화, 토큰·반응형 유지, build 검증.
어떤 효과를 어디에 넣었는지 마지막에 요약해줘.
```

## 5. 인트로 랜딩 화면 — 풍성하게
```
frontend-engineer로 인트로 랜딩(index.html, 다크 테마 인라인 스타일)을 더 풍성하고 임팩트 있게 개선해줘.
- 히어로: 타이틀 등장 애니메이션, 그라디언트/글로우 배경, 'AI Full Stack Developer' 정체성이 드러나는 카피와 CTA(블로그·포트폴리오로 유도).
- 스크롤로 이어지는 섹션(About·스킬·최근 글 미리보기 등) — 데이터는 site.data / site.posts에서 가져오기.
- 랜딩 다크 인라인 스타일은 의도된 예외이니 그 안에서 일관되게(가능하면 색/간격 토큰화 검토).
prefers-reduced-motion 존중, 모바일 히어로 깨짐 방지, build 검증.
먼저 레이아웃·무드 방향을 2~3개 제안하고, 내가 고르면 구현해줘.
```

## 6. 기타 기능 추가 (하나씩 선택)
```
frontend-engineer로 다음 중 내가 고르는 기능을 하나씩 추가해줘:
- 글 상단 읽기 진행률 바 + '맨 위로' 버튼
- 다크/라이트 테마 토글 (OS prefers-color-scheme 우선, 현재 팔레트 기준)
- 글 하단 '관련 글' 추천 (같은 category·태그 기반, site.posts에서)
- 코드블록 복사 버튼/언어 라벨 개선 (copy-code.js)
- 블로그 헤더 '검색…'을 실제 클라이언트 사이드 검색으로 (제목·태그 기준, 외부 의존 최소)
각 기능은 별도 작업으로 토큰·반응형·접근성·build 검증을 지켜줘. 먼저 무엇부터 할지 추천해줘.
```

## 7. 최종 검증
```
design-reviewer로 지금까지의 블로그·랜딩 변경을 최종 점검해줘:
디자인 토큰 일관성, 반응형($tablet/$mobile), 접근성(대비·포커스·prefers-reduced-motion),
Liquid·라우트 무결성, toc.js/filter.js/copy-code.js 동작.
심각도별 리포트를 준 뒤, frontend-engineer로 Blocker/Warning만 수정하고 마지막에 jekyll build 무에러 확인.
```
