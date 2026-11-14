## Other messaging systems

### RabbitMQ — exchanges (direct, fanout, topic, headers), bindings, routing keys, queues
RabbitMQ is a traditional **message broker** implementing AMQP. Producers publish to an **exchange** (never directly to a queue) with a **routing key**. **Bindings** connect exchanges to **queues** with rules, and consumers read from queues with acknowledgements. Its strength is flexible routing and per-message work distribution.

#### Intuition
A mail sorting room. You hand a letter to the sorter with a label, and the sorter decides which pigeonholes it goes into according to rules. You never put a letter into a pigeonhole yourself.

#### Must know
- A message broker. Producers publish to an **exchange**, never straight to a queue.
- The exchange routes to **queues** using **bindings** and the message's **routing key**.
- Exchange types: **direct** (exact key), **fanout** (all bound queues), **topic** (wildcard patterns), headers.
- Reliable setup: quorum queues, publisher confirms, manual acknowledgements, a prefetch limit, a dead-letter exchange.
- Strong at flexible routing, priorities and delayed retries. A message is gone once acknowledged.

#### Common mistakes
- Choosing it when you need to replay history.
- Non-replicated classic queues for data that matters.
- Letting queues grow very long, which degrades the broker.

#### How it works
```mermaid
flowchart LR
  P["Producer"] -- "routing key: order.created.in" --> X{{"Topic exchange: events"}}
  X -- "binding: order.*.in" --> Q1[["queue: india-orders"]]
  X -- "binding: order.#" --> Q2[["queue: audit"]]
  X -- "binding: payment.#" --> Q3[["queue: payments"]]
  Q1 --> C1["Consumer"]
  Q2 --> C2["Consumer"]
```

| Exchange type | Routing rule | Use |
|---|---|---|
| direct | routing key equals binding key | task queues by type |
| fanout | every bound queue gets a copy | broadcast |
| topic | wildcard match (`*` = one word, `#` = zero or more) | event routing by pattern |
| headers | match on message headers | complex attribute routing |

Reliability features: durable queues plus persistent messages, publisher confirms, manual acks, prefetch, dead-letter exchanges, TTL and delayed retries. **Quorum queues** (Raft-replicated) are the recommended HA queue type. **Streams** add a Kafka-like replayable log.

#### Example
A notification platform: services publish `notify.email.welcome`, `notify.sms.otp` and `notify.push.promo` to a topic exchange. OTP SMS goes to a high-priority quorum queue with dedicated consumers, and promo pushes go to a low-priority queue. A dead-letter exchange collects failures after 5 retries with per-message TTL backoff queues.

#### Trade-offs
Rich routing, low latency, per-message acks and priorities. But replay is limited (messages disappear once acknowledged, except with Streams), throughput is lower than Kafka at extreme scale, and queues degrade when they get very long.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Broker memory alarm, publishers blocked | huge backlogs in classic queues | more consumers, lazy/quorum queues, limit queue length |
| Messages lost on node failure | classic non-replicated queues | quorum queues + publisher confirms |
| Consumer overwhelmed | no prefetch | `basic.qos` prefetch |
| Unroutable messages silently dropped | no matching binding | `mandatory` flag / alternate exchange |

#### Cheat sheet
- Producer → exchange (direct/fanout/topic/headers) → bindings → queues → consumers.
- Quorum queues + confirms + manual acks + prefetch + DLX.
- Best for task routing. Kafka is better for replayable high-volume streams.

#### Interview questions
<details><summary>How would you route events by region and type in RabbitMQ?</summary>

Use a topic exchange with routing keys like `order.created.in` or `payment.failed.eu`. Bind each queue with patterns: the India order processor uses `order.*.in`, the audit queue uses `#`, payment alerts use `payment.failed.*`. Producers only know the exchange and key format, and new consumers add bindings without changing producers.
</details>

<details><summary>Why are quorum queues preferred over classic mirrored queues?</summary>

Quorum queues replicate with Raft, which gives predictable leader election, consistency and data safety on failures. Classic mirrored queues had complex synchronisation and could lose messages or stall during network partitions, and they were removed in RabbitMQ 4.0. Quorum queues are designed for durability-first workloads.
</details>

#### Interview angle
> "RabbitMQ is my pick when the hard part is routing: topic exchanges, quorum queues with publisher confirms, prefetch and dead-letter exchanges. For replayable high-volume streams I'd use Kafka."

