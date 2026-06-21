# 포트폴리오 전면 리디자인 프롬프트 (Claude Code 실행용)

> 이 문서를 Claude Code 세션에 그대로 붙여넣거나, "이 레포의 `PORTFOLIO_REDESIGN_PROMPT.md` 를 읽고 실행해줘" 라고 지시하면 됩니다.
> 빌드에서 제외하려면 `_config.yml`의 `exclude:`에 `PORTFOLIO_REDESIGN_PROMPT.md` 를 추가하세요.

---

## 0. 역할과 한 줄 목표

너는 이 Jekyll 포트폴리오/기술 블로그의 **시니어 프로덕트 디자이너 겸 프론트엔드 엔지니어**다.
목표는 **"딱 봐도 눈에 확 들어오는, 채용 담당자가 스크롤을 멈추는 포트폴리오"** 로 사이트 전체를 리디자인하는 것이다.
지금 콘텐츠를 기반으로 하되 **최소 수정이 아니라 시각적으로 한 단계 도약**시킨다. 톤은 일관되게, 디테일은 과감하게.

---

## 1. 디자인 방향 — "Editorial Tech"

매거진처럼 **큰 타이포 · 과감한 여백 · 강한 위계**를 쓰되, AI/테크 정체성을 살리는 **그리드·그라디언트·모노스페이스 라벨** 디테일을 얹는다.

핵심 무드:
- **Confident & big** — 히어로/섹션 타이틀은 크고 자신감 있게. 타이트한 자간(letter-spacing 음수).
- **Editorial rhythm** — 넉넉한 수직 리듬, 명확한 섹션 구분, 한 화면에 한 메시지.
- **Tech texture** — 은은한 도트/그리드 배경, 모노스페이스 캡션 라벨(`// OVERVIEW` 같은), 그라디언트 보더/메시.
- **Cinematic motion** — 스크롤 진입 페이드업(이미 있는 `reveal.js` 재사용), 숫자 카운트업, 부드러운 hover lift, 커서 따라오는 미세한 글로우(과하지 않게).
- **Premium, not flashy** — 화려하되 가벼워 보이지 않게. 그림자·보더·간격으로 고급감을 만든다.

라이트/다크 모드 둘 다 **각각 멋있어야** 한다. 다크는 딥네이비/잉크 배경 + 네온 블루 액센트로 SaaS 대시보드 느낌, 라이트는 종이처럼 깨끗한 에디토리얼 느낌.

---

## 2. 절대 지켜야 할 기술 제약 (HARD CONSTRAINTS)

1. **스택**: Jekyll + GitHub Pages. SCSS는 `_sass/`, 진입점은 `assets/css/main.scss`. 빌드는 반드시 통과해야 한다(`bundle exec jekyll build` 무오류).
2. **색·폰트 하드코딩 금지**. 모든 색은 `_sass/_variables.scss`의 CSS custom property 토큰(`--color-*`, `$blue`, `$t1` 등)으로만 쓴다. 새 색이 필요하면 **토큰을 추가**하고 라이트/다크 양쪽 값을 정의한다.
3. **라이트/다크 동시 지원**. `[data-theme="dark"]` 변수와 `theme-toggle.js`가 이미 있다. 새로 만드는 모든 컴포넌트는 두 테마에서 검증한다. 하드코딩한 `#fff`/`#000` 금지(반투명 오버레이 예외는 허용).
4. **폰트**는 Pretendard 유지(`_includes/head.html` CDN). 모노 라벨은 기존 `$mono` 스택 사용.
5. **데이터 분리 유지**. 프로젝트는 `_data/projects.yml`, 스킬은 `_data/skills.yml`. 템플릿에 콘텐츠를 하드코딩하지 말고 데이터/프론트매터로 뺀다. 카드/상세 페이지는 데이터 루프로 렌더해 **다음 프로젝트도 자동 적용**되게 한다.
6. **접근성**: 시맨틱 마크업, `alt` 텍스트, 키보드 포커스 가시성, 색대비 WCAG AA, `prefers-reduced-motion` 존중(모션 끄기). `reveal.js`는 이미 reduced-motion 처리됨 — 새 모션도 동일 처리.
7. **성능**: 이미지 `loading="lazy"`, 무거운 라이브러리 도입 금지(순수 CSS/소량 바닐라 JS 우선). 외부 폰트/JS 추가는 최소화.
8. **반응형**: 기존 브레이크포인트(`$tablet: 900px`, `$mobile: 600px`) 사용. 모바일에서 타이포 스케일·간격이 무너지지 않게 `clamp()` 적극 활용(단, Jekyll dart-sass 기준 `clamp()`는 그대로 통과).

---

## 3. 현재 구조 (먼저 읽고 파악할 것)

