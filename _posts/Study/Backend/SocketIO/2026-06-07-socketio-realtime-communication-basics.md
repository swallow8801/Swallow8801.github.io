---
layout: post
title: "Socket.IO로 실시간 통신 만들기: 폴링이 아니라 이벤트로 주고받는 구조"
date: 2026-06-07
series: "Study"
category: "Backend"
subcategory: "SocketIO"
tags: [socketio, websocket, realtime, event-driven]
description: "Socket.IO가 무엇이고 HTTP 폴링과 어떻게 다른지, 그리고 실시간 관제 화면에서 이벤트 기반 통신 구조를 어떻게 설계하는지 정리합니다."
image: https://images.unsplash.com/photo-1691435828932-911a7801adfb?auto=format&fit=crop&w=1200&q=80
pinned: false
---

## 들어가며

관제 대시보드를 만들다 보면 결국 "화면이 새로고침 없이 계속 바뀌어야 한다"는 요구를 만납니다. 카메라가 끊기면 즉시 표시되어야 하고, 알람이 발생하면 몇 초 안에 화면에 떠야 합니다. 그런데 일반적인 HTTP 요청-응답 구조는 "클라이언트가 물어봐야 서버가 답하는" 구조라, 이런 실시간성과는 출발선이 다릅니다.

이 글은 Socket.IO가 정확히 어떤 문제를 풀기 위한 도구인지, HTTP 폴링과 무엇이 다른지, 그리고 실시간 관제 화면에 적용할 때 통신을 어떤 식으로 구조화하면 좋을지를 정리합니다.

---

## 폴링이 아니라 "먼저 보내준다"

가장 단순하게 실시간처럼 보이게 만드는 방법은 폴링(polling)입니다. 클라이언트가 몇 초마다 "새로운 거 있어?"라고 계속 물어보는 방식이죠.

```js
// 폴링: 클라이언트가 계속 물어본다
setInterval(async () => {
  const res = await fetch('/api/alarms/latest');
  const data = await res.json();
  renderAlarms(data);
}, 3000);
```

이 방식은 구현은 쉽지만 두 가지가 늘 함께 따라옵니다. 새로운 일이 없어도 요청은 계속 나가서 서버 부하가 쌓이고, 반대로 실제 이벤트는 폴링 주기 사이에 끼어 있으면 최대 주기만큼 늦게 도착합니다. 카메라 수가 늘고 화면이 여러 개로 늘어날수록 이 비효율은 화면 수와 폴링 빈도에 비례해 그대로 곱해집니다.

Socket.IO는 이 구조를 뒤집습니다. 클라이언트와 서버 사이에 지속적인 연결을 맺어 두고, **이벤트가 생긴 쪽이 먼저 상대에게 보내는** 방식입니다. 내부적으로는 WebSocket을 우선 사용하고, 네트워크 환경이나 프록시 때문에 WebSocket이 막히면 HTTP 롱폴링으로 자동 전환하는 fallback도 갖추고 있어, "이론적으로는 WebSocket을 쓰지만 현실에는 막히는 환경이 있다"는 문제를 라이브러리 차원에서 흡수해 줍니다.

---

## 이벤트 기반으로 생각을 바꾸기: emit과 on

Socket.IO를 쓰기 시작하면 가장 먼저 익숙해져야 하는 것은 "요청을 보낸다"가 아니라 **"이벤트를 주고받는다"** 는 사고방식입니다. 서버와 클라이언트 모두 `emit`으로 이벤트를 보내고 `on`으로 받습니다.

```js
// 서버 (Node.js)
io.on('connection', (socket) => {
  console.log('클라이언트 연결:', socket.id);

  socket.on('subscribe:zone', (zoneId) => {
    socket.join(`zone:${zoneId}`);   // 구역 단위로 룸에 참여
  });
});

// 카메라 알람이 발생하면 해당 구역 룸에만 보낸다
function broadcastAlarm(zoneId, alarm) {
  io.to(`zone:${zoneId}`).emit('alarm:new', alarm);
}
```

```js
// 클라이언트
socket.emit('subscribe:zone', currentZoneId);

socket.on('alarm:new', (alarm) => {
  prependAlarmToList(alarm);
  playSound(alarm.priority);
});
```

여기서 `join`으로 만든 **룸(room)** 은 관제 시스템에 특히 잘 맞는 개념입니다. "구역 A를 보고 있는 화면에는 구역 A의 알람만, 구역 B를 보고 있는 화면에는 구역 B의 알람만" 보내는 식으로 메시지를 좁혀 보낼 수 있어, 모든 클라이언트에 모든 이벤트를 뿌리고 클라이언트에서 걸러내는 것보다 네트워크와 클라이언트 부하를 함께 줄일 수 있습니다. 네임스페이스(namespace)는 한 단계 더 위에서 "카메라 영상 채널과 알람 채널을 아예 다른 통신 경로로 분리하는" 식으로 용도 자체를 나눌 때 사용합니다.

