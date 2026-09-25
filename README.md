# Ottodot - Trial Booking Reliability System

A high-reliability trial class booking slice designed for **Ottodot** (live online science & math classes for kids). This project guarantees critical system invariants under high concurrency, payment failures, and double-booking attempts—specifically solving the **Last-Seat Race Condition** where multiple parents compete for the 4th and final seat of a class.

---

## 1. Quick Start: How to Run

### Prerequisites
- [Bun](https://bun.sh) (v1.3+ recommended) or Node.js (v20+)

### Running Locally
```bash
# 1. Install dependencies
bun install

# 2. Run the automated test suite (5 tests verifying all invariants & race conditions)
bun test

# 3. Start the development server
bun dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Verification Scripts
To test backend reliability under concurrent race conditions:
```bash
# Runs the full automated invariant & race condition suite
bun test tests/booking-reliability.test.ts
```

---

## 2. What We Built

We implemented the smallest production-grade working slice of the trial booking lifecycle:
1. **Parent Booking Flow**: Parents select their child and an available trial class (science or math).
2. **Atomic Reservation (`pending_payment`)**: Creates a reservation that checks capacity and duplicate constraints before handing off to payment.
3. **Mock Payment Processing**: Simulates successful transactions or card declines.
4. **Reliable Status Tracking**: Live booking statuses (`pending_payment`, `confirmed`, `payment_failed`, `cancelled`) with transaction logs.
5. **Teacher / Admin Roster**: Live roster showing only students with verified `confirmed` bookings, completely excluding failed or unconfirmed payments.
6. **Interactive Race Condition Testing Lab**: A built-in simulator with real-time execution telemetry to demonstrate the Last-Seat Race between User A and User B.

---

## 3. Time Spent

- **Architecture, Domain Modeling & Invariant Planning**: 40 minutes
- **PostgreSQL / Supabase Schema & Atomic Lock Stored Procedure**: 35 minutes
- **In-Memory ACID Store with Mutex Serialization & Concurrency Protection**: 45 minutes
- **API Endpoints (`/api/classes`, `/api/roster`, `/api/bookings/*`, `/api/simulate-race`)**: 35 minutes
- **Automated Concurrency & Invariant Test Suite (`bun test`)**: 30 minutes
- **Kid-Centric UI (Playgroup deep color palette, borderless design, white text hierarchy)**: 45 minutes
- **Documentation (`README.md`, `AI_USAGE.md`, `supabase/schema.sql`)**: 40 minutes
- **Total Time**: ~4.5 hours

---

## 4. Key Architecture & Backend Decisions

```
┌────────────────────────────────────────────────────────┐
│                   Next.js App Router                   │
│          (/, /api/bookings, /api/roster)               │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Application Invariant Layer                │
│         - Duplicate checks                             │
│         - Capacity checks (capacity <= 4)              │
│         - Payment attempt audit trail                  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Concurrency Defense Layer                │
│                                                        │
│  PostgreSQL / Supabase       Local / Test Engine       │
│  SELECT ... FOR UPDATE       AsyncClassMutex           │
│  Row-Level Exclusive Lock    Serialized Critical Sec.  │
│  + Partial Unique Index      Per Trial Class ID        │
└────────────────────────────────────────────────────────┘
```

### Data Model & Schema
Located in `supabase/schema.sql` and `src/types/index.ts`:

1. **`parents`**: `id`, `name`, `email` (unique), `phone`, `created_at`.
2. **`students`**: `id`, `parent_id` (FK), `name`, `age`, `created_at`.
3. **`trial_classes`**: `id`, `title`, `subject` (`science` | `math`), `instructor_name`, `scheduled_at`, `capacity` (INT DEFAULT 4 CHECK (capacity = 4)), `price_cents`, `created_at`.
4. **`bookings`**: `id`, `trial_class_id` (FK), `student_id` (FK), `parent_id` (FK), `status` (`pending_payment` | `confirmed` | `payment_failed` | `cancelled`), `payment_reference`, `created_at`, `confirmed_at`, `cancelled_at`.
5. **`payment_attempts`**: `id`, `booking_id` (FK), `amount_cents`, `status` (`initiated` | `succeeded` | `failed`), `failure_reason`, `transaction_id`, `created_at`.

### Database Constraints & Invariants
- **Duplicate Prevention**: Partial Unique Index:
  ```sql
  CREATE UNIQUE INDEX idx_unique_confirmed_booking 
  ON bookings (trial_class_id, student_id) 
  WHERE (status = 'confirmed');
  ```
  *Why partial?* Parents may have earlier failed payment attempts for the same class; they must still be allowed to retry. Only a `confirmed` booking prevents another booking for the same student.
- **Strict Capacity Invariant**: Class capacity is capped at 4. Handled under serialized transaction locks.

### Rendering Strategy & Hydration Defense (SSR + CSR Hybrid Architecture)
- **Server Component (SSR)**: `src/app/page.tsx` is an async React Server Component (RSC) that directly queries initial classes, parents, and roster data on the server. This guarantees:
  - Instant First Contentful Paint (FCP) with zero client-side waterfall spinners.
  - Full SEO crawlability for classes, schedules, and pricing.
  - An immutable initial data snapshot passed as props to the interactive client tree.
- **Interactive Client Islands (CSR)**: Only the interactive leaves (`BookingFlow`, `RosterView`, `RaceSimulator`, `ThemeToggle`) run on the client.
- **Hydration Mismatch Defense**:
  - `suppressHydrationWarning` applied to `<html lang="en">` and `<body>` in `app/layout.tsx` to prevent warnings from client-side dark mode class toggles and browser extensions.
  - Deterministic timestamp formatting via `FormattedTime` component to prevent server-client locale/timezone divergences.
- **Strict TypeScript & Clean Architecture**:
  - Zero `any` types throughout the entire codebase.
  - Discriminated unions on all domain results (`BookingSuccessResult | BookingFailureResult`).
  - Strict type narrowing on all errors (`error: unknown` with `error instanceof Error`).

---

## 5. Required Technical Scenario: The Last-Seat Race

### The Scenario
1. Class has 3 confirmed students (Capacity: 4, 1 seat remaining).
2. **User A** selects the last available slot and moves to payment.
3. **User B** selects the same slot simultaneously.
4. **User B** completes payment first and confirms the booking (confirmed count = 4/4).
5. **User A** then tries to complete payment.

### The Approach We Chose: Pessimistic Row Lock & Two-Phase Verification
We implemented an **exclusive row-level lock** (`SELECT ... FOR UPDATE` in PostgreSQL / `AsyncClassMutex` in memory) scoped strictly to the `trial_class_id`:
1. When a user submits payment authorization, the server acquires the lock for that specific class.
2. Inside the lock:
   - The server queries the fresh count of `confirmed` bookings for that class.
   - If `confirmed_count < 4`, the booking transitions to `confirmed`, the payment attempt is recorded as `succeeded`, and the lock is released. (User B succeeds).
   - If `confirmed_count >= 4`, the server detects that the seat was claimed while the user was entering details. The booking is marked `payment_failed` with the reason `"Class reached maximum capacity (4 students)"`, the payment attempt is recorded as `failed` (or refund triggered), and the lock is released. (User A safely fails).

### Why We Chose It
- **Absolute Correctness**: Unlike optimistic concurrency control (which can result in race-condition aborts after third-party payment gateway charges), locking at the confirmation step guarantees that a confirmed seat is never oversubscribed.
- **Granular Blast Radius**: The lock is scoped to `trial_class_id`. Parents booking Class X never wait for or conflict with parents booking Class Y.
- **Zero Orphaned Confirmed Records**: Eliminates edge cases where a payment succeeds at the bank but cannot be inserted into the roster.

### Tradeoffs Accepted
- **Queueing under heavy burst**: If hundreds of parents simultaneously submitted payment for the *exact same class* in the same second, requests serialize. For trial classes capped at 4 students, this serialization latency is negligible (<2ms) compared to network round-trips.
- **Payment Gateway Coordination**: In a live integration (e.g. Stripe), we use a two-step `Authorize -> Verify & Confirm Lock -> Capture` pattern, or issue an immediate automated void/refund if the seat was snatched before capture.

---

## 6. Division of Responsibility: Where Checks Belong

| Check / Responsibility | Layer | Rationale |
| :--- | :--- | :--- |
| **Instant Availability Indicator** | UI | Gives parents immediate visual feedback on seat counts without making invalid attempts. |
| **Pre-payment Reservation Check** | Backend API | Prevents users from entering checkout if class is already visibly full or duplicate booking exists. |
| **Atomic Capacity & Last-Seat Race Defense** | Database / Stored Proc (`FOR UPDATE`) | The database is the single source of truth; only database-level serialization guarantees zero overbooking. |
| **Partial Unique Constraint** (`student_id`, `class_id`) | Database Index | Guarantees no two concurrent transactions can commit duplicate confirmed bookings, even if application code bugs exist. |
| **Expired Reservation Cleanup (TTL)** | Background Job | If a user abandons checkout in `pending_payment` state after 15 minutes, a scheduled job cleans it up or expires the reservation. |

---

## 7. Seed Data & Edge Case Scenarios

The project includes pre-seeded records (`src/lib/db/seed-data.ts` and `supabase/seed.sql`) demonstrating all 4 requested edge cases:

1. **Class with available seats (`class-avail-1`)**:
   - "Junior Chemistry: Slime & Bubbles Lab"
   - 1 confirmed student (John Connor), 3 seats remaining.
2. **Class with exactly 3 confirmed students (`class-race-3`)**:
   - "Speed Math: Mental Arithmetic Quest"
   - 3 confirmed students (Damian Wayne, Cassandra Sandsmark, Jon Kent).
   - **Exactly 1 seat remaining**—the designated target for Last-Seat Race testing.
3. **Class with 4 confirmed students (`class-full-4`)**:
   - "Galaxy Explorers: Rocketry & Solar System"
   - 4 confirmed students—attempts to book return `CLASS_FULL (400)`.
4. **Duplicate Booking Attempt**:
   - Parent Sarah Connor and Student John Connor are already confirmed in `class-avail-1`.
   - Selecting John Connor for `class-avail-1` immediately triggers `DUPLICATE_BOOKING (409)`.
5. **Payment Failure Case (`booking-c1-fail`)**:
   - Pre-existing record for Mia Connor with status `payment_failed`.
   - Audit verifies she is **not** present in the confirmed teacher roster.

---

## 8. What We Deliberately Cut

To keep the scope razor-sharp on reliability and data invariants:
- **Regular Enrollment / Multi-Week Packages**: Only single trial class bookings are supported.
- **Real Payment Gateway Integration**: Replaced with an interactive mock payment simulator (Success vs Card Decline vs Race token) to enable immediate offline testing.
- **Authentication / JWT**: Used explicit parent/student selectors instead of a full Auth0/Supabase Auth login flow.
- **Email / SMS Notification Service**: Roster updates are immediate via REST/state instead of dispatching transactional emails.

---

## 9. What We Would Monitor After Release

1. **Roster Invariant Violations**: Alert immediately if `COUNT(bookings WHERE trial_class_id = X AND status = 'confirmed') > 4`.
2. **Race Condition Frequency**: Track how often parents hit `CLASS_FULL` during payment processing (indicates high demand; signals need for more sections).
3. **Payment Failure vs Abandonment Rates**: Track percentage of `pending_payment` bookings that transition to `payment_failed` vs timing out.
4. **Database Lock Wait Duration**: Monitor lock acquisition latency on `trial_classes` during high-traffic drops.
5. **Double Booking Attempt Metrics**: Alert if a high rate of duplicate attempts occurs, which could indicate UI confusion or double-clicking.

---

## 10. What We Would Do Next With More Time

1. **Stripe PaymentIntents with 2-Step Authorization & Capture**: Implement `stripe.paymentIntents.create` with `capture_method: 'manual'`, verifying the class seat under database lock before calling `capture()`. If full, call `stripe.paymentIntents.cancel()` with zero charge to the parent.
2. **10-Minute Hold Reservation TTL**: Implement temporary seat holds using Redis or Postgres timestamp leases (`reserved_until = now() + interval '10 minutes'`) so parents have a guaranteed window to fill card details.
3. **Waitlist System**: Automatically offer the 5th interested parent the option to join a waitlist or be notified if another class section opens.
4. **Teacher Portal with Live Attendance & Zoom Link Dispatch**: Add attendance checkboxes for teachers and automatic video room generation once 4 seats are confirmed.
