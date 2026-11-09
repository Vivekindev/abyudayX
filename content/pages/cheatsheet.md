# ⚡ One-page cheat sheet

Read this the night before. Every line links back to the day it came from.

## The interview flow

**Requirements (5 min) → Estimates (3–5) → API (5) → Data model (5) → High-level design (10–15) → Deep dives (15–20) → 30-second wrap-up.** See [Day 1](#/item/framework).

Always ask: *"Consistency or availability, which matters more here?"*

## Numbers ([Day 2](#/item/estimation))

| | |
|---|---|
| 1 day | ≈ 10⁵ seconds |
| QPS | DAU × actions/day ÷ 10⁵ (peak ×2–3) |
| Memory / SSD / cross-continent | 100 ns / 100 µs / 150–250 ms |
| Redis node | ~100K ops/s |
| Postgres node | ~5–20K simple queries/s |
| Kafka broker | ~100K–1M msgs/s |
| 99.9% / 99.99% | 8.8 h / 53 min downtime a year |

## Which database? ([Day 10](#/item/choosing-db))

| Data | Pick |
|---|---|
| Users, orders, bookings, **money** | PostgreSQL / MySQL (ACID) |
| Chat messages, feeds, activity logs | Cassandra / ScyllaDB / DynamoDB |
| Cache, sessions, counters, leaderboards, locks | Redis |
| Full-text search, autocomplete | Elasticsearch / OpenSearch |
| Files, images, video | S3 + CDN |
| Analytics | ClickHouse / BigQuery / Snowflake |
| Event bus / streams | Kafka |

## Fixes for the usual problems

| Problem | Reach for |
|---|---|
| Read-heavy, slow DB | Cache-aside (Redis) + read replicas ([Day 15](#/item/caching-patterns)) |
| Too much data / write load for one node | Shard by a high-cardinality key + consistent hashing ([Day 12](#/item/sharding)) |
| Hot key / celebrity | Key salting, local cache, hybrid fan-out ([Day 35](#/item/news-feed)) |
| Cache stampede | Single-flight lock, stale-while-revalidate, TTL jitter ([Day 16](#/item/caching-problems)) |
| Slow work in the request path | Queue + workers ([Day 26](#/item/queues-delivery)) |
| Duplicates from retries | Idempotency keys + unique constraints ([Day 4](#/item/api-design)) |
| Cross-service transaction | Saga + outbox ([Day 25](#/item/distributed-transactions)) |
| Double booking / overselling | `SELECT … FOR UPDATE` / conditional update / Redis Lua ([Day 8](#/item/sql-transactions)) |
| Ordering per entity | Kafka partition key = entity ID ([Day 27](#/item/kafka)) |
| Slow dependency | Timeout + retry with backoff and jitter + circuit breaker + bulkhead ([Day 31](#/item/resilience)) |
| Abuse / overload | Token-bucket rate limiter in Redis ([Day 20](#/item/rate-limiter)) |
| Real-time push | SSE (one way) / WebSockets + registry + pub/sub ([Day 5](#/item/realtime)) |
| Nearby search | Geohash / H3 cells, Redis GEO ([Day 37](#/item/geo)) |
| "Have I seen this?" at scale | Bloom filter ([Day 38](#/item/probabilistic)) |

## Consistency in one breath ([Day 22](#/item/cap-consistency))

During a partition, pick C or A. Otherwise, pick latency or consistency (PACELC). Quorum: **R + W > N**. Wallet balance → strong. Like count → eventual. Your own profile → read-your-writes.

## Money rules ([Day 43](#/item/payments-fundamentals), [Day 44](#/item/ledger-reconciliation))

Integers in paise · idempotency at every hop · a timeout means UNKNOWN, not FAILED · double-entry, append-only ledger · outbox for events · daily reconciliation · tokenize card numbers.

## LLD ([Day 50](#/item/oop-solid)–[52](#/item/lld-approach-concurrency))

SOLID · Strategy (swappable algorithms) · State (lifecycles: ATM, order) · Observer (notifications) · Factory · Builder · Decorator · Adapter · Chain of Responsibility · thread-safe singleton (holder idiom) · `ConcurrentHashMap.computeIfAbsent` · `AtomicBoolean.compareAndSet` for "only one wins".
