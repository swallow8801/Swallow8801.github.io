---
layout: post
title: "Claude Code(Codex) 사용 중 한글 인코딩 깨짐 문제 해결하기"
date: 2026-05-30
series: "DevNotes"
category: "Errors"
subcategory: "Encoding"
tags: [claudecode, encoding, utf8, korean, windows]
description: "Claude Code 또는 Codex CLI를 Windows에서 사용할 때 발생하는 한글 깨짐 현상의 원인과 해결법을 정리합니다."
image: https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 상황

Claude Code나 Codex CLI를 Windows 터미널(PowerShell, cmd)에서 실행하면 한글 출력이 `???? ????` 또는 `ì??í?ê³ ` 같이 깨져서 나오는 경우가 있습니다. AI 응답에 한글이 포함되거나, 파일 경로에 한글이 있을 때 특히 두드러집니다.

```text
>>> 이 코드를 리뷰해줘
?? ???? ??..
```

---

## 원인

Windows의 기본 코드페이지(Code Page)는 `949`(CP949, EUC-KR)입니다. CLI 도구들이 UTF-8로 출력해도 터미널이 CP949로 해석하면 글자가 깨집니다. Python 기반 CLI의 경우 `sys.stdout` 인코딩이 `cp949`로 잡히는 것도 원인이 됩니다.

```powershell
# 현재 코드페이지 확인
chcp
# 활성 코드 페이지: 949  ← 이 상태에서 깨짐 발생
```

---

## 해결법

### 1) 터미널 코드페이지를 UTF-8로 전환 (즉시 적용)

```powershell
chcp 65001
```

세션마다 입력해야 하는 임시 방법입니다. 터미널을 새로 열면 다시 949로 돌아옵니다.

### 2) PYTHONUTF8 환경변수 설정 (권장)

Python 3.7+에서 제공하는 UTF-8 모드입니다. 시스템 환경변수에 추가하면 영구 적용됩니다.

```powershell
# 현재 세션만
$env:PYTHONUTF8 = "1"

# 사용자 환경변수로 영구 등록 (관리자 권한 불필요)
[System.Environment]::SetEnvironmentVariable("PYTHONUTF8", "1", "User")
```

셸 프로필(`$PROFILE` 또는 `~/.bashrc`)에 직접 추가해도 됩니다.

```bash
# ~/.bashrc 또는 PowerShell $PROFILE
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8
```

### 3) Windows Terminal 사용

기본 cmd/PowerShell 창 대신 [Windows Terminal](https://aka.ms/terminal)을 사용하면 UTF-8이 기본값으로 처리됩니다. 설정 → 프로필 → 고급 → 문자 인코딩을 `UTF-8`로 확인하세요.

### 4) WSL 사용

WSL(Windows Subsystem for Linux) 환경은 기본 인코딩이 UTF-8이므로 이 문제가 발생하지 않습니다. Claude Code를 WSL 터미널에서 실행하면 별도 설정 없이 한글이 정상 출력됩니다.

---

## 메모

- `PYTHONUTF8=1`이 가장 근본적인 해결책이다. 한 번 환경변수에 등록하면 Python 기반 CLI 전체에 적용된다.
- `PYTHONIOENCODING=utf-8`도 함께 설정하면 파이프(`|`) 입출력까지 커버된다.
- `chcp 65001` 단독으로 안 되는 경우 → Python UTF-8 모드가 켜지지 않은 것이다. 환경변수도 함께 설정한다.
- 파일 경로의 한글 깨짐은 별도 문제일 수 있다 — OS 파일시스템 인코딩(`os.fsencode`/`os.fsdecode`) 관련 디버깅이 필요하다.
- Windows 11 22H2 이상에서는 시스템 전역 UTF-8 활성화 옵션이 있다: `제어판 → 지역 → 관리자 옵션 → 시스템 로캘 변경 → Beta: 세계 언어 지원을 위해 Unicode UTF-8 사용`.

---

## 이미지 출처

사진: Shahadat Rahman / Unsplash (Unsplash License) — https://unsplash.com/photos/BfrQnKBulYQ
