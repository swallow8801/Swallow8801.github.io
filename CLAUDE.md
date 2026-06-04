# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 명령어

```bash
# 의존성 설치
bundle install

# 로컬 개발 서버 (http://localhost:4000)
bundle exec jekyll serve

# 라이브 리로드 포함
bundle exec jekyll serve --livereload

# 프로덕션 빌드 (_site/ 폴더 생성)
bundle exec jekyll build
```

## 프로젝트 개요

Jekyll + GitHub Pages 기반 AI Full Stack Developer 포트폴리오 겸 기술 블로그.  
디자인 참고 파일(HTML 목업): `landing.html`, `portfolio.html`, `blog.html`

**URL 구조**
```
/           → 랜딩 (index.html)
/portfolio  → 포트폴리오 (portfolio.md)
/blog       → 블로그 목록 (blog/index.html)
/blog/:slug → 개별 포스트 (_layouts/post.html)
```

## 디자인 시스템

모든 색상·폰트 변수는 `_sass/_variables.scss`에서 관리한다. 임의로 하드코딩 금지.

```scss
// 핵심 변수
--blue:    #2563eb   // 메인 액센트 (버튼, 링크, 언더라인)
--bg:      #eef2f7   // 페이지 배경 (흰색 사용 금지)
--surface: #ffffff   // 카드 배경
--t1:      #0f1f3d   // 본문 텍스트
```

폰트: `Pretendard` (CDN, `_includes/head.html`에서 로드)

## 아키텍처 핵심

### 데이터 분리 원칙
콘텐츠 데이터는 코드와 분리한다.
- 프로젝트 목록 → `_data/projects.yml`
- 기술 스택 숙련도 → `_data/skills.yml`
- Liquid 템플릿에서 `site.data.projects`, `site.data.skills`로 접근

### 레이아웃 계층
```
_layouts/default.html   ← 모든 페이지의 공통 껍데기 (nav + head + footer)
  └─ _layouts/post.html ← 블로그 포스트 전용 (TOC 사이드바 포함)
```
`portfolio.md`와 `blog/index.html`은 `layout: default`를 사용하고,  
`_posts/` 파일들은 `layout: post`를 사용한다.

### JS 파일 역할
- `filter.js` — 포트폴리오의 카테고리 필터. 블로그 필터는 `blog/index.html` 내부 스크립트가 `data-category` 속성으로 카드 show/hide
- `toc.js` — 포스트 내 h2·h3를 스캔해 오른쪽 sticky TOC 생성 + 스크롤 하이라이팅
- `copy-code.js` — 코드 블록에 복사 버튼 동적 삽입

## 블로그 포스트 작성 규격

파일명: `_posts/YYYY-MM-DD-slug.md`

```yaml
---
layout: post
title: "제목"
date: YYYY-MM-DD
series: "Study"      # Study | DevNotes | Projects
category: "AI·LLM"   # 아래 series별 목록 참고
tags: [tag1, tag2]
description: "카드·SEO용 한 줄 요약"
pinned: false        # 강조 플래그 (true는 하나만 유지)
---
```

`series`와 `category`는 `blog/index.html` 사이드바가 그룹핑·카운트에 사용하므로 다음 조합을 정확히 따른다(문자열 일치 필수):

- **Study**: `AI` | `Backend` | `Frontend` | `DevOps` | `Database`
- **DevNotes**: `Snippets` | `Errors`
- **Projects**: 개발일지 (series만 `Projects`)

`pinned: true`는 강조용 플래그다. 현재 `blog/index.html`은 pinned를 별도 히어로로 렌더하지 않으니 선별/메타 용도로 쓰고, true는 한 개만 유지한다.

## GitHub Pages 배포

`main` 브랜치에 push하면 자동 배포된다.  
`_config.yml`의 `url`과 `baseurl` 값이 실제 도메인과 일치하는지 확인 후 push한다.
