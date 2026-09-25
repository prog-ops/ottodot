import { describe, test, expect, beforeEach } from 'bun:test';
import { bookingStore } from '../src/lib/db/store';

describe('Trial Booking Reliability & Invariants Test Suite', () => {
  beforeEach(() => {
    // Reset seed data before each test for isolated execution
    bookingStore.reset();
  });

  test('1. Prevents duplicate confirmed bookings for the same child and class', async () => {
    // Setup: John Connor (student-1) is ALREADY confirmed in class-avail-1
    const targetClassId = 'class-avail-1';
    const studentId = 'student-1';
    const parentId = 'parent-1';

    // Verify student already exists in confirmed roster
    const rosterBefore = bookingStore.getRoster(targetClassId);
    expect(rosterBefore.some((r) => r.student_id === studentId)).toBe(true);

    // Attempt 1: Try to reserve again for the same child and class
    const reserveResult = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: studentId,
      parent_id: parentId,
    });

    expect(reserveResult.success).toBe(false);
    if (!reserveResult.success) {
      expect(reserveResult.error_code).toBe('DUPLICATE_BOOKING');
      expect(reserveResult.message).toContain('already has a confirmed seat');
    }

    // Verify roster count did NOT increase
    const rosterAfter = bookingStore.getRoster(targetClassId);
    expect(rosterAfter.length).toBe(rosterBefore.length);
  });

  test('2. Prevents overbooking beyond 4 confirmed students', async () => {
    // Setup: Galaxy Explorers (class-full-4) already has 4 confirmed students
    const fullClassId = 'class-full-4';
    const newStudentId = 'student-5'; // Iris Allen Jr.
    const parentId = 'parent-5';

    const fullClass = bookingStore.getTrialClassById(fullClassId);
    expect(fullClass?.confirmed_count).toBe(4);
    expect(fullClass?.available_seats).toBe(0);

    // Attempt to reserve a seat in the full class
    const reserveResult = await bookingStore.reserveBooking({
      trial_class_id: fullClassId,
      student_id: newStudentId,
      parent_id: parentId,
    });

    expect(reserveResult.success).toBe(false);
    if (!reserveResult.success) {
      expect(reserveResult.error_code).toBe('CLASS_FULL');
      expect(reserveResult.message).toContain('maximum capacity of 4 students');
    }

    // Verify roster remains strictly 4
    const roster = bookingStore.getRoster(fullClassId);
    expect(roster.length).toBe(4);
  });

  test('3. Handles payment failure without adding child to confirmed roster', async () => {
    // Setup: Junior Chemistry (class-avail-1) has 3 available seats
    const targetClassId = 'class-avail-1';
    const studentId = 'student-5'; // Iris Allen Jr.
    const parentId = 'parent-5';

    const initialRosterCount = bookingStore.getRoster(targetClassId).length;

    // 1. Reserve seat (pending_payment)
    const reserveResult = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: studentId,
      parent_id: parentId,
    });

    expect(reserveResult.success).toBe(true);
    if (!reserveResult.success || !reserveResult.booking) {
      throw new Error('Reservation should have succeeded');
    }
    expect(reserveResult.booking.status).toBe('pending_payment');

    // 2. Submit payment with SIMULATED FAILURE (e.g. card declined)
    const paymentResult = await bookingStore.processPayment({
      booking_id: reserveResult.booking.id,
      simulate_outcome: 'failure',
    });

    expect(paymentResult.success).toBe(false);
    if (!paymentResult.success) {
      expect(paymentResult.error_code).toBe('PAYMENT_FAILED');
      expect(paymentResult.booking?.status).toBe('payment_failed');
      expect(paymentResult.payment_attempt?.status).toBe('failed');
    }

    // 3. CRITICAL INVARIANT: Student must NOT appear on confirmed roster!
    const rosterAfterFailure = bookingStore.getRoster(targetClassId);
    expect(rosterAfterFailure.length).toBe(initialRosterCount);
    expect(rosterAfterFailure.some((r) => r.student_id === studentId)).toBe(false);
  });

  test('4. Handles Last-Seat Race Condition: User A and User B compete for 1 remaining seat', async () => {
    // Setup: Speed Math (class-race-3) has EXACTLY 3 confirmed students, 1 seat remaining
    const targetClassId = 'class-race-3';
    const targetClass = bookingStore.getTrialClassById(targetClassId);
    expect(targetClass?.confirmed_count).toBe(3);
    expect(targetClass?.available_seats).toBe(1);

    // 1. User A selects slot and moves to payment
    const userAReserve = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: 'student-5', // Iris Allen
      parent_id: 'parent-5',
    });
    expect(userAReserve.success).toBe(true);
    if (!userAReserve.success || !userAReserve.booking) throw new Error('User A reserve failed');

    // 2. User B selects the same slot while User A is on payment screen
    const userBReserve = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: 'student-6', // Mia Connor
      parent_id: 'parent-1',
    });
    expect(userBReserve.success).toBe(true);
    if (!userBReserve.success || !userBReserve.booking) throw new Error('User B reserve failed');

    // 3. User B completes payment FIRST and confirms the booking
    const userBPayment = await bookingStore.processPayment({
      booking_id: userBReserve.booking.id,
      simulate_outcome: 'success',
      payment_token: 'tok_user_b_first',
    });
    expect(userBPayment.success).toBe(true);
    if (userBPayment.success) {
      expect(userBPayment.booking.status).toBe('confirmed');
    }

    // 4. User A then tries to complete payment
    const userAPayment = await bookingStore.processPayment({
      booking_id: userAReserve.booking.id,
      simulate_outcome: 'success',
      payment_token: 'tok_user_a_second',
    });

    // INVARIANT: At most ONE user can end up with a confirmed booking for the last available seat!
    expect(userAPayment.success).toBe(false);
    if (!userAPayment.success) {
      expect(userAPayment.error_code).toBe('CLASS_FULL');
      expect(userAPayment.booking?.status).toBe('payment_failed');
    }

    // Verify roster: Total confirmed students is strictly 4 (User B confirmed, User A omitted)
    const finalRoster = bookingStore.getRoster(targetClassId);
    expect(finalRoster.length).toBe(4);
    expect(finalRoster.some((r) => r.student_id === 'student-6')).toBe(true); // User B present
    expect(finalRoster.some((r) => r.student_id === 'student-5')).toBe(false); // User A absent
  });

  test('5. Massive Concurrency Stress Test: 10 concurrent payment requests for 1 remaining seat', async () => {
    // Setup: Speed Math (class-race-3) has 1 remaining seat
    const targetClassId = 'class-race-3';

    // Create 10 reservations for 10 distinct synthetic students
    const reservations = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        bookingStore.reserveBooking({
          trial_class_id: targetClassId,
          student_id: `concurrent-student-${i}`,
          parent_id: `concurrent-parent-${i}`,
        })
      )
    );

    // Verify all 10 were initially able to reserve pending bookings
    const validBookingIds: string[] = [];
    for (const r of reservations) {
      if (r.success && r.booking) {
        validBookingIds.push(r.booking.id);
      }
    }
    expect(validBookingIds.length).toBe(10);

    // FIRE ALL 10 PAYMENTS SIMULTANEOUSLY USING Promise.all
    const paymentResults = await Promise.all(
      validBookingIds.map((bookingId, i) =>
        bookingStore.processPayment({
          booking_id: bookingId,
          simulate_outcome: 'success',
          payment_token: `tok_concurrent_${i}`,
        })
      )
    );

    // ATOMICITY AUDIT:
    const successes = paymentResults.filter((p) => p.success);
    const failures = paymentResults.filter((p) => !p.success);

    // Exactly 1 must succeed
    expect(successes.length).toBe(1);
    // Exactly 9 must fail
    expect(failures.length).toBe(9);
    // All failures must be CLASS_FULL
    expect(failures.every((f) => !f.success && f.error_code === 'CLASS_FULL')).toBe(true);

    // Hard Invariant: Final confirmed count must be EXACTLY 4
    const finalRoster = bookingStore.getRoster(targetClassId);
    expect(finalRoster.length).toBe(4);
  });
});
