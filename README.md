# swallow8801.github.io

AI Full Stack Developer 포트폴리오 겸 기술 블로그.  
Jekyll + GitHub Pages로 구현. 디자인 참고 파일: `landing.html`, `portfolio.html`, `blog.html`

---

## Run
```cmd
bundle exec jekyll serve --livereload
```

## 기술 스택

| 항목 | 선택 |
|---|---|
| 프레임워크 | Jekyll |
| 호스팅 | GitHub Pages |
| 폰트 | Pretendard (CDN) |
| 테마 컬러 | Blue `#2563eb` / Background `#eef2f7` |
| 마크다운 | kramdown |
| 코드 하이라이팅 | Rouge |

---

## 사이트 구조

```
swallow8801.github.io/           → 랜딩 (소개 + CTA)
swallow8801.github.io/portfolio  → 포트폴리오 전용
swallow8801.github.io/blog       → 블로그 목록
swallow8801.github.io/blog/:slug → 개별 포스트
```

---

## 구현 기능 목록

### 1. 공통

- [ ] Pretendard 폰트 전역 적용
- [ ] 공통 nav: `Portfolio` / `Blog` 탭, 현재 페이지 파란 언더라인 표시
- [ ] 반응형 레이아웃 (모바일 / 태블릿 / 데스크탑)
- [ ] SEO 메타태그: `og:title`, `og:description`, `og:image`, `twitter:card`
- [ ] RSS 피드 (`/feed.xml`)
- [ ] Sitemap (`/sitemap.xml`)
- [ ] 404 커스텀 페이지

---

### 2. 랜딩 페이지 (`index.html`)

- [ ] 히어로: 이름, 역할(AI Full Stack Developer), 한 줄 소개
- [ ] 우측 코드 카드 비주얼 (Python 스니펫 스타일)
- [ ] CTA 버튼 2개: `Portfolio 보기 →` / `Blog 읽기`
- [ ] 통계 수치: Projects · Blog Posts · GitHub Stars
- [ ] 하단 기술 스택 스트립 (AI 계열 강조)

---

### 3. 포트폴리오 페이지 (`portfolio.md`)

- [ ] 블루 그라디언트 프로필 헤더: 이름, 역할, 스탯(Projects / Stars / Commits), GitHub · LinkedIn 링크
- [ ] 카테고리 필터 버튼: `전체` / `AI·LLM` / `Web App` / `Tool·Infra`
  - JavaScript로 카드 show/hide 처리
- [ ] Featured 프로젝트 카드 (2열 차지): 제목, 설명, 태그, Demo · GitHub 링크, Stars
- [ ] 일반 프로젝트 카드: 타입 뱃지, 제목, 설명, 태그, Stars
- [ ] 프로젝트 데이터는 `_data/projects.yml`로 관리
- [ ] 기술 스택 섹션: AI·LLM / Frontend / Backend / Infra 4개 그룹, 수평 스킬 바

---

### 4. 블로그 목록 페이지 (`blog/index.html`)

- [ ] 피처드 히어로: 좌측 블루 패널(배지 + 메타정보) + 우측 텍스트(제목, 설명, 태그, 읽기 버튼)
  - `pinned: true` 포스트 자동 표시
- [ ] 카테고리 필터 탭 바: `전체` / `AI·LLM` / `Backend` / `Frontend` / `DevOps`
  - JavaScript로 필터링
- [ ] 포스트 카드 2열 그리드: 카테고리, 날짜, 제목, 요약, 태그, 읽기 시간
- [ ] 우측 사이드바 (sticky):
  - About 위젯: 아바타, 이름, 역할, 한 줄 소개, 링크
  - 카테고리 위젯: 카테고리명 + 포스트 수
  - 인기 글 위젯: top 3 (제목 + 조회수)
  - 태그 클라우드 위젯
- [ ] 페이지네이션 (`jekyll-paginate`)

---

### 5. 개별 포스트 페이지 (`_layouts/post.html`)

- [ ] 포스트 헤더: 카테고리 뱃지, 제목, 날짜, 읽기 시간, 태그
- [ ] 목차 (Table of Contents): 우측 sticky, h2 · h3 자동 추출
- [ ] 본문: Markdown 렌더링, Rouge 코드 하이라이팅
- [ ] 코드 블록: 언어 표시, 복사 버튼
- [ ] 이전 / 다음 포스트 링크 (하단)
- [ ] 관련 포스트 (같은 카테고리 최대 3개)

---

### 6. Jekyll 파일 구조

```
_config.yml
_data/
  projects.yml        # 포트폴리오 프로젝트 데이터
  skills.yml          # 기술 스택 + 숙련도
_layouts/
  default.html        # 공통 레이아웃 (nav + footer)
  post.html           # 블로그 포스트 레이아웃
_includes/
  head.html           # <head> (메타, 폰트, CSS)
  nav.html            # 상단 네비게이션
  footer.html         # 푸터
  toc.html            # 목차 컴포넌트
  post-card.html      # 포스트 카드 컴포넌트
_posts/
  YYYY-MM-DD-slug.md  # 블로그 포스트 (Markdown)
_sass/
  _variables.scss     # 컬러, 폰트 변수
  _base.scss          # 리셋, 공통 스타일
  _nav.scss
  _landing.scss
  _portfolio.scss
  _blog.scss
  _post.scss
assets/
  css/main.scss
  js/
    filter.js         # 포트폴리오·블로그 카테고리 필터
    toc.js            # 목차 스크롤 하이라이팅
    copy-code.js      # 코드 블록 복사 버튼
index.html
portfolio.md
blog/index.html
404.html
feed.xml
sitemap.xml
```

---

### 7. 포스트 Front Matter 규격

```yaml
---
layout: post
title: "포스트 제목"
date: YYYY-MM-DD
category: "AI·LLM"      # AI·LLM | Backend | Frontend | DevOps
tags: [claude-api, rag]
description: "한 줄 요약"
pinned: false            # true 시 블로그 히어로에 표시
read_time: 12            # 분 단위
---
```

---

### 8. 구현 순서

1. **Jekyll 기반 세팅** — `_config.yml`, Gemfile, 기본 디렉터리 구조
2. **공통 레이아웃** — `head.html`, `nav.html`, `default.html`, CSS 변수
3. **랜딩 페이지** — `index.html`
4. **포트폴리오 페이지** — `portfolio.md` + `_data/projects.yml` + 필터 JS
5. **블로그 목록 페이지** — `blog/index.html` + 사이드바 + 필터
6. **포스트 레이아웃** — `_layouts/post.html` + TOC + 코드 복사
7. **반응형** — 모바일 브레이크포인트 적용
8. **SEO · RSS · Sitemap**
9. **GitHub Pages 배포 확인**
