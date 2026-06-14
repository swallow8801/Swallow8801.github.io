# 블로그 Header Cover Image — 이미지 생성 가이드

`/blog`의 **카테고리 헤더**와 **프로젝트(SHIMonitoring) 헤더** 상단 커버 배경 이미지를 ChatGPT 이미지 생성으로 만들 때 쓰는 프롬프트·파일명·적용 코드 모음.

이 이미지는 작은 아이콘이 아니라, 제목/설명 텍스트가 위에 올라가는 **가로형 와이드 커버 배경**입니다.

## 두 종류의 헤더 — 분위기를 의도적으로 다르게

이 가이드의 핵심 의도다. 두 그룹은 **서로 다른 시각 언어**를 쓴다.

- **카테고리 헤더(AI·Backend·…·Errors)** — 하나의 **통일된 패밀리**(추상·다크네이비·테크 브랜딩). 단, 같은 그림을 색만 바꾼 듯 보이면 안 되므로, 각 카테고리는 **강조색 + 모티프 + 구도/질감/조명**까지 서로 다르게 변주한다. "한 시리즈인데 각자 개성 있음"이 목표.
- **프로젝트 헤더(SHIMonitoring)** — 카테고리 패밀리와 **아예 다른 무드**. 추상 그래픽이 아니라 **실사풍 산업/조선소** 분위기(시네마틱). 그리고 **실제 삼성중공업 로고**를 올린다(아래 §8 방식).

## 공통 규격 (카테고리 헤더)

* 저장 위치: `assets/img/category/header/`
* 형식: PNG 또는 WebP / 비율 약 **2.8:1** (권장 1600×560px, 대체 1536×540 · 1440×500)
* 배경: 불투명 커버. 좌측은 흰색 제목이 올라갈 **어둡고 비어 있는 안전영역**
* **이미지 안에 글자·숫자·로고 문자 금지** (제목·설명·태그는 HTML/CSS로 별도 오버레이)

---

## 공통 스타일 가이드 (카테고리 전용)

각 카테고리 프롬프트 앞에 이미 포함돼 있다(복붙용). **차별화 규칙**: 각 카테고리는 색만 바꾸지 말고, 아래 각 항목의 **"Unique composition"** 문장을 반드시 반영해 구도·질감·조명을 다르게 만들 것.

```text
Wide blog category header cover image, modern developer blog style,
dark navy background, clean technology-themed visual design,
minimalist geometric composition, subtle abstract patterns,
designed for white title text overlay on the left side,
large empty readable text-safe area on the left,
decorative visual elements concentrated on the right side and lower edges,
high contrast but not too busy, no text, no letters, no numbers,
no logo text, no watermark, no mockup, no realistic people,
soft glow accents, subtle depth, polished SaaS/tech branding aesthetic,
wide horizontal composition, 2.8:1 aspect ratio.
```

---

## 카테고리별 프롬프트

각 블록은 그대로 복붙해 쓰면 된다. (★ Unique composition 줄이 카테고리 간 차별점)

### 1. AI — `assets/img/category/header/ai-header.png`
강조색 `#2563eb` · 분위기: 생성형 AI·추론·모델
```text
[공통 스타일 가이드]

Subject: AI and generative intelligence — abstract neural network nodes, soft orbit
lines, glowing four-pointed sparkle shapes, small data particles, model reasoning flows.
★ Unique composition: deep-space constellation feel, a glowing focal cluster on the right
with soft bokeh depth and luminous particle haze; dreamy, radiant, high-depth.
Use vivid electric blue accents based on #2563eb. Keep the left side darker and cleaner.
```

### 2. Backend — `assets/img/category/header/backend-header.png`
강조색 `#059669` · 분위기: 서버·API·서비스 아키텍처
```text
[공통 스타일 가이드]

Subject: backend infrastructure — server rack layers, API endpoint nodes, connected
service blocks, request-response lines, subtle data flow paths.
★ Unique composition: structured ISOMETRIC architecture, stacked layered slabs and clean
straight edges, orderly and engineered (NOT dreamy); crisp, solid, blueprint-like depth.
Use emerald green accents based on #059669 with soft mint highlights. Left side darker for text.
```

