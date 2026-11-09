## NewSQL & cloud databases

### Google Spanner — globally distributed, external consistency, TrueTime (GPS + atomic clocks)
Spanner is Google's globally distributed relational database: SQL, schemas and ACID transactions **across regions**, with **external consistency** (the strongest guarantee: if transaction T1 commits before T2 starts, T2 sees T1's effects everywhere). It combines Paxos-replicated data splits with **TrueTime**, a clock API with bounded uncertainty.

#### How it works
```mermaid
flowchart TD
  C["Client"] --> F["Spanner front end"]
  F --> L1["Split A leader (Paxos group across regions)"]
  F --> L2["Split B leader (Paxos group)"]
  L1 --- R1["replica us-east"]
  L1 --- R2["replica europe"]
  L1 --- R3["replica asia"]
  L1 -. "cross-split transaction: 2PC with one leader as coordinator, each participant a Paxos group" .-> L2
  TT["TrueTime: now() = [earliest, latest], ε ≈ 1–7 ms"] -.-> L1
```

- Data is split into ranges (**splits**). Each split is a **Paxos group** of replicas across zones and regions, with a leader.
- Writes take locks at the leaders. Cross-split transactions use **2PC over Paxos groups** (so participants themselves are fault-tolerant, which avoids classic 2PC blocking).
- Commit timestamps come from TrueTime plus **commit wait** (next topic), which gives external consistency.
- Reads can be **strong** (latest) or **stale** at a timestamp (lock-free, served by any replica).

#### Example
A global ledger for a payments company: accounts in Mumbai and Frankfurt, and a transfer between them is a single ACID transaction. Commit latency is tens to hundreds of ms because Paxos quorums span regions (configure regional instances when users are mostly local). Balance reads for dashboards use stale reads (`exact_staleness = 10s`) from the nearest replica, fast and lock-free.

#### Trade-offs
Strong global consistency and SQL with horizontal scale and high availability (99.999% multi-region SLA), at the cost of higher write latency for cross-region quorums, GCP lock-in and cost. Schema design needs care to avoid hotspots (monotonic keys).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Write hotspot on one split | monotonically increasing primary key (timestamp, sequence) | UUIDv4 / bit-reversed sequences, hash prefix |
| High commit latency | multi-region quorum on every write | regional config for local workloads, batch writes |
| Read latency high for global users | strong reads go to leaders | stale reads / bounded staleness from nearest replica |
| Lock contention aborts | long read-write transactions | short transactions, read-only transactions for reads |

#### Cheat sheet
- Global SQL + ACID + external consistency. Paxos per split, 2PC across splits.
- TrueTime + commit wait gives timestamps that respect real-time order.
- Avoid monotonic keys. Stale reads for low-latency reads.

#### Interview questions
<details><summary>How does Spanner provide external consistency across data centers?</summary>

Each transaction gets a commit timestamp from TrueTime, which returns an interval guaranteed to contain true time. The leader picks a timestamp at least TrueTime's latest bound and then waits until TrueTime's earliest bound has passed that timestamp (commit wait, a few ms) before making the commit visible. So any transaction starting after the commit is acknowledged gets a strictly larger timestamp, and timestamp order matches real-time order globally. Paxos replicates each split and 2PC coordinates multi-split transactions.
</details>

<details><summary>Why is a monotonically increasing primary key bad in Spanner?</summary>

Spanner range-partitions by primary key, so increasing keys (timestamps, sequences) send all new inserts to the last split, one server's leader, creating a write hotspot that no amount of splitting fixes. Use UUIDv4, a hashed prefix, or bit-reversed sequences to spread inserts.
</details>

#### Interview angle
> "For a globally consistent ledger I'd consider Spanner: Paxos per split, 2PC across splits and TrueTime commit wait give external consistency. I'd pay the cross-region write latency and use stale reads for dashboards."

### TrueTime — returns [earliest, latest] time interval, commit wait ensures monotonicity
TrueTime is Google's clock API that admits uncertainty: `TT.now()` returns an interval **[earliest, latest]** guaranteed to contain the true absolute time. GPS receivers and atomic clocks in every data centre keep the uncertainty ε small (typically 1–7 ms). Spanner uses it to assign commit timestamps that respect real-time order.

#### How it works
```mermaid
sequenceDiagram
  participant L as Spanner leader
  participant TT as TrueTime
  L->>TT: now()
  TT-->>L: [earliest = 100, latest = 104]
  L->>L: choose commit timestamp s = 104 (≥ latest)
  Note over L: commit wait: hold locks until TT.now().earliest > 104
  L->>TT: now() (about 4 ms later)
  TT-->>L: [105, 109], earliest > s
  L->>L: release locks, acknowledge commit
  Note over L: any transaction starting later gets timestamp > 104, so real-time order is preserved
```

