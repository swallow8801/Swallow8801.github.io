---
layout: post
title: "AI 서버에서 자주 쓰는 Linux 포트, SSH, GPU 확인 명령어"
date: 2026-05-19
series: "DevNotes"
category: "Snippets"
subcategory: "Linux"
tags: [linux, ssh, nvidia-smi, port]
description: "원격 AI 서버를 다룰 때 자주 확인하는 포트, SSH, GPU 상태 명령어를 짧게 정리합니다."
pinned: false
---

## 열린 포트 확인

서버에서 특정 포트가 열려 있는지 확인할 때는 `ss`를 자주 씁니다.

```bash
ss -tulpn
ss -tulpn | grep 8000
```

프로세스 이름과 PID까지 같이 보면 어떤 서비스가 포트를 잡고 있는지 빠르게 확인할 수 있습니다.

## SSH 접속 확인

SSH 포트가 기본 22번이 아니면 접속 시 포트를 지정합니다.

```bash
ssh -p 2222 user@server-host
```

방화벽이 켜져 있다면 서버 보안 그룹, OS 방화벽, 실제 프로세스 listen 상태를 순서대로 확인해야 합니다.

## GPU 상태 확인

AI 서버에서는 `nvidia-smi`를 가장 먼저 확인합니다.

```bash
nvidia-smi
nvidia-smi -l 1
```

메모리 사용량, GPU utilization, 실행 중인 프로세스를 보면 모델이 정상적으로 올라갔는지 확인할 수 있습니다.

## 로그 확인

Docker로 띄운 추론 서버는 컨테이너 로그를 바로 확인합니다.

```bash
docker ps
docker logs -f container_name
```

장애가 났을 때는 포트, 프로세스, GPU, 로그 순서로 보면 원인을 빠르게 좁힐 수 있습니다.

## 프로세스와 포트 연결해서 보기

포트만 열려 있는지 보는 것보다 어떤 프로세스가 열었는지 함께 확인해야 합니다. 같은 포트를 이전 프로세스가 잡고 있으면 새 서버가 뜨지 않을 수 있습니다.

```bash
sudo lsof -i :8000
ps -fp <PID>
```

서비스가 systemd로 떠 있다면 journal 로그도 함께 봅니다.

```bash
sudo systemctl status my-ai-server
sudo journalctl -u my-ai-server -f
```

## GPU 프로세스 정리

모델 서버가 비정상 종료되면 GPU 메모리가 남아 있는 것처럼 보일 때가 있습니다. `nvidia-smi`에서 PID를 확인하고 실제 프로세스가 살아 있는지 봅니다.

```bash
ps -fp <PID>
kill <PID>
```

강제 종료는 마지막 수단으로 둡니다. 가능하면 서비스 종료 명령이나 Docker stop으로 정리하는 것이 로그와 상태 관리에 좋습니다.

## 원격 작업 습관

원격 서버에서는 작은 명령 하나가 운영에 영향을 줄 수 있습니다. 작업 전에 현재 경로, 접속한 서버, 실행 중인 컨테이너를 확인하는 습관이 좋습니다.

```bash
hostname
pwd
docker ps
```

특히 개발 서버와 운영 서버가 비슷하게 생겼다면 프롬프트에 서버 이름을 표시해두는 것도 실수를 줄이는 데 도움이 됩니다.
