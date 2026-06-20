---
layout: post
title: "여러 프로젝트를 관리하는 에이전트 세팅 (2) — 실전 사용 예시와 실습"
date: 2026-06-21
series: "DevNotes"
category: "Snippets"
subcategory: "ClaudeAgents"
tags: [claude-code, subagents, agents, hands-on, delegation]
description: "이 블로그 저장소의 실제 에이전트들로 한 작업을 끝까지 돌려보고, 직접 도메인별 에이전트 세트를 만드는 실습을 정리합니다."
image: https://commons.wikimedia.org/wiki/Special:FilePath/Claude_AI_symbol.svg
pinned: false
---

[1부]({{ '/blog/claude-multi-project-agents-setup' | relative_url }})에서는 도메인별 에이전트를 어떻게 설계하는지를 다뤘다. 이번 글은 그렇게 만든 에이전트를 **실제로 어떻게 굴리는지**다. 이 블로그 저장소의 7개 에이전트로 작업을 처음부터 끝까지 한 번 돌려보고, 그다음 백엔드·프런트·문서 3-에이전트 세트를 직접 만드는 실습을 따라간다.

---

## 호출 방법 — 자동 위임 vs 명시 호출

서브에이전트를 부르는 길은 둘이다.

- **자동 위임.** 그냥 평소처럼 일을 시키면, 메인 스레드가 요청과 각 에이전트의 `description`을 맞춰보고 알아서 위임한다. "이 포스트들 배포 전에 점검해줘"라고만 해도 `post-validator`가 뜨는 식이다. description을 잘 써두는 게 중요한 이유.
- **명시 호출.** 누가 할지 직접 지정한다. 애매하거나 자동으로 안 잡힐 때 쓴다.

```text
# 자동 위임 — 어떤 에이전트가 맞는지 메인이 판단
"_posts 전체 컨벤션 점검해줘"

# 명시 호출 — 에이전트를 직접 지목
"post-validator 서브에이전트로 _posts 전체를 검사해줘"
"frontend-engineer를 써서 블로그 카드 호버 효과를 고쳐줘"
```

에이전트 목록을 보고 만들고 수정하는 건 `/agents` 명령으로 한다. 도구 권한도 여기서 체크박스로 켜고 끈다.

---

## 예시 1: 글 한 편을 끝까지 돌리기

새 글을 쓰는 작업은 이 저장소에서 **세 에이전트의 릴레이**로 돈다. 메인 스레드가 오케스트레이터 역할을 한다.

```text
1) (메인) "Redis 캐시 무효화 주제로 새 글 한 편 써줘"
        → blog-writer 위임
2) blog-writer:
   - jekyll-blog-post 스킬의 new_post.py 로 스캐폴딩
   - 비슷한 기존 글 1개 read 해서 톤 맞춤
   - 본문/태그/description 작성
3) (메인) "썸네일도 주제에 맞는 걸로 넣어줘"
        → image-curator 위임 (WebSearch 권한 보유)
4) (메인) "배포 전에 점검해줘"
        → post-validator 위임 → validate_posts.py 실행 → 리포트
```

핵심은 **각 에이전트가 자기 컨텍스트에서 돈다**는 점이다. `blog-writer`가 톤을 맞추려고 기존 글 여러 개를 읽어도, 그 내용이 메인 대화 컨텍스트를 채우지 않는다. 메인 스레드는 "글 작성 완료, 검증 통과" 같은 요약만 돌려받는다. 그래서 글 한 편을 끝까지 돌려도 메인 대화가 가벼운 상태로 유지된다.

또 하나, 여기서 `blog-writer`는 **스킬을 호출**한다는 점에 주목. 에이전트(누가·어떤 자세로)와 스킬(정확한 규격·스크립트)은 역할이 다르다. `blog-writer`의 프롬프트는 "먼저 `jekyll-blog-post` 스킬을 쓴다"로 시작한다. 규격의 단일 출처는 스킬에 두고, 에이전트는 그걸 부르는 페르소나 겸 라우터로 둔 것이다.

