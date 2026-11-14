## Serverless & infrastructure as code

### Lambda cold starts — JVM/Python faster than Java; reduce with provisioned concurrency, SnapStart
A **cold start** happens when Lambda must create a new execution environment: download your code, start the runtime, and run your initialisation code before handling the request. It adds latency, typically ~100–500 ms for Node/Python/Go and **1–6 s for Java/.NET** without optimisation. Warm environments are reused for subsequent requests.

#### Intuition
Starting a car on a cold morning. The first trip needs the engine to warm up. Trips straight after it start instantly, because the engine is still warm.

#### Must know
- A **cold start** is the extra delay when Lambda must create a new environment: load the code, start the runtime, run your init code.
- After that the environment is **reused warm** for later requests.
- Java and .NET are the slowest to start. Node, Python and Go are much faster.
- **Provisioned concurrency** keeps environments pre-warmed, for an hourly cost.
- **SnapStart** restores from a snapshot taken after init, which cuts start time sharply.

#### Numbers to quote
- Cold start is roughly 100–500 ms for Node, Python and Go, and 1–6 seconds for Java or .NET with no optimisation.

#### Common mistakes
- A heavy framework and a large package on a latency-critical function.
- Generating unique ids or random seeds during init with SnapStart, so every copy shares them.
- Paying for provisioned concurrency all day when traffic is only busy for a few hours.

#### How it works
```mermaid
sequenceDiagram
  participant R as Request
  participant L as Lambda service
  participant E as Execution environment
  R->>L: invoke (no idle environment available)
  L->>E: create micro-VM (Firecracker), download code/image
  E->>E: start runtime (JVM / Node / Python)
  E->>E: run init code (static blocks, DI container, SDK clients)
  E->>E: handler executes
  E-->>R: response (cold: init + handler)
  R->>E: next invoke → handler only (warm, ms)
```

Cold start factors: runtime choice, package or image size, init work (frameworks like Spring scanning classpaths), VPC configuration (much improved since Hyperplane ENIs), and memory setting (more memory means more CPU, so faster init).

Mitigations:
| Technique | Effect |
|---|---|
| **Provisioned concurrency** | pre-initialised environments, no cold start (costs per hour) |
| **SnapStart** (Java, Python, .NET) | snapshot after init, restore from snapshot (~10× faster) |
| Lighter runtimes/frameworks | Node/Python/Go, Quarkus/Micronaut, GraalVM native |
| Smaller packages, lazy init | less to load and initialise |
| More memory | faster CPU during init |

#### Example
A Java Spring Boot Lambda behind API Gateway had 4.5 s cold starts, and p99 latency for users was terrible after quiet periods. Enabling SnapStart (with priming of SDK clients in a `beforeCheckpoint` hook) cut cold starts to ~400 ms. For the checkout path, provisioned concurrency of 20 during business hours (auto-scaled by schedule) removed cold starts entirely.

#### Trade-offs
Provisioned concurrency removes cold starts but costs money continuously. SnapStart is cheap but needs care with uniqueness (random seeds, connections restored from a snapshot). Runtime changes may require rewrites.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Multi-second first-request latency | Java + heavy framework cold start | SnapStart, provisioned concurrency, lighter framework |
| Duplicate "random" values across instances after SnapStart | state captured in snapshot | re-seed on restore (runtime hooks), avoid caching unique values at init |
| Cold starts after deploys | new versions start cold | provisioned concurrency on alias, pre-warming |

#### Cheat sheet
- Cold start = create environment + runtime start + init. Java is the slowest without help.
- Provisioned concurrency (no cold starts, paid), SnapStart (snapshot restore), lighter runtimes.
- More memory speeds up init. Keep packages small.

#### Interview questions
<details><summary>How do you eliminate cold starts for a latency-critical Lambda API?</summary>

Configure provisioned concurrency on the alias serving production (sized to the expected concurrent requests, auto-scaled on schedule or utilisation), reduce init work and package size, and for Java enable SnapStart. If latency is critical and traffic is steady, consider containers (ECS/EKS), which have no per-request cold starts.
</details>

<details><summary>What subtle bug can SnapStart introduce?</summary>

Anything initialised before the snapshot is cloned into every restored environment: random number generators with the same seed, cached UUIDs or tokens, timestamps, or network connections that are stale after restore. Use runtime hooks to re-initialise uniqueness-sensitive state after restore, and avoid generating unique ids during init.
</details>

#### Interview angle
> "For Java Lambdas I enable SnapStart with re-seeding hooks and add scheduled provisioned concurrency on latency-critical paths. If traffic is steady and latency-critical, I'd move to containers instead."