- **Commit wait** costs ≈ 2ε per write transaction (a few ms), which is why keeping ε small with GPS and atomic clocks matters.
- Without bounded uncertainty, timestamps from different machines can't be safely compared, and systems fall back to logical clocks or a central timestamp oracle (TiDB's PD, Percolator).
- CockroachDB uses **hybrid logical clocks** and a max clock offset (default 500 ms) with uncertainty restarts instead of hardware clocks.

#### Example
Two transactions on different continents: T1 commits in Iowa at timestamp 104 after commit wait. T2 starts in Belgium 1 ms after T1's acknowledgement. TrueTime guarantees T2's timestamp is > 104, so a snapshot read at T2's timestamp includes T1's write, which is exactly the external consistency guarantee, with no coordination between the two regions beyond clocks.

#### Trade-offs
Delivers global ordering with no central coordinator, but requires special hardware and clock infrastructure, and every write pays commit wait.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| (in your own system) inconsistent ordering across servers | comparing NTP wall clocks with unknown skew | hybrid logical clocks, central timestamp oracle, or consensus |
| Large uncertainty → slow commits | poor clock sync | better time sync (PTP, Amazon Time Sync / ClockBound) |

#### Cheat sheet
- `TT.now()` = interval containing true time, ε ≈ few ms.
- Commit timestamp ≥ latest, then wait until earliest > timestamp (commit wait).
- Gives external consistency without a central timestamp server.

#### Interview questions
<details><summary>Why can't we just use NTP timestamps to order transactions across data centres?</summary>

NTP clocks have unknown and variable skew (milliseconds to seconds, and jumps), so a later transaction on a lagging machine can get a smaller timestamp than an earlier one elsewhere, which breaks ordering and snapshot consistency. TrueTime makes the uncertainty explicit and bounded, and commit wait outlasts it. Without that, you need logical clocks or a central timestamp oracle.
</details>

<details><summary>What is commit wait and what does it cost?</summary>