---

## 예시 2: 프런트 변경을 구현하고 감사받기

코드 변경은 **구현자 → 검토자** 쌍으로 돈다.

```text
1) (메인) "블로그 카드에 마우스 올리면 살짝 떠오르는 효과 넣어줘"
        → frontend-engineer 위임
2) frontend-engineer:
   - _sass/_blog.scss read, 기존 패턴 파악
   - @include card-hover 같은 기존 믹스인으로 최소 변경
   - jekyll build 로 검증 후 "무엇을 왜 바꿨는지" 보고
3) (메인) "방금 변경 디자인 시스템 기준으로 점검해줘"
        → design-reviewer 위임 (읽기 전용)
4) design-reviewer:
   - 하드코딩 색상/반응형 누락/접근성/BEM 네이밍 grep
   - 🔴Blocker/🟡Warning/⚪Nit 으로 묶어 리포트 (파일은 안 고침)
```

`design-reviewer`는 `Write`가 없으니 절대 코드를 못 고친다. 리포트만 낸다. 거기서 나온 지적을 고칠 때는 다시 `frontend-engineer`에게 넘긴다. **만드는 손과 검사하는 눈을 분리**하면, 자기가 짠 코드를 자기가 봐주는 맹점이 줄어든다.

---

## 병렬로 돌리기

서로 의존이 없는 작업은 여러 에이전트를 **동시에** 띄울 수 있다. 메인 스레드가 한 번에 여러 위임을 내보내는 식이다.

```text
"포트폴리오에 새 프로젝트 하나 추가하면서,
 동시에 _posts 전체 컨벤션도 점검해줘"
   → content-curator (projects.yml 수정)  ┐
   → post-validator   (_posts 검사)        ┘  병렬
```

둘은 건드리는 파일도(`_data/projects.yml` vs `_posts/*.md`), 도구도(쓰기 vs 읽기) 겹치지 않아 충돌 없이 같이 돈다. 반대로 같은 파일을 만지는 작업을 병렬로 띄우면 서로의 변경을 덮어쓸 수 있으니, **출력이 겹치는 작업은 순서대로** 돌린다. 1부에서 도메인을 파일 경계로 쪼갠 게 여기서 병렬성으로 돌아온다.

> 한 가지 제약: 서브에이전트는 또 다른 서브에이전트를 부르지 못한다. 오케스트레이션(누구에게 무엇을 언제)은 항상 메인 스레드가 쥔다. 그래서 메인 대화에서 작업을 어떻게 끊어 위임하느냐가 결과를 좌우한다.

---

## 실습: 백엔드·프런트·문서 3-에이전트 세트 만들기

이제 빈 프로젝트(일반적인 풀스택 앱)에 에이전트 세트를 직접 깔아본다. 1부의 설계 원칙을 그대로 손으로 옮기는 실습이다.

### 1단계 — 폴더와 첫 에이전트

```bash
# 프로젝트 루트에서
mkdir -p .claude/agents
```

`/agents` 명령으로 대화형으로 만들어도 되고, 파일을 직접 만들어도 된다. 직접 만드는 쪽으로 `backend-engineer`부터.

```bash
cat > .claude/agents/backend-engineer.md <<'EOF'
---
name: backend-engineer
description: API 엔드포인트·서비스 로직·DB 모델·마이그레이션을 구현/수정할 때 사용.
  라우터·스키마·모델을 프로젝트 컨벤션에 맞춰 작업하고 pytest로 검증한다.
  "엔드포인트 추가", "쿼리 수정", "마이그레이션" 요청 시 호출.
tools: Read, Write, Edit, Grep, Glob, Bash
model: sonnet
---

너는 이 서비스의 백엔드 엔지니어다. 레이어 경계를 지킨다:
라우터는 검증만, 비즈니스 로직은 service, DB 접근은 repository.
- 모든 엔드포인트에 입출력 스키마와 타입 힌트를 단다.
- DB 스키마를 바꾸면 마이그레이션을 같이 만든다.
- 변경 후 `pytest -q`로 검증하고, 무엇을 왜 바꿨는지 보고한다.
EOF
```