### 3. Frontend — `assets/img/category/header/frontend-header.png`
강조색 `#0891b2` · 분위기: UI·인터페이스·사용자 경험
```text
[공통 스타일 가이드]

Subject: frontend development — abstract browser panels, UI layout blocks, component cards,
cursor-like shapes, responsive grid lines (no real UI text).
★ Unique composition: light, airy GLASSMORPHISM — translucent layered glass panels floating
with parallax depth and gentle reflections; brighter and more weightless than other headers.
Use cyan accents based on #0891b2 with soft blue highlights. Keep the left side clean.
```

### 4. DevOps — `assets/img/category/header/devops-header.png`
강조색 `#d97706` · 분위기: CI/CD·자동화·배포
```text
[공통 스타일 가이드]

Subject: DevOps automation — CI/CD pipeline flow, curved loop arrows, deployment nodes,
container-like blocks, status check circles, continuous delivery paths.
★ Unique composition: KINETIC motion — sweeping circular flow loops with subtle motion-streak
trails and a sense of movement/rotation; energetic and dynamic.
Use amber orange accents based on #d97706 with soft golden highlights. Left side dark for text.
```

### 5. Database — `assets/img/category/header/database-header.png`
강조색 `#7c3aed` · 분위기: 데이터 저장·스키마·벡터 검색
```text
[공통 스타일 가이드]

Subject: database & vector search — database cylinders, connected schema nodes, vector
network lines, embedding-space dots, query paths, data graph structures.
★ Unique composition: CRYSTALLINE LATTICE — a precise 3D grid/mesh of connected points,
structured and gem-like with refractive sparkle; symmetrical, dense, ordered.
Use violet purple accents based on #7c3aed with blue-purple highlights. Left side cleaner.
```

### 6. Snippets — `assets/img/category/header/snippets-header.png`
강조색 `#475569` · 분위기: 코드 조각·재사용·개발 메모
```text
[공통 스타일 가이드]

Subject: reusable code snippets — abstract code cards, modular component blocks, bracket-like
shapes, small note panels, reusable pattern fragments (no readable code).
★ Unique composition: quiet MATTE MOSAIC — many small scattered tiles/cards in a calm
low-contrast grid; understated, muted, minimal glow (the most subdued header of the set).
Use slate gray accents based on #475569 with cool blue-gray highlights. Left side clean.
```

### 7. Errors — `assets/img/category/header/errors-header.png`
강조색 `#dc2626` · 분위기: 디버깅·장애 분석·트러블슈팅
```text
[공통 스타일 가이드]

Subject: debugging & error troubleshooting — abstract bug silhouettes, warning marker shapes,
magnifying-glass forms, broken flow lines, log fragments as simple blocks, diagnostic nodes.
★ Unique composition: DRAMATIC TENSION — sharp diagonal fracture/glitch lines cutting across,
higher contrast and a slightly unstable, alert mood; bold and edgy.
Use red accents based on #dc2626 with coral highlights. Keep the left side dark for text.
```

---

## 8. Projects — SHIMonitoring (분위기 완전히 다름 + 실제 로고)

> Projects 헤더는 카테고리 패밀리와 **다른 시각 언어**를 쓴다. 추상 다크네이비가 아니라 **엔터프라이즈 산업 AI 관제** 무드(시네마틱). 그리고 **실제 삼성중공업 로고**를 넣는다.

**방식:** 이미지 생성기(ChatGPT 등)에 **삼성중공업 공식 로고 파일을 먼저 업로드**한 뒤 아래 프롬프트를 쓴다. 생성기가 업로드한 로고를 **그대로(재그리기·변형 금지)** 우상단에 합성한다.

* 저장 위치: `assets/img/project/header/shimonitoring-header.png` (또는 `.webp`)
* 비율 약 **2.8:1**, 권장 **1600×560px**

