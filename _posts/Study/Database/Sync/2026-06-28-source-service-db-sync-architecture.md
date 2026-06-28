---
layout: post
title: "원천 DB와 서비스 DB 분리하기: 정제된 데이터를 동기화하는 구조와 방법"
date: 2026-06-28
series: "Study"
category: "Database"
subcategory: "Sync"
tags: [database, etl, cdc, sync, data-pipeline]
description: "원천 DB와 서비스 DB를 분리한 구조에서 정제된 데이터를 동기화하는 배치 ETL, 증분 동기화, CDC, 이벤트 기반 방식을 비교하고 UPSERT·멱등성·스테이징 스왑 같은 구현 패턴을 정리합니다."
pinned: false
---

## 들어가며

서비스를 운영하다 보면 어느 시점부터 "데이터가 들어오는 곳"과 "데이터를 보여주는 곳"이 같은 DB여서는 안 되는 순간이 옵니다. 외부 시스템에서 쏟아지는 원천 데이터는 형식이 들쑥날쑥하고, 중복·결측이 섞여 있고, 트래픽이 몰리는 시간대도 서비스 조회 패턴과 다릅니다. 이 원천 데이터를 그대로 서비스 화면에 연결하면, 적재 부하가 조회 성능을 갉아먹거나 정제되지 않은 값이 사용자에게 그대로 노출되는 문제가 생깁니다.

그래서 많은 시스템이 **원천 DB(raw/source DB)**와 **서비스 DB**를 분리합니다. 원천 DB는 들어오는 데이터를 있는 그대로(또는 최소한의 가공만 거쳐) 적재하는 역할에 집중하고, 서비스 DB는 조회 성능과 화면 요구사항에 맞춰 정규화·비정규화된 스키마를 갖습니다. 이 둘 사이를 잇는 것이 **정제(클렌징·검증·변환)된 데이터를 동기화하는 파이프라인**입니다. 이 글은 왜 분리하는지, 그 사이를 어떻게 동기화하는지, 그리고 동기화 방식을 고를 때의 트레이드오프를 정리합니다.

---

## 왜 원천 DB와 서비스 DB를 나누는가

분리는 비용입니다 — 파이프라인을 만들고 운영해야 하니까요. 그런데도 많은 팀이 이 비용을 감수하는 이유는 분리하지 않았을 때의 비용이 더 크기 때문입니다.

- **수집/적재 부하 vs 조회 최적화** — 원천 데이터는 보통 쓰기가 몰리는 패턴(배치 수집, 실시간 이벤트 유입)을 갖고, 서비스는 읽기가 몰리는 패턴(사용자 조회, 대시보드)을 갖습니다. 두 패턴을 같은 테이블·같은 인덱스로 동시에 만족시키기는 어렵습니다. 적재 중에 락 경합이나 인덱스 갱신 비용이 커지면 서비스 조회 지연이 같이 늘어납니다.
- **스키마·정규화 차이** — 원천은 외부 시스템의 구조를 그대로 받아야 하므로 정규화 수준이나 컬럼 구성이 서비스 화면과 다른 경우가 많습니다. 서비스 DB는 화면 하나를 그리는 데 필요한 조인을 줄이기 위해 비정규화·집계 테이블을 두는 식으로 별도 스키마를 설계하는 편이 자연스럽습니다.
- **장애 격리** — 원천 수집 파이프라인에 장애(외부 API 지연, 포맷 변경, 배치 실패)가 나도 서비스 DB는 마지막으로 동기화된 데이터로 계속 응답할 수 있습니다. 반대로 서비스 트래픽이 몰려도 원천 적재 작업에 영향을 주지 않습니다.
- **보안·권한 분리** — 원천 DB는 내부 배치·ETL 프로세스만 접근하고, 서비스 DB는 애플리케이션 서버만 접근하도록 네트워크·권한을 좁힐 수 있습니다. 원본에만 있는 민감 필드를 서비스 DB로 동기화하는 단계에서 자연스럽게 마스킹·제외할 수도 있습니다.
- **분석/원본 보존** — 정제 과정에서 일부 정보는 버려지거나 요약됩니다. 원본을 그대로 보존해 두면, 나중에 정제 로직을 바꿔야 할 때 처음부터 다시 정제(재처리)할 수 있습니다. 서비스 DB만 있었다면 이미 가공된 데이터에서 원래 값을 복원할 수 없습니다.

