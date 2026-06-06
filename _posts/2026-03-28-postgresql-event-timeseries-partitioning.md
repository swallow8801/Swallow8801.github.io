---
layout: post
title: "관제 이벤트를 시계열로 저장하기: PostgreSQL 파티셔닝과 인덱스 설계"
date: 2026-03-28
series: "Study"
category: "Database"
subcategory: "PostgreSQL"
tags: [postgresql, partitioning, index, time-series]
description: "CCTV 관제에서 쏟아지는 이벤트 로그를 PostgreSQL에 시계열로 저장할 때 파티셔닝·인덱스·보존 정책을 정리합니다."
image: https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

CCTV 관제 시스템은 이벤트를 끊임없이 쏟아 냅니다. 카메라별 탐지 결과, 알람 발생·해제, 모델 상태 변화가 모두 시간 순서로 쌓입니다. 이런 데이터는 몇 가지 공통된 성격이 있습니다. 거의 **추가(append)만** 일어나고, 조회는 대부분 **최근 시간 구간**을 보며, 오래된 데이터는 언젠가 **통째로 버려야** 합니다.

이 성격을 그대로 한 테이블에 넣고 시간이 지나면, 테이블이 수천만 행으로 불어나고 오래된 데이터를 지우는 `DELETE`만으로도 운영이 흔들립니다. 이 글은 PostgreSQL 기본 기능만으로 관제 이벤트를 시계열로 저장할 때의 파티셔닝·인덱스·보존 정책을 정리합니다.

---

## 이벤트 테이블을 시간으로 파티셔닝

### 왜 파티셔닝인가

시간 범위 파티셔닝을 하면 "최근 구간 조회"가 해당 파티션만 스캔하고, "오래된 데이터 삭제"가 파티션을 통째로 떼어 내는 작업으로 바뀝니다. 큰 테이블 하나를 다루는 대신, 다루기 쉬운 작은 조각 여러 개로 나누는 셈입니다.

### 선언적 파티셔닝 예시

PostgreSQL은 `PARTITION BY RANGE`로 선언적 파티셔닝을 지원합니다. 관제 이벤트는 보통 월 단위나 일 단위로 나눕니다.

```sql
CREATE TABLE events (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    camera_id   int         NOT NULL,
    event_type  text        NOT NULL,
    acknowledged boolean    NOT NULL DEFAULT false,
    payload     jsonb,
    created_at  timestamptz NOT NULL
) PARTITION BY RANGE (created_at);

-- 월 단위 파티션
CREATE TABLE events_2026_06 PARTITION OF events
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE events_2026_07 PARTITION OF events
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
```

파티션 키(`created_at`)는 기본키·유니크 제약에 포함돼야 한다는 제약이 있으니, 위처럼 단순 `id`만 PK로 두기보다 `(id, created_at)` 형태를 함께 고려합니다. 매달 파티션을 손으로 만들기 번거로우면 `pg_partman` 확장으로 생성·정리를 자동화할 수 있습니다.

---

## 인덱스는 쿼리 패턴에 맞춰

인덱스는 많이 거는 게 아니라 **실제 조회 패턴에 맞춰** 거는 것이 핵심입니다. 관제 이벤트에서 자주 나오는 패턴은 세 가지 정도입니다.

```sql
-- 1) 시간 순서로 쌓이는 컬럼엔 BRIN이 작고 효율적
CREATE INDEX ON events USING brin (created_at);

-- 2) "특정 카메라의 최근 이벤트" 조회
CREATE INDEX ON events (camera_id, created_at DESC);

-- 3) 미확인 알람만 빠르게 — 부분 인덱스
CREATE INDEX ON events (created_at)
    WHERE event_type = 'alarm' AND acknowledged = false;
```

`created_at`처럼 값이 시간 순으로 들어오는 컬럼은 BRIN 인덱스가 B-tree보다 훨씬 작은 크기로 범위 조회를 커버합니다. 반대로 "특정 카메라" 같은 선택적 조회는 복합 B-tree가 맞습니다. 미확인 알람만 보는 화면이 있다면 부분 인덱스로 인덱스 자체를 작게 유지할 수 있습니다.

---

## 보존 정책: 오래된 파티션은 통째로 버린다

파티셔닝의 가장 큰 이점이 여기서 나옵니다. 보존 기간이 지난 데이터를 `DELETE`로 지우면 행마다 정리 비용과 VACUUM 부담이 생기지만, 파티션 단위면 메타데이터만 건드리면 끝입니다.

```sql
-- 운영 테이블에서 분리(빠르고 잠금 영향이 작음)
ALTER TABLE events DETACH PARTITION events_2026_06;

-- 분리한 파티션은 아카이브로 옮기거나 통째로 폐기
DROP TABLE events_2026_06;
```

바로 지우기 부담스러우면 `DETACH` 후 콜드 스토리지로 덤프해 두고 나중에 `DROP`하는 흐름이 안전합니다. 보존 기간(예: 최근 N개월)은 운영·법적 요건에 맞춰 정하고, 파티션 생성·폐기를 스케줄로 돌려 두면 손이 거의 가지 않습니다.

---

## 언제 전용 시계열 DB로 갈까

PostgreSQL 기본 파티셔닝만으로도 상당한 쓰기·조회량을 감당합니다. 다만 초당 쓰기량이 크게 늘고, 다운샘플링·연속 집계(continuous aggregate)·자동 보존 같은 시계열 전용 기능이 필요해지면 `TimescaleDB`(하이퍼테이블) 같은 확장이나 전용 시계열 DB를 검토할 단계입니다.

판단 기준은 추정이 아니라 측정이어야 합니다. 현재 시스템의 초당 이벤트 수, 피크 시 쓰기 지연, 최대 동시 조회량을 먼저 재고(`<측정값>` — 운영 환경에서 직접 측정 필요), 기본 파티셔닝으로 충분한지부터 확인한 뒤 옮길지 정하는 게 순서입니다.

---

## 정리

관제 이벤트처럼 추가 위주에 시간 범위로 조회하고 오래되면 버리는 데이터는, 시간 범위 파티셔닝이 잘 맞습니다. 조회 패턴에 맞춰 BRIN·복합·부분 인덱스를 골라 걸고, 보존은 파티션 `DETACH`/`DROP`으로 가볍게 처리합니다. 전용 시계열 DB로의 이동은 분위기가 아니라 측정값을 보고 결정하는 것이 안전합니다.

---

## 이미지 출처

사진: Taylor Vick / Unsplash (Unsplash License) — https://unsplash.com/photos/cable-network-M5tzZtFCOfs
