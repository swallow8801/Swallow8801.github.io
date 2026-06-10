---
layout: post
title: "FFmpeg 자주 쓰는 명령어 모음: 영상 처리 실무 레퍼런스"
date: 2026-01-18
series: "DevNotes"
category: "Snippets"
subcategory: "FFmpeg"
tags: [ffmpeg, video, rtsp, hls, encoding, cli]
description: "RTSP 읽기, HLS 변환, 프레임 추출, 코덱 변환 등 AI 관제 영상 파이프라인에서 자주 쓰는 FFmpeg 명령어를 상황별로 정리합니다."
image: https://images.unsplash.com/photo-1743090660977-babf07732432?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 상황

AI 관제 영상 파이프라인을 다루다 보면 RTSP 수신, HLS 변환, 프레임 추출, 코덱 변환 등 FFmpeg 명령어를 자주 찾게 됩니다. 자주 쓰는 패턴을 상황별로 모아 둔 레퍼런스입니다.

---

## 코드

### RTSP 스트림 읽기 및 정보 확인

```bash
# 스트림 정보 확인 (코덱, 해상도, FPS 등)
ffprobe -v quiet -print_format json -show_streams rtsp://camera_ip:554/stream

# 스트림이 열리는지 테스트 (5초 후 종료)
ffmpeg -i rtsp://camera_ip:554/stream -t 5 -f null -
```

### RTSP → HLS 변환

```bash
# 기본 변환 (재인코딩 없이 스트림 복사)
ffmpeg -i rtsp://camera_ip:554/stream \
  -c:v copy \
  -hls_time 2 \
  -hls_list_size 5 \
  -hls_flags delete_segments \
  /var/www/stream/output.m3u8

# 해상도 다운스케일 + 재인코딩 (대역폭 절감 시)
ffmpeg -i rtsp://camera_ip:554/stream \
  -vf scale=1280:720 \
  -c:v libx264 -preset fast -crf 23 \
  -hls_time 2 -hls_list_size 5 \
  -hls_flags delete_segments+append_list \
  /var/www/stream/output.m3u8
```

### 프레임 추출

```bash
# 1초당 1프레임 추출 (jpg)
ffmpeg -i input.mp4 -vf fps=1 frames/frame_%04d.jpg

# 특정 시간 범위만 추출 (시작 10초, 30초간)
ffmpeg -ss 00:00:10 -i input.mp4 -t 30 -vf fps=1 frames/frame_%04d.jpg

# RTSP에서 직접 프레임 추출 (연결 안정화 옵션 포함)
ffmpeg -rtsp_transport tcp -i rtsp://camera_ip:554/stream \
  -vf fps=1 -q:v 2 frames/frame_%04d.jpg
```

### 코덱 변환

```bash
# H.264 → H.265 (파일 용량 절감, 처리 시간 더 걸림)
ffmpeg -i input.mp4 -c:v libx265 -crf 28 -preset medium output_h265.mp4

# MP4 → 오디오 제거 + 재패키징
ffmpeg -i input.mp4 -an -c:v copy output_noaudio.mp4

# 특정 구간 자르기 (재인코딩 없이, 빠름)
ffmpeg -ss 00:01:00 -to 00:02:30 -i input.mp4 -c copy output_clip.mp4
```

### 연속 이미지 → 영상 합성

```bash
# 프레임 시퀀스로 MP4 생성 (AI 추론 결과 시각화 영상 만들 때)
ffmpeg -framerate 25 -i frames/frame_%04d.jpg \
  -c:v libx264 -pix_fmt yuv420p output.mp4
```

### 스트림 안정성 관련 옵션

```bash
# RTSP TCP 강제 (UDP가 막히거나 패킷 손실이 많을 때)
ffmpeg -rtsp_transport tcp -i rtsp://camera_ip:554/stream ...

# 재연결 옵션 (스트림이 끊겼을 때 자동 재시도, bash 루프로 감싸기)
while true; do
  ffmpeg -rtsp_transport tcp \
    -i rtsp://camera_ip:554/stream \
    -c:v copy -hls_time 2 -hls_list_size 5 \
    -hls_flags delete_segments \
    /var/www/stream/output.m3u8
  echo "FFmpeg 종료. 5초 후 재시작..."
  sleep 5
done
```

---

## 메모

- `-c:v copy`는 재인코딩 없이 스트림을 그대로 복사한다. CPU 부하가 거의 없고 화질 손실도 없지만, 입력 코덱과 출력 컨테이너 포맷이 호환되어야 한다 (H.264 → MP4/HLS는 대부분 OK).
- `-crf` 값은 낮을수록 고화질·대용량이다. libx264 기준 18~28이 실용 범위, 23이 기본값.
- RTSP는 기본적으로 UDP를 사용한다. 방화벽·NAT 환경에서는 `-rtsp_transport tcp`를 먼저 시도하는 것이 좋다.
- FFmpeg 프로세스가 죽으면 HLS 세그먼트 갱신이 멈추므로, 실운영에서는 `systemd` 서비스나 `supervisord`로 감시하거나 위의 재시작 루프를 사용한다.
- GPU 가속: NVIDIA GPU가 있다면 `-c:v h264_nvenc`(인코딩) / `-hwaccel cuda`(디코딩)으로 CPU 부하를 크게 줄일 수 있다. 환경에 따라 드라이버·CUDA 버전 확인이 필요하다.

---

## 이미지 출처

사진: ANOOF C (@anoofc) / Unsplash (Unsplash License) — https://unsplash.com/photos/code-is-displayed-on-a-black-screen-HnfsOiBpzU0
