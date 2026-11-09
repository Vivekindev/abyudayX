# 🏢 Company playbook — Bangalore SDE-2 (2026)

> **Treat everything here as "commonly reported", not official.** Interview loops change by team and over time. Before each interview, read 5–10 **recent** experiences for your exact company and role (see the "Where to read real experiences" section at the bottom), and ask the recruiter what the rounds are. They usually tell you.

## What the jump from 11 LPA looks like

Moving from ~11 LPA to the 20–40 LPA band in Bangalore usually means moving to an SDE-2 / Associate / Senior Software Engineer title at a bank technology centre or a product company. Rough, **self-reported** total-compensation bands (base + bonus + stock) for roughly 3–6 years of experience:

| Company type | Titles at roughly SDE-2 level | Rough TC band (verify) |
|---|---|---|
| Investment banks (JPMorgan, Morgan Stanley, Goldman Sachs, Deutsche, Barclays) | Associate / Senior Associate / Analyst-Associate (GS) | ~20–40 LPA |
| Payment networks and fintech (Visa, Mastercard, PayPal, PhonePe, Razorpay, Juspay) | Senior SE / SDE-2 | ~25–45 LPA |
| Product companies (Flipkart, Swiggy, Walmart Global Tech, Atlassian, Uber, Microsoft, Amazon) | SDE-2 / SWE-II | ~30–60+ LPA (top end at Uber, Atlassian, Google) |

Check current numbers on **levels.fyi** (filter: Bangalore), **AmbitionBox** and **LeetCode compensation threads**. Negotiate with competing offers: the biggest jumps come from having 2–3 offers at the same time.

## Typical loops and what to emphasise

### JPMorgan Chase (Associate / SDE-2 equivalent)
- **Reported loop:** online assessment (HackerRank DSA) → 2–3 technical rounds (DSA, **core Java + Spring Boot**, microservices, SQL) → a design round (HLD and/or LLD) → hiring manager / HR.
- **Emphasise:** Java depth (collections internals, concurrency, JVM/GC basics), Spring Boot, REST and microservices patterns ([Day 30](#/item/microservices), [Day 31](#/item/resilience)), Kafka ([Day 27](#/item/kafka)), SQL and transactions ([Day 8](#/item/sql-transactions)), and LLD ([parking lot](#/item/lld-parking-lot), [ATM](#/item/lld-atm)).
- **Design questions to practise:** [payment system](#/item/payment-system), [notification system](#/item/notification-system), [rate limiter](#/item/rate-limiter), [ledger](#/item/ledger-reconciliation), trade capture / [job scheduler](#/item/job-scheduler).

### Morgan Stanley (Associate)
- **Reported loop:** online test → DSA rounds → **deep core Java** (multithreading, memory model, collections) → a design round → managerial / HR.
- **Emphasise:** [Java concurrency](#/item/lld-approach-concurrency), [design patterns](#/item/design-patterns), [low-latency concepts](#/item/low-latency-trading), [Kafka](#/item/kafka), and [caching](#/item/caching-patterns).
- **Design questions to practise:** [stock exchange / order book](#/item/stock-exchange), market-data fan-out, [LRU cache](#/item/lld-lru-cache), a trade reconciliation pipeline.

### Visa (Senior Software Engineer / SDE-2)
- **Reported loop:** online assessment → 2 DSA/coding rounds → a system design round (HLD, sometimes LLD) → hiring manager.
- **Emphasise:** how card payments work end to end ([Day 43](#/item/payments-fundamentals)), high availability and [DR](#/item/observability-reliability), [idempotency](#/item/api-design), [security and tokenization](#/item/auth-security), [rate limiting](#/item/rate-limiter), and [caching](#/item/caching-problems).
- **Design questions to practise:** [payment authorization system](#/item/payment-system), [rate limiter](#/item/rate-limiter), fraud detection (stream processing, [Day 39](#/item/data-pipelines)), [notification system](#/item/notification-system), [URL shortener](#/item/url-shortener).

### Goldman Sachs (Analyst / Associate)
- **Reported loop:** HackerRank OA → CoderPad DSA rounds → a "superday" of several back-to-back rounds including design and behavioural.
- **Emphasise:** strong DSA, design fundamentals, and the [fintech module](#/item/payments-fundamentals).

### Product companies (Flipkart, Swiggy, PhonePe, Razorpay, Uber, Walmart)
- **Reported loop:** DSA rounds → a **machine-coding round** (90–120 min, working code) → HLD → hiring manager / culture.
- **Emphasise:** the [machine-coding method](#/item/lld-approach-concurrency), plus [flash sale](#/item/flash-sale), [ride sharing](#/item/ride-sharing), [news feed](#/item/news-feed), [chat](#/item/chat-system) and [ticket booking](#/item/ticket-booking).

## Behavioural round (don't skip it)

Prepare 6–8 **STAR stories** (Situation, Task, Action, Result) from your current job: a production incident you handled, a design you led, a disagreement with a senior, a deadline you met by cutting scope, mentoring someone, a mistake you learned from. Banks weigh "ownership" and "risk awareness" heavily.

## Where to read real experiences

- **LeetCode Discuss**: Interview Experience section, search "<company> SDE 2 Bangalore" and sort by most recent.
- **GeeksforGeeks interview experiences**: search "<company> interview experience".
- **Glassdoor** and **AmbitionBox**: interview questions and process per company.
- **Reddit**: r/developersIndia (search the company name).
- **Blind / Fishbowl**: compensation and team insights.
- **LinkedIn**: message people 1–2 levels above you on your target team, and ask about the loop politely and briefly.