### 2단계 — 나머지 둘과 검토자

같은 골격(**역할 한 줄 → 규칙 3~5개 → 검증/보고**)으로 `frontend-engineer`, `docs-writer`를 만든다(1부의 예시 프롬프트를 그대로 써도 된다). 여기에 읽기 전용 검토자 하나를 추가하는 게 핵심이다.

```bash
cat > .claude/agents/code-reviewer.md <<'EOF'
---
name: code-reviewer
description: 코드 변경 직후나 "리뷰해줘", "이 diff 점검" 요청 시 사용.
  버그·경계 조건·보안·컨벤션 위반을 점검한다.
  읽기 전용 — 코드를 고치지 않고 리포트만 낸다. 수정은 구현 에이전트에 위임.
tools: Read, Grep, Glob, Bash
model: sonnet
---

너는 이 프로젝트의 코드 리뷰어다. 절대 파일을 수정하지 않는다.
git diff 를 확인하고 🔴Blocker / 🟡Warning / ⚪Nit 로 묶어 보고한다.
각 항목은 `파일:라인 — 문제 — 수정안` 한 줄 요지로. 위반이 없으면 솔직히 "통과".
EOF
```

`Write`/`Edit`가 빠진 걸 다시 확인하자. 이게 검토자를 검토자로 묶어두는 장치다.

### 3단계 — 확인하고 굴려보기

```bash
# 에이전트가 인식됐는지 (대화형 목록)
/agents
```

그다음 실제로 한 바퀴 돌린다.

```text
1) "사용자 즐겨찾기 추가 엔드포인트 만들어줘"     → backend-engineer
2) "방금 변경 리뷰해줘"                            → code-reviewer (읽기 전용)
3) (지적 반영) "리뷰에서 나온 입력 검증 누락 고쳐줘" → backend-engineer
4) "이 엔드포인트 README API 섹션에 추가해줘"       → docs-writer
```

자동 위임이 엉뚱하게 잡히거나 아예 안 잡히면, 명시 호출(`"backend-engineer로…"`)로 먼저 동작을 확인한 뒤 `description` 문구를 다듬는다. 이 디버깅은 3부에서 자세히 다룬다.

### 4단계 — 커밋해서 공유

```bash
git add .claude/agents/
git commit -m "chore: 백엔드·프런트·문서·리뷰어 에이전트 추가"
```

`.claude/agents/`를 커밋하면 팀원도, 다른 머신의 나도 클론만으로 같은 에이전트 세트를 그대로 쓴다. **에이전트 설정 자체가 코드와 함께 버전 관리되는 자산**이 되는 것 — 이 운영 측면이 3부의 주제다.

---

## 정리

- 호출은 **자동 위임**(description 매칭) 또는 **명시 호출**(`"X로 …"`). 목록·생성·권한은 `/agents`.
- 실제 작업은 에이전트 **릴레이**로 돈다: 글 = blog-writer→image-curator→post-validator, 코드 = frontend-engineer→design-reviewer. 각자 자기 컨텍스트에서 돌아 메인 대화가 가볍다.
- 의존 없는 작업은 **병렬**로, 같은 파일을 만지는 작업은 **순차**로. 오케스트레이션은 항상 메인 스레드가 쥔다(서브에이전트는 서브에이전트를 못 부른다).
- 실습: `.claude/agents/`에 backend/frontend/docs + 읽기 전용 reviewer를 같은 골격으로 만들고, 한 바퀴 돌려보고, 커밋해서 공유한다.

> 확인 필요: `/agents` UI와 자동 위임 동작은 Claude Code 버전에 따라 다를 수 있다. 위 명령·프롬프트 예시는 본인 프로젝트의 실제 명령(`pytest`/`jekyll build` 등)으로 바꿔서 쓸 것.

---

## 이미지 출처

로고: Anthropic — Claude AI (Wikimedia Commons, File:Claude AI symbol.svg)