---

## 큰 그림: 원천에서 서비스까지

전체 흐름은 보통 세 단계로 나뉩니다.

| 단계 | 위치 | 역할 | 특징 |
|---|---|---|---|
| 1. 수집·적재 | 원천 DB (raw) | 외부 시스템 데이터를 최소 가공으로 적재 | append 위주, 원본 구조 보존 |
| 2. 정제·변환 | ETL/ELT 처리 계층 | 클렌징·검증·변환·중복 제거 | 배치 잡 또는 스트림 처리 |
| 3. 서비스 적재 | 서비스 DB | 조회 최적화 스키마로 반영 | 읽기 위주, 비정규화·인덱스 최적화 |

아래는 이 흐름을 단순화한 다이어그램입니다. 각 단계를 클릭하면 그 단계에서 실제로 일어나는 작업을 오른쪽에서 확인할 수 있습니다.

<div class="dbsync-flow">
  <svg class="dbsync-flow__svg" id="dbsync-svg" viewBox="0 0 720 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="dbsync-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="#8fa3bf"></path>
      </marker>
    </defs>
    <line x1="150" y1="100" x2="270" y2="100" stroke="#8fa3bf" stroke-width="2" marker-end="url(#dbsync-arrow)"></line>
    <line x1="450" y1="100" x2="570" y2="100" stroke="#8fa3bf" stroke-width="2" marker-end="url(#dbsync-arrow)"></line>

    <g class="dbsync-flow__node" data-step="raw" tabindex="0">
      <rect x="20" y="55" width="130" height="90" rx="12"></rect>
      <text x="85" y="95" text-anchor="middle" class="dbsync-flow__title">원천 DB</text>
      <text x="85" y="118" text-anchor="middle" class="dbsync-flow__sub">raw 적재</text>
    </g>

    <g class="dbsync-flow__node" data-step="etl" tabindex="0">
      <rect x="270" y="55" width="180" height="90" rx="12"></rect>
      <text x="360" y="90" text-anchor="middle" class="dbsync-flow__title">정제 단계</text>
      <text x="360" y="113" text-anchor="middle" class="dbsync-flow__sub">클렌징 · 검증</text>
      <text x="360" y="132" text-anchor="middle" class="dbsync-flow__sub">변환 (ETL/ELT)</text>
    </g>

    <g class="dbsync-flow__node" data-step="service" tabindex="0">
      <rect x="570" y="55" width="130" height="90" rx="12"></rect>
      <text x="635" y="95" text-anchor="middle" class="dbsync-flow__title">서비스 DB</text>
      <text x="635" y="118" text-anchor="middle" class="dbsync-flow__sub">조회 최적화</text>
    </g>
  </svg>
  <div class="dbsync-flow__detail" id="dbsync-detail">
    <div class="dbsync-flow__detail-title" id="dbsync-detail-title">원천 DB</div>
    <p class="dbsync-flow__detail-body" id="dbsync-detail-body">외부 시스템·로그·이벤트를 최소한의 가공만 거쳐 그대로 쌓습니다. 정규화 여부보다 "나중에 무엇이든 다시 만들 수 있는가"가 설계 기준입니다.</p>
  </div>
  <p class="dbsync-flow__hint">위 도형을 클릭(또는 탭)하면 단계별 설명이 바뀝니다.</p>
</div>

