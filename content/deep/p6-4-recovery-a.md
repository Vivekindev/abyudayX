## Replication, failure detection & recovery

### Quorum reads/writes — N replicas, write to W, read from R; W+R>N ensures overlap and consistency
With N replicas, a write succeeds after **W** acknowledgements and a read consults **R** replicas. If **W + R > N**, every read set overlaps every write set in at least one replica, so a read can find the latest acknowledged write (by comparing versions). Tuning W and R trades consistency, latency and availability.

#### Intuition
You tell a secret to two of three friends. Later you ask any two of the three. At least one of the two you ask must be one you told, so you always hear the latest version.

#### Must know
- **N** replicas. A write succeeds after **W** acknowledgements. A read asks **R** replicas.
- **W + R > N** means every read set overlaps every write set in at least one replica.
- The read compares versions and returns the newest, so it needs version metadata.
- Tuning W and R trades consistency, latency and availability.
- It is **not linearizability**: concurrent writes and sloppy quorums can still cause anomalies.

#### Numbers to quote
- N = 3, W = 2, R = 2 tolerates 1 failure. N = 5, W = 3, R = 3 tolerates 2.

#### Common mistakes
- W = 1, R = 1 and expecting fresh reads.
- W = N, which makes a single down replica block every write.
- Claiming overlap alone guarantees linearizable behaviour.

#### How it works
```mermaid
flowchart LR
  subgraph N3["N = 3 replicas"]
    A["Replica A: v2 ✅"]
    B["Replica B: v2 ✅"]
    C["Replica C: v1 (missed write)"]
  end
  W["Write v2 with W = 2 → acked by A, B"] --> A
  W --> B
  R["Read with R = 2 → asks B and C"] --> B
  R --> C
  R --> X["B has v2 (newer version) → return v2, repair C"]
```

| Config (N=3) | Behaviour |
|---|---|
| W=3, R=1 | fast reads, writes fail if any replica is down |
| W=1, R=3 | fast writes, reads fail if any replica is down |
| **W=2, R=2** | balanced: tolerates 1 failure for both, overlapping quorums |
| W=1, R=1 | fastest, most available, eventual consistency (stale reads possible) |

Caveats: sloppy quorums (writing to substitute nodes), concurrent writes with LWW, and partially failed writes can still produce anomalies, so "W + R > N" is not linearizability.

#### Example
Cassandra RF=3 per DC with `LOCAL_QUORUM` for both reads and writes in a user-profile service: profile updates are visible to subsequent reads in the same DC, and either operation keeps working with one replica down. For analytics reads of the same table, `LOCAL_ONE` cuts latency.

#### Trade-offs
Larger W means more durable and consistent writes but more latency and less write availability. Larger R does the same for reads. Latency is set by the W-th or R-th fastest replica.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Stale reads | W + R ≤ N | quorum both sides, or read-your-writes routing |
| Writes fail with one node down | W = N | W = majority |
| p99 latency follows slowest replica | high W/R | speculative retries, quorum not ALL |
| Data inconsistent after failures | partial writes, sloppy quorum | read repair, anti-entropy, hinted handoff |

#### Cheat sheet
- W + R > N means overlapping quorums (read finds latest acknowledged write).
- N=3, W=2, R=2 is the balanced default.
- Not linearizable by itself. Repairs keep replicas converging.

#### Interview questions
<details><summary>With N = 5, what W and R would you choose for strong-ish reads that tolerate 2 failures?</summary>

W = 3 and R = 3: W + R = 6 > 5 gives overlap, and each operation needs only 3 of 5 replicas, so up to 2 replicas can be down for both reads and writes. Write-heavy workloads could use W = 2, R = 4 (still 6 > 5) at the cost of read availability (only one failure tolerated for reads).
</details>

<details><summary>Why does a quorum read need version metadata?</summary>

The read collects values from R replicas that may hold different versions. To return the latest acknowledged write it must determine which value is newest, via timestamps or version numbers (or vector clocks to detect concurrency). Without versions, overlap alone doesn't tell you which response is correct.
</details>

#### Interview angle
> "With three replicas I use W=2, R=2: overlapping quorums give read-your-latest, one replica can be down for either operation, and read repair plus anti-entropy keep replicas converging."

