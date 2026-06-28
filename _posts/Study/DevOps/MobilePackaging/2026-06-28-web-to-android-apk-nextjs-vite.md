---
layout: post
title: "웹 서비스를 APK로: Next.js·React(Vite) 앱을 안드로이드 앱으로 빌드하기"
date: 2026-06-28
series: "Study"
category: "DevOps"
subcategory: "MobilePackaging"
tags: [android, apk, capacitor, pwa, twa, vite, nextjs]
description: "Next.js·React(Vite)로 만든 웹을 Capacitor·TWA·PWA로 감싸 안드로이드 APK로 빌드하는 선택지를 비교합니다."
image: https://upload.wikimedia.org/wikipedia/commons/d/d7/Android_robot.svg
pinned: false
---

## 들어가며

이미 잘 굴러가는 웹 서비스가 있는데 "안드로이드 앱으로도 내보내 달라"는 요구가 들어오는 경우가 많습니다. 푸시 알림, 홈 화면 아이콘, 스토어 등록 같은 이유 때문입니다. 이때 매번 네이티브로 다시 짜는 건 비효율적입니다. 다행히 웹 앱을 **APK로 감싸는** 길이 여러 개 있습니다.

이 글은 Next.js나 React(Vite)로 만든 웹을 안드로이드 APK로 빌드하는 대표적인 세 갈래 — PWA + TWA, Capacitor(WebView 래핑), 그리고 진짜 네이티브 재작성 — 을 비교하고, 빌드·서명까지의 흐름을 정리합니다. 핵심 전제 하나만 먼저 짚으면, **APK 안에 들어가는 건 결국 정적 자산(HTML/JS/CSS)** 이거나 **원격 웹을 가리키는 컨테이너**라는 점입니다.

---

## 큰 그림: 세 가지 길

| 방식 | 무엇을 하나 | 적합한 경우 | 비고 |
| --- | --- | --- | --- |
| PWA + TWA | 설치형 웹(PWA)을 Trusted Web Activity로 스토어용 APK에 담음 | 이미 PWA 요건(HTTPS·manifest·SW)을 갖춘 서비스 | 가장 얇은 래퍼, 브라우저 엔진 그대로 |
| Capacitor (WebView 래핑) | 빌드된 정적 자산을 WebView 앱에 넣고 네이티브 API(카메라·푸시 등) 연결 | 디바이스 기능 접근이 필요한 경우 | 사실상의 표준 래핑 도구 |
| 네이티브 재작성 | React Native/Kotlin 등으로 다시 구현 | 고성능·복잡한 네이티브 UX가 핵심일 때 | 비용 가장 큼, 이 글 범위 밖 |

대부분의 "기존 웹을 앱으로" 요구는 앞의 두 갈래로 해결됩니다. 선택의 핵심 갈림길은 **네이티브 기능이 필요한가**입니다. 단순히 스토어에 올리고 전체화면으로 띄우는 정도면 TWA, 카메라·로컬 저장·푸시 같은 기능을 깊게 쓰면 Capacitor가 출발점입니다.

---

## 먼저 정리할 것: Next.js와 Vite의 차이

래핑 도구는 보통 **정적 파일 묶음**을 요구합니다. 여기서 Next.js와 Vite의 차이가 중요해집니다.

**Vite(React)** 는 본래 정적 빌드가 기본입니다. `vite build`를 하면 `dist/`에 그대로 담을 수 있는 자산이 나옵니다. 래핑에 가장 잘 맞습니다.

```bash
npm run build      # vite build → dist/ 에 정적 자산 생성
```

**Next.js** 는 SSR/서버 기능이 핵심이라, 그대로는 정적 묶음이 아닙니다. WebView/TWA에 담으려면 보통 **정적 export**(`output: 'export'`)로 빌드해 서버 의존을 없애야 합니다. 단, 이 경우 SSR·서버 액션·이미지 최적화 서버 등 **서버가 전제인 기능은 쓸 수 없습니다.**

```js
// next.config.js — 정적 export 모드
/** @type {import('next').NextConfig} */
module.exports = {
  output: 'export',        // out/ 에 정적 HTML/JS 생성
  images: { unoptimized: true },  // 서버 이미지 최적화 비활성
};
```

```bash
next build         # out/ 에 정적 자산 생성
```

정리하면, **서버 기능이 꼭 필요하면** 웹은 원격 서버에 두고 앱은 그 URL을 가리키게(TWA 또는 Capacitor의 원격 URL 로드) 하고, **완전 오프라인/정적이면** export한 자산을 앱에 직접 번들합니다.

---

## 길 1: PWA + TWA로 스토어용 APK 만들기