```text
[먼저 삼성중공업 로고 파일을 업로드한 뒤 사용]

Use the uploaded Samsung Heavy Industries logo as a fixed reference asset. Reproduce it
EXACTLY as uploaded — do not redraw, reinterpret, distort, stretch, rotate, recolor, or
restyle it. Place this uploaded logo in the TOP-RIGHT corner, kept sharp, clean, and fully
readable, with generous clear padding around it. This uploaded logo is the ONLY mark or text
allowed anywhere in the image.

Wide project header cover image for a developer portfolio/blog, enterprise industrial-AI
monitoring aesthetic with cinematic depth (deliberately a different mood from the flat
minimalist category banners). Deep navy / midnight-blue background, clean and rich geometric
composition with subtle atmospheric depth.

Layout: a large, darker, clean TEXT-SAFE empty area on the LEFT for white title, date, and tag
overlay. Concentrate decorative elements on the RIGHT side and lower edges. Keep the TOP-RIGHT
area uncluttered so the uploaded logo stands out clearly.

Subject: a CCTV-based industrial shipyard safety-monitoring platform — abstract shipyard
silhouettes and large ship-hull outlines, crane-like industrial structures, multiple CCTV
camera nodes, video monitoring panels, AI detection bounding-box shapes, alert signal paths,
a faint map/grid, and server-to-dashboard data-flow lines feeding a control dashboard,
conveying real-time detection of fire, fall, person, and vehicle events across many camera streams.

Color: deep navy and midnight blue base with electric blue, cyan, and emerald-green accent
lights; high contrast but not busy.
Style: professional, enterprise-grade, technical, industrial, polished.
Format: wide horizontal composition, 2.8:1 aspect ratio, 1600×560px.

Do NOT add any other text, letters, numbers, captions, signage, or watermark; no second or
fabricated logo; no recognizable human faces; no readable UI text. Only the uploaded Samsung
Heavy Industries logo, unmodified, in the top-right corner.
```

**팁 — 로고가 변형되면:** 생성기가 로고를 흐리게/왜곡해 합성하면, 대안으로 **로고 없이 배경만** 만든 뒤 공식 로고 파일을 CSS로 우상단에 오버레이한다(가장 선명·정확함 → 아래 §B의 `.project-cover__logo` 사용). 어느 방식이든 회사 브랜드 가이드(여백·비율·색·임의 변형 금지)를 지킨다.

---

## 적용 방법

### A. 카테고리 헤더
1) 생성 이미지를 `assets/img/category/header/`에 저장. 파일명:
```text
ai-header.png  backend-header.png  frontend-header.png  devops-header.png
database-header.png  snippets-header.png  errors-header.png
```
2) HTML:
```html
<section class="category-cover category-cover--backend">
  <div class="category-cover__content">
    <span class="category-cover__badge">Backend</span>
    <h1 class="category-cover__title">Backend</h1>
    <p class="category-cover__desc">서버, API, 데이터 처리 등 백엔드 아키텍처와 구현 과정을 기록합니다.</p>
  </div>
</section>
```
3) CSS:
```scss
.category-cover {
  position: relative; min-height: 320px; padding: 56px 64px;
  border-radius: 20px; overflow: hidden;
  background-size: cover; background-position: center; background-repeat: no-repeat;
  display: flex; align-items: center;
}
.category-cover::before {
  content: ""; position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(90deg, rgba(2,6,23,.78) 0%, rgba(2,6,23,.52) 45%, rgba(2,6,23,.18) 100%);
}
.category-cover__content { position: relative; z-index: 1; max-width: 720px; }
.category-cover__badge {
  display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 6px;
  background: rgba(37,99,235,.8); color: #fff; font-size: 13px; font-weight: 800;
  text-transform: uppercase; margin-bottom: 18px;
}
.category-cover__title { margin: 0 0 16px; color: #fff; font-size: 44px; font-weight: 900; line-height: 1.15; letter-spacing: -.04em; }
.category-cover__desc  { margin: 0; color: rgba(255,255,255,.82); font-size: 17px; line-height: 1.7; }

.category-cover--ai       { background-image: url("/assets/img/category/header/ai-header.png"); }
.category-cover--backend  { background-image: url("/assets/img/category/header/backend-header.png"); }
.category-cover--frontend { background-image: url("/assets/img/category/header/frontend-header.png"); }
.category-cover--devops   { background-image: url("/assets/img/category/header/devops-header.png"); }
.category-cover--database  { background-image: url("/assets/img/category/header/database-header.png"); }
.category-cover--snippets  { background-image: url("/assets/img/category/header/snippets-header.png"); }
.category-cover--errors    { background-image: url("/assets/img/category/header/errors-header.png"); }
```

