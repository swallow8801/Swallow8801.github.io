---
layout: post
title: "RTSP · WebRTC · HLS: 실시간 스트리밍 프로토콜을 고르기 전에 알아야 할 것들"
date: 2026-02-25
series: "Study"
category: "Backend"
subcategory: "Streaming"
tags: [rtsp, webrtc, hls, streaming, protocol, video]
description: "RTSP·WebRTC·HLS가 각각 어떤 상황에서 쓰이는지, 관제 시스템 영상 파이프라인에서 이 세 프로토콜을 어떻게 조합할지 정리합니다."
image: https://images.unsplash.com/photo-1606814540563-5c02d62fd409?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

CCTV AI 관제 시스템을 처음 만들 때 흔히 생기는 혼란이 있습니다. "카메라가 RTSP로 영상을 주는데, 브라우저 화면에서 바로 보여주려면 어떻게 해야 하지?" 알고 보면 RTSP는 브라우저가 직접 재생할 수 없습니다. 그렇다고 WebRTC를 쓰면 레이턴시는 줄지만 서버 구성이 복잡해집니다. HLS는 표준 플레이어로 쉽게 붙지만 수초의 지연이 따라옵니다.

이 글은 세 프로토콜이 각각 어떤 문제를 해결하기 위한 것인지, 그리고 관제 시스템 파이프라인에서 어떻게 조합해서 쓰는지를 정리합니다.

---

## 세 프로토콜이 다루는 계층이 다르다

먼저 이 셋이 "경쟁 관계"라기보다 **각자 다른 역할**을 담당한다는 점을 이해하면 선택이 훨씬 쉬워집니다.

| 프로토콜 | 원래 목적 | 전송 계층 | 브라우저 직접 재생 |
|----------|-----------|-----------|-------------------|
| RTSP | IP 카메라 → 서버 수신 | TCP/UDP | ❌ (플러그인 또는 변환 필요) |
| HLS | 서버 → 다수 클라이언트 배포 | HTTP(TCP) | ✅ (모든 모던 브라우저) |
| WebRTC | 초저지연 양방향 스트리밍 | UDP (DTLS/SRTP) | ✅ (W3C 표준) |

RTSP(Real Time Streaming Protocol)는 카메라와 미디어 서버 사이의 언어입니다. 대부분의 IP CCTV 카메라는 `rtsp://192.168.1.100:554/stream` 형태의 URL로 H.264/H.265 스트림을 내보냅니다. 브라우저는 이 URL을 직접 열 수 없으므로, 서버 쪽에서 RTSP를 받아서 다른 형태로 변환해야 합니다.

HLS(HTTP Live Streaming)는 애플이 만든, HTTP로 동영상을 배포하는 방식입니다. 영상을 짧은 `.ts` 세그먼트(보통 2~10초)로 자르고 `.m3u8` 인덱스 파일로 묶어서 일반 HTTP 서버로 제공합니다. 브라우저는 `.m3u8`을 주기적으로 폴링해 새 세그먼트를 이어 재생합니다. 세그먼트 길이와 폴링 주기만큼 지연이 생기므로, 기본 설정이라면 5~30초 정도의 레이턴시가 발생합니다.

WebRTC(Web Real-Time Communication)는 브라우저와 서버(또는 브라우저와 브라우저) 사이에 UDP 기반 연결을 직접 맺어 1초 미만의 지연으로 영상을 주고받습니다. 관제 화면에서 "실시간으로 보이는" 느낌을 주려면 WebRTC가 가장 적합하지만, STUN/TURN 서버, SDP 협상, ICE 처리 등 연결 수립 과정이 HLS보다 훨씬 복잡합니다.

---

## 관제 파이프라인에서 셋이 함께 쓰이는 이유

현실적인 관제 시스템에서는 세 프로토콜을 단계별로 조합하는 구조가 많습니다.

```
IP 카메라
  └─[RTSP]→ 미디어 서버 (FFmpeg / MediaMTX / Kurento 등)
                ├─[HLS]→  브라우저 (일반 재생, 5~30s 지연 허용 시)
                └─[WebRTC]→ 브라우저 (실시간 확인, <1s 지연 필요 시)
```

