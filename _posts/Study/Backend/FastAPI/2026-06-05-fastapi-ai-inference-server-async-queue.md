---
layout: post
title: "FastAPI로 AI 추론 서버 설계하기: 동기 호출의 한계에서 비동기·큐 구조로"
date: 2026-06-05
series: "Study"
category: "Backend"
subcategory: "FastAPI"
tags: [fastapi, async, inference, queue]
description: "FastAPI로 AI 추론 API를 만들 때 동기 처리에서 마주치는 한계를 짚고, 비동기·큐 기반 구조로 옮겨가는 설계를 정리합니다."
image: https://images.unsplash.com/photo-1754039984985-ef607d80113a?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

FastAPI로 추론 API를 처음 만들 때는 보통 엔드포인트 하나에 모델 호출을 그대로 넣는 것으로 시작합니다. 데모나 PoC 단계에서는 이것으로 충분히 동작합니다. 문제는 동시에 여러 요청이 들어오기 시작하면서 드러납니다. 응답이 느려지고, 어느 순간부터 큐가 꽉 찬 듯 요청이 밀립니다.

이 글은 그 과정을 "동기 엔드포인트 → 비동기 처리 → 큐 기반 워커 분리"로 옮겨가며, 각 단계에서 무엇이 막히고 무엇을 얻고 무엇을 더 신경 써야 하는지를 정리합니다.

---

## 동기 엔드포인트의 한계

가장 단순한 형태는 이렇습니다.

```python
@app.post("/predict")
def predict(file: UploadFile = File(...)):
    image = decode(file.file.read())
    result = model.infer(image)        # GPU 추론, 수십~수백 ms
    return result
```

이 코드의 문제는 추론이 끝날 때까지 해당 요청을 처리하는 워커가 **그대로 묶인다**는 점입니다. 동시에 들어온 다른 요청은 그 워커가 풀릴 때까지 기다려야 합니다. 워커 수를 늘리면 어느 정도 완화되지만, 추론이 GPU 자원을 쓰는 한 결국 GPU 안에서 다시 직렬화됩니다. "GPU 하나에 모델 하나"인 환경에서는 워커를 늘려도 처리량이 비례해서 늘지 않고, 오히려 같은 모델을 여러 번 메모리에 올려 GPU 메모리만 잡아먹는 경우도 있습니다.

---

## 비동기로 옮기기: 일단 이벤트 루프부터 풀어주기

`async def`로 바꾸는 것만으로는 부족합니다. 추론 자체가 CPU/GPU를 점유하는 블로킹 작업이라, 그대로 `await model.infer(image)`라고 쓰면 이벤트 루프가 멈추는 건 똑같습니다. 추론을 별도 스레드로 넘겨야 이벤트 루프가 다른 요청(헬스체크, 다른 엔드포인트)을 계속 처리할 수 있습니다.

```python
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    raw = await file.read()
    image = decode(raw)
    result = await asyncio.to_thread(model.infer, image)
    return result
```

이렇게 하면 "API 서버가 다른 요청에 응답하지 못하는" 문제는 풀립니다. 다만 이것만으로는 **GPU 자체의 처리량**이 늘어나지는 않습니다. 동시에 들어온 추론 요청은 여전히 GPU 안에서 순서를 기다립니다.

---

## 큐로 추론을 분리하기

근본적인 해법은 "요청을 받는 계층"과 "GPU에서 추론을 수행하는 계층"을 분리하는 것입니다. API는 작업을 큐에 넣고 결과를 기다리거나 작업 ID를 돌려주고, 모델을 로드해 둔 별도 워커가 큐에서 꺼내 배치로 처리합니다.

```python
# API 계층: 큐에 작업만 넣고 결과를 기다린다
job_id = await queue.enqueue(image_bytes)
result = await queue.wait_result(job_id, timeout=settings.infer_timeout)
```

```python
# 워커 계층: 모델은 한 번만 로드해 두고, 모아서 배치로 추론한다
batch = queue.pull_batch(max_size=8, max_wait_ms=50)
results = model.infer_batch([item.image for item in batch])
queue.push_results(batch, results)
```

이 구조로 얻는 것은 크게 세 가지입니다.

| 얻는 것 | 설명 |
| --- | --- |
| 배치 처리 | 짧은 시간 안에 모인 요청을 묶어 한 번의 forward로 처리 → GPU 활용률 상승 |
| 독립적 확장 | API(I/O 중심)와 워커(GPU 중심)를 따로 늘릴 수 있음 |
| 배압(backpressure) 제어 | 큐 길이·대기 시간을 기준으로 "지금은 못 받는다"를 명시적으로 판단 가능 |

배치 크기와 대기 시간은 트레이드오프 관계입니다. 배치를 키우면 처리량(throughput)은 늘지만 개별 요청의 지연(latency)도 함께 늘어납니다. 실시간성이 중요한 요청과 그렇지 않은 요청이 섞여 있다면 큐 자체를 분리하는 것도 방법입니다(`<측정값>` — 배치 크기별 처리량·지연 변화는 모델·하드웨어마다 달라 직접 측정해 채워 넣으세요).

---

## 운영에서 신경 쓸 점

- **헬스체크의 범위를 넓히기**: "API 프로세스가 떠 있다"는 "추론이 되고 있다"를 보장하지 않습니다. 워커가 모델 로드에 성공했는지, 큐가 정상적으로 소비되고 있는지까지 헬스체크 범위에 넣어야 실제 장애를 놓치지 않습니다.
- **큐 길이 제한**: 큐를 무제한으로 두면 부하가 몰릴 때 대기 시간만 한없이 늘어나고, 결국 클라이언트 타임아웃으로 이어집니다. 큐 길이나 대기 시간에 상한을 두고, 넘으면 명시적으로 "지금은 처리 불가"를 응답하는 편이 사용자 입장에서도 낫습니다.
- **타임아웃 일관성**: 클라이언트, API, 큐, 워커 각 구간의 타임아웃을 맞추지 않으면 "API는 포기했는데 워커는 계속 돌고 있는" 상황이 생깁니다.

---

## 정리

동기 엔드포인트는 프로토타입에는 충분하지만, 동시 요청이 늘면 추론 시간만큼 워커가 묶이는 구조적 한계를 만납니다. `asyncio.to_thread`로 이벤트 루프를 풀어주는 것은 첫걸음일 뿐이고, 진짜 처리량의 변화는 "API 계층"과 "GPU 추론 계층"을 큐로 분리하고 배치 처리를 도입할 때 옵니다. 이 구조로 옮긴 뒤에는 배치 크기·큐 길이·헬스체크 범위를 운영 지표로 삼아 계속 조정해 나가는 것이 핵심입니다.

---

## 이미지 출처

사진: Jakub Żerdzicki / Unsplash (Unsplash License) — https://unsplash.com/photos/code-displayed-on-computer-screens-v-jFS1AsHXo
