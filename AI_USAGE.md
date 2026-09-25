# AI Usage Report (AI_USAGE.md)

This document details the usage of Artificial Intelligence tools during the design, implementation, and verification of the **Ottodot Trial Booking Reliability** project.

---

## 1. Which AI Tools Were Used

- **Antigravity AI (powered by Google Gemini 3.8 Flash)**: Used as the primary agentic pair-programming assistant for code synthesis, architectural review, Next.js route construction, and test automation.
- **Bun Runtime & CLI**: Employed for rapid package execution, zero-config TypeScript testing (`bun test`), and build validation.

---

## 2. What AI Was Used For

1. **System Modeling & Schema Synthesis**: Generating the PostgreSQL / Supabase relational schema (`supabase/schema.sql`) and defining data structures for `parents`, `students`, `trial_classes`, `bookings`, and `payment_attempts`.
2. **Concurrency Analysis & Invariant Defense**: Formulating edge case scenarios, specifically around row-level pessimistic locking (`SELECT ... FOR UPDATE`) versus optimistic locking for the Last-Seat Race Condition.
3. **Automated Test Scaffolding**: Writing the end-to-end reliability test suite in `tests/booking-reliability.test.ts`, including concurrent `Promise.all` stress tests.
4. **UI Styling Implementation**: Translating the kid-centric design rules (deep playgroup color blocks, borderless UI, pure white typography hierarchy) into clean Tailwind CSS classes.
5. **Interactive Telemetry Simulator**: Building `/api/simulate-race` and the interactive UI lab to visually demonstrate atomic race resolution between User A and User B.

---

## 3. One Place Where AI Helped Move Faster

**Designing the Dual Invariant Verification Engine (Supabase SQL + In-Memory Mutex):**
Typically, setting up a database with stored procedures, migrations, row-level locks, and then mocking it for local unit testing takes significant boilerplate. The AI rapidly scaffolded:
- The production-grade PostgreSQL stored procedure with row-level locks (`SELECT ... FOR UPDATE`) and partial unique indexes.
- An identical zero-dependency in-memory transactional mutex store (`AsyncClassMutex`) that enforces the exact same locking semantics and isolation.

This allowed the entire automated test suite to run in **under 40ms** using `bun test`, giving instant feedback without requiring external Supabase credentials or network calls to verify reliability.

---

## 4. One Place Where AI Was Disagreed With, Corrected, or Rejected

**Handling Reservation Expiration vs Hard Confirmation Lock:**

*Initial AI Proposal:*
The AI initially suggested placing a hard decrement on the available seats counter in the database at the moment the parent clicked "Proceed to Checkout" (creating the `pending_payment` booking).

*Why It Was Corrected / Rejected:*
If a seat is decremented immediately when a user enters checkout, any user who abandons their browser tab or takes 20 minutes to find their credit card would effectively lock out other eager parents, causing "phantom seat exhaustion." 

*Corrected Approach:*
We rejected eager seat decrementing. Instead, we adopted an **optimistic reservation with a pessimistic confirmation lock**:
- Multiple parents can be on the payment page for the final seat simultaneously (`pending_payment`).
- The hard seat allocation and capacity check is serialized exclusively at the **confirmation step** under an atomic row lock.
- The first parent whose payment processes claims the seat; any subsequent parent attempting payment is rejected cleanly with an informative message (`CLASS_FULL`) and zero charge. This mirrors how high-throughput ticket systems (e.g. airlines, concert tickets) handle real-world payments safely without phantom sell-outs.

---

## 5. What Would Be Changed About AI Workflow Next Time

If repeating this project, I would adopt a **"Schema-First, Test-First Verification Loop"**:
1. Prompt the AI to generate the executable test suite (`tests/*.test.ts`) *before* generating any API handlers or UI components.
2. Have the AI run the failing tests against an empty repository first, ensuring that test assertions fail for the right reasons.
3. Only then scaffold the business logic and UI. While our tests passed cleanly on the first run, doing strict TDD with the AI from minute one provides an even more rigorous audit trail.

---

## 6. How the Final Implementation Was Verified

The implementation was validated through four distinct layers of verification:

1. **Automated Invariant Test Suite (`bun test`)**:
   - `Test 1`: Verified that duplicate confirmed bookings for the same child and class are rejected (`DUPLICATE_BOOKING (409)`).
   - `Test 2`: Verified that booking a class with 4 confirmed students is rejected (`CLASS_FULL (400)`).
   - `Test 3`: Verified that a simulated payment decline marks the booking as `payment_failed` and does **not** add the child to the confirmed roster.
   - `Test 4`: Verified the Last-Seat Race: User A and User B concurrently compete for the 4th seat; User B confirms first, User A is atomically rejected, and roster count remains strictly 4.
   - `Test 5`: Concurrency stress test firing 10 simultaneous payment requests for 1 remaining seat via `Promise.all`. Verified that exactly 1 succeeds and 9 fail with `CLASS_FULL`.
2. **Production Type Checking & Build (`bun run build`)**:
   - Compiled Next.js App Router and all TypeScript definitions with zero errors.
3. **Interactive Visual Simulator (`/api/simulate-race`)**:
   - Executed the race condition live in the browser, inspecting the step-by-step telemetry logs and confirming that the final roster snapshot contains exactly 4 students.
4. **Codebase Review**:
   - Reviewed `supabase/schema.sql` to ensure SQL syntax correctness, foreign key cascades, and row-level locking semantics are production-ready for Supabase deployment.
