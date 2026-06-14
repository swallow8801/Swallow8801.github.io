# 블로그 카테고리 로고 — ChatGPT 이미지 생성 가이드

`/blog`의 카테고리 배너(`.cat-banner__icon`, 36×36px 표시)에 들어갈
카테고리별 로고 이미지를 ChatGPT(DALL-E)로 생성할 때 사용하는 프롬프트와 파일명 모음.

- 저장 위치: `assets/img/category/`
- 형식: PNG, 정사각형, **배경 투명**
- 생성 크기: 512×512px (브라우저에서 36×36으로 축소 표시되므로 단순한 도형일수록 좋음)
- 라이트/다크 테마 양쪽에서 다 보이도록, 배경은 반드시 투명하게 요청

## 공통 스타일 가이드 (모든 프롬프트 앞에 붙여 사용)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.
```

## 카테고리별 프롬프트

### 1. AI — `assets/img/category/ai.png`
강조색: `#2563eb` (blue)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a four-pointed sparkle/star shape (AI "magic" spark) with one small
accent dot beside it, symbolizing AI and generative intelligence.
Primary color #2563eb (vivid blue) on transparent background.
```

### 2. Backend — `assets/img/category/backend.png`
강조색: `#059669` (emerald green)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: stacked server rack layers (three horizontal rounded bars with
small status-light dots on the left edge), symbolizing backend
infrastructure and APIs. Primary color #059669 (emerald green) on
transparent background.
```

### 3. Frontend — `assets/img/category/frontend.png`
강조색: `#0891b2` (cyan)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a browser window outline with a simple UI layout inside (top bar,
sidebar, and content blocks), symbolizing frontend development and UI work.
Primary color #0891b2 (cyan) on transparent background.
```

### 4. DevOps — `assets/img/category/devops.png`
강조색: `#d97706` (amber orange)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a circular infinity/refresh loop made of two curved arrows forming
a continuous cycle, symbolizing CI/CD pipelines and automation.
Primary color #d97706 (amber orange) on transparent background.
```

### 5. Database — `assets/img/category/database.png`
강조색: `#7c3aed` (violet purple)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a classic database cylinder shape made of stacked elliptical disks,
symbolizing data storage and schema design. Primary color #7c3aed
(violet purple) on transparent background.
```

### 6. Snippets — `assets/img/category/snippets.png`
강조색: `#475569` (slate gray)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a pair of code angle brackets "< >" facing outward, symbolizing
reusable code snippets. Primary color #475569 (slate gray) on transparent
background.
```

### 7. Errors — `assets/img/category/errors.png`
강조색: `#dc2626` (red)

```
Flat vector app icon/logo, minimalist geometric design, single bold symbol
centered in frame, transparent background, no text or letters, no shadow,
no gradient, clean rounded shapes, modern SaaS/tech branding style,
square 1:1 composition with generous padding around the symbol.

Subject: a rounded bug/insect silhouette with small radiating warning lines
around it, symbolizing debugging and error troubleshooting.
Primary color #dc2626 (red) on transparent background.
```

## 이미지 적용 방법 (이미지 받은 후)

1. 위 파일명대로 `assets/img/category/` 폴더에 저장.
2. `_includes/category-icon.html`의 해당 `{%- when 'xxx' -%}` 블록을
   `<img src="{{ '/assets/img/category/xxx.png' | relative_url }}" alt="">`로 교체.
3. `_sass/_base.scss` 또는 `_sass/_blog.scss`의 `.cat-banner__icon svg { width: 20px; height: 20px; }`
   규칙에 `img`도 함께 적용되도록 `svg, img { width: 20px; height: 20px; object-fit: contain; }`로 수정.
4. `bundle exec jekyll build`로 확인 후 커밋.
