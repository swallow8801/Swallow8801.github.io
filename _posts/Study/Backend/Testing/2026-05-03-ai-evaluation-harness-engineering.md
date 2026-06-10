---
layout: post
title: "Harness Engineering: AI 모델 평가 파이프라인을 체계적으로 설계하는 방법"
date: 2026-05-03
series: "Study"
category: "Backend"
subcategory: "Testing"
tags: [harness, evaluation, testing, ai, pipeline]
description: "AI 모델 평가를 코드로 자동화하는 Evaluation Harness의 개념과 설계 원칙을 소개합니다."
image: https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

모델 성능을 "한번 돌려봤더니 좋았다"는 감으로 판단하는 건 위험합니다. 같은 모델인데 평가할 때마다 숫자가 다르거나, 누군가 재현해 보면 결과가 맞지 않는 경우가 생깁니다. **Harness Engineering**은 이 문제를 해결하기 위한 접근입니다.

테스트 하네스(Test Harness)는 소프트웨어 엔지니어링에서 오래된 개념인데, AI 모델 평가에서도 똑같이 필요합니다. 이 글에서는 Evaluation Harness가 무엇인지, 어떻게 설계하고 쓰는지를 정리합니다.

---

## Harness란 무엇인가

원래 "하네스(Harness)"는 안전벨트나 마구(馬具)를 뜻합니다. 소프트웨어에서 테스트 하네스는 **테스트 대상(SUT, System Under Test) 주변을 감싸는 실행 틀**입니다. 모델에 입력을 넣고, 출력을 받아, 정해진 기준으로 채점하는 파이프라인 전체를 자동화한 것입니다.

AI 모델 평가 맥락에서 하네스는 보통 이런 요소로 구성됩니다.

```
[데이터셋] → [전처리] → [모델 호출] → [출력 후처리] → [메트릭 계산] → [결과 저장]
```

잘 알려진 오픈소스 하네스로는 EleutherAI의 [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness), UK AISI의 [Inspect](https://github.com/UKGovernmentBEIS/inspect_ai) 등이 있습니다.

---

## 왜 직접 만들어야 할 때가 있는가

범용 하네스가 있는데도 커스텀 하네스를 만드는 이유는 크게 세 가지입니다.

**1) 도메인 특화 태스크**  
제조업 불량 검출, 의료 이미지 판독처럼 공개 벤치마크에 없는 태스크를 평가해야 할 때입니다. 기존 하네스는 텍스트 중심이라 Vision AI나 스트리밍 추론 평가에 맞지 않을 수 있습니다.

**2) 배포 환경 통합**  
로컬 모델 로딩이 아니라 실제 서비스 엔드포인트를 평가 대상으로 삼을 때입니다. 범용 하네스 구조와 맞지 않아 직접 작성하는 것이 더 간단합니다.

**3) 재현성 완전 제어**  
랜덤 시드, 데이터 샘플링, 타임스탬프까지 완전히 통제하고 싶을 때 커스텀이 낫습니다.

---

## 커스텀 하네스 설계 원칙

### 태스크·데이터셋·메트릭을 분리한다

한 파일에 다 때려넣으면 재사용이 어렵습니다. 각자 인터페이스를 정의합니다.

```python
# tasks/base.py
class EvalTask:
    def load_dataset(self) -> list[dict]: ...
    def build_prompt(self, item: dict) -> str: ...
    def score(self, item: dict, prediction: str) -> float: ...
```

```python
# metrics/accuracy.py
def exact_match(pred: str, gold: str) -> float:
    return float(pred.strip() == gold.strip())
```

### 모든 실행을 기록한다

어느 모델, 어느 데이터, 어느 시각에 돌렸는지를 남깁니다.

```python
import json, datetime, subprocess

result = {
    "task": task_name,
    "model": model_id,
    "timestamp": datetime.datetime.utcnow().isoformat(),
    "num_samples": len(dataset),
    "metrics": {"accuracy": "<측정값>"},  # 직접 실측 후 채우기
    "git_commit": subprocess.check_output(
        ["git", "rev-parse", "HEAD"]
    ).decode().strip(),
}
with open(f"results/{run_id}.json", "w") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
```

### 배치 처리와 재시작을 지원한다

대규모 평가는 중간에 실패할 수 있습니다. 이미 평가한 샘플을 skip하는 체크포인팅을 넣어두면 재시작이 편합니다.

```python
def run_eval(task, model, output_dir):
    done_ids = load_checkpoint(output_dir)
    for item in task.load_dataset():
        if item["id"] in done_ids:
            continue
        pred = model.generate(task.build_prompt(item))
        score = task.score(item, pred)
        save_result(output_dir, item["id"], pred, score)
```

---

## 메트릭 설계 시 주의점

- **자동 메트릭과 인간 평가를 섞는다.** Exact Match나 F1처럼 자동 계산되는 메트릭만으로는 부족한 태스크가 많습니다. 샘플 기반 인간 평가 파이프라인도 하네스 안에 포함시킵니다.
- **메트릭을 버전 관리한다.** 스코어링 로직이 바뀌면 이전 결과와 비교가 불가합니다. 메트릭 버전을 결과 JSON에 함께 기록합니다.
- **신뢰 구간을 함께 저장한다.** 샘플 크기가 작으면 숫자 하나로 결론 내기 어렵습니다. 부트스트랩 신뢰 구간을 계산해두면 변동성을 파악하기 좋습니다.

---

## 정리

Harness Engineering의 핵심은 **평가를 재현 가능한 소프트웨어로 만드는 것**입니다. 태스크·데이터·메트릭을 분리하고, 실행 결과를 빠짐없이 기록하고, 재시작을 지원하는 구조를 갖추면 "어제 숫자랑 오늘 숫자가 다른" 상황을 피할 수 있습니다. 범용 하네스(lm-evaluation-harness, Inspect)로 시작하되, 도메인 특화 요구가 생기면 위 원칙을 바탕으로 직접 설계하는 것이 자연스러운 흐름입니다.

---

## 이미지 출처

사진: James Harrison / Unsplash (Unsplash License) — https://unsplash.com/photos/vpOeXr5wmR4