미디어 서버가 RTSP를 받아서 HLS와 WebRTC로 각각 내보내는 구조입니다. HLS는 "녹화 다시보기"나 "지연이 허용되는 일반 모니터링"에, WebRTC는 "실시간 확인이 필요한 관제 화면"에 쓰는 식으로 역할을 나눌 수 있습니다.

### FFmpeg으로 RTSP → HLS 변환

가장 단순한 구성입니다. FFmpeg 하나로 카메라 스트림을 받아 HLS 세그먼트를 뽑아냅니다.

```bash
ffmpeg -i rtsp://camera_ip:554/stream \
  -c:v copy \           # 재인코딩 없이 스트림 복사 (CPU 절감)
  -hls_time 2 \         # 세그먼트 길이 2초
  -hls_list_size 5 \    # .m3u8에 최근 5개 세그먼트만 유지
  -hls_flags delete_segments \   # 오래된 세그먼트 자동 삭제
  /tmp/stream/output.m3u8
```

이 구성의 실제 엔드투엔드 지연은 `hls_time × 2` + 플레이어 버퍼 정도로 예상할 수 있지만, 실측값은 환경마다 다릅니다(`<측정값>` — 세그먼트 길이 2초 기준 실측 지연).

### MediaMTX로 RTSP → WebRTC 변환

[MediaMTX](https://github.com/bluenviron/mediamtx)는 RTSP를 받아서 WebRTC로 중계하는 구성을 설정 파일 몇 줄로 만들 수 있어, Go로 작성된 단일 바이너리라 배포도 간단합니다.

```yaml
# mediamtx.yml (핵심 설정만)
paths:
  cam1:
    source: rtsp://camera_ip:554/stream

webrtc: yes
webrtcAddress: :8889
```

설정 후 브라우저에서 `http://server:8889/cam1` 을 열면 WebRTC 스트림이 재생됩니다. 내부적으로 SDP 협상과 ICE 처리를 MediaMTX가 담당하므로, 직접 WebRTC 스택을 구현하는 것보다 진입 장벽이 훨씬 낮습니다.

---

## 프로토콜 선택 기준 정리

| 상황 | 권장 선택 | 이유 |
|------|-----------|------|
| 카메라 스트림 수신 | RTSP | 거의 모든 IP 카메라의 기본 출력 |
| 브라우저 일반 재생 (지연 무관) | HLS | 서버 부하 낮고 구현 단순 |
| 브라우저 실시간 확인 (1초 이하) | WebRTC | 지연 최소화, 단 서버 구성 복잡 |
| 대규모 동시 시청 | HLS | CDN 연계로 수평 확장 용이 |
| P2P 양방향 통신 | WebRTC | 원래 목적에 가장 적합 |

관제 시스템 특성상 "서버가 카메라에서 RTSP로 받고, 관제 화면에 WebRTC로 뿌리되, 녹화본 재생은 HLS"를 쓰는 구성이 많습니다. 동시 접속 카메라 수가 늘수록 미디어 서버의 트랜스코딩·중계 부하가 올라가므로, 실측 CPU/메모리 사용량을 기준으로 카메라 수 한계를 파악해 두는 것이 중요합니다(`<측정값>` — 미디어 서버 1대 기준 동시 처리 가능한 RTSP 스트림 수).

---

## 정리

RTSP는 카메라에서 서버로 받는 입력 프로토콜, HLS는 HTTP로 다수에게 뿌리는 출력 프로토콜, WebRTC는 초저지연이 필요할 때 쓰는 출력 프로토콜입니다. 관제 시스템에서는 이 세 가지를 경쟁 관계가 아니라 파이프라인의 각 단계 역할로 이해하는 것이 핵심입니다. FFmpeg 하나로도 RTSP→HLS 변환은 가능하고, MediaMTX 같은 미디어 서버를 두면 RTSP→WebRTC 중계를 설정 파일 수준으로 처리할 수 있습니다. 지연 요구사항과 동시 접속 규모를 기준으로 구성을 선택하고, 실측 부하 데이터를 쌓아두는 것이 다음 단계입니다.

---

## 이미지 출처

사진: Compare Fibre / Unsplash (Unsplash License) — https://unsplash.com/photos/blue-and-white-light-in-dark-room-INNsF0Zz_kQ