작업 전 다음을 읽어 현재 토큰/패턴을 파악한다:
- `_sass/_variables.scss` — 색/타입/간격 토큰, `@mixin card`, `@mixin btn-primary/secondary`, `$navy-grad`.
- `assets/css/main.scss` — `@import` 순서.
- `_layouts/default.html`, `_layouts/post.html`, `_layouts/project.html`.
- `index.html`(랜딩), `_includes/nav.html`·`head.html`·`footer.html`.
- `portfolio.html`(리스트), `portfolio/contracthoney.html`(상세 예시), `blog/index.html`.
- `_data/projects.yml`, `_data/skills.yml`.
- `assets/js/` — `reveal.js`, `filter.js`, `toc.js`, `theme-toggle.js`, `copy-code.js`.

기존 클래스 네이밍(BEM 풍, `proj-`, `port-`, `proj-hero__*` 등)과 디자인 토큰을 **재사용·확장**하고, 평행 시스템을 새로 만들지 않는다.

---

## 4. 디자인 시스템 업그레이드 (먼저 토큰부터)

`_sass/_variables.scss`에 다음을 추가/정비한다(라이트·다크 값 모두):
- **타이포 스케일 확장**: 더 큰 디스플레이 토큰(`--fs-display`는 이미 있음) 활용 + 섹션 kicker용 작은 모노 라벨 스타일.
- **간격 스케일 토큰**(`--space-*`)과 **섹션 수직 리듬** 표준화.
- **엘리베이션 토큰**: soft/elevated 두세 단계 그림자(`--shadow-sm/md/lg`), 라이트는 푸른 기 도는 그림자, 다크는 글로우성 그림자.
- **그라디언트 토큰**: 히어로 메시/보더용 그라디언트 1~2종.
- **프로젝트 액센트 시스템**: 프로젝트별 액센트 색을 `_data/projects.yml`의 항목 필드(예: `accent: "#f59e0b"`)로 받고, 상세 페이지 히어로/링크/포인트에 CSS 변수(`--accent`)로 주입. 기본값은 블루. 예) 계꿀(ContractHoney)은 허니 앰버 계열.
- 공통 컴포넌트 믹스인 정리: `card`, `card-hover`, 버튼, **새 `pill`/`kicker`/`figure`** 등.

---

## 5. 페이지별 요구사항

### 5-1. 랜딩 (`index.html`)
- **임팩트 히어로**: 큰 이름 + 역할 한 줄(AI Full Stack Developer) + 짧은 가치 제안. 배경에 은은한 그리드/그라디언트 메시 또는 노이즈. 상태 칩(예: `Open to work`, 기술 키워드).
- **핵심 지표 카운트업**(프로젝트 수, 커밋, AI 모델 등 — 실제값 기준, 가짜 금지). 스크롤 진입 시 숫자 애니메이션.
- **대표 프로젝트 1~2개를 랜딩에 미리보기**로 노출(포트폴리오로 유도하는 큰 CTA).
- 스킬/스택을 시각적으로(태그 클라우드 또는 카테고리 그리드). 막대 게이지를 쓰면 더 세련되게 다듬는다.

### 5-2. 네비게이션 (`_includes/nav.html`)
- 스크롤 시 축소/블러 배경 처리, 현재 페이지 활성 표시, 다크토글 위치 정리, 모바일 메뉴 매끄럽게. 로고 워드마크 다듬기.

### 5-3. 포트폴리오 리스트 (`portfolio.html`)
- **쇼케이스형 카드 그리드**로 재설계: 대표 이미지(커버)/로고, 큰 타이틀, 한 줄 요약, 액센트 바, 태그, hover lift + 미세 글로우.
- Featured 프로젝트는 **풀폭 히어로 카드**(좌측 텍스트 + 우측 비주얼/목업). 한눈에 "이 사람 메인 작품"이 보이게.
- 필터(`filter.js`) 유지하되 칩 디자인 고급화, 전환 애니메이션 부드럽게.
- 프로필/통계 헤더를 에디토리얼하게 재구성(아바타/로고, 이름, 역할, 실제 지표, 링크).

### 5-4. 프로젝트 상세 (`_layouts/project.html` + `portfolio/contracthoney.html`)
- **매거진형 레이아웃**: 강한 히어로(프로젝트 액센트 적용), 좌측 또는 상단에 **섹션 목차(sticky)** — `toc.js` 패턴 재사용 가능.
- 섹션 kicker를 모노 라벨로(`// ARCHITECTURE`), 큰 섹션 타이틀, 넉넉한 리드 문단.
- **피규어 컴포넌트 고급화**: 큰 이미지 + 캡션, 라이트박스(클릭 확대, 바닐라 JS 소량), 다크 배경 그래프는 전용 프레임. 이미 추출된 이미지(`assets/img/portfolio/contracthoney/`)를 활용.
- AI 추론 예시는 **풀쿼트/콜아웃** 스타일로 강조. 성능 수치는 카운트업 가능.
- 상·하단에 프로젝트 간 **이전/다음 내비** 추가.

### 5-5. 블로그 (`blog/index.html`, `_layouts/post.html`)
- 사이트 톤과 통일. 리스트는 카드/리딩 그리드, 포스트는 가독성(측정 폭 65~75ch)·TOC·코드블록 스타일 유지하며 다듬기.