웹이 이미 PWA 요건(HTTPS 배포, `manifest.json`, 서비스 워커)을 갖췄다면, **Bubblewrap**으로 TWA(Trusted Web Activity) 기반 APK를 만들 수 있습니다. TWA는 주소창 없는 Chrome을 전체화면으로 띄우는 얇은 컨테이너라, 웹과 앱의 동작이 사실상 같습니다.

```bash
# Google의 Bubblewrap CLI
npm install -g @bubblewrap/cli

bubblewrap init --manifest https://your-app.example.com/manifest.json
bubblewrap build        # APK(AAB) 생성
```

TWA는 "내 도메인이 이 앱을 신뢰한다"는 증명을 위해 **Digital Asset Links**(`/.well-known/assetlinks.json`)를 사이트에 올려 둬야 합니다. 이게 맞아야 주소창 없이 전체화면으로 뜹니다. 장점은 래퍼가 가장 얇아 유지보수가 쉽다는 것, 한계는 결국 브라우저가 할 수 있는 일까지만 된다는 것입니다.

---

## 길 2: Capacitor로 WebView에 감싸기

카메라·푸시·파일 시스템 같은 **네이티브 기능**이 필요하면 Capacitor가 무난합니다. 빌드된 정적 자산을 WebView 앱에 넣고, 플러그인으로 네이티브 API를 연결합니다.

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "MyApp" "com.example.myapp" --web-dir=dist   # Vite는 dist, Next export는 out

npx cap add android        # android/ 네이티브 프로젝트 생성
npm run build              # 웹 자산 빌드
npx cap copy               # 빌드 결과를 네이티브 프로젝트로 복사
npx cap open android       # Android Studio로 열기
```

`capacitor.config` 의 `webDir`를 빌드 산출물 폴더(Vite `dist`, Next.js export `out`)로 맞추는 게 핵심입니다. 서버 기능이 필요한 Next.js라면 자산을 번들하는 대신 `server.url`로 **원격 웹을 로드**하게 설정할 수도 있습니다(앱은 껍데기, 내용은 서버에서).

---

## APK 빌드와 서명 흐름

어느 길이든 마지막은 Android 빌드입니다. Capacitor 경로라면 Android Studio(또는 Gradle)로 빌드합니다.

```bash
# android/ 디렉터리에서
./gradlew assembleDebug      # 디버그 APK (테스트용)
./gradlew assembleRelease    # 릴리스 APK/AAB (서명 필요)
```

스토어에 올리거나 외부에 배포하려면 **서명**이 필요합니다. keystore를 만들고 릴리스 빌드에 연결합니다.

```bash
keytool -genkey -v -keystore my-release.keystore \
  -alias my-key -keyalg RSA -keysize 2048 -validity 10000
```

서명 정보(`keystore`, 비밀번호, alias)는 절대 저장소에 커밋하지 말고, CI라면 시크릿으로 주입합니다. Google Play는 보통 AAB(Android App Bundle) 업로드를 요구하므로, 배포 대상이 Play 스토어면 APK 대신 `bundleRelease`로 AAB를 만듭니다. (구체적인 빌드 시간·산출물 용량은 프로젝트마다 다릅니다 — `<측정값>` 빌드 시간·APK 용량, 확인 필요.)

---

## 무엇을 고를까

요약하면 이렇습니다. **이미 PWA고, 네이티브 기능이 거의 필요 없다** → TWA(Bubblewrap)가 가장 얇고 깔끔합니다. **카메라·푸시·로컬 저장 등 디바이스 기능을 쓴다** → Capacitor로 WebView를 감싸고 플러그인을 붙입니다. **앱처럼 보이지만 콘텐츠는 항상 서버 최신이어야 한다(SSR 유지)** → 자산을 번들하지 말고 원격 URL을 로드하는 컨테이너로 구성합니다. **진짜 네이티브 수준의 성능·UX가 핵심이다** → 그때만 React Native/네이티브 재작성을 검토합니다.

기존 웹 자산을 최대한 재사용하는 게 목적이라면, 대부분 TWA나 Capacitor 선에서 끝납니다.

---

## 정리

웹을 안드로이드 APK로 내보내는 길은 크게 셋입니다. 얇게 감싸는 TWA, 네이티브 기능까지 잇는 Capacitor, 그리고 비용이 큰 네이티브 재작성. 갈림길은 "네이티브 기능이 필요한가"와 "서버 기능(SSR)을 유지해야 하는가"입니다. Vite는 정적 빌드가 기본이라 래핑이 수월하고, Next.js는 정적 export로 바꾸거나 원격 URL을 로드하는 방식으로 다뤄야 합니다. 어느 쪽이든 마지막은 Android 빌드·서명이며, keystore는 안전하게 관리하고 Play 배포는 AAB로 올리면 됩니다.

---

## 이미지 출처

Android 로봇 로고 — Wikimedia Commons (File:Android robot.svg, 원형 유지) — https://commons.wikimedia.org/wiki/File:Android_robot.svg