### B. 프로젝트 헤더 (SHIMonitoring) — 별도 클래스로 무드 분리
> `.category-cover`를 재사용하지 말 것. 정렬·그라디언트·크기를 다르게 해 **다른 느낌**을 낸다(하단 정렬 + 시네마틱 세로 비네트 + 실제 로고).
> 로고를 **이미지에 합성한 경우(§8 기본 방식)** 아래 `<img class="project-cover__logo">` 줄과 `.project-cover__logo` CSS는 빼면 된다(이미 배경에 로고가 있음). **CSS 오버레이 대안(§8 팁)** 을 쓸 때만 그 줄을 살린다.
```html
<section class="project-cover project-cover--shimonitoring">
  <img class="project-cover__logo"
       src="{{ '/assets/img/project/logo/shi-logo.svg' | relative_url }}"
       alt="Samsung Heavy Industries">
  <div class="project-cover__content">
    <span class="project-cover__badge">Project · SHIMonitoring</span>
    <h1 class="project-cover__title">SHI Monitoring</h1>
    <p class="project-cover__desc">선체 표면 인식 기반 워터블라스팅 제어 시스템 개발 기록.</p>
  </div>
</section>
```
```scss
.project-cover {
  position: relative; min-height: 380px;          /* 카테고리보다 크게 → 무게감 다름 */
  padding: 60px 64px; border-radius: 20px; overflow: hidden;
  background-image: url("/assets/img/project/header/shimonitoring-header.png");
  background-size: cover; background-position: center;
  display: flex; align-items: flex-end;            /* center가 아닌 하단 정렬 → 다른 분위기 */
}
.project-cover::before {                            /* 카테고리와 다른 세로 시네마틱 비네트 */
  content: ""; position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(180deg, rgba(7,12,20,.15) 0%, rgba(7,12,20,.55) 55%, rgba(7,12,20,.92) 100%);
}
.project-cover__logo {                              /* 실제 SHI 공식 로고 (투명 배경) */
  position: absolute; top: 26px; left: 32px; height: 34px; width: auto; z-index: 2;
  opacity: .96;
}
.project-cover__content { position: relative; z-index: 1; max-width: 760px; color: #fff; }
.project-cover__badge {
  display: inline-flex; padding: 6px 12px; border-radius: 999px;   /* 알약형 → 카테고리 사각형과 차별 */
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.28);
  color: #fff; font-size: 12px; font-weight: 800; letter-spacing: .02em; margin-bottom: 16px;
}
.project-cover__title { margin: 0 0 14px; font-size: 48px; font-weight: 900; line-height: 1.1; letter-spacing: -.04em; }
.project-cover__desc  { margin: 0; color: rgba(255,255,255,.86); font-size: 17px; line-height: 1.7; }
```

### C. 모바일 대응 (공통)
```scss
@media (max-width: 768px) {
  .category-cover, .project-cover { min-height: 240px; padding: 32px 24px; border-radius: 16px; background-position: center right; }
  .category-cover::before { background: linear-gradient(90deg, rgba(2,6,23,.88) 0%, rgba(2,6,23,.7) 58%, rgba(2,6,23,.34) 100%); }
  .category-cover__title { font-size: 30px; }
  .project-cover__title  { font-size: 32px; }
  .category-cover__desc, .project-cover__desc { font-size: 15px; }
  .project-cover__logo { height: 26px; top: 18px; left: 20px; }
}
```

### D. 빌드 · 커밋
```bash
bundle exec jekyll build
git add assets/img/category/header/ assets/img/project/ ; git add . ; git commit -m "Add category + SHIMonitoring header covers"
```

---

## 빠른 체크리스트
- [ ] 카테고리 7개: 색만이 아니라 **구도/질감/조명(★ Unique)** 까지 서로 다른가
- [ ] 카테고리 이미지에 글자·로고 **없음**
- [ ] SHIMonitoring 배경: 실사 산업 무드(카테고리와 확연히 다름), **로고·글자 없이** 생성
- [ ] SHIMonitoring 로고: **실제 삼성중공업 공식 파일**을 오버레이(어두운 배경엔 화이트 버전)
- [ ] 좌측 텍스트 안전영역 확보, 모바일에서 제목 가독