### 5-6. 푸터 (`_includes/footer.html`)
- 큰 CTA(연락/깃허브/링크드인) + 미니 사이트맵 + 저작권. 사이트 마무리감.

---

## 6. 새 콘텐츠 = "Preview Mockup" 규칙

- 지금 **실제 데이터가 없는 영역**(예: 추가 프로젝트, About 상세, 후기, 통계 일부)은 **명확히 표시된 플레이스홀더(Preview Mockup)** 로 만든다. 카드/섹션 모서리에 작은 `PREVIEW` 뱃지를 달고, 더미 데이터임을 주석으로 남긴다.
- **가짜 수치를 실제처럼 쓰지 말 것**(스타·커밋 등은 실제값만). 모르는 값은 Preview로 둔다.
- 더미 데이터는 `_data/`에 `preview: true` 플래그로 분리해, 나중에 실제 콘텐츠로 쉽게 교체 가능하게 한다.

---

## 7. 작업 순서 (이대로 진행)

1. **현황 파악 + 디자인 제안**: 위 파일들을 읽고, 적용할 디자인 시스템 변경(토큰/타이포/간격/그림자/모션)과 페이지별 변경안을 **짧은 요약**으로 먼저 제시한다.
2. **정적 Preview Mockup 1~2장**: 본격 리팩터 전에, 핵심 화면(랜딩 히어로 + 포트폴리오 카드 그리드)을 보여주는 **단일 HTML 목업**을 `/preview_mockups/` 같은 폴더에 만들어 방향을 합의받는다(빌드 제외 처리).
3. **디자인 토큰부터** `_variables.scss` 정비 → 공통 컴포넌트 → 페이지 순으로 점진 적용. 각 단계마다 빌드 통과 확인.
4. 라이트/다크 + 모바일/데스크탑 교차 검증.
5. 최종 정리 및 변경 요약 보고.

> 큰 변경은 한 번에 쏟지 말고 **단계별 커밋 단위**로 나눠 진행하고, 각 단계 후 빌드/렌더를 확인한다.

---

## 8. 하지 말 것 (GUARDRAILS)

- 디자인 토큰 우회한 색/폰트 하드코딩.
- 빌드 깨지는 변경, 또는 라이트/다크 한쪽만 검증.
- 무거운 프레임워크/대형 라이브러리 추가(React, 대용량 애니 라이브러리 등). 순수 CSS + 소량 바닐라 JS로.
- 실제값인 척하는 가짜 지표.
- 기존 URL 구조(`/portfolio`, `/portfolio/:slug`, `/blog/:slug`) 변경. 퍼머링크 깨면 안 됨.
- 콘텐츠를 템플릿에 하드코딩(데이터 분리 원칙 위반).

---

## 9. 완료 기준 (DONE = 모두 충족)

- [ ] `bundle exec jekyll build` 무오류, SCSS 컴파일 무경고 수준.
- [ ] 랜딩·포트폴리오 리스트·프로젝트 상세·블로그·네비·푸터가 한 톤으로 통일.
- [ ] 라이트/다크 모두에서 시각적으로 완성도 높음, 색대비 AA 충족.
- [ ] 모바일(≤600px)·태블릿(≤900px)·데스크탑에서 레이아웃 정상, 타이포 스케일 자연스러움.
- [ ] 스크롤 모션·hover·카운트업이 `prefers-reduced-motion`에서 비활성.
- [ ] 새 콘텐츠 영역은 `PREVIEW` 뱃지 + `preview: true` 데이터로 분리.
- [ ] 프로젝트별 액센트가 데이터 필드로 주입되어 다음 프로젝트도 자동 적용.
- [ ] 변경 파일 목록과 추가된 토큰/컴포넌트를 짧게 보고.

---

## 10. 참고 사실 (현재 콘텐츠 기준, 가짜 금지)

- 정체성: **Swallow8801 · AI Full Stack Developer** (LLM · RAG · Vector Search · Web · Infra).
- 대표 프로젝트: **계꿀(ContractHoney)** — 계약서 위법·독소조항 검출 & 요약 AI 풀스택 서비스(KoBERT·KoELECTRA·EXAONE·KoBART, 코사인 유사도 법령 매칭, Next.js+FastAPI 3-Tier, Docker/Azure). repo 2개(Web FE/BE, AI Server). 라이브 데모 없음. 실제 GitHub 스타 0.
- 메인 색: 블루 `#2563eb`, 배경 `#eef2f7`(흰색 단독 사용 금지), 네이비 그라디언트 히어로.
- 추출 이미지: `assets/img/portfolio/contracthoney/` (logo, architecture, erd, service-flow, demo, performance, loss-graph, uiux).

---

이 프롬프트의 우선순위: **(1) 한눈에 임팩트 → (2) 톤 일관성 → (3) 디테일/모션 → (4) 확장성(데이터 분리·액센트 시스템)**. 의심되면 임팩트와 가독성을 먼저 택한다.
