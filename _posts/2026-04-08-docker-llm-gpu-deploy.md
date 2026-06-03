---
layout: post
title: "LLM 앱 Docker 배포 — GPU 환경 세팅과 비용 최적화"
date: 2026-04-08
series: "Study"
category: "DevOps"
tags: [docker, aws, gpu, llm, deployment, cost-optimization]
description: "GPU 인스턴스 위에 LLM 서빙 컨테이너를 올리고 비용을 절반으로 줄이기까지. 실제 AWS 세팅 파일 공유."
pinned: false
read_time: 11
---

## 배포 목표

자체 호스팅 LLM(Llama 3, Mistral 등)을 AWS에 배포하면서 비용을 최소화하는 방법입니다. Spot Instance + 자동 스케일링으로 On-Demand 대비 70% 비용을 절감했습니다.

---

## 1. Docker 이미지 준비

```dockerfile
# GPU 지원 베이스 이미지
FROM nvidia/cuda:12.1-cudnn8-runtime-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# NVIDIA GPU 메모리 최적화
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV CUDA_VISIBLE_DEVICES=0

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```
# requirements.txt
fastapi==0.104.0
uvicorn[standard]==0.24.0
torch==2.1.0+cu121
transformers==4.35.0
accelerate==0.24.0
bitsandbytes==0.41.1   # 4-bit 양자화
```

---

## 2. 4-bit 양자화로 메모리 절반 절감

```python
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
import torch

# 4-bit 양자화 설정 — VRAM 사용량 약 50% 감소
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_use_double_quant=True,
)

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B-Instruct",
    quantization_config=bnb_config,
    device_map="auto",
)
```

| 모델 | 원본 VRAM | 4-bit 양자화 VRAM |
|---|---|---|
| Llama 3 8B | ~16GB | ~5GB |
| Llama 3 70B | ~140GB | ~40GB |
| Mistral 7B | ~14GB | ~4.5GB |

---

## 3. AWS 배포 — EC2 + Spot Instance

```yaml
# docker-compose.yml (GPU 지원)
version: '3.8'
services:
  llm-server:
    build: .
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    ports:
      - "8000:8000"
    environment:
      - MODEL_NAME=meta-llama/Meta-Llama-3-8B-Instruct
      - MAX_CONCURRENT_REQUESTS=4
    volumes:
      - model-cache:/root/.cache/huggingface
    restart: unless-stopped

volumes:
  model-cache:
```

---

## 4. Spot Instance 활용 (비용 절감의 핵심)

```bash
# AWS CLI로 Spot Instance 요청
aws ec2 run-instances \
  --image-id ami-0xxxxxxxxxxxxx \
  --instance-type g4dn.xlarge \
  --instance-market-options '{
    "MarketType": "spot",
    "SpotOptions": {
      "MaxPrice": "0.5",
      "SpotInstanceType": "persistent",
      "InstanceInterruptionBehavior": "stop"
    }
  }' \
  --iam-instance-profile Name=EC2-LLM-Profile \
  --user-data file://startup.sh
```

```bash
# startup.sh — 인스턴스 시작 시 자동 실행
#!/bin/bash
cd /home/ubuntu/llm-server
docker-compose up -d

# Spot 중단 신호 감지 후 Graceful Shutdown
while true; do
  if curl -s http://169.254.169.254/latest/meta-data/spot/termination-time 2>&1 | grep -q 'T'; then
    docker-compose stop --timeout 30
    break
  fi
  sleep 5
done
```

---

## 5. 비용 비교

| 인스턴스 타입 | On-Demand 시간당 | Spot 시간당 | 절감율 |
|---|---|---|---|
| g4dn.xlarge (T4 GPU) | $0.526 | **$0.158** | 70% |
| g4dn.2xlarge | $1.052 | **$0.316** | 70% |
| g5.xlarge (A10G GPU) | $1.006 | **$0.302** | 70% |

월 720시간 g4dn.xlarge 기준:
- On-Demand: $379/월
- Spot: **$114/월** (약 $265 절감)
