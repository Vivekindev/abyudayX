# 🎯 Interview Prep

The problem list from your original site, kept in the same three tiers. Each problem lists its **key points**. A link to a full write-up in this manual means there's a complete 6-step design (requirements → estimates → API → data model → architecture → deep dives). Problems without one link to a free reference breakdown and the roadmap topics they rely on.

## The framework (use it for every question)

1. **Clarify requirements** (5 min): functional + non-functional, scale, constraints.
2. **Estimate scale** (3–5 min): QPS, storage, bandwidth, latency targets.
3. **Define APIs** (5 min): endpoints, request/response shapes.
4. **High-level design** (10–15 min): boxes and arrows, the main components.
5. **Deep dive** (15–20 min): pick 2–3 critical components (DB schema, caching, scaling strategy).
6. **Bottlenecks + trade-offs**: what breaks first, the CAP choice, cost.

Never jump straight to solutions. Show your reasoning at every step. Full lesson: [How the round works](#/item/framework) · [Estimation](#/item/estimation).

## 🟢 Tier 1: Warm-up (always asked)

| Problem | Key points | Study |
|---|---|---|
| **URL Shortener** (Bitly / TinyURL) | Base62 encoding, collision handling, DB sharding (range vs hash), caching redirects (Redis), analytics counters at scale, expiry with TTL | [Full design](#/item/url-shortener) |
| **Rate Limiter** | Token bucket, leaky bucket, fixed window, sliding window log/counter. Redis INCR + EXPIRE, distributed counters, multi-tier limits (per user, per IP, per API key) | [Full design](#/item/rate-limiter) · [LLD version](#/item/lld-rate-limiter) |
| **Key-Value Store** | Consistent hashing + virtual nodes, quorum reads/writes (NWR), LSM write path, WAL, SSTable compaction, replication, vector clocks | [Full design](#/item/key-value-store) |
| **Pastebin** | Object storage (S3), unique IDs (base62/Snowflake), expiry with TTL + background cleanup, CDN delivery, access control (public/private/password) | Same design as the [URL shortener](#/item/url-shortener) + [blob storage](#/item/blob-storage) · [Primer solution](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/pastebin/README.md) |
| **Web Crawler** | BFS URL frontier with priority queue, politeness (crawl delay, robots.txt, per-domain limits), URL dedupe (bloom filter), distributed workers, DNS caching | [Full design](#/item/web-crawler) |

## 🔵 Tier 2: Core SDE-2 (most frequently asked)

| Problem | Key points | Study |
|---|---|---|
| **Twitter / X News Feed** | Fan-out on write vs read, celebrity problem → hybrid, timeline cache (Redis sorted set), media in S3 + CDN, cursor pagination | [Full design](#/item/news-feed) |
| **WhatsApp / Chat** | WebSockets, ordering (sequence numbers), sent/delivered/read receipts, offline storage, group fan-out, E2E encryption concepts | [Full design](#/item/chat-system) |
| **YouTube / Netflix** | Upload → transcoding pipeline, chunking + adaptive bitrate (HLS/DASH), CDN, metadata DB, view counter at scale | [Full design](#/item/video-streaming) |
| **Instagram** | Photo storage (S3 + CDN), social graph (follower lists), feed generation (hybrid fan-out), hashtag search, DMs | Combine [news feed](#/item/news-feed) + [blob storage](#/item/blob-storage) + [search](#/item/search) + [chat](#/item/chat-system) |
| **Notification System** | Push (FCM/APNs), email, SMS, Kafka fan-out, priority queues, backoff retries, idempotency per notification, device tokens | [Full design](#/item/notification-system) |
| **Search Autocomplete** | Trie vs Elasticsearch completion suggester, top-K per prefix, Redis/CDN for hot prefixes, batch vs real-time updates, client debounce | [Full design](#/item/typeahead) |
| **Dropbox / Google Drive** | 4 MB chunks + dedupe, content-addressed storage (SHA-256), delta sync, conflict resolution, metadata service | [Full design](#/item/file-storage) |
| **Hotel / Ticket Booking** | Double-booking prevention, SELECT FOR UPDATE vs optimistic locking, seat holds with TTL, idempotent payment, spike handling | [Full design](#/item/ticket-booking) · [LLD version](#/item/lld-movie-booking) |

## 🟣 Tier 3: Advanced (differentiate yourself)

| Problem | Key points | Study |
|---|---|---|
| **Payment System** (Razorpay / Stripe / Visa) | Idempotency at every hop, state machine, double-entry ledger, outbox, webhooks, reconciliation, PCI tokenisation | [Full design](#/item/payment-system) · [Payments primer](#/item/payments-fundamentals) |
| **Uber / Ola** | Geo-indexing (quadtree / S2 / geohash / H3), live locations (WebSocket → Redis GEO), matching + driver locks, surge pricing, ETA, trip state | [Full design](#/item/ride-sharing) |
| **Stock Exchange / Order Book** | Matching engine with price-time priority, order types, event sourcing / journal, determinism, low latency, market-data feed | [Full design](#/item/stock-exchange) |
| **Flash Sale** (Big Billion Days) | Atomic Redis stock decrement (Lua), waiting room, async orders via Kafka, isolation, reservation expiry | [Full design](#/item/flash-sale) |
| **Distributed Job Scheduler** | Due-job polling with SKIP LOCKED, partitions + leases, idempotent jobs, retries, cron drift | [Full design](#/item/job-scheduler) |
| **Google Search** | Crawler → inverted index → TF-IDF/BM25 + PageRank → spell correction → query understanding → index sharding → freshness vs relevance | [Crawler](#/item/web-crawler) + [search internals](#/item/search) + Roadmap Phase 11 |
| **Distributed Message Queue** (Kafka-like) | Topics + partitions, consumer groups + offsets, ISR, acks 0/1/all, exactly-once (idempotent producer + transactions), compaction, retention | [Kafka deep dive](#/item/kafka) + Roadmap Phase 7 |
| **Distributed Cache** (Redis Cluster-like) | Consistent hashing + vnodes, LRU + TTL, invalidation, stampede mitigation, hot keys, RDB + AOF | [Caching patterns](#/item/caching-patterns) + [cache problems & Redis](#/item/caching-problems) · [Hello Interview breakdown](https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-cache) |
| **Google Maps** | Map tiles (quadtree tiling), routing graph, Dijkstra / A* / contraction hierarchies, real-time traffic via Kafka, location updates at scale | [Geo indexing](#/item/geo) + [data pipelines](#/item/data-pipelines) + Roadmap Phase 10 |
| **Distributed ID Generator** (Snowflake) | 64-bit layout (1 + 41 + 10 + 12), clock-skew handling, ULID / UUIDv7 alternatives | [IDs & clocks](#/item/ids-clocks) + Roadmap Phase 10 |

## How to practise a problem

1. Read the problem name only. Set a **45-minute timer**.
2. Talk through all 6 steps out loud, on paper or in Excalidraw.
3. Open the full design and note **what you missed**.
4. Turn your misses into flashcards (the topics already exist under [Flashcards](/cards/)).
5. Repeat the same problem a week later from memory.

More: [Mock interviews & revision](#/item/mocks-revision) · [Company playbook](#/page/companies) · [Resources](#/page/resources)