#### Sources
- [Dynamo: Amazon's highly available key-value store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — DeCandia et al., SOSP 2007
- [Quorum (distributed computing)](https://en.wikipedia.org/wiki/Quorum_%28distributed_computing%29) — Wikipedia

### Common quorum config — N=3, W=2, R=2: tolerates 1 failure, consistent reads
The most common quorum configuration is **3 replicas, writes acknowledged by 2, reads from 2**. It's the sweet spot: tolerates one replica failure for both reads and writes, guarantees read/write overlap (2 + 2 > 3), and keeps latency near the second-fastest replica rather than the slowest.

#### Intuition
Three keyholders for a safe, with any two needed to open it. One can be on holiday and the safe still opens, and no two pairs can ever disagree about what is inside.

#### Must know
- **Three replicas, writes acknowledged by two, reads from two.**
- One replica can be down for both reads and writes.
- 2 + 2 > 3, so reads overlap writes.
- Latency follows the second-fastest replica, not the slowest.
- The same shape appears everywhere: Cassandra `LOCAL_QUORUM`, Kafka RF 3 with `min.insync.replicas=2`, a 3-node etcd cluster, a MongoDB majority.

#### Common mistakes
- Putting two of the three replicas in the same AZ.
- Forgetting that maintenance on one node leaves no room for an unplanned failure.
- Kafka `min.insync.replicas=3` with RF 3, which blocks producers when one broker is down.

#### How it works
```mermaid
flowchart TD
  P["Partition with RF = 3, replicas in 3 AZs"] --> A["AZ-a replica"]
  P --> B["AZ-b replica"]
  P --> C["AZ-c replica"]
  W["Write: wait for 2 of 3 acks"] --> OK1["Survives losing any 1 AZ"]
  R["Read: query 2 of 3, newest version wins"] --> OK2["Overlap guaranteed: 2 + 2 > 3"]
```

Failure scenarios with N=3, W=2, R=2:
| Replicas down | Writes | Reads |
|---|---|---|
| 0 | ✅ | ✅ |
| 1 | ✅ | ✅ |
| 2 | ❌ (can't reach 2) | ❌ |

#### Example
- **Cassandra** RF=3 + `LOCAL_QUORUM`/`LOCAL_QUORUM` per datacentre.
- **Kafka** `replication.factor=3`, `min.insync.replicas=2`, producer `acks=all` (an analogous durability quorum: a write survives one broker loss without blocking).
- **etcd / ZooKeeper** 3-node ensembles (Raft/ZAB majorities of 2).
- **MongoDB** 3-member replica set with `w: "majority"` and `readConcern: "majority"`.

#### Trade-offs
Robust and cost-efficient (3× storage), but only one failure is tolerated. Planned maintenance (taking one node down) leaves no slack for an unplanned failure at the same time, which is why some critical systems use N=5.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Outage during maintenance + unexpected failure | only 1 failure tolerated | N=5 for critical data, or careful maintenance windows |
| Two replicas in the same AZ | placement not AZ-aware | rack/AZ-aware placement |
| Kafka producers blocked with one broker down | min.insync = 3 | RF=3, min.insync=2 |

#### Cheat sheet
- N=3, W=2, R=2: one failure tolerated, overlapping reads.
- Place replicas in 3 different AZs.
- Need two-failure tolerance? N=5 with W=R=3.

#### Interview questions
<details><summary>Why is N=3, W=2, R=2 preferred over N=2, W=2, R=1?</summary>

With N=2 and W=2, any single replica failure blocks all writes, so there's no write availability under failure. N=3 with majority quorums tolerates one failure for both reads and writes while keeping overlap. Two replicas also can't form a majority after a partition, so you lose either consistency or availability immediately.
</details>

<details><summary>Map the N/W/R idea to Kafka's durability settings.</summary>

`replication.factor` ≈ N (copies per partition). `min.insync.replicas` + `acks=all` ≈ W: a write is acknowledged only when at least min.insync replicas in the ISR have it. Reads come from the partition leader, which only exposes messages replicated to the ISR (the high watermark), similar to reading committed data. RF=3, min.insync=2 survives one broker loss without data loss or blocking.
</details>

#### Interview angle
> "My default is three replicas across three AZs with majority writes and reads, in Cassandra, Kafka, etcd or MongoDB alike, which survives one failure with consistent reads. Five replicas only for data that must survive two."

#### Sources
- [Replication](https://kafka.apache.org/documentation/#replication) — Apache Kafka docs
- [Dynamo architecture in Cassandra: tunable consistency](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) — Apache Cassandra docs

### Gossip protocol — epidemic broadcast: each node periodically exchanges state with random peers, O(log N) convergence
Gossip (epidemic) protocols spread information the way rumours spread: periodically, each node picks a few **random peers** and exchanges state. New information reaches all N nodes in about **O(log N) rounds**, with no central coordinator and graceful tolerance of failures. It's used for membership, failure detection, metadata and anti-entropy. (Cassandra's implementation is covered in Phase 3.)

#### Intuition
A rumour in a school. Each pupil who knows tells a couple of others at random every break. Nobody organises it, and within a few breaks the whole school has heard.

#### Must know
- Each node regularly exchanges state with a few **random peers**.
- News reaches all N nodes in about **O(log N) rounds**.
- No central coordinator, and it tolerates failed nodes and lost messages.
- Used for cluster membership, failure detection and metadata.
- Views are **eventually consistent**: nodes can briefly disagree.

#### Common mistakes
- Using gossip where an exact, agreed answer is needed. That is a job for consensus.
- Shipping the full state in every message, which floods a large cluster.
- Declaring a node dead after one missed ping, with no indirect probe.

#### How it works
```mermaid
flowchart LR
  R0["Round 0: node A knows update"] --> R1["Round 1: A tells B (2 know)"]
  R1 --> R2["Round 2: A→C, B→D (4 know)"]
  R2 --> R3["Round 3: 8 know"]
  R3 --> RN["≈ log2(N) rounds → all N nodes (with fanout and randomness, robust to failures)"]
```

Variants:
- **Push**, **pull**, **push-pull** (exchange digests, then the missing data).
- **SWIM** (Scalable Weakly-consistent Infection-style Membership): ping and indirect ping for failure detection, plus piggybacked gossip for membership updates (used by Consul/Serf, HashiCorp memberlist).
- **Anti-entropy gossip**: periodically reconcile full state (Merkle trees).

#### Example
Consul agents form a SWIM gossip pool: each agent pings a random member every second. If there's no ack, it asks k other members to ping indirectly before suspecting. Suspicions and membership changes ride along on normal gossip messages. A 5,000-node cluster detects a failed node in seconds and propagates the change to all nodes in a few more seconds, with constant per-node network load.

#### Trade-offs
Scalable, decentralised and robust, but **eventually consistent** views (nodes briefly disagree), probabilistic delivery timing, and background bandwidth.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| False failure suspicions | packet loss, CPU starvation | indirect probes (SWIM), suspicion timeouts, Lifeguard extensions |
| Slow convergence | low fanout / long intervals | tune fanout and gossip interval |
| Gossip storms in huge clusters | large state payloads | send digests/deltas, not full state |

#### Cheat sheet
- Random peer exchanges converge in O(log N) rounds.
- Membership, failure detection (SWIM), metadata, anti-entropy.
- Eventually consistent views. Constant per-node cost.

#### Interview questions
<details><summary>Why does gossip converge in O(log N) rounds?</summary>

Each round, every node that knows the information tells at least one random peer, so the number of informed nodes roughly doubles each round (until saturation). Reaching N nodes therefore takes about log₂N rounds, and randomness plus fanout greater than 1 make it robust to failed nodes and lost messages.
</details>

<details><summary>How does SWIM reduce false positives in failure detection?</summary>

If a direct ping to a member fails, the prober asks k other random members to ping the target on its behalf (indirect probes). Only if none succeed is the member marked "suspect", and it gets a suspicion period to refute it (by gossiping that it's alive with a higher incarnation number) before being declared dead. That filters out transient network issues between two specific nodes.
</details>

#### Interview angle
> "For membership and failure detection in large clusters I'd use gossip, specifically SWIM-style indirect probes and piggybacked updates as in Consul. Per-node cost stays constant and changes spread in O(log N) rounds."

#### Sources
- [Gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol) — Wikipedia
- [Gossip protocol in Consul](https://developer.hashicorp.com/consul/docs/concept/gossip) — HashiCorp Consul docs

### Phi accrual failure detector — adaptive: outputs suspicion value φ, not binary up/down judgment
A phi accrual failure detector replaces "no heartbeat for X seconds means dead" with a continuous **suspicion level φ**, computed from the statistical distribution of past heartbeat arrival intervals. The application picks a threshold. It adapts automatically to network jitter and load, which reduces false positives. Cassandra and Akka use it.

#### Intuition
A friend who normally replies within a minute has been silent for ten: you start to worry. A friend who often takes an hour has been silent for ten minutes: you think nothing of it. The same silence means different things depending on their habits.

#### Must know
- It outputs a **suspicion level φ**, not a yes or no.
- φ is computed from the history of heartbeat arrival times, so it **adapts to the network's jitter**.
- The application sets the threshold at which a node counts as down.
- It gives fewer false alarms than a fixed timeout.
- No detector can tell a dead node from a very slow one, so correctness must rest on quorums and fencing.

#### Numbers to quote
- Cassandra's default `phi_convict_threshold` is 8.

#### Common mistakes
- A fixed heartbeat timeout tuned for a quiet day.
- Treating the detector's verdict as fact and acting destructively on it.
- A threshold so low that GC pauses make nodes flap.

#### How it works
```mermaid
flowchart LR
  H["Heartbeat inter-arrival history (sliding window): mean 1.0 s, stddev 0.1 s"] --> P["Time since last heartbeat: t"]
  P --> F["φ(t) = −log10(P(next heartbeat arrives later than t))"]
  F --> T{"φ > threshold (e.g. 8)?"}
  T -- "yes" --> D["mark node down (probability of mistake ≈ 10^-8)"]
  T -- "no" --> U["still considered up"]
```

Interpretation: φ = 1 means ~10% chance the node is actually alive and just late. φ = 8 means ~0.000001%. On a jittery network the distribution widens, so the same silence produces a lower φ, and the detector naturally becomes more patient.

Cassandra setting: `phi_convict_threshold` (default 8, raise to 10–12 in noisy cloud environments).

#### Example
A Cassandra cluster in the cloud had nodes flapping DOWN/UP during brief network hiccups and GC pauses, causing unnecessary hint storage and request rerouting. Raising `phi_convict_threshold` from 8 to 12 and fixing long GC pauses stopped the flapping, while real crashes were still detected within ~10–20 s.

#### Trade-offs
Adaptive and tunable as a probability rather than a fixed timeout, but detection time still depends on history and threshold, and it can't distinguish a slow node from a dead one.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Nodes flapping up/down | threshold too low for environment | raise threshold, fix GC/network jitter |
| Slow detection of real failures | threshold too high | lower threshold, add active probes |
| Detector skewed after long idle periods | stale history | bounded sliding window, minimum std-dev |

#### Cheat sheet
- φ = suspicion from heartbeat timing statistics. Threshold sets the trade-off.
- Adapts to jitter automatically.
- Cassandra `phi_convict_threshold` 8 by default, higher in noisy clouds.

#### Interview questions
<details><summary>Why is a fixed heartbeat timeout a poor failure detector?</summary>

Networks and hosts have variable latency (GC pauses, congestion, noisy neighbours). A short fixed timeout causes false positives under jitter, and a long one makes detection slow everywhere. A fixed value can't adapt to changing conditions. Phi accrual adapts the effective timeout to observed heartbeat behaviour.
</details>

<details><summary>Can any failure detector be perfect in an asynchronous network?</summary>

No. In an asynchronous system you can't distinguish a crashed node from a very slow one or a slow network (the FLP impossibility context). Detectors trade completeness (eventually suspect crashed nodes) against accuracy (don't suspect live ones). Systems therefore combine detectors with safety mechanisms (quorums, fencing) so that false suspicions don't cause incorrect behaviour.
</details>

#### Interview angle
> "Failure detection is a probability, not a fact. Phi accrual adapts to jitter, and I keep correctness safe with quorums and fencing regardless of what the detector says."

#### Sources
- [Failure detector](https://en.wikipedia.org/wiki/Failure_detector) — Wikipedia
- [Dynamo architecture in Cassandra: failure detection](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) — Apache Cassandra docs

### Read repair — detect stale replica during read, return latest to client, async update stale replica
Read repair fixes stale replicas **opportunistically on the read path**: when a read consults multiple replicas and their versions differ, the coordinator returns the newest value and **writes it back** to the replicas that were behind. Frequently read data converges quickly without background jobs. (Phase 3 covers Cassandra's specifics.)

#### Intuition
You ask two colleagues the same question, get two different answers, and take the more recent one. While you are there, you tell the colleague who was out of date.

#### Must know
- When a read sees replicas with different versions, it returns the newest and **writes it back to the stale ones**.
- Frequently read data converges quickly, with no background job.
- It fixes **only data that is read**, and only when several replicas are consulted.
- Blocking repair fixes before replying. Asynchronous repair replies first.
- Cold data still needs anti-entropy repair.

#### Common mistakes
- Relying on read repair as the only convergence mechanism.
- Expecting it to work on single-replica reads.
- Forgetting that the repair adds latency to the read that triggers it.

#### How it works
```mermaid
sequenceDiagram
  participant Co as Coordinator
  participant A as Replica A (v7)
  participant B as Replica B (v5, stale)
  participant C as Replica C (v7)
  Co->>A: read key (full data)
  Co->>B: read key (digest)
  A-->>Co: v7
  B-->>Co: digest(v5), mismatch
  Co->>B: fetch full, resolve → v7 newest
  Co->>B: write v7 (repair)
  Co-->>Co: return v7 to client
```

Variants: **blocking** (repair before responding, which gives monotonic quorum reads) vs **asynchronous** (respond first, repair in the background). Used in Cassandra, Riak, Dynamo-style systems and some caches.

#### Example
After a node in a 3-replica user-profile store was briefly partitioned, it missed updates for 2% of users. Hot profiles (read thousands of times a day) were repaired within minutes via quorum reads. Rarely accessed profiles stayed stale until the weekly anti-entropy repair, which is why both mechanisms are needed.

#### Trade-offs
Free convergence for hot data, but extra latency on reads that trigger repairs, no help for cold data, and tricky with deletes (tombstones must be propagated properly).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Cold data stays inconsistent | never read | scheduled anti-entropy |
| Read latency spikes after outages | many blocking repairs | expected briefly, run full repair to clear backlog |
| Deleted data resurrected | stale replica + purged tombstones | repairs within gc_grace, careful tombstone handling |

#### Cheat sheet
- Compare versions on read, return newest, fix stale replicas.
- Only for data that's read (at CL > 1).
- Complement with anti-entropy and hinted handoff.

#### Interview questions
<details><summary>Why do Dynamo-style systems need read repair, hinted handoff and anti-entropy together?</summary>

Each covers a different gap. Hinted handoff fixes replicas that were briefly down (within the hint window). Read repair fixes inconsistencies on data that gets read. Anti-entropy (Merkle tree comparison) systematically fixes everything else, including cold data and failures beyond the hint window. Together they make eventual consistency actually converge.
</details>

<details><summary>Blocking vs asynchronous read repair: what's the trade-off?</summary>

Blocking repair (write back before responding) guarantees that once a quorum read returns a value, subsequent quorum reads won't return older values (monotonicity), but it adds latency to that read. Asynchronous repair responds faster but allows a subsequent read to hit a still-stale replica before the repair lands.
</details>

#### Interview angle
> "Read repair converges hot keys as a side effect of quorum reads. Anti-entropy and hinted handoff cover cold data and recovering nodes."

#### Sources
- [Read repair](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/read_repair.html) — Apache Cassandra docs
- [Dynamo: Amazon's highly available key-value store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — DeCandia et al., SOSP 2007

### Anti-entropy repair — Merkle tree comparison between nodes, repair differences in background
Anti-entropy is a background process that makes replicas identical by comparing their data and transferring differences. To avoid shipping everything, replicas build **Merkle trees** (hash trees over key ranges) and exchange hashes top-down, transferring only ranges whose hashes differ. (Phase 3 covers Cassandra repair operations.)

#### Intuition
Two accountants reconciling ledgers. They compare the grand total first. If it differs, they compare chapter totals, then page totals, and only re-read the few pages that do not match.

#### Must know
- A background process that makes replicas identical.
- Each replica builds a **Merkle tree**: hashes of key ranges, with each parent hashing its children.
- Compare from the root down, and transfer only the ranges whose hashes differ.
- It is the only mechanism that covers **data nobody reads**.
- It is heavy on CPU and I/O, so schedule and throttle it.

#### Common mistakes
- Never running it.
- One enormous repair at peak time.
- Thinking Merkle trees are only a blockchain idea. Git and file sync use them too.

#### How it works
```mermaid
flowchart TD
  subgraph A["Replica A Merkle tree"]
    A0["root: H(H1,H2)"] --> A1["H1 (keys 0–499)"]
    A0 --> A2["H2 (keys 500–999)"]
    A2 --> A21["H21 (500–749)"]
    A2 --> A22["H22 (750–999)"]
  end
  CMP["Compare roots ≠ → compare children: H1 equal, H2 differs → H22 differs"] --> S["Stream only keys 750–999 between replicas"]
```

Used by: Cassandra (`nodetool repair`), Riak (active anti-entropy), DynamoDB internals, Amazon S3, Git-like sync systems, blockchain light clients (Merkle proofs).

#### Example
After a disk replacement, a Cassandra node rebuilt from peers still had subtle gaps. A scheduled Reaper repair built Merkle trees per token range on each replica, compared them, and streamed only the mismatched sub-ranges (a few hundred MB instead of 2 TB), and the replicas converged within an hour.

#### Trade-offs
Efficient, complete convergence, but building trees costs CPU and I/O, and coarse trees cause over-streaming (sending more than necessary). It must be scheduled and monitored.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Repairs overload cluster | full repairs of large ranges | subrange/incremental repairs, throttling |
| Over-streaming | coarse Merkle tree leaves | finer subranges |
| Repairs never complete | too large/too slow, failing mid-way | schedulers (Reaper), smaller units, monitoring |

#### Cheat sheet
- Merkle trees: compare top-down, sync only differing ranges.
- Covers all data (including cold and deleted).
- Schedule regularly. Subrange + throttle.

#### Interview questions
<details><summary>How do Merkle trees make replica comparison efficient?</summary>

Each leaf hashes a small key range and each parent hashes its children. Two replicas compare root hashes: if equal, all data matches and nothing is transferred. If different, they recurse only into children whose hashes differ, isolating mismatched ranges with O(log n) comparisons, and then transfer only those ranges' data.
</details>

<details><summary>Where else are Merkle trees used beyond database repair?</summary>

Git (content-addressed commits and trees), file sync tools and backup deduplication, certificate transparency logs, blockchains (Merkle proofs that a transaction is in a block), and storage systems verifying integrity (ZFS checksums, IPFS).
</details>

#### Interview angle
> "Background anti-entropy compares Merkle trees per range and streams only what differs, which is what guarantees eventual consistency for data that's never read."

#### Sources
- [Merkle tree](https://en.wikipedia.org/wiki/Merkle_tree) — Wikipedia
- [Repair](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/repair.html) — Apache Cassandra docs

### Hinted handoff — store writes for unavailable nodes locally, replay when node recovers
Hinted handoff keeps writes flowing when a replica is temporarily down: another node (the coordinator) accepts the write **on behalf of** the missing replica, stores it as a **hint**, and **replays** it when the replica comes back. That shortens recovery for brief outages. (Phase 3 covers Cassandra's specifics.)

#### Intuition
A colleague is away, so you keep the notes meant for them in an envelope with their name on it and hand it over when they are back.

#### Must know
- When a replica is down, another node **stores the write as a hint** and replays it later.
- Writes keep flowing through short outages, and the returning node catches up fast.
- Hints are kept for a **limited window**. After a longer outage the node needs a full repair.
- A **sloppy quorum** counts writes on substitute nodes toward W: more available, weaker guarantee.
- It is best-effort. It does not replace anti-entropy.

#### Common mistakes
- Treating a hint as a successful write to the real replica.
- Bringing a node back after a long outage with no repair.
- Mixing up strict and sloppy quorums.

#### How it works
```mermaid
sequenceDiagram
  participant C as Client
  participant Co as Coordinator
  participant A as Replica A
  participant B as Replica B (down)
  C->>Co: write key K
  Co->>A: write
  A-->>Co: ack
  Co->>Co: store hint {target: B, mutation}
  Co-->>C: success (if consistency level met by real replicas)
  Note over B: B returns, gossip says UP
  Co->>B: replay hints
  B-->>Co: ack, hint deleted
```

Related: **sloppy quorum** (Dynamo), where if home replicas are unreachable the write goes to other healthy nodes temporarily (with hints), increasing availability but weakening quorum guarantees.

#### Example
During a rolling OS patch, each Cassandra node reboots for ~4 minutes. Hints accumulated on coordinators bring each node up to date immediately after it rejoins, so reads at LOCAL_QUORUM remain consistent and full repairs aren't needed after every reboot. A node down for 10 hours (beyond the 3-hour hint window) must be repaired before serving.

#### Trade-offs
Fast catch-up after short outages, but hints consume coordinator disk, replay adds load, hints expire, and with sloppy quorums a "successful" write may not be on its home replicas yet.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Node stale after long outage | hints expired | repair before rejoining reads |
| Coordinator disks fill | huge hint backlog | cap hints, replace/repair failed node quickly |
| Recovered node overloaded | hint replay burst | replay throttling |

#### Cheat sheet
- Store-and-forward writes for briefly down replicas.
- Window-limited (~hours). Repair after longer outages.
- Doesn't count toward consistency level (except Dynamo-style sloppy quorums / CL ANY).

#### Interview questions
<details><summary>What's the difference between a strict quorum and a sloppy quorum?</summary>

A strict quorum requires W acknowledgements from the key's designated home replicas, so if too many are down, writes fail. A sloppy quorum accepts writes on any W healthy nodes (including non-home nodes holding hints) to stay available, then hands data back to the home replicas later. Higher availability, but a subsequent read from home replicas might miss the write until handoff completes.
</details>

<details><summary>Why can't hinted handoff replace anti-entropy repair?</summary>

Hints are kept only for a limited window and only on the coordinators that handled each write. Coordinators can fail and lose hints, and replicas can diverge for reasons other than downtime (dropped mutations, bugs, disk issues). Anti-entropy systematically compares all data, so it's needed for guaranteed convergence.
</details>

#### Interview angle
> "Hinted handoff covers replicas that are down for minutes during restarts. Anything longer than the hint window requires a repair before the node serves reads again."

#### Sources
- [Hints](https://cassandra.apache.org/doc/latest/cassandra/managing/operating/hints.html) — Apache Cassandra docs
- [Dynamo: Amazon's highly available key-value store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) — DeCandia et al., SOSP 2007

### CRDTs — Conflict-free Replicated Data Types: G-counter, PN-counter, LWW-Register, OR-Set, 2P-Set
CRDTs are data structures designed so that replicas can **update independently and merge automatically** into the same state, regardless of the order or number of times updates are received. They provide strong eventual consistency without coordination, ideal for multi-region, offline-first and collaborative systems.

#### Intuition
Vote tallies kept at each polling station. Every station counts its own votes, and the national total is the sum of the latest figure from each station. Merging the same report twice, or in a different order, never changes the result.

#### Must know
- Data types that replicas can **update independently and always merge to the same state**.
- The merge is commutative, associative and idempotent, so order and repeats do not matter.
- **G-Counter**: increment only. **PN-Counter**: increment and decrement.
- **OR-Set**: add and remove repeatedly, and an add beats a concurrent remove.
- They cannot enforce invariants such as stock ≥ 0 or uniqueness.

#### Common mistakes
- Using a 2P-Set for a cart, where a removed item can never be re-added.
- Proposing CRDTs for balances or inventory.
- Ignoring the metadata and tombstones they accumulate.

#### How it works
```mermaid
flowchart TD
  T["CRDT families"] --> SB["State-based (CvRDT): ship full state, merge = join (max/union). Needs commutative, associative, idempotent merge"]
  T --> OB["Operation-based (CmRDT): ship operations, which must commute. Needs reliable causal delivery"]
  SB --> EX1["G-Counter: per-replica counts, merge = per-entry max, value = sum"]
  SB --> EX2["OR-Set: adds tagged with unique ids, remove deletes observed tags (add wins over concurrent remove)"]
  OB --> EX3["Sequence CRDTs (RGA, Yjs): insert/delete operations with unique positions"]
```

| CRDT | Operations | Merge / semantics |
|---|---|---|
| G-Counter | increment | per-replica max, sum |
| PN-Counter | increment, decrement | two G-Counters (P − N) |
| G-Set | add | union |
| 2P-Set | add, remove (once) | add-set ∪, remove-set (tombstones). Removed elements can't be re-added |
| OR-Set | add, remove (repeatable) | unique tags. Remove only affects observed tags |
| LWW-Register | set | highest timestamp wins |
| MV-Register | set | keep concurrent values (siblings) |

#### Example
A multi-region "online presence" and "likes" service: likes are a PN-counter per post replicated across Mumbai, Frankfurt and Virginia, and each region increments locally while gossip merges states. Users' "followed topics" are an OR-Set, so following in one region and unfollowing in another resolve deterministically (add-wins for concurrent operations). Redis Enterprise Active-Active, Riak data types, Akka Distributed Data and Automerge/Yjs offer CRDTs off the shelf.

#### Trade-offs
Coordination-free and partition-tolerant with deterministic convergence, but metadata overhead (tags, tombstones, per-replica vectors), limited semantics (no global invariants or uniqueness), and sometimes counter-intuitive merge outcomes.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Removed element reappears | G-Set/2P-Set misuse or concurrent add | OR-Set (or choose add-wins/remove-wins explicitly) |
| State size grows | tombstones and per-replica entries | causal stability GC, delta-CRDTs |
| Business rule broken (stock < 0) | CRDT can't enforce invariants | bounded counters/escrow or coordination for that operation |

#### Cheat sheet
- Merge is commutative, associative and idempotent, so replicas converge without coordination.
- Counters (G/PN), sets (G, 2P, OR), registers (LWW, MV), sequences (Yjs/Automerge).
- Use for counters, presence, carts, collaboration. Not for invariants.

#### Interview questions
<details><summary>Explain how a PN-Counter works and why it converges.</summary>

Each replica keeps two maps: increments per replica (P) and decrements per replica (N), and only updates its own entry. Merging takes the per-replica maximum of each map (state-based), and the value is ΣP − ΣN. Because merge is a max over per-replica monotonically growing counters, it's commutative, associative and idempotent: any order of merges, repeated or not, yields the same result.
</details>

<details><summary>OR-Set vs 2P-Set: which would you use for a shopping cart and why?</summary>

An OR-Set: users repeatedly add and remove the same item, and a 2P-Set forbids re-adding an element once it's removed. The OR-Set tags each add uniquely, and a remove deletes only the tags it observed, so concurrent add and remove of the same item keeps the add (add-wins), which suits carts.
</details>

#### Interview angle
> "For multi-region counters, presence and carts I use CRDTs (PN-counters, OR-Sets), so every region accepts writes locally and converges deterministically. Invariants like stock or balance still need coordination."

#### Sources
- [Conflict-free replicated data type](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) — Wikipedia
- [About CRDTs](https://crdt.tech/) — crdt.tech

### At-most-once delivery — fire and forget, may lose messages (UDP, basic HTTP without retry)
At-most-once delivery sends a message **zero or one times**: there are no retries, so failures cause **loss** but never duplicates. It's the cheapest delivery guarantee, appropriate when losing occasional messages is acceptable and duplicates would be harmful or pointless.

#### Intuition
Shouting a message across a noisy room once. Maybe they heard, maybe not. You will not repeat it, so they never hear it twice.

#### Must know
- The message is delivered **zero or one times**. No retries.
- **Loss is possible, duplicates are not.**
- Suitable for metrics, telemetry and presence pings, where the next sample replaces a lost one.
- It also happens by accident: a consumer that **acknowledges before processing** loses the message if it crashes.
- Never use it for orders, payments or anything a user relies on.

#### Common mistakes
- Kafka auto-commit with slow processing, which is at-most-once in disguise.
- Choosing it for business events because it is simple.
- Adding retries to a metrics pipeline, which adds load exactly during incidents.

#### How it works
```mermaid
sequenceDiagram
  participant P as Producer
  participant B as Broker / receiver
  participant C as Consumer
  P->>B: message (no retry on failure)
  Note over P,B: lost in network → gone forever
  B->>C: deliver
  C->>B: ack BEFORE processing (auto-commit)
  C->>C: crash while processing → message lost (already acked)
```

Ways it arises:
- UDP fire-and-forget (metrics, StatsD).
- Producer without retries (Kafka `acks=0` or `retries=0`).
- Consumer that **commits offsets before processing** (Kafka auto-commit with slow processing): a crash loses the message.

#### Example
Telemetry and metrics pipelines: StatsD counters over UDP from 2,000 servers. Losing 0.1% of samples barely changes dashboards, and retries would add load during incidents, exactly when the network is stressed. Never use at-most-once for orders, payments or notifications users rely on.

#### Trade-offs
Lowest latency and overhead with no duplicate handling, at the cost of silent loss.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Orders/events occasionally missing | consumer commits before processing | commit after processing (at-least-once) + idempotency |
| Lost messages on broker failure | `acks=0` / no replication | `acks=all`, replication, retries |
| Metrics gaps during incidents | UDP drops under load | accept, or use pull-based metrics (Prometheus) |

#### Cheat sheet
- 0 or 1 deliveries: loss possible, no duplicates.
- Fine for metrics, telemetry, presence pings.
- Commit-before-process accidentally creates at-most-once.

#### Interview questions
<details><summary>How can a Kafka consumer accidentally become at-most-once?</summary>

With auto-commit enabled (or committing manually before processing), offsets can be committed for messages that haven't finished processing. If the consumer crashes, it restarts from the committed offset and those messages are skipped. Fix: disable auto-commit and commit only after successful processing (at-least-once), with idempotent handlers.
</details>

<details><summary>When is at-most-once actually the right choice?</summary>

When data is high-volume, individually low-value and quickly superseded (metrics samples, location pings every few seconds, presence heartbeats, debug logs), and duplicates or retry overhead would be worse than occasional loss. The next message makes up for a lost one.
</details>

#### Interview angle
> "At-most-once is only for telemetry-style data where the next sample supersedes the last. Business events are at-least-once with idempotent consumers, and offsets are committed only after processing."

#### Sources
- [Message delivery semantics](https://kafka.apache.org/documentation/#semantics) — Apache Kafka docs
- [Reliability guide](https://www.rabbitmq.com/docs/reliability) — RabbitMQ docs

### At-least-once delivery — retry until ack; messages may be duplicated, require idempotent consumers
At-least-once delivery **retries until the message is acknowledged**, so nothing is lost, but the same message may be delivered (and processed) **more than once** (after timeouts, crashes before ack, rebalances). It's the default guarantee of most queues (SQS, Kafka consumers committing after processing, RabbitMQ with acks, webhooks), and it demands **idempotent consumers**.

#### Intuition
A courier who keeps coming back until someone signs for the parcel. You will certainly get it, but if your signature gets lost in the paperwork, a second parcel turns up.

#### Must know
- Retry until acknowledged: **nothing is lost, but duplicates happen**.
- The default for most queues: SQS, RabbitMQ with acks, Kafka when you commit after processing.
- Consumers **must be idempotent**.
- Idempotency methods: a dedupe table keyed by message id, upserts, conditional state changes, version checks.
- Send messages that always fail to a **dead-letter queue**.

#### Common mistakes
- A consumer with side effects and no dedupe, which sends two emails or charges twice.
- A visibility timeout shorter than the processing time, which redelivers work still in progress.
- Recording the dedupe id outside the transaction that performs the side effect.

#### How it works
```mermaid
sequenceDiagram
  participant Q as Queue
  participant C as Consumer
  participant DB
  Q->>C: message M (id m-77)
  C->>DB: process M (charge, insert row)
  C--xQ: crash before ack
  Note over Q: visibility timeout expires → redeliver
  Q->>C: M again
  C->>DB: INSERT processed(m-77) → already exists → skip side effect
  C->>Q: ack
```

Making consumers idempotent:
- **Dedupe table**: record processed message ids (unique constraint) in the same transaction as the side effect.
- **Naturally idempotent operations**: upserts, `SET status = 'PAID' WHERE status = 'PENDING'`, PUT-style writes.
- **Versioned updates**: apply only if the event version is greater than the stored version.
- Idempotency keys toward downstream APIs.

#### Example
A notification consumer on SQS sent duplicate SMS when processing took longer than the visibility timeout (the message reappeared and a second worker sent it again). Fixes: extend the visibility timeout (or heartbeat it), record `notification_id` in a dedupe table before sending (conditional insert), and use the SMS provider's idempotency key.

#### Trade-offs
No loss, simple to provide, at the cost of duplicates that every consumer must handle, plus dedupe storage.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Duplicate emails/charges | redelivery after timeout/crash | idempotent consumer (dedupe by message id), longer visibility timeout |
| Poison message retried forever | always fails | max receive count → dead-letter queue |
| Dedupe table grows forever | no cleanup | TTL/partitioned dedupe table (keep ids for retention window) |

#### Cheat sheet
- Retry until ack: no loss, duplicates possible.
- Idempotent consumers: dedupe table, upserts, versioned updates.
- DLQ for poison messages. Tune visibility timeouts.

#### Interview questions
<details><summary>How do you make a "send welcome email" consumer safe under at-least-once delivery?</summary>

Give each event a unique id. In the consumer, insert the id into a `processed_events` table with a unique constraint (or a conditional put in DynamoDB) before or atomically with sending. If the insert fails because the id exists, skip. Pass an idempotency key to the email provider if supported, and expire old ids after the maximum redelivery window.
</details>

<details><summary>Why is at-least-once usually preferred over at-most-once for business events?</summary>

Losing business events (orders, payments, state changes) silently corrupts system state and is hard to detect, while duplicates can be neutralised with idempotency, which is a well-understood, local engineering task. At-least-once plus idempotent processing gives effectively-once outcomes.
</details>

#### Interview angle
> "Business events are at-least-once: commit or ack after processing, consumers are idempotent through a dedupe table in the same transaction as the side effect, and poison messages go to a DLQ."

#### Sources
- [Message delivery semantics](https://kafka.apache.org/documentation/#semantics) — Apache Kafka docs
- [Amazon SQS at-least-once delivery](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html) — Amazon SQS developer guide