<style>
.dbsync-flow { margin: 24px 0; padding: 20px; background: #eef2f7; border: 1px solid #d8e3f0; border-radius: 12px; }
.dbsync-flow__svg { width: 100%; height: auto; display: block; }
.dbsync-flow__node rect { fill: #ffffff; stroke: #2563eb; stroke-width: 2; cursor: pointer; transition: fill .15s, stroke-width .15s; }
.dbsync-flow__node.is-active rect { fill: rgba(37,99,235,.12); stroke-width: 3; }
.dbsync-flow__node:focus rect { outline: none; stroke-dasharray: 4 3; }
.dbsync-flow__title { fill: #0f1f3d; font-family: Arial, sans-serif; font-size: 17px; font-weight: 700; }
.dbsync-flow__sub { fill: #475569; font-family: Arial, sans-serif; font-size: 12px; }
.dbsync-flow__detail { margin-top: 16px; padding: 14px 16px; background: #ffffff; border: 1px solid #d8e3f0; border-radius: 8px; min-height: 70px; }
.dbsync-flow__detail-title { font-size: 14px; font-weight: 700; color: #0f1f3d; margin-bottom: 6px; }
.dbsync-flow__detail-body { font-size: 13px; color: #0f1f3d; line-height: 1.6; margin: 0; }
.dbsync-flow__hint { font-size: 13px; color: #8fa3bf; margin: 10px 0 0; }
</style>

<script>
(function () {
  var nodes = document.querySelectorAll('.dbsync-flow__node');
  var titleEl = document.getElementById('dbsync-detail-title');
  var bodyEl = document.getElementById('dbsync-detail-body');
  if (!nodes.length || !titleEl || !bodyEl) return;

  var INFO = {
    raw: {
      title: '원천 DB',
      body: '외부 시스템·로그·이벤트를 최소한의 가공만 거쳐 그대로 쌓습니다. 정규화 여부보다 "나중에 무엇이든 다시 만들 수 있는가"가 설계 기준입니다.'
    },
    etl: {
      title: '정제 단계 (ETL/ELT)',
      body: '결측·중복을 제거하고 타입·단위를 맞추고, 검증 규칙을 통과한 데이터만 다음 단계로 보냅니다. 배치 잡, CDC 스트림, 메시지 컨슈머 등 여러 구현 방식이 이 단계에 들어갑니다.'
    },
    service: {
      title: '서비스 DB',
      body: '애플리케이션이 바로 조회할 수 있는 형태로 적재합니다. 화면에 맞춘 비정규화, 조회용 인덱스, 캐시 친화적 구조가 원천 DB와 가장 크게 다른 지점입니다.'
    }
  };

  function activate(step) {
    nodes.forEach(function (n) {
      n.classList.toggle('is-active', n.getAttribute('data-step') === step);
    });
    var info = INFO[step];
    if (!info) return;
    titleEl.textContent = info.title;
    bodyEl.textContent = info.body;
  }

  nodes.forEach(function (n) {
    n.addEventListener('click', function () { activate(n.getAttribute('data-step')); });
    n.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(n.getAttribute('data-step'));
      }
    });
  });

  activate('raw');
})();
</script>

이 그림에서 중요한 것은 화살표가 한쪽으로만 흐른다는 점입니다. 서비스 DB에서 원천 DB로 데이터가 되돌아가는 경로는 없습니다(있다면 그건 보통 별도의 쓰기 경로이거나 설계 결함입니다). 서비스 DB는 항상 원천을 정제한 **읽기 전용 사본**에 가깝게 다루는 것이 운영을 단순하게 만듭니다.

---

## 동기화 방식 비교

원천에서 서비스로 데이터를 옮기는 방법은 한 가지가 아닙니다. 데이터 양, 허용 가능한 지연(latency), 원천 시스템이 변경을 얼마나 잘 알려주는지에 따라 적합한 방식이 달라집니다.

### ① 배치 ETL (전량 또는 증분, 스케줄 기반)

가장 단순한 방식입니다. 정해진 주기(예: 매일 새벽, 매시간)로 잡을 돌려 원천에서 읽고 → 정제 → 서비스 DB에 반영합니다. 매번 전체 데이터를 다시 읽는 **전량(full) 방식**과, 변경된 부분만 읽는 **증분(incremental) 방식**이 있습니다.

- **적합한 경우**: 데이터 양이 적거나, 분 단위 신선도까지는 필요 없는 도메인(통계 집계, 일일 리포트성 데이터).
- **지연**: 스케줄 주기만큼(시간~일 단위). 가장 큽니다.
- **복잡도**: 가장 낮습니다. 별도 인프라 없이 스케줄러(cron, Airflow 등)만으로 구현 가능합니다.
- **주의점**: 전량 방식은 원천이 커질수록 잡 실행 시간이 늘어나 스케줄을 압박합니다. 보통 어느 시점부터는 증분 방식으로 전환하게 됩니다.

### ② 증분 동기화 (watermark / updated_at 기준)

전량을 매번 읽는 대신, "마지막으로 동기화한 시점 이후에 바뀐 행만" 가져옵니다. 원천 테이블에 `updated_at` 같은 변경 시각 컬럼이 있다는 전제가 필요합니다.

- **적합한 경우**: 원천에 신뢰할 수 있는 변경 시각 컬럼이 있고, UPDATE/INSERT 위주(DELETE가 드문) 도메인.
- **지연**: 배치 전량 방식보다 짧고, 같은 스케줄이라도 처리량이 줄어 더 자주 돌릴 수 있습니다(분 단위까지 가능).
- **복잡도**: 중간. watermark 관리, 시계 차이(clock skew), "동기화 도중 갱신된 행"을 놓치지 않는 처리가 필요합니다.
- **주의점**: 물리적 DELETE를 따라가지 못합니다. 원천에서 행을 지우면 서비스 DB에는 그 사실이 전달되지 않으므로, 보통 소프트 삭제(`deleted_at`)와 함께 씁니다.

### ③ CDC — Change Data Capture (로그 기반)

원천 DB의 트랜잭션 로그(WAL, binlog 등)를 직접 읽어 변경 내역(INSERT/UPDATE/DELETE)을 그대로 스트림으로 받습니다. PostgreSQL의 **logical replication**, 또는 Debezium 같은 CDC 커넥터가 대표적입니다.

- **적합한 경우**: 거의 실시간 신선도가 필요하거나, DELETE까지 정확히 반영해야 하는 도메인. 원천 애플리케이션 코드를 건드리지 않고 변경을 감지할 수 있다는 점도 장점입니다.
- **지연**: 초 단위 이하까지 가능합니다(가장 짧음).
- **복잡도**: 가장 높습니다. 복제 슬롯·커넥터 운영, 스키마 변경 시 호환성, 컨슈머 측 멱등 처리가 추가로 필요합니다.
- **주의점**: 원천 DB에 복제 부하가 생기고(복제 슬롯이 밀리면 WAL이 쌓여 디스크 압박), 운영 난도가 올라갑니다. 실시간성이 꼭 필요한 부분에만 선택적으로 적용하는 경우가 많습니다.

### ④ 이벤트 기반 동기화 (메시지 큐)

원천 시스템(또는 그 앞단 애플리케이션)이 변경 발생 시 메시지 큐(Kafka, RabbitMQ 등)에 이벤트를 발행하고, 서비스 측 컨슈머가 이를 구독해 반영합니다. CDC가 "DB 로그를 읽어 이벤트화"하는 것이라면, 이벤트 기반은 "애플리케이션이 직접 이벤트를 발행"한다는 점이 다릅니다.

- **적합한 경우**: 이미 이벤트 기반 아키텍처를 쓰고 있거나, 단순 데이터 복제 이상의 비즈니스 의미(주문 생성, 상태 변경)를 같이 전달해야 할 때.
- **지연**: CDC와 비슷하게 초 단위로 짧습니다.
- **복잡도**: 높음. 큐 인프라 운영, 메시지 순서 보장, 중복 발행 대비 컨슈머 멱등 처리가 필요합니다.
- **주의점**: 애플리케이션 코드가 이벤트 발행을 빠뜨리면(예: 코드 경로 누락, 트랜잭션 롤백 시 이벤트만 나가는 이중 쓰기 문제) 원천과 서비스 DB가 조용히 어긋날 수 있습니다. Transactional Outbox 같은 패턴으로 보완합니다.

### ⑤ 머티리얼라이즈드 뷰 / 스테이징 테이블 스왑

정제 결과를 곧바로 운영 테이블에 갱신하는 대신, 별도의 스테이징 테이블에 전부 새로 적재한 뒤 **원자적으로 테이블을 교체**합니다. PostgreSQL의 머티리얼라이즈드 뷰(`REFRESH MATERIALIZED VIEW CONCURRENTLY`)도 비슷한 사상입니다.

- **적합한 경우**: 정제 로직이 복잡해 "부분적으로만 갱신된 상태"를 노출하면 안 되는 경우, 또는 전량 재계산이 필요한 집계성 데이터.
- **지연**: 배치 ETL과 비슷한 수준(스왑 직전까지는 갱신 안 됨).
- **복잡도**: 중간. 스토리지를 두 배로 쓰고(신규 테이블 + 기존 테이블), 스왑 타이밍의 트랜잭션 처리가 필요합니다.
- **주의점**: 읽기 트래픽이 스왑 순간에도 끊기지 않아야 하므로, `ALTER TABLE ... RENAME` 또는 뷰 교체처럼 짧은 락으로 끝나는 방법을 씁니다.

아래는 다섯 방식을 지연·복잡도 축으로 한눈에 비교한 그림입니다. 각 점을 클릭하면 핵심 요약이 표시됩니다.

<div class="dbsync-matrix">
  <svg class="dbsync-matrix__svg" id="dbsync-matrix-svg" viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">
    <line x1="60" y1="20" x2="60" y2="280" stroke="#8fa3bf" stroke-width="1.5"></line>
    <line x1="60" y1="280" x2="450" y2="280" stroke="#8fa3bf" stroke-width="1.5"></line>
    <text x="60" y="14" class="dbsync-matrix__axis" text-anchor="middle">지연 짧음</text>
    <text x="60" y="298" class="dbsync-matrix__axis" text-anchor="middle">지연 길음</text>
    <text x="58" y="300" class="dbsync-matrix__axis" text-anchor="end" dx="-4"></text>
    <text x="450" y="298" class="dbsync-matrix__axis" text-anchor="end">복잡도 높음 →</text>
    <text x="64" y="298" class="dbsync-matrix__axis" text-anchor="start">복잡도 낮음</text>

    <circle class="dbsync-matrix__pt" data-key="batch" cx="100" cy="260" r="10" tabindex="0"></circle>
    <text x="100" y="245" text-anchor="middle" class="dbsync-matrix__label">배치 ETL</text>

    <circle class="dbsync-matrix__pt" data-key="incremental" cx="190" cy="190" r="10" tabindex="0"></circle>
    <text x="190" y="175" text-anchor="middle" class="dbsync-matrix__label">증분 동기화</text>

    <circle class="dbsync-matrix__pt" data-key="staging" cx="230" cy="240" r="10" tabindex="0"></circle>
    <text x="230" y="225" text-anchor="middle" class="dbsync-matrix__label">스테이징 스왑</text>

    <circle class="dbsync-matrix__pt" data-key="cdc" cx="360" cy="70" r="10" tabindex="0"></circle>
    <text x="360" y="55" text-anchor="middle" class="dbsync-matrix__label">CDC</text>

    <circle class="dbsync-matrix__pt" data-key="event" cx="390" cy="90" r="10" tabindex="0"></circle>
    <text x="390" y="115" text-anchor="middle" class="dbsync-matrix__label">이벤트 기반</text>
  </svg>
  <div class="dbsync-matrix__detail" id="dbsync-matrix-detail">스테이징 테이블 스왑처럼 점을 클릭해 보세요 — 각 방식의 한 줄 요약이 여기 표시됩니다.</div>
</div>

<style>
.dbsync-matrix { margin: 24px 0; padding: 20px; background: #eef2f7; border: 1px solid #d8e3f0; border-radius: 12px; }
.dbsync-matrix__svg { width: 100%; height: auto; display: block; }
.dbsync-matrix__axis { fill: #8fa3bf; font-family: Arial, sans-serif; font-size: 11px; }
.dbsync-matrix__label { fill: #0f1f3d; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; }
.dbsync-matrix__pt { fill: #2563eb; stroke: #ffffff; stroke-width: 2; cursor: pointer; transition: r .12s; }
.dbsync-matrix__pt:hover, .dbsync-matrix__pt.is-active { r: 13; fill: #1d4ed8; }
.dbsync-matrix__pt:focus { outline: none; stroke: #0f1f3d; stroke-dasharray: 2 2; }
.dbsync-matrix__detail { margin-top: 14px; padding: 12px 14px; background: #ffffff; border: 1px solid #d8e3f0; border-radius: 8px; font-size: 13px; color: #0f1f3d; line-height: 1.6; min-height: 44px; }
</style>

<script>
(function () {
  var pts = document.querySelectorAll('.dbsync-matrix__pt');
  var detail = document.getElementById('dbsync-matrix-detail');
  if (!pts.length || !detail) return;

  var SUMMARY = {
    batch: '구현이 가장 쉽지만 지연이 가장 큽니다. 신선도 요구가 낮은 집계·리포트성 데이터에 적합합니다.',
    incremental: 'updated_at 기준으로 변경분만 가져와 배치보다 자주 돌릴 수 있지만, DELETE 추적을 위해 소프트 삭제가 필요합니다.',
    cdc: '트랜잭션 로그를 직접 읽어 초 단위 이하 지연을 달성하지만, 복제 인프라 운영 부담이 가장 큽니다.',
    event: '애플리케이션이 직접 이벤트를 발행해 비즈니스 의미까지 전달하지만, 발행 누락(이중 쓰기 문제)을 막을 패턴이 필요합니다.',
    staging: '전량을 새 테이블에 채운 뒤 원자적으로 교체해, 부분 갱신 상태를 노출하지 않습니다. 스토리지를 두 배로 씁니다.'
  };

  pts.forEach(function (p) {
    p.addEventListener('click', function () {
      pts.forEach(function (o) { o.classList.remove('is-active'); });
      p.classList.add('is-active');
      detail.textContent = SUMMARY[p.getAttribute('data-key')] || '';
    });
    p.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.dispatchEvent(new Event('click')); }
    });
  });
})();
</script>

---

## 핵심 구현 패턴

방식을 골랐다면, 실제로 안전하게 동기화를 구현하기 위한 몇 가지 패턴이 거의 항상 필요합니다.

### watermark 컬럼으로 증분 읽기

증분 동기화의 핵심은 "어디까지 읽었는지"를 기록하는 watermark입니다. 원천 테이블의 변경 시각을 기준으로, 마지막 동기화 시점 이후의 행만 읽습니다.

```sql
-- sync_state 테이블에 마지막 동기화 시각을 기록
CREATE TABLE sync_state (
    sync_name   text PRIMARY KEY,
    last_synced_at timestamptz NOT NULL
);

-- 증분 읽기: 마지막 동기화 시각 이후 변경된 행만
SELECT id, name, status, updated_at
FROM source.orders
WHERE updated_at > (SELECT last_synced_at FROM sync_state WHERE sync_name = 'orders')
ORDER BY updated_at
LIMIT 1000;
```

읽은 행을 모두 처리한 뒤에야 `sync_state`를 갱신합니다. 처리 중간에 실패하면 watermark를 갱신하지 않아, 다음 실행이 같은 구간부터 다시 시작하도록 합니다. 동기화 도중에 갱신된 행(읽기 시작과 끝 사이에 `updated_at`이 바뀐 행)을 놓치지 않으려면, 정확한 시각 대신 약간의 겹침(overlap)을 두고 다음 시작점을 "이번에 읽은 최대 `updated_at` 그대로"가 아니라 "그보다 살짝 이전"으로 잡는 방법을 흔히 씁니다.

### UPSERT — INSERT와 UPDATE를 한 번에

서비스 DB에 반영할 때, 행이 이미 있는지 미리 조회해서 분기하는 대신 PostgreSQL의 `ON CONFLICT`로 한 번에 처리합니다.

```sql
INSERT INTO service.orders (id, name, status, updated_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at
WHERE service.orders.updated_at < EXCLUDED.updated_at;
```

`WHERE` 절을 붙인 이유가 있습니다. 동기화 잡이 재시도되거나 메시지가 중복 전달될 때, **더 오래된 데이터로 최신 데이터를 덮어쓰는 사고**를 막기 위해서입니다. `EXCLUDED.updated_at`이 기존 값보다 최신일 때만 갱신하면, 순서가 뒤바뀐 채 두 번 들어와도 결과가 항상 같습니다.

### 멱등성과 중복 제거

동기화 파이프라인은 같은 데이터가 두 번 들어와도(재시도, 중복 메시지, 잡 재실행) 결과가 달라지지 않아야 합니다. 이것이 **멱등성(idempotency)**입니다.

- UPSERT의 충돌 키(위 예시의 `id`)가 멱등성의 기반입니다. 같은 `id`가 다시 들어오면 새 INSERT가 아니라 같은 행의 UPDATE로 처리됩니다.
- 메시지 큐를 쓴다면, 메시지 자체에 고유 식별자를 부여하고 처리 완료 여부를 별도로 기록해(예: `processed_messages` 테이블에 메시지 ID 저장) 같은 메시지를 두 번 적용하지 않게 막을 수 있습니다.
- 집계처럼 단순 누적(`UPDATE ... SET count = count + 1`)을 쓰면 중복 처리 시 값이 틀어집니다. 누적 대신 "현재 상태를 다시 계산해서 덮어쓰는" 방식이 멱등성과 더 잘 맞습니다.

### 스테이징 테이블에 적재 후 원자적 스왑

운영 테이블을 직접 갱신하는 대신, 동일한 구조의 스테이징 테이블에 전부 새로 채운 뒤 트랜잭션 안에서 이름을 바꿔 치환합니다.

```sql
-- 1) 스테이징 테이블에 정제된 데이터를 전량 적재 (운영 테이블과 무관하게 진행)
CREATE TABLE service.orders_staging (LIKE service.orders);
-- ... INSERT INTO service.orders_staging ...

-- 2) 짧은 트랜잭션으로 원자적 교체
BEGIN;
ALTER TABLE service.orders RENAME TO orders_old;
ALTER TABLE service.orders_staging RENAME TO orders;
COMMIT;

-- 3) 이전 테이블은 검증 후 폐기
DROP TABLE service.orders_old;
```

이 방식의 장점은 적재 작업이 아무리 오래 걸려도 운영 테이블이 그동안 그대로 유지된다는 점입니다. 읽기 트래픽은 스왑이 일어나는 짧은 순간(메타데이터 변경 수준의 락)만 영향을 받습니다. 단점은 스토리지를 일시적으로 두 배 쓰고, 증분이 아니라 항상 전량 재처리가 필요하다는 점입니다.

### 실패 시 재시도와 정합성 보장

동기화 잡은 네트워크 문제, 타임아웃, 일시적 잠금 경합으로 실패할 수 있습니다. 안전하게 재시도하려면 다음을 같이 챙깁니다.

- **트랜잭션 단위 처리** — 한 배치를 하나의 트랜잭션으로 묶어, 절반만 반영된 상태가 남지 않게 합니다.
- **watermark는 처리 완료 후에만 갱신** — 위에서 본 패턴대로, 실패하면 watermark가 그대로 남아 다음 시도가 같은 구간을 다시 읽습니다.
- **재시도는 멱등한 작업에만** — UPSERT 기반이라면 재시도해도 안전합니다. 단순 INSERT만 쓰는 구조라면 재시도 시 중복 행이 쌓이므로, 재시도 전에 먼저 멱등하게 만들어야 합니다.

---

## 운영 관점

파이프라인을 만들고 나면, 그것이 계속 올바르게 동작하는지 확인하는 운영 루틴이 필요합니다.

### 정합성 검증

원천과 서비스 DB가 실제로 일치하는지 주기적으로 확인합니다.

- **행 수 비교** — 같은 조건(예: 같은 날짜 범위)으로 원천과 서비스 DB의 행 수를 비교합니다. 차이가 나면 동기화가 누락된 구간이 있다는 신호입니다.
- **체크섬/해시 비교** — 행 수만으로는 "값이 다른데 개수는 같은" 경우를 못 잡습니다. 주요 컬럼을 해시한 값을 원천과 서비스 양쪽에서 집계해 비교하면 더 세밀하게 검증할 수 있습니다.
- **샘플링 검증** — 전체를 매번 비교하기 부담스럽다면, 무작위 또는 최근 구간 샘플을 뽑아 행 단위로 비교하는 방식도 씁니다.

### 지연과 신선도(freshness) 모니터링

"동기화가 잘 되고 있는가"는 결국 "서비스 DB의 데이터가 원천보다 얼마나 뒤처져 있는가"로 측정합니다. watermark 방식이라면 `now() - last_synced_at`을, CDC라면 복제 지연(replication lag)을 지표로 노출해 알람을 걸어 둡니다. 신선도가 갑자기 벌어지면 동기화 잡이 멈췄거나 원천 부하가 늘어 처리량이 줄었다는 신호일 수 있습니다(`<측정값>` — 정상 범위의 지연 수치는 도메인·SLA에 따라 다르므로 운영 환경에서 직접 기준을 정해야 합니다).

### 백필(backfill)

정제 로직을 바꾸거나 새 컬럼을 추가했을 때, 이미 동기화된 과거 데이터에도 같은 로직을 적용해야 하는 경우가 있습니다. 이것이 백필입니다. 평소 운영하는 증분 동기화 파이프라인과 별도로, 특정 기간을 지정해 다시 처리하는 일회성 잡을 따로 준비해 두면 이런 상황에 빠르게 대응할 수 있습니다. UPSERT 기반 구조라면 백필도 같은 적재 로직을 그대로 재사용할 수 있다는 점이 장점입니다.

### 스키마 변경 대응

원천 시스템에 컬럼이 추가·삭제·타입 변경되면 동기화 파이프라인이 영향을 받습니다. 컬럼 추가는 보통 무해하지만(매핑하지 않은 컬럼은 무시), 컬럼 삭제나 타입 변경은 파이프라인이 조용히 실패하거나 잘못된 값을 적재할 위험이 있습니다. 정제 단계에 스키마 검증(예상한 컬럼·타입인지 확인)을 넣어 두면, 원천 스키마가 바뀌었을 때 잘못된 데이터가 서비스 DB까지 흘러가기 전에 멈출 수 있습니다.

---

## 정리

원천 DB와 서비스 DB의 분리는 결국 "쓰기와 읽기, 원본과 가공본의 책임을 나눈다"는 한 가지 원칙에서 나옵니다. 그 사이를 잇는 동기화 방식은 신선도 요구와 운영 복잡도를 맞바꾸는 선택입니다.

- 신선도가 중요하지 않고 구현을 단순하게 유지하고 싶다면 **배치 ETL**.
- 원천에 변경 시각 컬럼이 있고 분 단위 신선도면 충분하다면 **증분 동기화**.
- 초 단위 신선도와 DELETE까지 정확한 반영이 필요하다면 **CDC**.
- 이미 이벤트 기반 아키텍처이거나 단순 복제 이상의 비즈니스 의미를 전달해야 한다면 **이벤트 기반 동기화**.
- 정제 로직이 복잡해 부분 갱신 상태를 노출하면 안 되거나 전량 재계산이 필요하다면 **스테이징 테이블 스왑**.

어떤 방식을 고르든 UPSERT와 멱등성은 거의 항상 필요한 안전장치입니다. 동기화는 한 번 성공하는 것이 아니라 계속 반복되는 작업이므로, 재시도해도 안전한 구조를 먼저 만들어 둔 다음 신선도를 올리는 방향으로 발전시키는 것이 안전합니다.