After choosing a commit timestamp s (at least TrueTime's upper bound), the leader waits until TrueTime's lower bound exceeds s before releasing locks and acknowledging. That guarantees s is in the past everywhere when clients learn of the commit. It costs about twice the clock uncertainty (a few ms) of added latency per read-write transaction.
</details>

#### Interview angle
> "TrueTime turns clock uncertainty into a bounded interval, and commit wait outlasts that interval, so timestamp order matches real-time order across continents without a central sequencer."

### CockroachDB — distributed Postgres-compatible, Raft consensus per range
CockroachDB is an open-source distributed SQL database that speaks the **PostgreSQL wire protocol**. Data is split into ~512 MB **ranges**, each replicated (default 3×) with **Raft**. Transactions are serializable by default and span ranges and regions, using hybrid logical clocks instead of special hardware.

#### How it works
```mermaid
flowchart LR
  App["App (Postgres driver)"] --> GW["Any node (SQL gateway)"]
  GW --> R1["Range [a–m): Raft group, leaseholder on node 1"]
  GW --> R2["Range [m–z): Raft group, leaseholder on node 3"]
  R1 --- N1["node 1"]
  R1 --- N2["node 2"]
  R1 --- N4["node 4"]
  R2 --- N3["node 3"]
  R2 --- N2b["node 2"]
  R2 --- N5["node 5"]
```

- Every node can accept SQL. A **leaseholder** per range serves reads and coordinates writes, and Raft replicates them.
- Ranges split and rebalance automatically as data grows.
- **Serializable** isolation by default (Read Committed also available in newer versions), with transaction retries on contention (error `40001`).
- Multi-region features: `REGIONAL BY ROW` tables (each row homed in a region), `GLOBAL` tables (fast reads everywhere), and survival goals (zone or region failure).

#### Example
A fintech needs Postgres semantics but must survive a full AWS region loss: a CockroachDB cluster across `ap-south-1`, `ap-southeast-1` and `ap-northeast-1` with `SURVIVE REGION FAILURE`. User rows are `REGIONAL BY ROW` homed by user region (low-latency local reads and writes). Reference data (currencies, fees) is `GLOBAL`. Losing Mumbai entirely keeps the database available with no data loss.

#### Trade-offs
Horizontal scale, automatic rebalancing and strong consistency with Postgres compatibility. But per-transaction latency is higher than single-node Postgres (consensus round trips), and compatibility isn't complete (some extensions or features are missing). Contention leads to retries.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Frequent `40001` retry errors | serializable contention | client-side retry loops, smaller transactions, `SELECT FOR UPDATE` |
| Hotspot range | sequential primary keys (SERIAL) | UUIDs or hash-sharded indexes |
| Slow cross-region transactions | rows homed far away | REGIONAL BY ROW homing, follower reads for stale-OK queries |
| Feature missing vs Postgres | partial compatibility | check docs, adapt (e.g. no some extensions) |

#### Cheat sheet
- Postgres-wire distributed SQL. Ranges with Raft (RF 3+), leaseholders.
- Serializable by default. Implement retry loops.
- Multi-region: REGIONAL BY ROW, GLOBAL tables, survival goals.

#### Interview questions
<details><summary>When would you choose CockroachDB over sharded PostgreSQL?</summary>

When you need horizontal scale and multi-region resilience with strong consistency and cross-shard ACID transactions, without building sharding logic yourself, and you can accept higher per-transaction latency and some Postgres feature gaps. Sharded Postgres (Citus or app-level) gives lower latency and full Postgres features, but cross-shard transactions, rebalancing and failover become your job.
</details>

<details><summary>Why does CockroachDB tell clients to retry transactions?</summary>

It runs serializable isolation optimistically. When concurrent transactions conflict, or a read encounters a value within the clock-uncertainty window, one transaction must restart to preserve serializability, and the error (40001) is sent to the client. Applications wrap transactions in retry loops (the drivers and ORMs provide helpers).
</details>

#### Interview angle
> "If we need Postgres semantics with region-failure survival, I'd use CockroachDB, homing rows to regions with REGIONAL BY ROW and wrapping transactions in retry loops."

### TiDB — MySQL-compatible, separates compute (TiDB) from storage (TiKV with Raft)
TiDB is an open-source distributed SQL database compatible with the **MySQL protocol**. It separates stateless **SQL compute nodes** (TiDB) from distributed transactional **storage** (TiKV, a Raft-replicated key-value store on RocksDB), plus a **Placement Driver (PD)** for metadata and timestamps. It optionally adds **TiFlash** columnar replicas for analytics (HTAP).

#### How it works
```mermaid
flowchart TD
  App["App (MySQL driver)"] --> T1["TiDB server (stateless SQL)"]
  App --> T2["TiDB server"]
  T1 --> PD["PD: region map + timestamp oracle (TSO)"]
  T1 --> K1["TiKV: Region 1 (Raft leader)"]
  T1 --> K2["TiKV: Region 2"]
  T2 --> K3["TiKV: Region 3"]
  K1 -. "Raft learner (async)" .-> F["TiFlash columnar replica for analytics"]
```

- Data is split into ~96 MB **Regions**, each a Raft group (3 replicas).
- Transactions use a **Percolator**-style 2PC with timestamps from PD's **TSO** (a central timestamp oracle).
- Scale SQL and storage independently. Add TiFlash for real-time analytics on the same data without ETL.

#### Example
An Indian e-commerce company outgrows sharded MySQL (manual shard routing, painful resharding). Migrating to TiDB keeps the MySQL protocol and most SQL. Data auto-splits across TiKV nodes, and TiFlash serves the merchant analytics dashboards (aggregations over billions of rows) on fresh data without affecting OLTP queries.

#### Trade-offs
MySQL compatibility, horizontal scale and HTAP, but the central TSO adds a dependency (highly available but a cross-zone round trip per transaction), latency is higher than single-node MySQL, and it's another complex system to operate (or pay for TiDB Cloud).

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Write hotspot | AUTO_INCREMENT / sequential keys | `AUTO_RANDOM`, `SHARD_ROW_ID_BITS` |
| Analytics hurting OLTP | heavy scans on TiKV | TiFlash replicas, route analytics there |
| Large transaction failures | transaction size limits / memory | batch DML, use `BATCH` statements |

#### Cheat sheet
- MySQL-compatible distributed SQL: TiDB (SQL) + TiKV (Raft KV) + PD (metadata, TSO).
- Percolator-style 2PC with a central timestamp oracle.
- TiFlash = columnar replica for HTAP. Use AUTO_RANDOM against hotspots.

#### Interview questions
<details><summary>How does TiDB generate transaction timestamps, and what's the trade-off versus Spanner?</summary>

TiDB gets start and commit timestamps from PD's centralised timestamp oracle (TSO), a highly available Raft-backed service that hands out monotonically increasing timestamps (batched). It needs no special clocks, unlike Spanner's TrueTime, but every transaction needs a round trip to PD, which adds latency and makes cross-region deployments slower.
</details>

<details><summary>What is HTAP and how does TiDB implement it?</summary>

Hybrid Transactional/Analytical Processing: running OLTP and OLAP on the same fresh data. TiDB keeps row-based TiKV replicas for transactions and asynchronously replicated columnar TiFlash replicas (Raft learners) for analytics. The optimizer can route analytical queries to TiFlash, so dashboards query live data without ETL or hurting OLTP latency.
</details>

#### Interview angle
> "To escape manually sharded MySQL, TiDB keeps the MySQL protocol while splitting data into Raft regions automatically, and TiFlash replicas give real-time analytics without ETL."

### YugabyteDB — PostgreSQL-compatible distributed SQL, uses DocDB storage engine
YugabyteDB is a distributed SQL database that **reuses PostgreSQL's query layer** (YSQL), for high compatibility (many extensions, stored procedures, triggers), on top of **DocDB**, a distributed document store derived from RocksDB with Raft replication per tablet. It also offers a Cassandra-compatible API (YCQL).

#### How it works
```mermaid
flowchart TD
  App["App (Postgres driver)"] --> Q["YSQL layer (forked Postgres query engine) on every node"]
  Q --> D["DocDB: tables sharded into tablets (hash or range)"]
  D --> T1["Tablet 1: Raft group (3 replicas)"]
  D --> T2["Tablet 2: Raft group"]
  D --> T3["Tablet 3: Raft group"]
  M["YB-Master: metadata, tablet placement, load balancing"] -.-> D
```

- Tables shard automatically into tablets by **hash** (default) or **range** of the primary key.
- Raft per tablet. Hybrid logical clocks for distributed transactions (snapshot and serializable isolation, plus read committed).
- Geo features: tablespaces pinned to regions, read replicas, xCluster async replication between clusters.

#### Example
A bank modernising a monolithic Oracle/Postgres app wants horizontal scale without rewriting SQL-heavy code (stored procedures, triggers, partial indexes). YugabyteDB's Postgres-derived query layer runs most of it unchanged, while tablets spread across 3 AZs give zone-failure tolerance and online scaling.

#### Trade-offs
The highest Postgres feature compatibility among distributed SQL options, but performance characteristics differ from single-node Postgres (distributed joins, per-row network hops), and tuning (colocation, tablet splitting) is needed.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Many small tables cause too many tablets | each table split into tablets | colocated tables (small tables share a tablet) |
| Range queries slow on hash-sharded table | hash sharding scatters ranges | range sharding for that table/index |
| Latency higher than old Postgres | distributed reads/writes | colocate related data, follower reads, batch |

#### Cheat sheet
- Postgres-compatible query layer (YSQL) on DocDB (RocksDB + Raft tablets).
- Hash or range sharding per table. Colocation for small tables.
- Strong Postgres compatibility (extensions, triggers, procedures).

#### Interview questions
<details><summary>CockroachDB vs YugabyteDB: how do they differ for a Postgres shop?</summary>

Both are Raft-based distributed SQL with Postgres wire compatibility. YugabyteDB reuses the actual Postgres query layer, so feature compatibility (extensions, stored procedures, triggers) is higher. CockroachDB reimplemented SQL in Go with its own optimizer, a strong multi-region feature set and serializable-first semantics. Pick based on which features your app relies on and on operational preferences.
</details>

<details><summary>Why does YugabyteDB offer colocated tables?</summary>

Each table is normally split into multiple tablets, each its own Raft group. A schema with hundreds of small tables would create thousands of tablets, wasting resources and adding overhead. Colocation stores many small tables in one tablet, while large tables still shard across the cluster.
</details>

#### Interview angle
> "To scale a Postgres app with lots of stored procedures and extensions, YugabyteDB keeps the real Postgres query layer over Raft-replicated tablets, so far less code needs rewriting."

### Aurora — MySQL/Postgres-compatible, shared distributed storage (6-way replication across 3 AZs)
Amazon Aurora keeps the familiar MySQL/PostgreSQL engines but replaces their storage with a **distributed, log-structured storage service**: data is stored in 10 GB segments, **6 copies across 3 AZs**, and the database ships only **redo log records** to storage. That gives fast, durable commits, quick failover and up to 15 low-lag replicas sharing the same storage.

#### How it works
```mermaid
flowchart TD
  W["Writer instance"] -- "redo log records only" --> SV["Shared storage volume (auto-grows to 128 TB)"]
  R1["Reader 1"] -- "reads pages" --> SV
  R2["Reader 2 … up to 15"] -- "reads pages" --> SV
  subgraph SV["Storage: each 10 GB segment ×6"]
    A1["AZ-a copy 1"] --- A2["AZ-a copy 2"]
    B1["AZ-b copy 1"] --- B2["AZ-b copy 2"]
    C1["AZ-c copy 1"] --- C2["AZ-c copy 2"]
  end
```

- **Write quorum 4/6, read quorum 3/6**: survives losing an entire AZ plus one more copy without data loss, and keeps writing after losing an AZ.
- Storage nodes apply redo to pages themselves ("the log is the database"), so there are no full-page writes from the instance.
- Readers share the storage, so replica lag is typically < 20 ms, and failover promotes a reader in ~30 s or less.
- Extras: Aurora Serverless v2 (autoscaling capacity), Global Database (cross-region storage replication < 1 s lag, fast regional failover), fast cloning (copy-on-write), backtrack (MySQL).

#### Example
An Indian fintech on RDS PostgreSQL struggles with replica lag during batch jobs and slow failovers. Moving to Aurora PostgreSQL: 3 readers at single-digit ms lag behind a reader endpoint, ~30 s automated failover, storage durable across 3 AZs, and Aurora Global Database to a DR region with an RPO around 1 s. Fast clones give the QA team production-sized copies in minutes.

#### Trade-offs
Managed durability, low-lag replicas and fast recovery, but still a **single writer** (write scaling is vertical), I/O-based pricing can surprise (Aurora I/O-Optimized helps), and it's AWS-only.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Write throughput ceiling | single writer instance | bigger instance, shard by domain, or distributed SQL |
| High bill from I/O | I/O-heavy workload on standard pricing | Aurora I/O-Optimized, reduce I/O (indexes, caching) |
| Clients stuck on old writer after failover | cached DNS / connections | cluster endpoint with short TTL, RDS Proxy, driver failover support |
| Reader overload | uneven routing | reader endpoint / custom endpoints, auto scaling replicas |

#### Cheat sheet
- Compute/storage separation: redo log shipped to 6 copies across 3 AZs (4/6 write, 3/6 read quorum).
- Up to 15 low-lag readers. ~30 s failover. Global Database for DR.
- Still a single writer.

#### Interview questions
<details><summary>How does Aurora achieve durability across AZs without the latency of full synchronous replication of pages?</summary>

The writer sends only small redo log records (not full pages) to six storage nodes across three AZs in parallel, and commits once 4 of 6 acknowledge. Storage nodes materialise pages from the log asynchronously. Network traffic per write is much smaller than shipping pages, and the quorum tolerates an AZ failure with no data loss.
</details>

<details><summary>Does Aurora solve write scaling?</summary>

No. It has a single writer instance per cluster (Aurora multi-master for MySQL was deprecated). It scales reads via up to 15 replicas and storage automatically to 128 TB. Write scaling still means a bigger instance, splitting by domain, sharding, or moving to a distributed SQL database.
</details>

#### Interview angle
> "On AWS I'd default to Aurora: quorum storage across three AZs, readers with single-digit-millisecond lag, about 30-second failover and a Global Database for DR. Write scaling is still single-writer, so plan around that."

### Columnar storage — Parquet, ORC, Apache Arrow — for analytics, 10–100× faster than row stores
Columnar storage stores **each column's values together** instead of each row's values together. Analytical queries read a few columns across millions of rows, so a columnar layout reads only the needed columns, compresses extremely well (similar values sit together) and enables vectorised CPU processing.

#### How it works
```mermaid
flowchart LR
  subgraph Row["Row store (OLTP)"]
    R1["(981, Pune, 1200, PAID)"] --- R2["(982, Delhi, 450, FAILED)"] --- R3["(983, Pune, 999, PAID)"]
  end
  subgraph Col["Column store (OLAP)"]
    C1["order_id: 981, 982, 983"]
    C2["city: Pune, Delhi, Pune (dictionary encoded)"]
    C3["amount: 1200, 450, 999"]
    C4["status: PAID, FAILED, PAID (run-length encoded)"]
  end
  Q["SELECT city, SUM(amount) … GROUP BY city"] -- "reads only city + amount" --> Col
```

| Format / engine | Role |
|---|---|
| **Parquet** | open columnar file format (row groups → column chunks → pages, with min/max stats) for data lakes (S3) |
| **ORC** | columnar format from the Hive ecosystem, similar ideas |
| **Apache Arrow** | in-memory columnar format for zero-copy exchange between engines (Pandas, Spark, DuckDB) |
| Warehouses | BigQuery, Snowflake, Redshift, ClickHouse, Druid, DuckDB use columnar storage internally |

#### Example
Orders table: 2 billion rows × 40 columns ≈ 2 TB row-oriented. "Revenue per city last quarter" touches 3 columns. A row store reads all 2 TB. Parquet reads only those columns (~150 GB raw, ~20 GB compressed), and min/max statistics skip row groups outside the quarter. The query takes 15 seconds in Athena/Trino instead of hours, and costs much less.

#### Trade-offs
| Columnar | Row |
|---|---|
| fast scans and aggregations over few columns | fast point lookups/updates of whole rows |
| 5–10× compression | less compression |
| slow single-row inserts/updates (batch loads) | efficient transactional writes |

Hence OLTP in row stores (Postgres/MySQL) feeding OLAP in columnar warehouses via CDC/ETL.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Slow queries on data lake | many tiny Parquet files | compaction into ~128 MB–1 GB files |
| Full scans despite filters | no partitioning / unsorted data, so stats can't prune | partition by date, sort/cluster by common filters |
| Poor compression | high-cardinality unsorted columns | sort by low-cardinality columns first |
| Analytics hurting production DB | OLAP queries on row-store OLTP | replicate to a warehouse / columnar store |

#### Cheat sheet
- Store columns together: read fewer bytes, compress more, vectorise.
- Parquet/ORC on disk, Arrow in memory. Warehouses are columnar.
- Partition + sort for pruning. Avoid tiny files.

#### Interview questions
<details><summary>Why are analytical queries much faster on columnar storage?</summary>

They read only the referenced columns rather than whole rows, so I/O drops by the fraction of columns used. Values in a column share a type and are often repetitive, so they compress very well (dictionary, run-length, delta encoding), meaning even fewer bytes are read. Engines process column batches with SIMD (vectorised execution), and min/max statistics per block let them skip irrelevant data entirely.
</details>

<details><summary>Design analytics for an e-commerce company whose dashboards are slowing down the production Postgres.</summary>

Stream changes from Postgres via CDC (Debezium → Kafka) into a columnar store: Parquet on S3 queried by Athena/Trino (or Iceberg tables), or a warehouse like BigQuery/Snowflake/Redshift, or ClickHouse for real-time dashboards. Partition by date, sort by common filters, and precompute heavy aggregates. Production Postgres serves only OLTP.
</details>

#### Interview angle
> "Analytics never runs on the OLTP database. CDC streams changes into partitioned, sorted Parquet or a columnar warehouse, where a dashboard query reads three columns instead of whole rows."

### Column-oriented query execution — predicate pushdown, vectorized processing, compression
Columnar engines aren't fast only because of storage layout. Their **execution** is designed around it: **push filters down** to skip data before reading, **process batches of values with SIMD** instead of row by row, and **operate directly on compressed data** where possible.

#### How it works
```mermaid
flowchart LR
  Q["WHERE dt = '2026-11-09' AND city = 'Pune'"] --> P1["Partition pruning: only dt=2026-11-09 folder"]
  P1 --> P2["Row-group / zone-map pruning: skip blocks where city min/max excludes Pune"]
  P2 --> P3["Read only needed column chunks"]
  P3 --> V["Vectorized execution: filter + sum over 1,024-value batches (SIMD)"]
  V --> L["Late materialization: build full rows only for survivors"]
```

Techniques:
- **Predicate pushdown**: filters evaluated at the storage or file layer (Parquet stats, ORC indexes, bloom filters) so non-matching blocks are never read.
- **Projection pushdown**: read only referenced columns.
- **Vectorised processing**: operators work on arrays of values (cache-friendly, SIMD), as in ClickHouse, DuckDB, Velox, Photon.
- **Operating on compressed data**: e.g. comparing dictionary codes instead of strings, summing run-length runs.
- **Late materialisation**: carry row positions, and assemble other columns only for rows that survive filters.

#### Example
ClickHouse table `events` ordered by `(event_date, user_id)`. "Daily active users for the last 7 days" prunes to 7 days of parts via the primary index (sparse index on the sort key), reads only `event_date` and `user_id`, and computes `uniq(user_id)` with vectorised HLL. It scans billions of rows per second on a few servers.

#### Trade-offs
Massive scan throughput for analytics, but point lookups and frequent updates are inefficient, and data layout (sort keys, partitioning) must match query patterns or pruning won't help.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Query scans everything despite WHERE | filter on non-sort/partition column, functions on columns | align sort/partition keys with filters, keep predicates simple |
| Poor performance with `SELECT *` | projection pushdown defeated | select needed columns |
| Slow joins on huge tables | big shuffles | pre-join/denormalise, broadcast small tables |

#### Cheat sheet
- Prune early: partitions → row groups (min/max, bloom) → columns.
- Vectorised batches + SIMD. Work on compressed data. Late materialisation.
- Sort and partition keys must match common filters.

#### Interview questions
<details><summary>What is predicate pushdown and why does it matter in a data lake?</summary>

Pushing filter conditions down to the storage layer, so the engine uses partition folders, file and row-group statistics (min/max, bloom filters) to skip data that can't match before reading or decompressing it. In data lakes, where I/O from S3 dominates cost and latency, this can cut bytes scanned by orders of magnitude.
</details>

<details><summary>Why is vectorised execution faster than row-at-a-time execution?</summary>

Row-at-a-time (Volcano model) calls virtual functions per row per operator, which costs heavy interpretation overhead and poor CPU cache use. Vectorised engines process batches of a column in tight loops: fewer function calls, values contiguous in cache, and SIMD instructions handle several values per instruction, often a 5–10× speedup.
</details>

#### Interview angle
> "I lay analytical tables out so filters prune early: partition by date, sort by the common filters, and select few columns. The engine then scans only surviving blocks in vectorised batches."

### B-tree vs LSM-tree — B-tree: read-optimized (database indexes); LSM: write-optimized (Cassandra, RocksDB)
The two dominant storage engine designs. **B-trees** update fixed-size pages **in place** (PostgreSQL, MySQL InnoDB, Oracle), which is good for reads and predictable latency. **LSM-trees** buffer writes in memory and **append sorted immutable files**, merged by compaction (Cassandra, RocksDB, LevelDB, ScyllaDB, HBase), which is good for write-heavy workloads.

#### How it works
```mermaid
flowchart TB
  subgraph BT["B-tree"]
    W1["Write"] --> F["Find leaf page (log N)"] --> U["Update page in place + WAL"]
    RB["Read: one tree traversal"]
  end
  subgraph LSM["LSM-tree"]
    W2["Write"] --> WAL2["WAL append"] --> MEM["Memtable (sorted, RAM)"] --> FL["Flush → L0 SSTable"] --> CP["Compaction merges into levels L1…Ln"]
    RL["Read: memtable + bloom filters + several SSTables"]
  end
```

| | B-tree | LSM-tree |
|---|---|---|
| Write pattern | random in-place page writes | sequential appends + background compaction |
| Write throughput | moderate | high |
| Read latency | low, predictable (one path) | higher / variable (multiple levels), helped by bloom filters |
| Write amplification | page rewrites (whole page per small change) | compaction rewrites data multiple times |
| Space amplification | fragmentation (half-empty pages) | obsolete versions until compaction |
| Typical | OLTP relational databases | time series, logs, messaging, KV at scale |

#### Example
- An order database with many reads by key and range plus moderate writes → B-tree (Postgres/InnoDB).
- A metrics or event store ingesting 500k writes/s → LSM (Cassandra/ScyllaDB/RocksDB-based stores), or a TSDB.
- Many modern systems embed RocksDB (an LSM): Kafka Streams state stores, CockroachDB (Pebble), TiKV, MyRocks (an LSM engine for MySQL, used by Facebook to save storage).

#### Trade-offs
B-trees favour read latency and update-in-place semantics. LSMs favour write throughput and compression. Both depend heavily on caching and workload.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| B-tree insert throughput drops (random keys) | page splits, random I/O | sequential keys, fillfactor |
| LSM read latency spikes | compaction backlog, many levels | tune compaction, bloom filters, more IOPS |
| LSM disk usage spikes | space amplification during compaction | headroom, leveled compaction |
| SSD wear | write amplification | engine/compaction tuning, appropriate design choice |

#### Cheat sheet
- B-tree: in-place pages, fast predictable reads (OLTP).
- LSM: memtable + immutable SSTables + compaction, fast writes (ingest-heavy).
- Amplification triangle: read vs write vs space. You can't minimise all three.

#### Interview questions
<details><summary>Your service ingests 300k events/s and reads are mostly by key for recent data. B-tree or LSM, and why?</summary>

LSM. Writes become sequential appends and memtable inserts, with no random page updates, which sustains very high ingest on commodity disks. Reads of recent data often hit the memtable or recent SSTables, and bloom filters avoid unnecessary disk reads. Choose a compaction strategy suited to time-ordered data (e.g. TWCS). A B-tree would bottleneck on random page writes and index maintenance.
</details>

<details><summary>What are read, write and space amplification, and how do B-trees and LSMs trade them?</summary>

Read amplification is how many disk reads per logical read. Write amplification is how many bytes are written to disk per byte of user data. Space amplification is disk used relative to live data. B-trees have low read amplification but write whole pages per small change and fragment space. LSMs have low write cost per insert but rewrite data during compaction (write amplification), read multiple levels (read amplification) and keep stale versions until compaction (space amplification). Compaction strategies move the balance between them.
</details>

#### Interview angle
> "B-trees for read-heavy OLTP, LSM engines for ingest-heavy workloads. I can explain the read, write and space amplification trade-offs and tune compaction to match."

### Write amplification in LSM trees — compaction rewrites data multiple times
Write amplification (WA) is the ratio of **bytes physically written to disk** to **bytes written by the application**. In LSM trees, every piece of data is written to the WAL, flushed to an SSTable, then **rewritten repeatedly** as compaction merges it into lower levels, so WA of 10–30× is common with leveled compaction.

#### How it works
```mermaid
flowchart LR
  U["App writes 1 GB"] --> W["WAL: 1 GB"]
  U --> M["Memtable → flush L0: 1 GB"]
  M --> L1["Compaction into L1: rewrite ~1 GB (+ overlapping L1 data)"]
  L1 --> L2["L1 → L2: rewrite again (fan-out 10 → overlap up to 10×)"]
  L2 --> L3["L2 → L3: rewrite again"]
  L3 --> T["Total disk writes ≈ 10–30 GB for 1 GB of user data"]
```

- **Leveled compaction**: low space and read amplification, high WA (each level merge can rewrite ~fan-out × data).
- **Tiered / size-tiered**: lower WA (data rewritten fewer times), higher read and space amplification.
- WA consumes disk bandwidth (competing with foreground I/O) and wears out SSDs (limited write endurance).

#### Example
A RocksDB-backed service writes 50 MB/s of user data. With leveled compaction WA ≈ 20, so the disk sustains ~1 GB/s of writes. It saturates during peaks (write stalls) and wears SSDs within months. Switching to **universal (tiered) compaction** cut WA to ~6, with slightly higher read latency, which was acceptable for that workload. Alternatives: bigger memtables, larger L1, key-value separation (WiscKey/BlobDB stores large values outside the LSM so compaction moves only keys).

#### Trade-offs
Lower WA means more read and space amplification. The right setting depends on whether the workload is write-heavy, read-heavy or storage-constrained.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Write stalls ("compaction pending too large") | compaction can't keep up with WA × ingest | tiered compaction, more disk bandwidth, rate-limit ingest |
| SSDs wearing out fast | high WA | tiered compaction, blob separation for large values |
| Disk bandwidth saturated, read latency up | compaction I/O | compaction rate limiter, off-peak tuning |

#### Cheat sheet
- WA = disk bytes written ÷ user bytes written. Leveled ≈ 10–30×, tiered lower.
- Costs disk bandwidth and SSD life.
- Reduce with tiered compaction, bigger memtables/levels, value separation.

#### Interview questions
<details><summary>Why does leveled compaction have higher write amplification than size-tiered?</summary>

Leveled compaction keeps each level's SSTables non-overlapping, so moving data from level N to N+1 means merging it with all overlapping files in N+1 (about fan-out × as much data) and rewriting them. Data passes through every level, rewritten each time. Size-tiered merges similar-sized files only occasionally, rewriting each byte fewer times, at the cost of more overlapping files (read amplification) and temporary space.
</details>

<details><summary>How would you reduce write amplification for a key-value store holding large values (10 KB+)?</summary>

Separate values from keys (WiscKey / RocksDB BlobDB / Titan): keep keys and small pointers in the LSM, and store values in append-only blob files with their own garbage collection. Compaction then rewrites only small key entries. Also consider tiered compaction and larger memtables.
</details>

#### Interview angle
> "LSM engines pay for fast writes with compaction rewrites. I'd tune the compaction style and value separation to the workload so write amplification doesn't saturate disks or wear out SSDs."

### Read amplification mitigated — bloom filter per SSTable level avoids unnecessary disk seeks
In an LSM tree a key may live in the memtable or in any of several SSTables, so a naive read checks many files: **read amplification**. Engines cut it with **bloom filters** (skip files that definitely don't have the key), **sparse indexes and block caches**, **fence pointers**, and compaction that keeps levels non-overlapping.

#### How it works
```mermaid
flowchart TD
  G["GET key K"] --> MT{"in memtable?"}
  MT -- "yes" --> HIT["return"]
  MT -- "no" --> L0["L0 SSTables (overlapping): check each bloom filter"]
  L0 --> L1["L1: one candidate file by key range (fence pointers)"]
  L1 --> BF{"bloom filter: K maybe present?"}
  BF -- "no (definitely absent)" --> L2["next level, no disk read"]
  BF -- "maybe (≈1% false positive)" --> IDX["index block → one data block read (often cached)"]
```

- **Bloom filter**: a bit array plus k hashes. "Not present" is certain, "present" might be a false positive. ~10 bits per key gives a ~1% false-positive rate.
- **Partitioned/ribbon filters** and **prefix bloom filters** (for prefix scans) are refinements.
- **Block cache** keeps hot data and index blocks in memory. **Leveled compaction** ensures ≤ 1 candidate file per level (except L0).

#### Example
A user-profile store with 7 LSM levels: without bloom filters a miss checks ~7+ files on disk. With 10-bit-per-key filters in memory, a lookup for a non-existent key touches disk with probability ~7 × 1% ≈ 7%. Existing keys need ~1 data block read, usually from cache. That's why Cassandra, HBase and RocksDB keep filters resident in memory (memory cost ≈ 1.25 bytes per key at 10 bits).

#### Trade-offs
Bloom filters cost memory (bits per key) and don't help range scans (which must merge all levels). Fewer levels and better compaction reduce read amplification at the cost of write amplification.

#### Problems & fixes
| Symptom | Cause | Fix |
|---|---|---|
| Point reads hit disk too often | bloom filters disabled/too small, low cache hit | ~10 bits/key, keep filters + index in block cache |
| Range scans slow | bloom filters don't help ranges | prefix bloom filters, better clustering, leveled compaction |
| Memory pressure from filters | billions of keys | partitioned filters, tune bits/key per level |

#### Cheat sheet
- Bloom filter per SSTable: certain "no", probable "yes". ~10 bits/key ≈ 1% false positives.
- Fence pointers + block cache = ~1 disk read per hit.
- Range scans still touch every level.

#### Interview questions
<details><summary>How do bloom filters reduce read latency in LSM-based databases?</summary>

Each SSTable has an in-memory bloom filter of its keys. Before reading a file, the engine checks the filter. If it says the key is absent (no false negatives), the file is skipped with no disk I/O. Only files whose filter says "maybe" are read, and with ~1% false positives most unnecessary reads are eliminated, so a point lookup usually costs one data-block read.
</details>

<details><summary>Why don't bloom filters help range queries?</summary>

A bloom filter answers membership for specific keys. It can't say whether any key within a range exists in a file. Range scans must open iterators on the memtable and on every overlapping SSTable and merge them. Prefix bloom filters help only when scans share a fixed key prefix.
</details>

#### Interview angle
> "LSM reads stay fast because each SSTable's bloom filter rules out files that can't hold the key. A point lookup usually costs one data block read, while range scans still pay to merge every level."