---

## 연결은 끊긴다는 전제로 설계하기

Socket.IO를 처음 적용할 때 가장 자주 놓치는 부분은 "연결되어 있는 동안"의 설계이지, "연결이 끊겼다 다시 붙는 동안"의 설계가 아닙니다. 그런데 실제 운영에서는 후자가 훨씬 자주 일어납니다. 네트워크가 잠깐 끊기거나, 사용자가 노트북을 덮었다 열거나, 서버를 재배포하는 순간에도 연결은 끊깁니다.

Socket.IO 클라이언트는 기본적으로 재연결을 자동으로 시도하지만, "재연결되었을 때 무엇을 다시 해야 하는가"는 직접 챙겨야 하는 부분입니다.

```js
socket.on('connect', () => {
  // 재연결 시에도 항상 다시 실행되어야 하는 절차
  socket.emit('subscribe:zone', currentZoneId);
  fetchMissedAlarmsSince(lastSeenTimestamp);   // 끊긴 동안 놓친 데이터는 별도로 보강
});

socket.on('disconnect', (reason) => {
  showConnectionBanner('연결이 끊겼습니다. 재연결을 시도합니다…');
});
```

여기서 중요한 것은 "재연결되면 알아서 다시 받겠지"가 아니라, **끊겨 있던 동안의 공백을 메우는 절차**를 별도로 두는 것입니다. Socket.IO는 끊긴 동안 발생한 이벤트를 보관해 두지 않으므로, 재연결 시점에 "마지막으로 본 시각 이후의 데이터"를 REST API 등으로 따로 가져오는 보강 로직이 필요합니다. 이 부분을 빼먹으면 화면은 "연결됨"으로 표시되지만 실제로는 끊겨 있던 동안의 알람이 통째로 비어 있는, 뒤늦게야 발견되는 결함으로 남습니다.

---

## 서버를 늘릴 때 마주치는 것: 어댑터

서버가 한 대일 때는 `io.emit`이나 `io.to(room).emit`이 그대로 잘 동작합니다. 문제는 트래픽이 늘어 서버를 여러 대로 늘릴 때 시작됩니다. A 서버에 연결된 클라이언트와 B 서버에 연결된 클라이언트는 기본적으로 서로의 존재를 모르기 때문에, A 서버가 받은 이벤트를 B 서버의 클라이언트에는 전달할 방법이 없습니다.

이를 해결하는 표준적인 방법은 Redis 같은 메시지 브로커로 서버 간 이벤트를 중계하는 **어댑터(adapter)** 를 두는 것입니다.

```js
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
// 이제 io.to(room).emit()은 서버가 여러 대여도 모든 서버의 해당 룸 클라이언트에 전달된다
```

| 구성 | 적합한 상황 | 신경 쓸 점 |
| --- | --- | --- |
| 단일 서버 | 동시 접속이 적고 트래픽이 예측 가능 | 가장 단순하지만 수평 확장이 안 됨 |
| Redis 어댑터 | 서버를 여러 대로 늘려야 함 | Redis 자체가 새로운 장애 지점이 됨 |
| 메시지 큐 연동 | 알람·이벤트가 다른 백엔드 시스템과도 연결돼야 함 | 지연·순서 보장 정책을 큐 쪽과 맞춰야 함 |

서버 한 대로 버틸 수 있는 동시 접속 규모와, 어댑터를 도입했을 때의 지연 변화는 실제 부하 테스트로 확인해야 하는 영역입니다(`<측정값>` — 동시 접속 수별 메시지 전달 지연, 어댑터 도입 전후 비교).

---

## 정리

Socket.IO 도입의 핵심은 (1) 폴링처럼 "물어보는" 구조를 "이벤트가 생긴 쪽이 먼저 알리는" 구조로 바꾼다는 점을 이해하고, (2) 룸·네임스페이스로 메시지를 필요한 대상에게만 좁혀 보내며, (3) "연결되어 있는 동안"이 아니라 "끊겼다 재연결되는 순간"을 기준으로 공백 보강 로직을 설계하고, (4) 서버를 늘릴 시점에는 Redis 어댑터 같은 서버 간 중계 수단이 필요해진다는 것을 미리 알아 두는 데 있습니다. 동시 접속 규모와 지연은 실제 운영 환경에서 측정한 값을 기준으로 판단하세요.

---

## 이미지 출처

사진: Albert Stoynov / Unsplash (Unsplash License) — https://unsplash.com/photos/a-close-up-of-a-network-with-wires-connected-to-it-dyUp7WPu5q4
