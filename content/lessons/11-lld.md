---
id: oop-solid
title: OOP & SOLID — the foundation of every LLD round
module: lld
day: 50
minutes: 35
tags: star, oop, solid, lld, java, composition, interfaces
summary: The four OOP pillars and the five SOLID principles explained with small Java examples, plus composition over inheritance. The vocabulary interviewers expect you to use in machine-coding and LLD rounds.
videos: Concept && Coding SOLID principles | Sudocode SOLID principles | ByteByteGo SOLID principles | Shrayansh Jain low level design playlist
read: Awesome Low-Level Design (GitHub) => https://github.com/ashishps1/awesome-low-level-design | Refactoring.Guru — Design patterns & principles => https://refactoring.guru/design-patterns
---

## TL;DR

- **OOP pillars:** Encapsulation (hide state), Abstraction (expose *what*, hide *how*), Inheritance (is-a), Polymorphism (one interface, many implementations).
- **SOLID:** **S**ingle responsibility · **O**pen/closed · **L**iskov substitution · **I**nterface segregation · **D**ependency inversion.
- **Prefer composition over inheritance** and **program to interfaces**.
- In the LLD round, these aren't theory questions. They're the **lens the interviewer uses to judge your class design**.

## The four pillars in one example

```java
public interface PaymentMethod {                 // Abstraction
    PaymentResult pay(Money amount);
}

public class CardPayment implements PaymentMethod {
    private final String token;                  // Encapsulation: hidden, immutable
    public CardPayment(String token) { this.token = token; }
    @Override public PaymentResult pay(Money amount) { /* call card PSP */ return PaymentResult.ok(); }
}

public class UpiPayment implements PaymentMethod {
    private final String vpa;
    public UpiPayment(String vpa) { this.vpa = vpa; }
    @Override public PaymentResult pay(Money amount) { /* call UPI PSP */ return PaymentResult.ok(); }
}

// Polymorphism: checkout doesn't care which method
PaymentResult r = paymentMethod.pay(Money.ofPaise(49_900));
```

## SOLID with examples

### S — Single Responsibility
*A class should have one reason to change.*
❌ `InvoiceService` that calculates totals **and** generates the PDF **and** emails it.
✅ `InvoiceCalculator`, `InvoicePdfRenderer`, `InvoiceMailer`.

### O — Open/Closed
*Open for extension, closed for modification.* Add new behaviour by adding classes, not by editing a growing `if/else`.

```java
// ❌ every new fee type edits this method
double fee(String type) { if (type.equals("CARD")) return 2.0; else if (type.equals("UPI")) return 0; ... }

// ✅ new fee types = new classes
interface FeeRule { boolean appliesTo(Payment p); Money fee(Payment p); }
class CardFeeRule implements FeeRule { … }
class InternationalFeeRule implements FeeRule { … }
Money total = rules.stream().filter(r -> r.appliesTo(p)).map(r -> r.fee(p)).reduce(Money.ZERO, Money::plus);
```

### L — Liskov Substitution
*Subtypes must be usable wherever the parent is expected, without surprises.*
The classic violation is `Square extends Rectangle`: `setWidth` on a Square also changes its height, which breaks callers' expectations. Another one: a `ReadOnlyAccount extends Account` whose `withdraw()` throws. Fix it by modelling the capabilities with separate interfaces.

### I — Interface Segregation
*Don't force classes to implement methods they don't use.*
❌ `interface Machine { print(); scan(); fax(); }`, so a simple printer must stub out fax.
✅ `Printer`, `Scanner`, `Fax` as separate small interfaces.

### D — Dependency Inversion
*High-level code depends on abstractions, not on concrete details.* That's what Spring's dependency injection gives you.

```java
class PaymentService {
    private final PaymentGateway gateway;       // interface
    private final LedgerRepository ledger;      // interface
    PaymentService(PaymentGateway g, LedgerRepository l) { this.gateway = g; this.ledger = l; }
}
// Swap RazorpayGateway ↔ StripeGateway ↔ FakeGateway (tests) without touching PaymentService.
```

## Composition over inheritance

Inheritance hierarchies get rigid fast (`Bird → FlyingBird → …`, and then penguins). Instead, **compose behaviours**:

```java
class Vehicle {
    private final Engine engine;            // has-a
    private final ParkingSpotType spotType;
    Vehicle(Engine e, ParkingSpotType t) { engine = e; spotType = t; }
}
```

Use inheritance for **true is-a relationships with shared behaviour** (`abstract class Account` → `SavingsAccount`, `CurrentAccount`). Use interfaces plus composition for capabilities.

## Other principles worth a sentence

- **DRY** (don't repeat yourself), **KISS**, **YAGNI** (don't build what isn't needed yet; interviewers like seeing restraint).
- **Law of Demeter:** talk only to your direct collaborators (`order.getCustomer().getAddress().getCity()` is a smell).
- **Immutability:** `final` fields, value objects like `Money` and `Location`. Thread-safe by design.
- **Tell, don't ask:** `account.withdraw(amt)` instead of `if (account.getBalance() > amt) account.setBalance(...)`.

## Self-check

<details>
<summary>Explain Open/Closed with a concrete example.</summary>

Adding a new payment method or fee rule should mean adding a new class that implements an interface (`PaymentMethod`, `FeeRule`), not editing an existing if/else chain. Existing tested code stays untouched.
</details>

<details>
<summary>What is a Liskov violation? Give an example.</summary>

A subclass that can't fully stand in for its parent, e.g. `Square extends Rectangle` (setting the width changes the height), or a subclass that throws `UnsupportedOperationException` for an inherited method.
</details>

<details>
<summary>How does Dependency Inversion make code testable?</summary>

Classes depend on interfaces injected through the constructor, so tests can pass fakes or mocks (e.g. `FakePaymentGateway`) instead of real external systems.
</details>

<details>
<summary>Why prefer composition over inheritance?</summary>

Composition is flexible: behaviours can be combined and swapped at runtime, and you avoid fragile deep hierarchies and LSP violations. Inheritance tightly couples a subclass to its parent's implementation.
</details>
---
id: design-patterns
title: Design patterns you'll actually use (with Java)
module: lld
day: 51
minutes: 40
tags: star, design patterns, singleton, factory, builder, strategy, observer, state, decorator, adapter, chain of responsibility, command
summary: The ~12 Gang-of-Four patterns that show up in LLD rounds. What each solves, a minimal Java sketch, and which interview problem it fits (parking lot, ATM, notification, rate limiter…).
videos: Concept && Coding design patterns | Sudocode design patterns | Christopher Okhravi strategy pattern | Geekific design patterns
read: Refactoring.Guru — Design patterns catalogue => https://refactoring.guru/design-patterns | java-design-patterns (GitHub) => https://github.com/iluwatar/java-design-patterns
---

## TL;DR — which pattern for which problem

| Pattern | One-line purpose | Classic LLD use |
|---|---|---|
| **Singleton** | Exactly one instance | ParkingLot, config, a connection-pool manager |
| **Factory** | Create objects without exposing `new` logic | `VehicleFactory`, `PaymentMethodFactory`, `NotificationSenderFactory` |
| **Builder** | Build complex objects step by step | `Order`, `HttpRequest`, `Pizza` with many optional fields |
| **Strategy** ⭐ | Swap algorithms at runtime | Pricing, spot allocation, rate-limit algorithm, split type (Splitwise) |
| **Observer** ⭐ | Notify subscribers of changes | Notifications, display boards, stock price watchers |
| **State** ⭐ | Behaviour changes with internal state | ATM, vending machine, order/payment lifecycle, elevator |
| **Decorator** | Add responsibilities by wrapping | Pizza toppings, adding logging/caching around a service |
| **Adapter** | Make incompatible interfaces work together | Wrapping Razorpay/Stripe SDKs behind your `PaymentGateway` |
| **Facade** | A simple front for a complex subsystem | `BookingFacade` hiding seat, payment and notification services |
| **Chain of Responsibility** | Pass a request along handlers | ATM cash dispenser (₹2000 → ₹500 → ₹100), logging levels, validation pipeline |
| **Command** | Encapsulate a request as an object | Undo/redo, a job queue, remote control |
| **Proxy** | A stand-in controlling access | Lazy loading, caching proxy, access control |

## The patterns, in code

### Singleton (thread-safe)

```java
public final class ParkingLot {
    private ParkingLot() {}
    private static class Holder { static final ParkingLot INSTANCE = new ParkingLot(); } // lazy, thread-safe via class loading
    public static ParkingLot getInstance() { return Holder.INSTANCE; }
}
// Alternative: enum singleton → public enum Config { INSTANCE; }
```

Say this: *"Singletons make testing harder, so in Spring I'd just use a singleton-scoped bean injected via DI."*

### Factory

```java
class NotificationSenderFactory {
    static NotificationSender create(Channel c) {
        return switch (c) {
            case SMS   -> new SmsSender();
            case EMAIL -> new EmailSender();
            case PUSH  -> new PushSender();
        };
    }
}
```

### Builder

```java
Order order = Order.builder()
    .customerId(42).item("SKU-1", 2).couponCode("DIWALI10")
    .deliverBy(LocalDate.now().plusDays(2)).build();   // Lombok @Builder does this for you
```

### Strategy ⭐

```java
interface SplitStrategy { Map<User, Money> split(Money total, List<User> users, List<Double> params); }
class EqualSplit implements SplitStrategy { … }
class PercentSplit implements SplitStrategy { … }
class ExactSplit implements SplitStrategy { … }

class Expense {
    private final SplitStrategy strategy;          // injected; swap freely
    Map<User, Money> shares() { return strategy.split(total, users, params); }
}
```

### Observer ⭐

```java
interface PriceListener { void onPrice(String symbol, BigDecimal price); }

class StockTicker {
    private final Map<String, List<PriceListener>> listeners = new ConcurrentHashMap<>();
    void subscribe(String sym, PriceListener l) { listeners.computeIfAbsent(sym, k -> new CopyOnWriteArrayList<>()).add(l); }
    void publish(String sym, BigDecimal p) { listeners.getOrDefault(sym, List.of()).forEach(l -> l.onPrice(sym, p)); }
}
```

### State ⭐ (ATM)

```java
interface AtmState {
    default void insertCard(Atm atm, Card c)  { throw new IllegalStateException(); }
    default void enterPin(Atm atm, String pin) { throw new IllegalStateException(); }
    default void withdraw(Atm atm, int amount) { throw new IllegalStateException(); }
    default void eject(Atm atm)                { throw new IllegalStateException(); }
}
class IdleState implements AtmState {
    public void insertCard(Atm atm, Card c) { atm.setCard(c); atm.setState(new HasCardState()); }
}
class HasCardState implements AtmState {
    public void enterPin(Atm atm, String pin) {
        if (atm.bank().verify(atm.card(), pin)) atm.setState(new AuthenticatedState());
        else atm.setState(new IdleState());   // eject after failure (simplified)
    }
}
// Each state only implements what's legal in that state, so there's no giant switch.
```

### Decorator

```java
interface PaymentGateway { Result charge(Money m); }
class LoggingGateway implements PaymentGateway {
    private final PaymentGateway inner;
    LoggingGateway(PaymentGateway inner) { this.inner = inner; }
    public Result charge(Money m) { log.info("charge {}", m); return inner.charge(m); }
}
PaymentGateway g = new RetryingGateway(new LoggingGateway(new RazorpayAdapter(sdk)));
```

### Adapter

```java
class RazorpayAdapter implements PaymentGateway {
    private final RazorpayClient client;           // third-party SDK with its own API
    public Result charge(Money m) { var resp = client.payments.create(toJson(m)); return map(resp); }
}
```

### Chain of Responsibility (ATM cash dispenser)

```java
abstract class NoteDispenser {
    private final int denom; private NoteDispenser next;
    NoteDispenser(int denom) { this.denom = denom; }
    NoteDispenser then(NoteDispenser n) { this.next = n; return n; }
    void dispense(int amount) {
        int notes = amount / denom, rest = amount % denom;
        if (notes > 0) System.out.println(notes + " x ₹" + denom);
        if (rest > 0) { if (next == null) throw new IllegalArgumentException("Cannot dispense"); next.dispense(rest); }
    }
}
// chain: 2000 → 500 → 200 → 100
```

## How to talk about patterns in the interview

- Don't announce "I'll use 5 patterns". **Let the problem pull them in**: "Spot allocation could vary (nearest, by floor), so I'll make it a Strategy."
- Name the **trade-off**: patterns add indirection. Use them where variation is likely.

## Self-check

<details>
<summary>Which pattern for an ATM's behaviour across Idle → CardInserted → Authenticated → Dispensing?</summary>

**State.** Each state is a class implementing only the actions valid in that state, and transitions swap the ATM's current state object.
</details>

<details>
<summary>Strategy vs State: what's the difference?</summary>

Both swap an implementation behind an interface. **Strategy** is chosen by the client to vary an algorithm (pricing, split type). **State** changes internally as the object's lifecycle progresses, and the state objects trigger transitions themselves.
</details>

<details>
<summary>Write a thread-safe lazy singleton in Java.</summary>

The initialization-on-demand holder idiom: a private constructor plus a private static nested `Holder` class holding `static final INSTANCE`, returned by `getInstance()`. Or an `enum` singleton. (Double-checked locking with `volatile` also works.)
</details>

<details>
<summary>Which pattern lets you put Razorpay's and Stripe's SDKs behind one interface?</summary>

**Adapter.** Each adapter implements your `PaymentGateway` interface and translates calls to the specific SDK.
</details>
---
id: lld-approach-concurrency
title: Cracking the machine-coding round + Java concurrency essentials
module: lld
day: 52
minutes: 40
tags: star, machine coding, lld approach, uml, concurrency, java, synchronized, concurrenthashmap, executor, locks
summary: A step-by-step method for 60–90 minute LLD/machine-coding rounds (requirements → entities → classes → APIs → code → tests), and the Java concurrency tools you'll need to make designs thread-safe.
videos: Concept && Coding machine coding round | Udit Agarwal machine coding | Defog Tech Java concurrency | Jakob Jenkov Java concurrency
read: Awesome Low-Level Design — problems list => https://github.com/ashishps1/awesome-low-level-design | Low Level Design Primer => https://github.com/prasadgujar/low-level-design-primer
---

## TL;DR

- **Machine coding (60–120 min):** write **working, clean, extensible** code, usually runnable with a `main()` demo, sometimes with tests. Common at Flipkart, Swiggy, PhonePe, Uber and Razorpay, and increasingly at banks.
- **LLD discussion (45–60 min):** class diagram + key methods + discussion of patterns and concurrency. Common at JPMorgan, Morgan Stanley, Goldman, Visa and Amazon.
- Method: **clarify → entities → relationships → interfaces → code the core flow → extend → handle concurrency → test**.
- Concurrency must-knows: `synchronized`, `ReentrantLock`, `ConcurrentHashMap`, `AtomicInteger`, `ExecutorService`, `CompletableFuture`, and thread-safe singletons.

## The 7-step method

1. **Clarify requirements (5 min).** List features as bullet points. Ask about scale only if it matters (in-memory vs DB). Agree on what's out of scope.
2. **Identify entities (5 min).** Underline the nouns: *ParkingLot, Floor, Spot, Vehicle, Ticket, Payment*.
3. **Relationships & class diagram (10 min).** has-a / is-a, multiplicities, enums for fixed types.
4. **Define interfaces / APIs (5 min).** `parkVehicle(vehicle) → Ticket`, `unpark(ticketId) → Receipt`.
5. **Code the core flow first (25–40 min).** Models → services → main demo. Keep it compiling and runnable early.
6. **Extend with patterns.** Strategy for pricing and allocation, Observer for display boards, Factory for vehicles.
7. **Concurrency & edge cases (10 min).** Two cars taking the same spot? Invalid ticket? Lot full?

### Code structure that impresses

```
com.example.parkinglot
 ├── model/        Vehicle, Spot, Ticket, enums (VehicleType, SpotType)
 ├── strategy/     SpotAllocationStrategy, PricingStrategy (+ impls)
 ├── repository/   InMemoryTicketRepository (interface + impl)
 ├── service/      ParkingService (orchestrates)
 ├── exception/    ParkingFullException, InvalidTicketException
 └── Main.java     demo scenario
```

**Evaluation criteria** (most companies): working code · separation of concerns · extensibility (patterns used where natural) · naming and readability · edge-case handling · concurrency awareness · testability.

## Java concurrency essentials

| Tool | Use |
|---|---|
| `synchronized` method/block | Simple mutual exclusion on an object's monitor |
| `ReentrantLock` | `tryLock(timeout)`, fairness, multiple conditions |
| `ReadWriteLock` | Many readers, few writers (config caches) |
| `volatile` | Visibility of a flag across threads (no atomicity) |
| `AtomicInteger/AtomicLong`, `LongAdder` | Lock-free counters (`LongAdder` under heavy contention) |
| `ConcurrentHashMap` | Thread-safe map. `computeIfAbsent`, `merge` are atomic per key |
| `CopyOnWriteArrayList` | Read-mostly listener lists |
| `BlockingQueue` (`ArrayBlockingQueue`, `LinkedBlockingQueue`) | Producer–consumer |
| `ExecutorService`, `ScheduledExecutorService` | Thread pools, scheduled tasks |
| `CompletableFuture` | Async composition (call 3 services in parallel, combine) |
| `Semaphore` | Limit concurrent access (N permits, e.g. parking spots, a connection limit) |
| `CountDownLatch` / `CyclicBarrier` | Wait for N events / threads |

### Pattern: per-resource locking (not one global lock)

```java
class SpotManager {
    private final ConcurrentHashMap<String, Spot> spots = new ConcurrentHashMap<>();

    Optional<Spot> reserve(SpotType type) {
        for (Spot s : spots.values()) {
            if (s.getType() == type && s.tryOccupy()) return Optional.of(s);   // CAS inside Spot
        }
        return Optional.empty();
    }
}

class Spot {
    private final AtomicBoolean occupied = new AtomicBoolean(false);
    boolean tryOccupy() { return occupied.compareAndSet(false, true); }   // only one thread wins
    void release()      { occupied.set(false); }
}
```

### Producer–consumer (e.g. a notification dispatcher)

```java
BlockingQueue<Notification> q = new LinkedBlockingQueue<>(10_000);   // bounded = backpressure
ExecutorService workers = Executors.newFixedThreadPool(8);
for (int i = 0; i < 8; i++) workers.submit(() -> {
    while (!Thread.currentThread().isInterrupted()) {
        Notification n = q.take();       // blocks when empty
        senderFactory.get(n.channel()).send(n);
    }
    return null;
});
```

### Common concurrency bugs to name

- **Race conditions** (check-then-act: `if (!map.containsKey(k)) map.put(k, v)`). Fix with `putIfAbsent` / `computeIfAbsent`.
- **Deadlock** (lock-ordering violations). Always acquire locks in a fixed order.
- **Visibility** (a non-volatile flag never seen as changed).
- **Thread-pool starvation** (blocking tasks waiting on tasks in the same pool).

## Practice list (in order)

1. Parking lot (Day 53) · 2. LRU cache (Day 54) · 3. Splitwise (Day 55) · 4. BookMyShow (Day 56) · 5. Rate limiter (Day 57) · 6. ATM (Day 58)
Then, from the GitHub lists: elevator, Snake & Ladder, Tic-Tac-Toe / chess, vending machine, logging framework, pub-sub queue, library management, hotel booking, cab booking, digital wallet, stock-brokerage, task scheduler.

## Self-check

<details>
<summary>What are the first three things you do in an LLD round?</summary>

Clarify and list requirements (with explicit out-of-scope), identify entities (the nouns), then sketch relationships and a class diagram before writing code.
</details>

<details>
<summary>Why is `if (!map.containsKey(k)) map.put(k, v)` unsafe even with ConcurrentHashMap?</summary>

Check-then-act isn't atomic: two threads can both see the key missing and both put. Use the atomic `putIfAbsent` or `computeIfAbsent`.
</details>

<details>
<summary>AtomicLong vs LongAdder?</summary>

Both are lock-free counters. `LongAdder` spreads updates across cells and sums them on read, so it's much faster under heavy write contention (metrics counters). `AtomicLong` is better when you need the exact current value often or CAS semantics.
</details>

<details>
<summary>How do you ensure two threads can't allocate the same parking spot?</summary>

Make the allocation atomic per spot: `AtomicBoolean.compareAndSet(false, true)` on the spot, or a per-spot lock / `synchronized`. Avoid one global lock that serialises the whole lot.
</details>
