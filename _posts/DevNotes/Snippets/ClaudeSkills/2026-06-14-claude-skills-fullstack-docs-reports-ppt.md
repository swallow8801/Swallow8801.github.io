---
layout: post
title: "풀스택 개발과 문서·리포트·PPT까지 — 갖춰두면 좋은 Claude Skill 모음"
date: 2026-06-14
series: "DevNotes"
category: "Snippets"
subcategory: "ClaudeSkills"
tags: [claude, skills, docx, pptx, document-skills]
description: "풀스택 개발과 문서·리포트·PPT 제작을 돕는 Claude Skill을 분야별로 묶고, 여러 GitHub 레포에서 가져오는 방법을 정리합니다."
image: https://commons.wikimedia.org/wiki/Special:FilePath/Claude_AI_symbol.svg
pinned: false
---

스킬(Skill)은 Claude에게 "이런 일은 이런 절차로 해라"를 미리 적어 둔 폴더다. 매번 프롬프트로 설명하던 작업을 한 번 정의해 두면, 관련된 요청이 들어올 때 알아서 해당 절차를 따른다. 풀스택 개발을 하다 보면 코드뿐 아니라 문서·리포트·발표자료까지 만들 일이 계속 생기는데, 이 영역마다 갖춰두면 좋은 스킬이 정해져 있다. 이 글은 내가 챙기는 스킬을 분야별로 묶고, 여러 GitHub 레포에서 가져오는 방법을 정리한 메모다.

---

## 문서·리포트·PPT 제작: 공식 document-skills

문서 계열은 Anthropic이 공식 레포 [`anthropics/skills`](https://github.com/anthropics/skills)에서 제공하는 **document-skills** 묶음이 기본이다. 네 가지가 핵심이다.

- **docx** — Word 문서 생성·편집. 목차, 머리글, 표, 트래킹/코멘트까지 다룬다. 리포트·제안서·레터에 쓴다.
- **pptx** — 슬라이드 덱 생성·편집. 발표자료, 피치덱을 만들 때 쓴다.
- **pdf** — PDF 텍스트·표 추출, 병합/분할, 폼 처리.
- **xlsx** — 스프레드시트 생성·편집, 수식·차트·데이터 정리.

Claude Code에서는 플러그인 마켓플레이스로 한 번에 설치할 수 있다.

```bash
# Claude Code 안에서
/plugin install document-skills@anthropic-agent-skills
```

설치 후에는 스킬 이름을 언급하기만 하면 된다. 예: "PDF 스킬로 이 파일에서 폼 필드를 추출해줘". 같은 스킬들은 Claude.ai 유료 플랜에도 이미 들어가 있어, 데스크톱 환경에서는 별도 설치 없이 쓰기도 한다.

> 워크플로 팁: **리서치 먼저, 문서 스킬은 나중**이다. 사실·수치·출처를 먼저 모으고, 내용이 정리된 뒤에 docx/pptx 스킬을 불러 문서 형태로 빚는다. 빈 문서 골격부터 잡으면 정작 들어갈 내용이 비어버린다.

---

## 풀스택 개발: 가져다 쓰는 스킬

개발 쪽은 작업 성격에 따라 갖춰두면 좋은 스킬이 갈린다.

### 백엔드 / 인프라

- **mcp-builder** — 외부 API·서비스를 MCP 서버로 감싸 Claude가 도구로 쓰게 만든다. 사내 시스템을 연동할 때 유용하다.
- **테스트·리뷰 계열** — PR 리뷰, 보안 점검 같은 반복 검증을 스킬/명령으로 굳혀두면 매번 체크리스트를 설명할 필요가 없다.

### 프론트엔드 / 산출물

- **web-artifacts-builder** — React·Tailwind·shadcn/ui 기반의 복잡한 HTML 아티팩트를 만들 때.
- **canvas-design / algorithmic-art** — 포스터·썸네일·도식 같은 시각 산출물.
- **theme-factory** — 슬라이드·문서·랜딩 페이지에 일관된 테마(색/폰트)를 입힐 때.

이 목록은 절대적인 정답이 아니라 "내 작업 흐름에 자주 등장하는 것들"이다. 본인 프로젝트에서 세 번 이상 반복되는 작업이 있으면 그게 곧 스킬 후보다.

---

## 여러 GitHub 레포에서 스킬 모으기

스킬은 한 레포에만 있는 게 아니다. 출처를 섞어 쓰는 게 현실적이다.

1. **공식** — [`anthropics/skills`](https://github.com/anthropics/skills): document-skills를 비롯한 레퍼런스 스킬. 스킬 폴더 구조를 어떻게 짜야 하는지 보는 표준이기도 하다.
2. **큐레이션 목록** — [`travisvn/awesome-claude-skills`](https://github.com/travisvn/awesome-claude-skills): 커뮤니티가 모은 스킬·자료 모음. 필요한 도메인의 스킬을 찾는 출발점으로 좋다.
3. **자작 스킬** — 회사·프로젝트 고유 절차는 직접 만든다. `skill-creator` 스킬이 처음부터 만들거나 기존 스킬을 다듬는 걸 도와준다.

여러 레포를 참조할 때는 각 스킬의 `SKILL.md`(이름·설명·트리거 조건)를 먼저 읽어, **언제 발동되는지**가 내 작업과 맞는지 확인하고 가져온다. 설명이 모호하면 엉뚱한 타이밍에 발동하거나 아예 발동하지 않는다.

---

## 정리

문서·리포트·PPT는 공식 **document-skills(docx·pptx·pdf·xlsx)**로 충분히 커버되고, 개발 산출물은 mcp-builder·web-artifacts-builder·theme-factory 같은 스킬을 작업 성격에 맞춰 갖춘다. 출처는 공식 레포 + 큐레이션 목록 + 자작을 섞고, 가져올 때는 항상 `SKILL.md`의 발동 조건을 확인한다. 핵심은 "반복되는 절차를 스킬로 굳혀, 매번 설명하는 비용을 없애는 것"이다.

> 확인 필요: 설치 명령·플러그인 이름은 사용 중인 Claude Code 버전에 맞는지 한 번 점검하고, 자작 스킬 목록은 본인 레포 기준으로 교체할 것.

---

## 이미지 출처

로고: Anthropic — Claude AI (Wikimedia Commons, File:Claude AI symbol.svg)