#### Sources
- [AMQP 0-9-1 model explained](https://www.rabbitmq.com/tutorials/amqp-concepts) — RabbitMQ docs
- [Quorum queues](https://www.rabbitmq.com/docs/quorum-queues) — RabbitMQ docs

### RabbitMQ vs Kafka — traditional message broker vs distributed log; RabbitMQ: complex routing; Kafka: replay, high throughput
RabbitMQ and Kafka both move messages but with different models. **RabbitMQ** is a smart broker with simple consumers: it routes messages to queues, tracks per-message acks, and deletes messages once they're consumed. **Kafka** is a simple broker with smart consumers: it stores an append-only partitioned log and consumers track their own offsets, so data is retained and replayable.

#### Intuition
RabbitMQ is a post office: it sorts and delivers each letter, and once you sign for it the letter is gone. Kafka is a library archive: everything is filed in order and kept, and each reader keeps their own bookmark.

#### Must know
- **RabbitMQ**: smart broker. It routes messages, tracks each acknowledgement and **deletes on ack**.
- **Kafka**: a durable, partitioned **log**. Consumers track their own offsets, and data is retained and replayable.
- Pick RabbitMQ for task queues, complex routing, priorities and per-message delays.
- Pick Kafka for an event backbone: many independent consumers, replay, very high throughput, per-key order.
- Many companies run both.

#### Numbers to quote
- RabbitMQ handles tens of thousands of messages per second per node. A Kafka cluster handles millions.

#### Common mistakes
- Saying one is simply better than the other.
- Using Kafka for prioritised work queues or request-reply.
- Using RabbitMQ where new consumers need to read last month's events.

#### How it works
```mermaid
flowchart TB
  subgraph R["RabbitMQ: smart broker"]
    RP["Producer"] --> RX{{"Exchange + routing"}} --> RQ[["Queue"]] --> RC["Consumer acks each message, then it's deleted"]
  end
  subgraph K["Kafka: distributed log"]
    KP["Producer"] --> KT["Topic partitions (retained N days)"]
    KT --> KC1["Group A at offset 900"]
    KT --> KC2["Group B at offset 120 (replaying)"]
  end
```

| | RabbitMQ | Kafka |
|---|---|---|
| Model | queues, push, per-message ack | log, pull, offsets |
| Retention | until consumed | time/size based, replay |
| Routing | rich (exchanges, patterns, headers) | by topic/partition key |
| Ordering | per queue (single consumer) | per partition |
| Throughput | tens of thousands msg/s per node | millions msg/s per cluster |
| Priorities, delays, per-message TTL | yes | not natively |
| Typical use | task queues, RPC, complex routing | event streaming, CDC, analytics, event sourcing |

#### Example
A company uses both. **RabbitMQ** handles work jobs: PDF generation, emails, priority OTP SMS, retries with delays. **Kafka** is the event backbone: order and payment events consumed by 10 services, CDC from databases, and a data-lake feed with 30-day replay. Using Kafka for prioritised work queues, or RabbitMQ for analytics replay, would fight each tool's design.

#### Trade-offs
Pick by need: routing, priorities and simple work distribution favour RabbitMQ, while throughput, retention, replay and many independent consumers favour Kafka. Managed services (Amazon MQ, MSK, Confluent) reduce the operations burden either way.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Need to replay last week's events from RabbitMQ | consumed messages are gone | Kafka (or RabbitMQ Streams) for replayable data |
| Priority jobs stuck behind bulk in Kafka | no priorities, ordered partitions | separate topics per priority, or RabbitMQ |
| Kafka used for request/reply RPC | awkward fit | HTTP/gRPC or RabbitMQ direct reply-to |

#### Cheat sheet
- RabbitMQ: smart routing broker, delete on ack, push, priorities.
- Kafka: durable partitioned log, replay, huge throughput, many consumer groups.
- Use both: tasks in RabbitMQ or SQS, events in Kafka.

#### Interview questions
<details><summary>Which would you choose for an event-driven microservices backbone, and why?</summary>

Kafka. Events are retained and replayable (bootstrapping new services, recovering from bugs), many consumer groups read independently, throughput is high, per-key ordering comes from partitions, and it integrates with CDC and stream processing. RabbitMQ is better for task queues with complex routing, priorities and per-message TTL.
</details>

<details><summary>When is RabbitMQ the better choice over Kafka?</summary>

When you need flexible routing (topic/header exchanges), message priorities, per-message delays or TTL, request-reply patterns, low-latency delivery of individual tasks to competing workers, and you don't need long retention or replay. Typical examples are background job processing and notification dispatch.
</details>

#### Interview angle
> "Kafka is our event log, retained, replayable and fanned out to many groups. RabbitMQ or SQS handles task queues that need routing, priorities and delayed retries."

#### Sources
- [Kafka design](https://kafka.apache.org/documentation/#design) — Apache Kafka docs
- [AMQP 0-9-1 model explained](https://www.rabbitmq.com/tutorials/amqp-concepts) — RabbitMQ docs
- [Streams and super streams](https://www.rabbitmq.com/docs/streams) — RabbitMQ docs

### AWS SQS Standard — at-least-once, best-effort ordering, up to 1 MiB, infinite scale
Amazon SQS Standard is a fully managed queue with **nearly unlimited throughput**, **at-least-once delivery** (occasional duplicates) and **best-effort ordering** (messages can arrive out of order). It needs zero operations and is replicated across AZs. It's the default choice for decoupling AWS workloads.

#### Intuition
A bottomless in-tray run by someone else. You drop work in and never think about its capacity. The catch is that a sheet is occasionally handed out twice, and not always in the order it went in.

#### Must know
- A fully managed queue with **practically unlimited throughput** and nothing to operate.
- **At-least-once** delivery, so duplicates happen. **Best-effort ordering**, so order is not guaranteed.
- A received message is hidden for the **visibility timeout** and must be deleted after processing.
- Use long polling, batches of up to 10, and a DLQ through a redrive policy.
- The default choice for decoupling independent background tasks on AWS.

#### Numbers to quote
- Maximum message size 1 MiB (raised from 256 KB in 2025). Retention up to 14 days. Long poll up to 20 seconds.

#### Common mistakes
- A consumer that is not idempotent.
- A visibility timeout shorter than the processing time.
- Expecting ordering or replay from a standard queue.

#### How it works
```mermaid
sequenceDiagram
  participant P as Producer
  participant Q as SQS Standard
  participant C as Consumer
  P->>Q: SendMessage(body ≤ 1 MiB)
  C->>Q: ReceiveMessage(WaitTimeSeconds 20, MaxNumber 10)
  Q-->>C: messages (now invisible for VisibilityTimeout 60 s)
  C->>C: process
  C->>Q: DeleteMessage(receiptHandle)
  Note over Q: no delete before timeout → visible again → redelivered (receive count +1)
  Note over Q: receive count > maxReceiveCount → moved to DLQ
```

Key features: visibility timeout (extendable with `ChangeMessageVisibility`), long polling, batch send/receive/delete (10 per call), delay queues (up to 15 min), retention up to 14 days, DLQ via redrive policy, and Lambda event source mapping (with partial batch failure reporting). The payload limit is 1 MiB (raised from 256 KB in August 2025). For anything larger, store it in S3 and send a pointer (the extended client library).

#### Example
An image-processing pipeline: an S3 upload notification lands in SQS, and an ECS service autoscaled on `ApproximateAgeOfOldestMessage` resizes images. Duplicates are harmless because the output path is deterministic (`thumbs/{key}`), which makes the operation idempotent. Out-of-order processing doesn't matter. At a 10× traffic spike there's nothing to tune, SQS just absorbs it.

#### Trade-offs
Zero operations, effectively infinite scale and cheap, but duplicates and no ordering guarantee, no replay (messages are deleted after processing), a 1 MiB limit, and polling-based consumption.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Duplicate processing | at-least-once / visibility timeout too short | idempotent consumers, timeout above processing time, heartbeat extension |
| High cost from empty receives | short polling | long polling (20 s), batching |
| Lambda retries whole batch on one failure | no partial batch response | `ReportBatchItemFailures` |
| Payload too large | > 1 MiB | S3 pointer pattern |

#### Cheat sheet
- Managed, unlimited throughput, at-least-once, unordered, 14-day retention max.
- Visibility timeout + delete after processing + DLQ redrive.
- Long polling, batching, idempotent consumers. Scale on oldest message age.

#### Interview questions
<details><summary>How do you size the visibility timeout for an SQS consumer?</summary>

Set it above the maximum expected processing time (e.g. 6× the typical duration for Lambda, as AWS recommends), so a message isn't redelivered while still being processed. For variable or long jobs, extend it periodically with `ChangeMessageVisibility` (a heartbeat). Too long a timeout delays retry after a real crash, so balance the two.
</details>

<details><summary>SQS Standard vs FIFO: when would Standard be acceptable?</summary>

When consumers are idempotent and order doesn't matter (independent tasks like thumbnails, emails, webhook deliveries, analytics events), and you want unlimited throughput at lower cost. Use FIFO when per-entity order or strict deduplication matters and throughput fits its limits.
</details>

#### Interview angle
> "Independent background tasks on AWS go to SQS Standard: idempotent consumers, a long-polling batch receive, visibility timeout above processing time, a DLQ redrive policy, and scaling on the age of the oldest message."

#### Sources
- [Amazon SQS standard queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html) — Amazon SQS developer guide
- [Amazon SQS message quotas](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html) — Amazon SQS developer guide
- [Amazon SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) — Amazon SQS developer guide

### AWS SQS FIFO — exactly-once processing, ordered within message group, 300 TPS (3000 with batching)
SQS FIFO queues guarantee **ordering within a message group** and **deduplication** within a 5-minute window, giving exactly-once *processing* when consumers delete messages properly. Throughput is lower than Standard (300 messages/s per API action, 3,000 with batching, and much higher in **high-throughput mode**, scaling with the number of message groups).

#### Intuition
A bank with one queue per customer account. Each account's transactions are handled strictly in turn, but different accounts are served at different counters at the same time.

#### Must know
- Order is guaranteed **within a message group** (`MessageGroupId`).
- Duplicate sends are dropped using a **deduplication id**, within a time window.
- **Parallelism = the number of active message groups.** Group by entity (user, account, order).
- A failing message **blocks its own group** until it succeeds or goes to the DLQ.
- Throughput is lower than a standard queue.

#### Numbers to quote
- 300 messages per second per API action, or 3,000 with batching. More in high-throughput mode.
- The deduplication window is 5 minutes.

#### Common mistakes
- One `MessageGroupId` for everything, which makes the whole queue serial.
- Treating the 5-minute dedupe as a replacement for idempotent consumers.
- No DLQ, so one bad message blocks a group forever.

#### How it works
```mermaid
flowchart LR
  P["Producer"] -- "MessageGroupId = account-42, DeduplicationId = txn-9001" --> Q[["orders.fifo"]]
  Q -- "group account-42: strictly in order, one in flight at a time" --> C1["Consumer A"]
  Q -- "group account-77: in parallel with other groups" --> C2["Consumer B"]
  D["Duplicate send with same DeduplicationId within 5 min → dropped"] -.-> Q
```

- **MessageGroupId**: the ordering unit. Messages of a group are delivered in order, and the next one only after the previous is deleted (or its visibility expires).
- **MessageDeduplicationId**: explicit, or content-based (SHA-256 of the body).
- Parallelism = number of active message groups.

#### Example
Wallet transactions per user must apply in order (credit before debit). SQS FIFO with `MessageGroupId = walletId` processes each wallet's transactions sequentially, while thousands of wallets proceed in parallel. Producer retries reuse the same `MessageDeduplicationId = transactionId`, so a network-retry duplicate is dropped.

#### Trade-offs
Ordering and dedupe are built in, but throughput is limited per queue (high-throughput mode helps), a stuck message blocks its group (head-of-line blocking), dedupe only covers 5 minutes, and costs are slightly higher.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Throughput capped | few message groups / low TPS limits | more granular group ids, batching, high-throughput mode |
| One group stuck | failing message at head of group | DLQ after maxReceiveCount, fix and redrive |
| Duplicates after 5 minutes | dedupe window expired | consumer-side idempotency anyway |
| All messages processed serially | single MessageGroupId for everything | group by entity (user/order) |

#### Cheat sheet
- Order per MessageGroupId. Dedupe via DeduplicationId (5-minute window).
- Parallelism = number of groups. Watch per-queue TPS limits.
- Head-of-line blocking per group: DLQ + idempotency.

#### Interview questions
<details><summary>How do you get both ordering and parallelism with SQS FIFO?</summary>

Set `MessageGroupId` to the entity whose operations must be ordered (user, account, order). SQS keeps each group's messages in order and processes one at a time per group, while different groups are delivered to different consumers concurrently. Fine-grained group ids give more parallelism.
</details>

<details><summary>Does SQS FIFO's deduplication remove the need for idempotent consumers?</summary>

No. Dedup only applies to sends with the same deduplication id within 5 minutes. Duplicates can still arise from producer retries after 5 minutes, logically duplicate events with different ids, consumer crashes after side effects but before delete, or replays from a DLQ. Consumers should still be idempotent for critical effects.
</details>

#### Interview angle
> "When per-entity order matters on AWS, I use SQS FIFO with the entity as MessageGroupId and the transaction id as deduplication id, plus idempotent consumers and a DLQ so one bad message can't block a group forever."

#### Sources
- [Amazon SQS FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fifo-queues.html) — Amazon SQS developer guide
- [Exactly-once processing in Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues-exactly-once-processing.html) — Amazon SQS developer guide

### AWS SNS — pub/sub fan-out to SQS, Lambda, HTTP, email, SMS; no replay
Amazon SNS is a managed **pub/sub** service: publishers send a message to a **topic**, and SNS pushes copies to every subscription (SQS queues, Lambda functions, HTTP endpoints, email, SMS, mobile push). It's push-based with retries, but it **doesn't store messages for replay**, so pair it with SQS for durable per-consumer buffering.

#### Intuition
A public-address system. One announcement reaches every loudspeaker that is plugged in. It does not record the announcement for someone who was out of the room.

#### Must know
- Managed **pub/sub**: publish once to a topic, and SNS **pushes a copy to every subscription**.
- Subscribers can be SQS queues, Lambda functions, HTTP endpoints, email or SMS.
- **No storage and no replay.**
- The standard pattern is **SNS → one SQS queue per consumer**, which gives each consumer a durable buffer.
- Filter policies let a subscription receive only matching messages.

#### Common mistakes
- Subscribing a service's HTTP endpoint directly, with no queue and no DLQ.
- Expecting a new subscriber to receive past messages.
- Sending every message to every consumer when a filter policy would do.

#### How it works
```mermaid
flowchart LR
  P["Order service"] -- "Publish(OrderPlaced, attributes: country=IN, type=prepaid)" --> T(("SNS topic orders"))
  T -- "filter: country = IN" --> Q1[["SQS india-fulfilment"]]
  T --> Q2[["SQS analytics"]]
  T --> L["Lambda: send confirmation"]
  T --> H["HTTPS partner webhook (retries with backoff)"]
```

Features: **message filtering** (subscription filter policies on attributes or body), FIFO topics (ordered fan-out to SQS FIFO), delivery retries and DLQs for subscriptions, raw message delivery, encryption, and cross-account subscriptions.

#### Example
The classic **SNS → SQS fan-out**: `OrderPlaced` is published once to SNS, and four SQS queues subscribe (fulfilment, billing, notifications, analytics). Each service consumes at its own pace with its own DLQ. Filter policies send only Indian prepaid orders to a COD-reconciliation queue. Adding a new consumer is one subscription.

#### Trade-offs
Simple, scalable, serverless fan-out with filtering, but no persistence or replay (if a subscriber endpoint is down beyond the retries, the message goes to that subscription's DLQ or is lost), a message limit of 256 KB by default (up to 1 MiB with a topic setting), and push delivery to HTTP endpoints needs those endpoints to be robust.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Messages lost when consumer down | direct Lambda/HTTP subscriptions without DLQ | SNS → SQS per consumer, subscription DLQs |
| Consumers receive irrelevant messages | no filtering | subscription filter policies |
| Need to replay history | SNS doesn't retain | Kafka/Kinesis/EventBridge archive, or store events |

#### Cheat sheet
- Managed pub/sub, push fan-out to SQS, Lambda, HTTP, email, SMS, mobile.
- SNS → SQS per consumer for durability. Filter policies. Subscription DLQs.
- No replay.

#### Interview questions
<details><summary>Why combine SNS with SQS instead of subscribing services directly to SNS?</summary>

SQS gives each consumer a durable buffer: if the service is slow or down, messages wait in its queue (up to 14 days) instead of SNS retrying a push and eventually giving up. Each service controls its own consumption rate, retries, scaling and DLQ, and failures in one consumer don't affect others.
</details>

<details><summary>SNS vs EventBridge vs Kafka for domain events on AWS?</summary>

SNS is simple, high-throughput fan-out with attribute filtering and no replay. EventBridge adds content-based routing rules, schema registry, SaaS and AWS-service integrations, archive and replay, at lower throughput per bus and higher latency. Kafka/MSK gives durable partitioned logs with long retention, ordering per key, stream processing and many consumer groups. Choose based on replay, ordering and throughput needs.
</details>

#### Interview angle
> "On AWS, domain events fan out through SNS to one SQS queue per consuming service, with filter policies and DLQs. If we need replay or per-key ordering, I'd move to EventBridge archives or Kafka."

#### Sources
- [What is Amazon SNS?](https://docs.aws.amazon.com/sns/latest/dg/welcome.html) — Amazon SNS developer guide
- [Fanout to Amazon SQS queues](https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html) — Amazon SNS developer guide

### AWS Kinesis Data Streams — real-time, 1MB/s per shard, 7-day retention, replay capable
Kinesis Data Streams is AWS's managed **streaming log** (like Kafka): records go to **shards** chosen by partition key, are ordered within a shard, retained for 24 hours by default (up to 365 days), and can be read by multiple consumers and replayed. Capacity is per shard (**1 MB/s or 1,000 records/s write, 2 MB/s read**), in provisioned or on-demand mode.

#### Intuition
AWS's managed version of Kafka's idea: a set of numbered conveyor belts called shards. Items stay in order on each belt, each belt carries a fixed amount per second, and you can rewind a belt to look again.

#### Must know
- A managed streaming log. Records go to **shards** chosen by partition key.
- Order is kept **within a shard**, and data is retained and replayable.
- Each shard has a fixed capacity, so you size by shard count or use on-demand mode.
- Consumers: Lambda, the Kinesis Client Library, Firehose to S3, managed Flink.
- Watch for hot shards and for **iterator age**, which is the consumer's lag.

#### Numbers to quote
- Per shard: 1 MB/s or 1,000 records/s in, 2 MB/s out.
- Retention is 24 hours by default and can be extended to 365 days.

#### Common mistakes
- A skewed partition key that overloads one shard.
- Several consumers sharing one shard's 2 MB/s read limit with no enhanced fan-out.
- No alarm on iterator age.

#### How it works
```mermaid
flowchart LR
  P["Producers (KPL / SDK) partition key = deviceId"] --> S1["Shard 1"]
  P --> S2["Shard 2"]
  P --> S3["Shard 3"]
  S1 --> L["Lambda consumer (per shard batches)"]
  S2 --> KCL["KCL app (lease per shard, checkpoints in DynamoDB)"]
  S3 --> FH["Firehose → S3 / Redshift / OpenSearch"]
  EFO["Enhanced fan-out: dedicated 2 MB/s per consumer per shard (push)"] -.-> KCL
```

Consumers: Lambda event source mapping, KCL (Kinesis Client Library, with checkpointing via DynamoDB leases), Amazon Data Firehose (formerly Kinesis Data Firehose, managed delivery), Managed Service for Apache Flink. Resharding splits or merges shards (or use on-demand mode to auto-scale).

#### Example
A ride-hailing telemetry pipeline: 200k location updates/s at ~200 bytes each is 40 MB/s, so ~50 shards provisioned (with headroom), or on-demand mode. A Flink app computes live supply per geohash, Firehose lands raw data in S3 for analytics, and Lambda triggers geofence alerts. Retention is 7 days to replay after bugs.

#### Trade-offs
| Kinesis | Kafka/MSK |
|---|---|
| fully serverless-ish, AWS-native integrations | richer ecosystem (Connect, Streams), portable |
| shard limits (1 MB/s in), resharding management (or on-demand cost) | partitions with higher per-partition throughput |
| per-shard pricing | broker-based pricing |

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| `ProvisionedThroughputExceeded` | hot shard / too few shards | better partition keys, more shards, on-demand mode, KPL aggregation |
| Consumers throttled reading | 5 reads/s and 2 MB/s per shard shared by consumers | enhanced fan-out |
| Lambda iterator age rising | consumer too slow | parallelization factor, batch size, more shards |

#### Cheat sheet
- Managed stream: shards (1 MB/s in, 2 MB/s out), ordered per shard, replay up to 365 days.
- Consumers: Lambda, KCL, Firehose, Flink. EFO for many consumers.
- Watch hot shards and iterator age.

#### Interview questions
<details><summary>How many Kinesis shards do you need for 30 MB/s of writes with 3 consumer applications?</summary>

Writes: 30 MB/s ÷ 1 MB/s per shard = 30 shards minimum (plus ~30% headroom, so about 40, also checking the records/s limit). Reads: 3 consumers × 30 MB/s = 90 MB/s, beyond 2 MB/s × 40 shards = 80 MB/s shared, so use enhanced fan-out (each consumer gets its own 2 MB/s per shard) or add shards. On-demand mode auto-manages capacity at a different price.
</details>

<details><summary>What's Lambda "iterator age" for Kinesis and why monitor it?</summary>

It's the age of the last record processed relative to the stream head, essentially consumer lag in time. Rising iterator age means the Lambda consumer can't keep up (slow processing, errors causing retries, too little parallelism), so data is getting stale and may expire beyond retention. Alert on it and scale with the parallelization factor or more shards.
</details>

#### Interview angle
> "For AWS-native real-time streams I'd use Kinesis: shards sized at 1 MB/s writes plus headroom (or on-demand), enhanced fan-out for multiple consumers, Firehose to S3, and alerts on iterator age."

#### Sources
- [Amazon Kinesis Data Streams terminology and concepts](https://docs.aws.amazon.com/streams/latest/dev/key-concepts.html) — Amazon Kinesis Data Streams developer guide
- [Quotas and limits](https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html) — Amazon Kinesis Data Streams developer guide

### Google Cloud Pub/Sub — managed pub/sub, at-least-once, ordering per ordering-key, push or pull
Google Cloud Pub/Sub is a globally available, fully managed messaging service: publishers send to **topics**, and **subscriptions** deliver to consumers via **pull** (streaming pull) or **push** (HTTPS endpoints, Cloud Run). It auto-scales without partitions to manage, offers at-least-once delivery by default (exactly-once delivery as an option within a region), and ordering **per ordering key** when enabled.

#### Intuition
A subscription magazine service that handles all its own printing and delivery. You publish, subscribers receive, and nobody on your side manages presses or vans.

#### Must know
- Fully managed topics and subscriptions with **no partitions to plan**.
- Delivery is **at-least-once** by default.
- A subscription is **pull** (the consumer fetches) or **push** (delivered to an HTTPS endpoint).
- Ordering is available **per ordering key**, at the cost of throughput for that key.
- Dead-letter topics and `seek` (replay to a time) are built in.

#### Common mistakes
- An acknowledgement deadline shorter than the processing time, which causes redelivery.
- A push endpoint with no concurrency limit.
- Expecting global ordering.

#### How it works
```mermaid
flowchart LR
  P["Publisher (ordering_key = userId)"] --> T(("Topic: user-events"))
  T --> S1["Subscription A (pull, Dataflow)"]
  T --> S2["Subscription B (push → Cloud Run)"]
  T --> S3["Subscription C (BigQuery subscription → table)"]
  S2 -- "non-2xx → retry with backoff → dead-letter topic after N attempts" --> DLT(("dead-letter topic"))
```

Features: ack deadlines (modifiable), retry policies, dead-letter topics, filtering, seek (replay to a timestamp or snapshot within retention, up to 31 days with topic retention), BigQuery and Cloud Storage subscriptions, schemas, and exactly-once delivery (regional).

#### Example
A GCP-based fintech publishes transaction events with `ordering_key = accountId`: Dataflow computes risk features (pull), a Cloud Run push subscriber sends notifications, and a BigQuery subscription streams raw events into a table for analysts with no pipeline code. After a bug, they `seek` the notification subscription back 2 hours to resend missed messages (the handlers are idempotent).

#### Trade-offs
No capacity planning, global, rich integrations, but ordering keys reduce throughput per key and add head-of-line blocking on failures, push endpoints must handle retries and duplicates, and it's GCP-specific.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Messages redelivered repeatedly | ack deadline too short | extend deadline (client libraries auto-extend), process faster |
| Ordered key stuck | failing message blocks key | dead-letter policy, idempotent handling |
| Push endpoint overwhelmed | push rate | pull subscription or concurrency limits on Cloud Run |

#### Cheat sheet
- Topics + subscriptions (pull, push, BigQuery, GCS). At-least-once (exactly-once optional).
- Ordering per ordering_key. Seek/replay within retention.
- DLQ topics, ack deadlines, idempotent handlers.

#### Interview questions
<details><summary>How does Pub/Sub ordering work and what's the trade-off?</summary>

With message ordering enabled on the subscription and publishers setting an ordering key, messages with the same key are delivered in publish order (in the same region). The trade-off: per-key throughput is limited, a failed message must be acked or dead-lettered before later messages for that key proceed (head-of-line blocking), and publishers must handle publish failures for a key before continuing.
</details>

<details><summary>Push vs pull subscriptions: when to use each?</summary>

Push suits serverless HTTP consumers (Cloud Run, Functions) at moderate volume, with Pub/Sub managing delivery and retries. Pull (streaming pull) suits high-throughput or batch consumers (Dataflow, GKE workers) that control flow and concurrency, and environments without public HTTPS endpoints.
</details>

#### Interview angle
> "On GCP I'd use Pub/Sub: ordering keys per account where order matters, push to Cloud Run for light handlers, BigQuery subscriptions for analytics, and dead-letter topics with seek for replay."

#### Sources
- [What is Pub/Sub?](https://cloud.google.com/pubsub/docs/overview) — Google Cloud docs
- [Order messages](https://cloud.google.com/pubsub/docs/ordering) — Google Cloud Pub/Sub docs

### Apache Pulsar — tiered storage (offload to S3), geo-replication, multi-tenancy, unified queue+stream
Apache Pulsar is a distributed messaging and streaming platform that **separates serving from storage**: stateless **brokers** handle clients, and **Apache BookKeeper** "bookies" store data in segments. It supports both streaming (Kafka-like) and queuing (shared subscriptions) semantics, built-in **multi-tenancy**, **geo-replication** and **tiered storage** to S3.

#### Intuition
A restaurant where the waiters and the storeroom are separate teams. You can hire more waiters without moving any stock, and old stock is shifted to a cheap warehouse automatically.

#### Must know
- It **separates serving from storage**: stateless brokers in front, Apache BookKeeper storing the data.
- One system gives **both** queue semantics (shared subscriptions) and stream semantics.
- Multi-tenancy, geo-replication and tiered storage to object storage are built in.
- Scaling brokers does not require moving partition data.
- It has more components to run and a smaller ecosystem than Kafka.

#### Common mistakes
- Proposing it as a default with no stated reason. Name the feature you need.
- Underestimating the work of running brokers, bookies and a metadata store.
- Assuming Kafka's connector ecosystem carries over.

#### How it works
```mermaid
flowchart TB
  C["Producers / consumers"] --> B1["Broker (stateless, owns topics)"]
  C --> B2["Broker"]
  B1 --> BK["BookKeeper bookies: ledger segments replicated (write quorum)"]
  B2 --> BK
  BK -- "older segments offloaded" --> S3[("Tiered storage: S3 / GCS")]
  B1 -. "geo-replication" .-> R2["Pulsar cluster in another region"]
  ZK["Metadata store (ZooKeeper / etcd / Oxia)"] -.-> B1
```

Subscription types: **exclusive**, **failover**, **shared** (queue-like, messages distributed with per-message acks), **key_shared** (ordering per key across multiple consumers). Hierarchy: tenant → namespace → topic, with quotas and policies per namespace.

#### Example
A SaaS provider offering messaging to hundreds of customers uses Pulsar's tenants and namespaces for isolation and quotas, geo-replication between Mumbai and Singapore for DR, and tiered storage so customers can replay months of data cheaply from S3. Shared subscriptions give queue semantics for job processing on the same platform as event streams.

#### Trade-offs
Flexible (queue and stream), easy broker scaling (stateless brokers, no partition data movement), strong multi-tenancy and geo features. But more moving parts (brokers, bookies, metadata store), a smaller ecosystem and community than Kafka, and operational expertise is rarer.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Operational complexity | three components to run | managed Pulsar (StreamNative), good automation |
| Ecosystem gaps vs Kafka | fewer connectors/tools | Pulsar IO connectors, Kafka-protocol handler (KoP) |
| Noisy tenant affects others | missing quotas | namespace quotas, isolation policies |

#### Cheat sheet
- Stateless brokers + BookKeeper storage + tiered storage.
- Shared, key_shared, failover and exclusive subscriptions (queue and stream).
- Multi-tenancy, geo-replication built in. More components to operate.

#### Interview questions
<details><summary>How does Pulsar's architecture make scaling easier than Kafka's?</summary>

Brokers don't store partition data. They serve topics while data lives in BookKeeper segments spread across bookies. Adding brokers or moving topic ownership doesn't require copying partition data, and adding bookies increases storage capacity immediately for new segments. In Kafka, rebalancing partitions means copying their data between brokers.
</details>

<details><summary>When would you consider Pulsar over Kafka?</summary>

When you need strong multi-tenancy (many teams or customers with quotas and isolation), built-in geo-replication, both queue (shared subscription with per-message ack) and stream semantics in one system, or very long retention via tiered storage, and you can operate (or buy) the more complex stack. Otherwise Kafka's ecosystem usually wins.
</details>

#### Interview angle
> "I'd consider Pulsar for a multi-tenant platform needing geo-replication, tiered storage and both queue and stream semantics. For most product companies, Kafka's ecosystem and operational familiarity win."

#### Sources
- [Pulsar architecture overview](https://pulsar.apache.org/docs/next/concepts-architecture-overview/) — Apache Pulsar docs
- [Messaging concepts](https://pulsar.apache.org/docs/next/concepts-messaging/) — Apache Pulsar docs

### NATS — ultra-lightweight, sub-millisecond latency, JetStream for persistence
NATS is a lightweight, high-performance messaging system: a single small binary with **subject-based** pub/sub, request-reply and queue groups, and sub-millisecond latency. **Core NATS** is fire-and-forget (at-most-once, in-memory). **JetStream** adds persistence, at-least-once and exactly-once semantics, streams, consumers, a key-value store and an object store.

#### Intuition
A walkie-talkie channel. It is instant and needs almost no equipment, but if your set is switched off you miss the message. JetStream is the optional recorder that keeps messages for later.

#### Must know
- A very small, fast messaging system based on **subjects**, with pub/sub, request-reply and queue groups.
- **Core NATS is at-most-once** and in memory: a subscriber that is offline misses the message.
- **JetStream** adds persistence, replay and at-least-once delivery.
- Suits low-latency service-to-service messaging and edge or IoT deployments.
- For a very large replayable event log, Kafka remains the usual choice.

#### Common mistakes
- Using core NATS for events that must not be lost.
- Treating it as a drop-in Kafka replacement at massive scale.
- An open subject namespace with no permissions.

#### How it works
```mermaid
flowchart LR
  P["Publisher: orders.created.in"] --> N(("NATS cluster"))
  N -- "subscribe orders.>" --> S1["Audit service"]
  N -- "queue group 'workers' on orders.created.*" --> W1["Worker 1"]
  N -- "queue group" --> W2["Worker 2 (one of the group gets each message)"]
  R["Request: inventory.check"] --> N -- "reply inbox" --> R
  JS["JetStream stream ORDERS (file storage, replicas 3)"] -.-> N
```

Subjects use tokens with wildcards (`*` one token, `>` many). Request-reply uses auto-generated inbox subjects. Leaf nodes and superclusters connect edge, cloud and multi-region deployments.

#### Example
An IoT/edge platform: thousands of devices connect to NATS leaf nodes in factories, publish telemetry on `factory.<id>.machine.<id>.temp` subjects, and control commands use request-reply with sub-millisecond latency. JetStream streams persist telemetry for 7 days, and central services consume via durable consumers. A tiny footprint fits edge gateways where Kafka would be too heavy.

#### Trade-offs
Very simple, fast, low resource use, flexible topologies (edge to cloud). Core NATS loses messages when no subscriber is connected. JetStream is younger than Kafka for massive-scale streaming, and the ecosystem (connectors, stream processing) is smaller.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Messages missing | core NATS has no persistence | JetStream streams + durable consumers |
| Slow consumers disconnected | NATS protects server from slow subscribers | JetStream pull consumers, faster processing |
| Subject sprawl / security | open subject space | accounts, permissions, naming conventions |

#### Cheat sheet
- Core NATS: subject pub/sub, request-reply, queue groups, at-most-once, very fast.
- JetStream: persistence, replay, at-least/exactly-once, KV/object store.
- Great for edge/IoT, service communication, lightweight eventing.

#### Interview questions
<details><summary>When would you choose NATS over Kafka?</summary>

For low-latency service-to-service messaging and request-reply, edge or IoT deployments needing a tiny footprint and leaf-node topologies, simple operations, and moderate persistence needs (JetStream). Kafka is better for very high-throughput durable event logs with long retention, a large connector ecosystem and stream processing.
</details>

<details><summary>What's the difference between core NATS and JetStream delivery guarantees?</summary>

Core NATS delivers at-most-once to currently connected subscribers, with nothing stored, so disconnected subscribers miss messages. JetStream persists messages in streams (with replication), tracks consumer acknowledgements, redelivers unacked messages (at-least-once), and supports deduplication windows and double acks for exactly-once processing.
</details>

#### Interview angle
> "NATS fits low-latency request-reply and edge or IoT messaging with a tiny footprint, using JetStream when messages must persist. For the big replayable event log, I'd still pick Kafka."

#### Sources
- [What is NATS?](https://docs.nats.io/nats-concepts/what-is-nats) — NATS docs
- [JetStream](https://docs.nats.io/nats-concepts/jetstream) — NATS docs