#### Sources
- [Understanding the Lambda execution environment lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html) — AWS Lambda developer guide
- [Improving startup performance with Lambda SnapStart](https://docs.aws.amazon.com/lambda/latest/dg/snapstart.html) — AWS Lambda developer guide

### Lambda concurrency — reserved concurrency (cap), provisioned concurrency (pre-warmed)
Lambda concurrency is the number of **requests being processed at the same moment** (≈ requests/s × duration). It's bounded by the **account regional limit** (default 1,000, raisable) shared by all functions. **Reserved concurrency** guarantees and caps a function's share. **Provisioned concurrency** keeps a number of environments **pre-initialised** to avoid cold starts.

#### Intuition
A shared office with a fixed number of desks. Reserving desks for one team guarantees them a place and also stops them taking more. Pre-booking desks with the computers already switched on is a different thing.

#### Must know
- **Concurrency** = requests being handled at the same moment ≈ requests per second × duration.
- All functions in a region share one **account limit**.
- **Reserved concurrency**: a guaranteed share for a function, and also its hard cap.
- **Provisioned concurrency**: environments kept warm to avoid cold starts.
- Over the limit, requests are **throttled**.

#### Numbers to quote
- The default account limit is 1,000 concurrent executions per region, and can be raised.
- 500 requests/s × 0.3 s = 150 concurrent executions.

#### Common mistakes
- Mixing up reserved (a cap) and provisioned (pre-warmed).
- One noisy function using the whole account pool and throttling a critical one.
- Forgetting that a slow dependency doubles duration and so doubles concurrency.

#### How it works
```mermaid
flowchart TB
  ACC["Account limit (e.g. 3,000 concurrent)"] --> F1["checkout-api: reserved 500 (guaranteed + capped), provisioned 50 (always warm)"]
  ACC --> F2["image-resizer: reserved 200 (cap protects downstream)"]
  ACC --> F3["other functions share the unreserved pool"]
  T["Over the cap → throttled: sync = 429 to caller, async = retried, SQS = message stays in queue"] -.-> F2
```

- **Reserved concurrency**: a hard cap and guarantee per function. Set it to 0 to disable (an emergency kill switch).
- **Provisioned concurrency**: warm environments on a version or alias, billed hourly, can autoscale via Application Auto Scaling.
- Burst scaling: functions scale quickly but at a bounded rate (now up to 1,000 new concurrent executions per 10 s per function).

#### Example
A Black Friday incident: a marketing Lambda processing clickstream from Kinesis scaled up and consumed most of the account's concurrency, so the checkout Lambda got throttled. Fix: reserve 800 for checkout (guaranteed), cap clickstream at 300, and add an alarm on `ConcurrentExecutions` approaching the account limit, plus a limit increase request before the event.

#### Trade-offs
Reserved concurrency protects critical functions and downstreams but can throttle bursts. Provisioned concurrency removes cold starts at a fixed cost.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Critical function throttled | other functions exhausted account pool | reserved concurrency for critical functions |
| Downstream DB overwhelmed | unbounded concurrency | reserved concurrency cap, RDS Proxy |
| Paying for idle provisioned concurrency | static over-provisioning | scheduled/target-tracking autoscaling |

#### Cheat sheet
- Concurrency ≈ RPS × duration. The account limit is shared.
- Reserved = guarantee + cap (0 = disable). Provisioned = pre-warmed (paid).
- Alarm on concurrency and throttles. Raise limits before events.

#### Interview questions
<details><summary>A Lambda handles 500 req/s with an average duration of 300 ms. How much concurrency does it need?</summary>

By Little's law: 500 × 0.3 s = 150 concurrent executions on average. Add headroom for bursts and latency spikes (e.g. 250–300), and make sure the account limit and any reserved concurrency accommodate it. If the duration doubles (a slow dependency), concurrency doubles too.
</details>

<details><summary>How can reserved concurrency act as a safety mechanism?</summary>

It caps how many instances a function can run, which limits the load it can put on downstream systems (databases, third-party APIs) and its cost. Setting it to 0 immediately stops all invocations, a quick kill switch during incidents (e.g. a runaway recursive trigger).
</details>

#### Interview angle
> "Concurrency is RPS times duration. Critical Lambdas get reserved concurrency so batch functions can't starve them, downstream-heavy functions are capped, and provisioned concurrency is scheduled for latency-sensitive paths."

#### Sources
- [Understanding Lambda function scaling](https://docs.aws.amazon.com/lambda/latest/dg/lambda-concurrency.html) — AWS Lambda developer guide
- [Configuring reserved concurrency for a function](https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html) — AWS Lambda developer guide
- [Configuring provisioned concurrency for a function](https://docs.aws.amazon.com/lambda/latest/dg/provisioned-concurrency.html) — AWS Lambda developer guide

### Lambda + SQS — reserved concurrency = backpressure; SQS retains messages, Lambda scales
Combining SQS with Lambda gives a robust, serverless **buffered processing** pipeline: SQS absorbs bursts and retains messages, Lambda's event source mapping polls and invokes functions in batches, and **concurrency limits act as backpressure** (messages simply wait in the queue). Failures retry automatically, and poison messages go to a DLQ.

#### Intuition
A waiting room in front of a clinic with a fixed number of doctors. A sudden crowd simply waits in the room. The doctors keep a steady pace, and nobody is turned away.

#### Must know
- **SQS buffers** the burst. Lambda polls the queue and processes messages in batches.
- A **concurrency cap acts as backpressure**: extra messages just wait in the queue.
- Set **maximum concurrency** on the event source mapping to protect the downstream system.
- Return **partial batch failures** so only the failed messages are retried.
- Delivery is at-least-once, so the handler must be idempotent. Add a DLQ.

#### Numbers to quote
- Visibility timeout at least 6 × the function timeout.

#### Common mistakes
- A visibility timeout shorter than processing time, which causes duplicates.
- One bad message failing the whole batch again and again.
- No DLQ, so a poison message is retried until it expires.

#### How it works
```mermaid
flowchart LR
  P["Producers (bursty)"] --> Q[["SQS queue (retains up to 14 days)"]]
  Q -- "event source mapping: batch 10, window 5 s, maximum concurrency 50" --> L["Lambda (scales pollers with backlog)"]
  L -- "partial batch failure: return failed message ids" --> Q
  Q -- "maxReceiveCount 5" --> DLQ[["DLQ + alarm"]]
  L --> DS[("Downstream DB / API protected by concurrency cap")]
```

Settings that matter:
- **Batch size and batching window** (throughput vs latency).
- **Maximum concurrency** on the event source mapping (preferred over reserved concurrency to cap SQS consumers without throttling noise).
- **Visibility timeout** ≥ 6 × function timeout.
- **ReportBatchItemFailures** so only failed messages retry.
- **DLQ** on the queue with `maxReceiveCount`.

#### Example
A partner-webhook ingestion system receives up to 30k events/minute in bursts. The API enqueues to SQS and returns 202, and Lambda processes with maximum concurrency 40 (the downstream ledger API's safe limit). During a burst the queue backs up to 200k messages and drains in ~10 minutes, and the ledger never sees more than 40 concurrent calls. Poison payloads (schema errors) land in the DLQ after 5 attempts and are inspected and redriven after fixes.

#### Trade-offs
Simple, elastic and resilient, with no servers, but at-least-once delivery (idempotency required), ordering only with FIFO queues (message group ids), and latency from polling and batching.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Messages processed twice | visibility timeout < processing time, retries | timeout ≥ 6× function timeout, idempotency |
| Whole batch retried for one failure | no partial batch response | ReportBatchItemFailures |
| Downstream overloaded | unbounded scaling | event source mapping maximum concurrency |
| Throttling errors with reserved concurrency | pollers exceed reserved concurrency | use maximum concurrency setting instead |

#### Cheat sheet
- SQS buffers, Lambda scales, and concurrency caps give backpressure.
- Batch size/window, max concurrency, visibility timeout ≥ 6× function timeout.
- Partial batch failures + DLQ + idempotent handlers.

#### Interview questions
<details><summary>How do you protect a fragile downstream API when processing an SQS queue with Lambda?</summary>

Set the event source mapping's maximum concurrency (or reserved concurrency) to the downstream's safe parallelism, so excess messages wait in SQS rather than hammering the API. Use backoff on retries (visibility timeout), a circuit breaker or kill switch (disable the mapping), idempotent processing, and a DLQ for persistent failures.
</details>

<details><summary>Why should the SQS visibility timeout be much longer than the Lambda timeout?</summary>

If a message becomes visible again while the original invocation is still running (or before retries finish), another invocation processes it concurrently, causing duplicates. AWS recommends a visibility timeout of at least 6 × the function timeout (plus batching window) to cover retries and throttling within the event source mapping.
</details>

#### Interview angle
> "Bursty async work goes through SQS into Lambda: maximum concurrency matched to the downstream's capacity, visibility timeout at six times the function timeout, partial batch failures, a DLQ and idempotent handlers."

#### Sources
- [Using Lambda with Amazon SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html) — AWS Lambda developer guide
- [Handling errors for an SQS event source in Lambda](https://docs.aws.amazon.com/lambda/latest/dg/services-sqs-errorhandling.html) — AWS Lambda developer guide

### Step Functions — stateful serverless workflows: sequential, parallel, wait, retry, catch
AWS Step Functions orchestrates multi-step workflows as **state machines** (Amazon States Language): task steps (Lambda, ECS, 200+ AWS SDK integrations), **choice**, **parallel**, **map** (fan-out over items), **wait** (up to a year), and built-in **retry and catch** with backoff. State and execution history are durable and visible, which makes it ideal for sagas and long-running processes.

#### Intuition
A flowchart that runs itself. Each box is a step, the arrows say what comes next, and the chart remembers where it is, even if a step takes three days or fails and must be retried.

#### Must know
- It orchestrates multi-step workflows as a **state machine** with durable state.
- Built-in **retry with backoff and catch**, plus choice, parallel, map and wait states.
- Every execution's history is visible, which makes it a natural fit for **sagas**.
- **Standard** workflows: long-running, exactly-once steps. **Express**: short, high-volume, at-least-once.
- A task can pause for a callback, such as a human approval.

#### Numbers to quote
- Standard runs up to 1 year. Express runs up to 5 minutes. State payload limit 256 KB.

#### Common mistakes
- A Standard workflow for very high-volume, chatty flows, which is billed per transition.
- Passing large payloads between states. Pass an S3 reference.
- Tasks that are not idempotent, although they are retried.

#### How it works
```mermaid
stateDiagram-v2
  [*] --> ValidateOrder
  ValidateOrder --> ReserveInventory
  ReserveInventory --> ChargePayment
  ReserveInventory --> Cancelled: catch OutOfStock
  ChargePayment --> Fulfil: success
  ChargePayment --> ReleaseInventory: catch PaymentFailed (after 3 retries with backoff)
  ReleaseInventory --> Cancelled
  Fulfil --> WaitForShipment
  WaitForShipment --> Notify: task token callback (up to days)
  Notify --> [*]
  Cancelled --> [*]
```

Workflow types: **Standard** (durable, exactly-once steps, up to 1 year, audit history, priced per state transition) vs **Express** (high-volume, short (≤ 5 min), at-least-once, priced per duration). Patterns: `.waitForTaskToken` callbacks (human approval, external systems), Distributed Map (process millions of S3 objects), and direct SDK integrations (DynamoDB PutItem without a Lambda).

#### Example
A loan-disbursement saga: KYC check (Lambda) → credit score (HTTP API via SDK integration) → a human approval step (task token sent to an ops dashboard, waiting up to 48 h) → disbursement (ECS task) → ledger posting (DynamoDB) → notification (SNS). Failures trigger compensations (reverse the disbursement, cancel the agreement). Ops sees every application's execution graph and history.

#### Trade-offs
Durable, visual, retry-rich orchestration with no orchestrator servers, but Standard workflows cost per transition (expensive for very chatty flows), ASL JSON or YAML can get verbose, and it's AWS-specific (Temporal is the portable alternative).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| High cost | Standard workflow with many tiny transitions at high volume | Express workflows, combine steps, Distributed Map batching |
| Payload too large | 256 KB state limit | store payloads in S3, pass references |
| Duplicate side effects in Express | at-least-once execution | idempotent tasks |
| Hard-to-read definitions | huge JSON | Workflow Studio, CDK/SDK definitions, modular sub-workflows |

#### Cheat sheet
- State machine: task, choice, parallel, map, wait. Retry/catch built in.
- Standard (durable, ≤ 1 year, per transition) vs Express (high volume, ≤ 5 min).
- Task tokens for callbacks. SDK integrations without Lambda. Pass S3 refs for big data.

#### Interview questions
<details><summary>How would you implement a saga with Step Functions?</summary>

Model each step as a task state (calling a service via Lambda, an SDK integration or HTTP) with retry policies, and attach catch clauses that route to compensating states (release inventory, refund payment) in reverse order, ending in a failure or cancelled state. Standard workflows give durable state and audit history, and idempotency keys (execution name or id) make tasks safe to retry.
</details>

<details><summary>Standard vs Express workflows: how do you choose?</summary>

Standard for long-running, auditable business processes needing exactly-once step execution, waits and human approvals (orders, loans, onboarding). Express for high-volume, short-lived event processing (IoT ingestion, streaming transforms, API orchestration under 5 minutes) where at-least-once is acceptable and cost per execution matters.
</details>

#### Interview angle
> "Long-running sagas like loan disbursement run on Step Functions Standard: retries, catches into compensations, task-token waits for human approval and full execution history. High-volume short flows use Express."

#### Sources
- [What is Step Functions?](https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html) — AWS Step Functions developer guide
- [Choosing workflow type in Step Functions](https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html) — AWS Step Functions developer guide

### EventBridge — serverless event bus: route events from AWS services and SaaS to Lambda/SQS
Amazon EventBridge is a serverless **event bus** that routes events from your apps, **AWS services** (S3, EC2, CodePipeline…) and **SaaS partners** (Stripe, Zendesk, Datadog…) to targets (Lambda, SQS, Step Functions, API destinations, other buses) using **content-based rules**. It also offers schema registry, **archive and replay**, cross-account buses, Pipes (point-to-point with filtering and enrichment) and Scheduler.

#### Intuition
A mail sorting office with rules. Every letter arrives at one place, the office reads what is written on it, and copies go to whichever departments have asked for that kind of letter.

#### Must know
- A serverless **event bus**. Events come from your apps, AWS services and SaaS partners.
- **Rules match on event content** and route to targets: Lambda, SQS, Step Functions, HTTP endpoints.
- **Archive and replay** lets a new consumer catch up on past events.
- It gives **no ordering guarantee** and lower throughput than Kafka or Kinesis.
- Put a DLQ on each target.

#### Numbers to quote
- Maximum event size 1 MB (raised from 256 KB in January 2026).

#### Common mistakes
- A rule pattern that silently matches nothing, with no alarm on failed invocations.
- Consumers that depend on event order.
- Using it as a high-throughput stream.

#### How it works
```mermaid
flowchart LR
  APP["Order service PutEvents {source: shop.orders, detail-type: OrderPlaced, detail: {...}}"] --> BUS(("Custom event bus"))
  SAAS["Stripe (partner event source)"] --> BUS
  AWSE["AWS services (S3, ECS state changes)"] --> DEF(("Default bus"))
  BUS -- "rule: detail.total > 50000 and detail.country = IN" --> SF["Step Functions: fraud review"]
  BUS -- "rule: detail-type = OrderPlaced" --> Q[["SQS: fulfilment"]]
  BUS -- "rule: all" --> ARC["Archive (replay later)"]
  BUS -- "API destination" --> CRM["Partner CRM webhook (rate-limited)"]
```

Rule patterns support prefix, numeric ranges, exists, anything-but and so on. Targets get retries (24 h) and DLQs.

#### Example
An e-commerce company uses a custom bus for domain events: `OrderPlaced` routes to fulfilment (SQS), high-value Indian orders route to a fraud-review Step Function, and all events are archived for 90 days. When a new loyalty service launched, they replayed the last 30 days of `OrderPlaced` from the archive to backfill points. Stripe payment events arrive via the partner integration with no webhook endpoint to maintain.

#### Trade-offs
Low-ops routing, rich filtering, SaaS integrations and replay, but higher latency (tens to hundreds of ms) and lower per-bus throughput than Kafka or Kinesis, no ordering guarantees, and events up to 1 MB (256 KB before 2026).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Events silently not delivered | rule pattern mismatch / target failures | test patterns, target DLQs, metrics on FailedInvocations |
| Ordering issues | EventBridge doesn't guarantee order | design order-independent consumers, or use Kinesis/MSK |
| Webhook partner overwhelmed | unthrottled API destination | API destination rate limits |

#### Cheat sheet
- Serverless bus: content rules route events to targets. AWS and SaaS sources.
- Archive + replay, schema registry, cross-account, Pipes, Scheduler.
- No ordering. Moderate throughput. DLQs on targets.

#### Interview questions
<details><summary>EventBridge vs Kafka for a microservices event backbone?</summary>

EventBridge suits AWS-centric, moderate-volume event routing with minimal operations: content-based rules, AWS and SaaS integrations, archive and replay. Kafka suits high-throughput, ordered (per partition) streams, long retention, stream processing, and many consumers reading at their own pace, at the cost of operating or paying for a cluster (MSK).
</details>

<details><summary>How can EventBridge archive and replay help when launching a new service?</summary>

If domain events were archived, the new consumer's rule can receive replayed historical events from a chosen time window, letting it backfill its state (e.g. loyalty points from past orders) without asking producers to resend. Consumers must be idempotent, since replays and live events can overlap.
</details>

#### Interview angle
> "For AWS-centric event routing, EventBridge gives content-based rules, SaaS sources, DLQs and archive-and-replay to backfill new services. High-throughput ordered streams go on Kafka."

#### Sources
- [What is Amazon EventBridge?](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-what-is.html) — Amazon EventBridge user guide
- [Archiving and replaying events](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-archive.html) — Amazon EventBridge user guide
- [Increased 1 MB payload size support in Amazon EventBridge](https://aws.amazon.com/about-aws/whats-new/2026/01/amazon-eventbridge-increases-event-payload-size-256-kb-1-mb) — AWS What's New

### Terraform — declarative IaC: resources, providers, state file (lock with S3 + DynamoDB)
Terraform (and its open fork OpenTofu) is a **declarative infrastructure-as-code** tool: you describe desired resources in HCL, **providers** translate them into API calls (AWS, GCP, Kubernetes, Datadog…), and a **state file** records what exists so Terraform can compute diffs. Remote state with **locking** makes team use safe.

#### Intuition
An architect's drawing plus a site inventory. You draw what should exist. Terraform compares the drawing with its inventory of what is already built and does only the work needed to close the gap.

#### Must know
- You **declare the desired infrastructure** in code. Terraform works out the changes.
- **Providers** translate resources into API calls for AWS, GCP, Kubernetes and others.
- The **state file** records what exists. Without it Terraform cannot compute a diff.
- Keep state **remote, locked and encrypted**. It can contain secrets.
- Split state per environment and component to limit the blast radius.

#### Numbers to quote
- Since Terraform 1.10 the S3 backend can lock natively (`use_lockfile`). DynamoDB locking is deprecated.

#### Common mistakes
- Local or unlocked state, so two applies corrupt each other.
- One giant state for everything.
- Changing resources in the console, which creates drift.

#### How it works
```mermaid
flowchart LR
  HCL["*.tf: resources, modules, variables"] --> PLAN["terraform plan: desired (code) vs current (state + refresh) → diff"]
  ST[("Remote state: S3 bucket (versioned, encrypted) + lock (DynamoDB table / S3 native locking)")] <--> PLAN
  PLAN --> APPLY["terraform apply: provider API calls in dependency order"]
  APPLY --> CLOUD["AWS resources"]
  APPLY --> ST
```

```hcl
terraform {
  backend "s3" {
    bucket         = "acme-tfstate-prod"
    key            = "network/vpc.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "tf-locks"          # legacy locking, deprecated since Terraform 1.11: prefer use_lockfile = true (S3 native)
    encrypt        = true
  }
}
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.8.1"
  name    = "prod"
  cidr    = "10.20.0.0/16"
  azs     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}
```

Practices: separate state per environment and component (blast radius), reusable versioned **modules**, `plan` in PRs and `apply` in CI only, policy as code (OPA/Sentinel/Checkov), drift detection, and no secrets in state (state contains sensitive values, so encrypt it and restrict access).

#### Example
A platform team manages 4 AWS accounts with Terraform: separate state files for network, data and services per environment, PRs run `terraform plan` and post the diff as a comment, merges trigger `apply` via CI using an OIDC-assumed role (no static keys), Checkov blocks public S3 buckets, and a nightly plan detects drift (someone changed a security group in the console, so it's reverted).

#### Trade-offs
Reproducible, reviewable infrastructure across many providers, but state management is critical (corruption or locking issues), refactoring resources needs `moved` blocks or imports, and plans can surprise (replacements, which you must read carefully).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Concurrent applies corrupt state | no locking | remote backend with locking |
| One mistake affects everything | single giant state | split state by env/component |
| Secrets leaked via state | sensitive outputs in plain state | encrypted backend, restricted access, external secret managers |
| Console changes drift | manual edits | drift detection, deny console writes for managed resources |

#### Cheat sheet
- Declarative HCL + providers + state (remote, locked, encrypted).
- Modules, split states, plan in PR, apply from CI with OIDC.
- Policy as code. Drift detection. Careful with replacements.

#### Interview questions
<details><summary>Why is the Terraform state file important, and how do you manage it in a team?</summary>

State maps configuration to real resource ids and stores attributes Terraform needs to compute changes. Without it Terraform can't know what exists. In teams: store it remotely (S3 with versioning and encryption, Terraform Cloud), enable locking to prevent concurrent applies, restrict access (it can contain secrets), and split state per environment and component to limit blast radius.
</details>

<details><summary>How do you rename or move a resource in Terraform without destroying it?</summary>

Use a `moved` block (`moved { from = aws_s3_bucket.old to = aws_s3_bucket.new }`) or `terraform state mv`, so Terraform updates state addresses instead of planning destroy-and-create. Always read the plan for unexpected "must be replaced" actions before applying.
</details>

#### Interview angle
> "Infrastructure is Terraform: versioned modules, split remote state with locking and encryption, plans posted on PRs, applies from CI via OIDC roles, policy checks and nightly drift detection."

#### Sources
- [State](https://developer.hashicorp.com/terraform/language/state) — Terraform docs
- [Backend type: s3](https://developer.hashicorp.com/terraform/language/backend/s3) — Terraform docs

### Terraform plan/apply workflow — preview changes before applying; destroy with care
Terraform's core workflow is **`init` → `plan` → `apply`**: `plan` computes and shows exactly what will be created, updated in place, **replaced** or destroyed, and `apply` executes that plan. Reviewing plans (especially replacements and destroys) is the main safety mechanism. `destroy` removes everything a configuration manages.

#### Intuition
A builder's quote before the work starts. It lists exactly what will be built, altered or knocked down. You read it, sign it, and the builder does precisely what was on the quote.

#### Must know
- The workflow is **init → plan → apply**.
- **`plan` shows what will be created, changed, replaced or destroyed.** Reading it is the main safety check.
- `-/+` means **destroy and recreate**. On a database that means data loss.
- Save the plan to a file and **apply that exact plan** in CI.
- Guard stateful resources with `prevent_destroy` and deletion protection.

#### Common mistakes
- Approving a plan without reading the replacements and destroys.
- Re-planning at apply time, so something different from the reviewed plan is applied.
- Huge plans from a single giant state that nobody can review.

#### How it works
```mermaid
flowchart LR
  PR["Pull request"] --> CI1["CI: terraform fmt + validate + tflint + checkov"]
  CI1 --> PLAN["terraform plan -out=tfplan (comment diff on PR)"]
  PLAN --> REV{"Human review: any '-/+ must be replaced' or '- destroy'?"}
  REV -- "approved + merged" --> APPLY["CI: terraform apply tfplan (same saved plan)"]
  REV -- "unexpected replacement" --> FIX["Fix config (lifecycle, moved, ignore_changes)"]
  APPLY --> NOTIFY["Notify + record"]
```

Plan symbols: `+` create, `~` update in place, `-/+` destroy and recreate (replacement!), `-` destroy, `<=` read data source.

Safety tools:
- `lifecycle { prevent_destroy = true }` on critical resources (databases, state buckets).
- `create_before_destroy` for zero-downtime replacements.
- `ignore_changes` for attributes managed elsewhere.
- Saved plan files (`-out`) so you apply exactly what was reviewed.
- `-target` only for emergencies.
- Deletion protection on RDS and other services.

#### Example
A PR changing an RDS parameter accidentally altered `engine_version` format, and the plan showed `-/+ aws_db_instance.orders must be replaced`, which would destroy the production database. Review caught it. The team added `prevent_destroy` and `deletion_protection = true` to all databases and a CI rule failing any plan that contains a destroy or replace of tagged critical resources without an explicit override label.

#### Trade-offs
Plans make changes predictable, but only if humans actually read them (plan fatigue). Large plans are hard to review, so keep changes small and states split.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Accidental resource replacement | immutable attribute changed | read plans, prevent_destroy, CI checks for replacements |
| Applied something different from reviewed | re-planning at apply time | apply saved plan file |
| Huge unreadable plans | monolithic state | smaller states, smaller PRs |
| `terraform destroy` run in wrong workspace | human error | protected prod, separate accounts, prevent_destroy |

#### Cheat sheet
- init → plan (review) → apply the saved plan.
- Watch `-/+` replacements and `-` destroys. Use prevent_destroy and deletion protection.
- create_before_destroy, ignore_changes, small states and PRs.

#### Interview questions
<details><summary>A plan shows your production database "must be replaced". What do you do?</summary>

Stop: don't apply. Identify the attribute forcing replacement (the plan marks it), revert or adjust the change (use an in-place-updatable attribute, `ignore_changes` if it's managed elsewhere, or a planned migration path such as a snapshot restore or blue/green). Add `prevent_destroy` and RDS deletion protection to guard against this in future.
</details>

<details><summary>Why apply a saved plan file in CI instead of running apply directly?</summary>

Between review and apply, state or code could change (another merge, drift), producing a different plan than the one approved. Applying the saved plan executes exactly the reviewed changes (and fails if state changed), keeping the review meaningful and auditable.
</details>

#### Interview angle
> "Every change gets a plan posted on the PR, a human reviews any replace or destroy, and CI applies exactly that saved plan, with prevent_destroy and deletion protection on stateful resources."

#### Sources
- [Command: plan](https://developer.hashicorp.com/terraform/cli/commands/plan) — Terraform docs
- [The core Terraform workflow](https://developer.hashicorp.com/terraform/intro/core-workflow) — Terraform docs

### CloudFormation — AWS-native IaC: stacks, change sets, drift detection
AWS CloudFormation is AWS's native IaC service: you declare resources in YAML/JSON templates (or generate them with **CDK**), deploy them as **stacks**, preview changes with **change sets**, and detect manual changes with **drift detection**. AWS manages the state and rollback for you.

#### Intuition
Terraform's idea, run by AWS itself. You hand over the drawing, and AWS keeps the inventory, does the building, and puts things back the way they were if a step fails.

#### Must know
- AWS's own infrastructure-as-code service. Templates are deployed as **stacks**.
- **AWS stores the state** and **rolls back automatically** on failure.
- A **change set** previews what an update will do.
- **Drift detection** finds manual changes. **StackSets** deploy to many accounts and regions.
- **CDK** generates templates from real programming languages.

#### Common mistakes
- No `DeletionPolicy` on a database, so a replacement deletes the data.
- Editing stack resources by hand, then getting stuck in a failed rollback.
- Choosing it for a multi-cloud setup, where Terraform fits better.

#### How it works
```mermaid
flowchart LR
  T["Template (YAML) / CDK app (TypeScript, Java…) → synthesised template"] --> CS["Change set: preview adds/modifies/replacements"]
  CS --> STACK["Stack deployment (AWS-managed state, dependency ordering)"]
  STACK -- "failure → automatic rollback" --> PREV["Previous state"]
  STACK --> DRIFT["Drift detection: compare actual vs template"]
  SS["StackSets: deploy across accounts/regions"] -.-> STACK
```

Features: nested stacks and modules, StackSets (multi-account and multi-region), stack policies (prevent updates to critical resources), DeletionPolicy/UpdateReplacePolicy (Retain/Snapshot), custom resources (Lambda-backed), and hooks (policy checks before provisioning).

#### Example
A company standardises account baselines (CloudTrail, GuardDuty, Config rules, IAM roles) with CloudFormation StackSets deployed to 60 accounts via AWS Organizations, so new accounts get the baseline automatically. Application teams use **CDK** in TypeScript to define services (ECS + ALB + RDS), with change sets reviewed in pipelines and `DeletionPolicy: Snapshot` on databases.

#### Trade-offs
| CloudFormation / CDK | Terraform |
|---|---|
| AWS-managed state, automatic rollback | you manage state backend |
| day-0 support for many AWS features (sometimes lagging) | multi-cloud + SaaS providers |
| AWS-only | portable across providers |
| CDK: real programming languages | HCL (+ CDKTF) |

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Stack stuck in UPDATE_ROLLBACK_FAILED | resource changed outside/failed rollback | continue-update-rollback with skips, avoid manual changes |
| Accidental data loss on replacement | missing deletion/replace policies | DeletionPolicy/UpdateReplacePolicy: Snapshot/Retain, stack policies |
| Manual drift | console edits | drift detection + guardrails |

#### Cheat sheet
- Templates/CDK → stacks. Change sets preview. Auto rollback. Drift detection.
- StackSets for multi-account baselines. Deletion/replace policies for data.
- AWS-only. Terraform for multi-provider.

#### Interview questions
<details><summary>CloudFormation vs Terraform: when would you pick CloudFormation/CDK?</summary>

When the organisation is AWS-only and wants AWS-managed state with automatic rollback, tight integration with AWS services (StackSets with Organizations, Service Catalog, Control Tower), and CDK's ability to use TypeScript or Java with higher-level constructs. Terraform is preferable for multi-cloud or many SaaS providers, or when teams already standardise on it.
</details>

<details><summary>How do you protect a production database defined in CloudFormation from accidental deletion?</summary>

Set `DeletionPolicy: Snapshot` (or Retain) and `UpdateReplacePolicy: Snapshot` on the resource, enable the database's own deletion protection, apply a stack policy denying `Update:Replace`/`Delete` on that logical resource, enable stack termination protection, and always review change sets for replacements.
</details>

#### Interview angle
> "In AWS-only shops I'd use CDK synthesised to CloudFormation: change sets reviewed in pipelines, Snapshot deletion and replace policies on data, StackSets for account baselines and drift detection to catch console edits."

#### Sources
- [What is CloudFormation?](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html) — AWS CloudFormation user guide
- [Update CloudFormation stacks using change sets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html) — AWS CloudFormation user guide

### Ansible — configuration management: agentless, idempotent YAML playbooks
Ansible automates **configuration management and orchestration** over SSH (or WinRM) with **no agents**: YAML **playbooks** describe desired state using idempotent **modules** (install packages, template configs, manage services, users and files). Running a playbook twice produces the same result. Roles and inventories organise it at scale.

#### Intuition
A checklist a caretaker walks round with: "is nginx installed? is this config file correct?" Anything already right is left alone. Walking round twice changes nothing the second time.

#### Must know
- It **configures what runs on machines**: packages, config files, services, users.
- **Agentless**: it connects over SSH. Nothing is installed on the hosts.
- Playbooks are YAML, built from **idempotent** modules: running twice gives the same result.
- **Terraform provisions the infrastructure. Ansible configures it.**
- Today it is often used to bake machine images, not to change live servers.

#### Common mistakes
- Raw `shell` or `command` tasks that are not idempotent.
- Secrets in plain YAML with no Ansible Vault.
- Changing live servers by hand between runs, which causes drift.

#### How it works
```mermaid
flowchart LR
  CTRL["Control node: ansible-playbook site.yml -i inventory/prod"] -- "SSH (parallel forks)" --> H1["web-01"]
  CTRL -- "SSH" --> H2["web-02"]
  CTRL -- "SSH" --> H3["db-01"]
  PB["Playbook: roles → tasks (apt, template, systemd, user), handlers on change"] --> CTRL
  INV["Inventory: groups (web, db), host vars, dynamic inventory (AWS EC2 plugin)"] --> CTRL
  VAULT["Ansible Vault: encrypted secrets"] --> CTRL
```

```yaml
- hosts: web
  become: true
  roles: [common]
  tasks:
    - name: Install nginx
      ansible.builtin.apt: { name: nginx, state: present, update_cache: true }
    - name: Deploy nginx config
      ansible.builtin.template: { src: nginx.conf.j2, dest: /etc/nginx/nginx.conf, mode: "0644" }
      notify: reload nginx
  handlers:
    - name: reload nginx
      ansible.builtin.service: { name: nginx, state: reloaded }
```

Where it fits today: configuring VMs and bare metal (OS hardening, agents), **baking images** with Packer + Ansible (immutable), network device automation, and orchestration tasks (rolling restarts). Terraform provisions resources and Ansible configures what runs on them (for non-container workloads).

#### Example
A bank with on-prem servers plus AWS EC2 uses Ansible roles to apply CIS hardening, install monitoring agents and configure application servers, using a dynamic AWS inventory and Ansible Vault for secrets. For new services they moved to Packer + Ansible to bake AMIs (immutable), rather than running Ansible against live servers, to avoid drift.

#### Trade-offs
Simple (YAML, SSH, no agents) and broad module coverage, but slower at large scale (SSH per host), procedural ordering can hide state complexity, and live configuration of mutable servers encourages drift (prefer immutable images and containers).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Playbook changes something every run | non-idempotent tasks (shell/command) | proper modules, `creates`/`changed_when` |
| Slow runs on thousands of hosts | SSH overhead | forks, pipelining, mitogen, pull mode, image baking |
| Secrets in plain YAML | no vault | Ansible Vault / external secret lookups |
| Drift on live servers | mutable infra | bake images, replace instances |

#### Cheat sheet
- Agentless (SSH), YAML playbooks, idempotent modules, roles, inventories.
- Configure VMs, harden OS, bake images (Packer + Ansible), network automation.
- Terraform provisions, Ansible configures. Prefer immutable images.

#### Interview questions
<details><summary>Terraform vs Ansible: how do they differ and how do they fit together?</summary>

Terraform is declarative provisioning of infrastructure resources via cloud APIs (VPCs, instances, databases) with a state file and dependency graph. Ansible is configuration management and orchestration of what runs on machines (packages, configs, services) via SSH, procedural playbooks with idempotent modules. Typical combination: Terraform creates instances, and Ansible (often through Packer at image build time) configures them.
</details>

<details><summary>What does idempotency mean in Ansible and why does it matter?</summary>

Running a task repeatedly yields the same end state, and it only reports "changed" when something actually changed (e.g. `apt: state=present` installs only if missing). That makes playbooks safe to re-run for convergence and drift correction, and avoids unintended restarts. Raw `shell` or `command` tasks break idempotency unless guarded.
</details>

#### Interview angle
> "Terraform provisions and Ansible configures. For new workloads, Ansible runs inside Packer to bake immutable AMIs rather than mutating live servers, with Vault-encrypted secrets and idempotent modules."

#### Sources
- [Introduction to Ansible](https://docs.ansible.com/ansible/latest/getting_started/introduction.html) — Ansible docs
- [Ansible playbooks](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_intro.html) — Ansible docs

### Container registry — ECR (AWS), Docker Hub, GCR, Harbor (self-hosted)
A container registry **stores and distributes container images** (and other OCI artifacts like Helm charts and SBOMs). Production registries add **access control**, **vulnerability scanning**, **immutability**, **replication**, **lifecycle policies** and **signature verification**. Options: Amazon ECR, Google Artifact Registry, Azure ACR, GitHub Container Registry, Docker Hub, and self-hosted Harbor.

#### Intuition
A warehouse for sealed, labelled boxes. Builders drop boxes off, clusters collect them, and the warehouse checks who may do either and whether a box has been tampered with.

#### Must know
- A registry **stores and distributes container images**.
- Tag images by **commit SHA** and deploy by **digest**, which identifies the exact content.
- Make tags **immutable**, so a tag can never point to different code later.
- **Scan on push** and **sign images**. Let clusters admit only signed images.
- Add lifecycle rules, and mirror public base images.

#### Common mistakes
- Deploying `latest` or any other mutable tag.
- Anonymous pulls from Docker Hub in CI, which hit rate limits.
- No lifecycle policy, so old images pile up and cost money.

#### How it works
```mermaid
flowchart LR
  CI["CI build"] -- "push app:1f3c9e (git SHA), SBOM, cosign signature" --> REG[("Registry: ECR repo (immutable tags, scan on push, KMS encryption)")]
  REG -- "pull (IAM / pull-through cache)" --> K["EKS / ECS nodes (VPC endpoint)"]
  REG -- "cross-region replication" --> REG2[("ECR in DR region")]
  POL["Lifecycle: keep last 50 tagged, expire untagged after 7 days"] -.-> REG
  ADM["Admission policy: only signed images from our registry (Kyverno / Gatekeeper)"] -.-> K
```

Practices: tag images by **commit SHA** (and deploy by digest), enable **immutable tags**, scan on push (ECR enhanced scanning / Inspector, Trivy), sign with **cosign** and verify at admission, use pull-through caches for public images (avoiding Docker Hub rate limits and supply-chain risk), and private access via VPC endpoints.

#### Example
After Docker Hub rate limits broke CI builds, a team mirrored base images through an ECR pull-through cache. All app images are pushed to ECR with immutable SHA tags, scanned on push (critical CVEs block promotion), signed with cosign in CI, and Kyverno in EKS rejects unsigned images or images from other registries. Lifecycle policies cut registry storage by 80%.

#### Trade-offs
Managed registries are low-ops and integrated with cloud IAM, while self-hosted Harbor gives control (on-prem, air-gapped) but needs operations. Supply-chain security adds pipeline steps.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| "latest" changed under running pods | mutable tags | immutable tags, deploy by digest |
| CI broken by Docker Hub limits | anonymous pulls | pull-through cache / mirror |
| Vulnerable images deployed | no scanning gates | scan on push + block criticals + admission policies |
| Storage costs grow | no lifecycle | lifecycle rules for old/untagged images |

#### Cheat sheet
- Store and distribute OCI artifacts: images, Helm charts, SBOMs, signatures.
- SHA tags + immutability + digest deploys. Scan on push. Sign and verify.
- Pull-through caches, VPC endpoints, lifecycle policies, replication.

#### Interview questions
<details><summary>Why deploy images by digest rather than by tag?</summary>

A tag is a mutable pointer: someone can push a different image under the same tag (including `latest`), so nodes could pull different code for the "same" version, and rollbacks become ambiguous. A digest (sha256) identifies exact image content, so deployments are reproducible and tamper-evident.
</details>

<details><summary>How do you secure the container supply chain from build to cluster?</summary>

Minimal pinned base images (pulled via a trusted mirror), dependency and image scanning in CI with gates, SBOM generation, image signing (cosign/Sigstore) and provenance attestations (SLSA), immutable tags in a private registry with restricted push rights, and admission control in clusters allowing only signed images from approved registries.
</details>

#### Interview angle
> "Images go to ECR with immutable SHA tags, are scanned on push, signed with cosign and pulled over VPC endpoints. Clusters admit only signed images, deployed by digest."

#### Sources
- [What is Amazon Elastic Container Registry?](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html) — Amazon ECR user guide
- [Signing containers](https://docs.sigstore.dev/cosign/signing/signing_with_containers/) — Sigstore docs
- [Harbor documentation](https://goharbor.io/docs/) — Harbor

### GitOps with ArgoCD — desired state in Git, ArgoCD reconciles cluster continuously
Argo CD is the most widely used GitOps controller for Kubernetes: it watches Git repositories (plain manifests, Helm, Kustomize), compares them with live cluster state, shows diffs and health, and **syncs** automatically or on approval, with **self-heal** to revert drift. (Phase 8 covers GitOps principles.)

#### Intuition
A gardener with a photo of how the garden should look. They walk round all day comparing garden and photo, and put back anything that has moved. To change the garden, you change the photo.

#### Must know
- Argo CD **watches a Git repository** and compares it with the live cluster.
- It **syncs** the cluster to match Git, automatically or on approval.
- **Self-heal** reverts manual changes. **Prune** removes resources deleted from Git.
- An **Application** maps a repository path to a cluster and namespace.
- Rollback is reverting the commit.

#### Common mistakes
- Setting `replicas` in Git while an autoscaler also changes it, so the app flaps out of sync.
- Running Argo CD with one all-powerful project and no per-team limits.
- Plain-text secrets in the repository.

#### How it works
```mermaid
flowchart LR
  GIT["Git: apps/orders/overlays/prod (Kustomize / Helm values)"] --> ARGO["Argo CD: Application (source repo + path + destination cluster/namespace)"]
  ARGO -- "diff + sync (auto, prune, selfHeal)" --> K["Cluster"]
  ARGO --> UI["UI/CLI: Synced/OutOfSync, Healthy/Degraded, history, rollback"]
  APPSET["ApplicationSet: generate apps per cluster/env from templates"] --> ARGO
  ROLL["Argo Rollouts: canary/blue-green with analysis"] -.-> K
```

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: { name: orders-prod, namespace: argocd }
spec:
  project: payments-team
  source: { repoURL: https://github.com/acme/deploy, targetRevision: main, path: apps/orders/overlays/prod }
  destination: { server: https://kubernetes.default.svc, namespace: orders }
  syncPolicy:
    automated: { prune: true, selfHeal: true }
    syncOptions: [CreateNamespace=true]
```

Features: sync waves and hooks (ordering, e.g. migrations first), AppProjects (RBAC and allowed destinations per team), SSO, multi-cluster management, notifications, and Image Updater.

#### Example
50 microservices across dev, staging and prod clusters are managed by ApplicationSets generated from a directory structure. Teams own their app directories (CODEOWNERS), and AppProjects restrict each team to its namespaces. Production syncs are automated, but PRs to `prod/` need approval. A sync wave runs the Flyway migration Job before the Deployment. Rollback is reverting the commit, or using Argo's history in an emergency.

#### Trade-offs
Clear desired state, auditability, drift correction and multi-cluster visibility, but Argo CD itself needs HA and security (it has cluster-admin powers), secrets need external tooling, and large monorepos can slow reconciliation.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| App flaps OutOfSync | fields mutated by controllers (HPA replicas, webhooks) | ignoreDifferences, don't set replicas when HPA owns them |
| Deletions not applied | prune disabled | enable prune (carefully), finalizers |
| Over-privileged Argo | single admin project | AppProjects, RBAC, SSO |
| Migrations run after app starts | no ordering | sync waves/hooks |

#### Cheat sheet
- Application = repo path → cluster namespace. Auto-sync + prune + selfHeal.
- ApplicationSets, AppProjects (RBAC), sync waves/hooks, Rollouts for progressive delivery.
- ignoreDifferences for controller-managed fields. Secure Argo itself.

#### Interview questions
<details><summary>How does Argo CD handle drift?</summary>

It continuously compares the live state of managed resources with the rendered manifests from Git and marks the application OutOfSync on differences. With `selfHeal: true` it re-applies the Git state automatically, reverting manual changes. Without it, it reports the drift for a human to sync or update Git.
</details>

<details><summary>Why might an HPA-managed Deployment show as constantly OutOfSync in Argo CD, and how do you fix it?</summary>

The Deployment manifest in Git sets `replicas`, while the HPA changes the live replica count, so the live and desired states differ continuously (and self-heal fights the HPA). Remove `replicas` from the manifest (let the HPA own it) or configure `ignoreDifferences` for `/spec/replicas`.
</details>

#### Interview angle
> "Argo CD ApplicationSets deploy every service from Git with auto-sync, prune and self-heal, AppProjects scoping each team, and sync waves running migrations before the rollout."

#### Sources
- [Core concepts](https://argo-cd.readthedocs.io/en/stable/core_concepts/) — Argo CD docs
- [Automated sync policy](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/) — Argo CD docs

### CI/CD stages — build → unit test → integration test → security scan → artifact publish → deploy to staging → smoke test → promote to production
A mature CI/CD pipeline moves every change through a predictable sequence of **quality and security gates** to production, building the artifact once and promoting it. Each stage should fail fast and give clear feedback, and later stages add confidence with more realistic environments. (Phase 8 covers pipeline principles.)

#### Intuition
Airport security in stages. The quick, cheap checks come first and turn most problems away early. The slower, thorough checks come later, for the few that got through.

#### Must know
- Order the stages **fast and cheap first**: build, unit tests, then integration, security, staging, production.
- **Fail fast**: a failure stops the pipeline at that stage.
- **Build the artifact once** and promote that same artifact through every environment.
- Production rollout is progressive (canary) with **automatic rollback**.
- Match the gates to the risk: strict for payments, lighter for internal tools.

#### Numbers to quote
- Keep pull-request feedback under about 10 minutes.

#### Common mistakes
- Slow end-to-end tests blocking every pull request.
- Security findings so noisy that everyone ignores the gate.
- Staging that differs from production in configuration or data shape.

#### How it works
```mermaid
flowchart LR
  S1["1 Build (compile, cache deps)"] --> S2["2 Unit tests + coverage"]
  S2 --> S3["3 Integration tests (Testcontainers), contract tests"]
  S3 --> S4["4 Security: SAST, SCA, secrets, IaC, image scan"]
  S4 --> S5["5 Publish artifact: image@sha256, SBOM, signature"]
  S5 --> S6["6 Deploy to staging (GitOps PR / Argo)"]
  S6 --> S7["7 Smoke + e2e critical journeys, perf sanity"]
  S7 --> S8["8 Promote to production: approval (if required), canary + automated analysis"]
  S8 --> S9["9 Post-deploy verification + auto rollback"]
```

| Stage | Typical tools | Fail on |
|---|---|---|
| Build | Maven/Gradle, Docker Buildx (cache) | compile errors |
| Unit | JUnit, Jest | test failures, coverage drop |
| Integration/contract | Testcontainers, Pact | broken integrations |
| Security | Semgrep/Sonar, Snyk/Dependabot, gitleaks, Checkov, Trivy | high/critical findings |
| Publish | ECR + cosign + Syft SBOM | signing/scanning failure |
| Staging | Argo CD, Helm | deploy/health failure |
| Smoke | Playwright/k6 smoke, synthetic checks | journey failures |
| Prod | Argo Rollouts, CodeDeploy | analysis regression |

#### Example
For a payments service, a merge to main produces an image in about 12 minutes and auto-deploys to staging. Smoke tests run a synthetic payment end to end in sandbox mode. Promotion to production requires one approver (compliance), and an Argo Rollouts canary (5% → 25% → 100%) checks error rate, p99 latency and payment success. A failed analysis rolls back automatically and posts to Slack with links to the dashboards and the offending commit.

#### Trade-offs
Each gate adds confidence but also time, so balance them by risk (strict for payments, lighter for internal tools). Flaky gates erode trust.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Pipeline too slow | everything serial | parallel stages, caching, split test suites |
| Staging passes, prod fails | env differences | IaC parity, same artifact, production-like data |
| Security gate ignored | too many low-value findings | severity thresholds, triage, baseline suppression |
| No fast rollback | manual deploys | progressive delivery with auto rollback |

#### Cheat sheet
- Build → unit → integration/contract → security → publish (signed, SBOM) → staging → smoke → canary prod → verify.
- Build once, promote the digest. Gate by risk. Automate rollback.
- Keep PR feedback fast. Kill flaky tests quickly.

#### Interview questions
<details><summary>Where in the pipeline do you run database migrations?</summary>

As an explicit step before the new application version receives traffic: in staging first (validating the migration), then in production as a pre-deploy job or sync wave, using backward-compatible (expand) migrations so the old version keeps working. Destructive (contract) migrations run in a later release once no deployed version needs the old schema.
</details>

<details><summary>How do you decide which checks block a merge vs run later?</summary>

Block on fast, high-signal checks: compile, unit tests, critical-severity security findings, secrets, contract tests and linting, keeping PR feedback under ~10 minutes. Run slower or noisier checks (full e2e, DAST, load tests, full SAST) post-merge or nightly, with alerts and tickets, and gate production promotion on them where risk demands.
</details>

#### Interview angle
> "Every change flows build, unit, integration and contract, security scans, a signed image with an SBOM, staging plus smoke tests, then a canaried production rollout with automatic rollback, with gates matched to risk."

#### Sources
- [Deployment pipeline](https://martinfowler.com/bliki/DeploymentPipeline.html) — Martin Fowler
- [Continuous delivery](https://dora.dev/capabilities/continuous-delivery/) — DORA
- [Supply-chain levels for software artifacts](https://slsa.dev/) — SLSA

