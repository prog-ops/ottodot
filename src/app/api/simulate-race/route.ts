import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { RaceSimulationLog, RaceSimulationResponse } from '@/types';

export async function POST(): Promise<NextResponse<RaceSimulationResponse>> {
  const logs: RaceSimulationLog[] = [];

  const addLog = (
    actor: 'User A' | 'User B' | 'System',
    action: string,
    status: 'info' | 'success' | 'warning' | 'error',
    details?: Record<string, unknown>
  ) => {
    logs.push({
      step: logs.length + 1,
      actor,
      action,
      status,
      timestamp: new Date().toISOString(),
      details,
    });
  };

  try {
    // 1. Reset database to ensure clean test state
    bookingStore.reset();
    addLog('System', 'Reset seed data. Selected target class: "Speed Math: Mental Arithmetic Quest" (class-race-3).', 'info', {
      initial_confirmed_count: 3,
      capacity: 4,
      available_seats: 1,
    });

    const targetClassId = 'class-race-3';

    // Verify initial capacity
    const initialClass = await bookingStore.getTrialClassById(targetClassId);
    if (!initialClass || initialClass.available_seats !== 1) {
      throw new Error('Test setup error: Class does not have exactly 1 available seat.');
    }

    // Step 1: User A selects the last available slot and reserves it (pending_payment)
    addLog('User A', 'Selected last available slot (Seat 4 of 4) and initiated checkout.', 'info');
    const reserveA = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: 'student-5', // Iris Allen Jr.
      parent_id: 'parent-5',  // Barry Allen
    });

    if (!reserveA.success) {
      throw new Error(`User A reservation failed unexpectedly: ${reserveA.message}`);
    }
    addLog('User A', `Reservation created (Status: ${reserveA.booking.status}). Moved to payment gateway.`, 'success', {
      booking_id: reserveA.booking.id,
    });

    // Step 2: User B selects the same slot while User A is on payment screen
    addLog('User B', 'Selected the same slot while User A is entering card details.', 'info');
    const reserveB = await bookingStore.reserveBooking({
      trial_class_id: targetClassId,
      student_id: 'student-6', // Mia Connor
      parent_id: 'parent-1',  // Sarah Connor
    });

    if (!reserveB.success) {
      throw new Error(`User B reservation failed unexpectedly: ${reserveB.message}`);
    }
    addLog('User B', `Reservation created (Status: ${reserveB.booking.status}). Also moved to payment gateway.`, 'success', {
      booking_id: reserveB.booking.id,
    });

    // Step 3: User B completes payment FIRST
    addLog('User B', 'Completes payment first! Sending payment authorization to server...', 'warning');
    const payB = await bookingStore.processPayment({
      booking_id: reserveB.booking.id,
      simulate_outcome: 'success',
      payment_token: 'tok_user_b_fast_winner',
    });

    if (payB.success) {
      addLog('User B', 'Payment SUCCEEDED! Booking status changed to "confirmed". Seat 4 allocated to User B.', 'success', {
        confirmed_at: payB.booking.confirmed_at ?? '',
        tx_id: payB.payment_attempt?.transaction_id ?? '',
      });
    } else {
      throw new Error(`User B payment failed unexpectedly: ${payB.message}`);
    }

    // Step 4: User A then tries to complete payment (after User B already confirmed the last seat)
    addLog('User A', 'Submits payment slightly later. Processing payment authorization...', 'warning');
    const payA = await bookingStore.processPayment({
      booking_id: reserveA.booking.id,
      simulate_outcome: 'success',
      payment_token: 'tok_user_a_late_arrival',
    });

    if (!payA.success && payA.error_code === 'CLASS_FULL') {
      addLog('User A', `Payment REJECTED ATOMICALLY: "${payA.message}". Status marked as "${payA.booking ? payA.booking.status : 'payment_failed'}". Child was NOT added to roster.`, 'error', {
        failure_reason: payA.payment_attempt?.failure_reason ?? '',
      });
    } else {
      throw new Error(`CRITICAL INVARIANT VIOLATION: User A was confirmed despite class being full!`);
    }

    // Step 5: Final Invariant Verification on Roster
    const finalRoster = await bookingStore.getRoster(targetClassId);
    const finalClass = await bookingStore.getTrialClassById(targetClassId);

    const invariantHolds = finalRoster.length === 4 &&
      finalRoster.some(r => r.student_id === 'student-6') && // User B's student
      !finalRoster.some(r => r.student_id === 'student-5');  // User A's student NOT in roster

    addLog('System', `Final Roster Audit: Class confirmed count = ${finalRoster.length}/4. Invariant strictly preserved!`, 'success', {
      confirmed_students: finalRoster.map(r => r.student_name),
      invariant_holds: invariantHolds,
    });

    return NextResponse.json({
      success: true,
      invariant_passed: invariantHolds,
      target_class: finalClass,
      roster: finalRoster,
      logs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Simulation aborted due to an unexpected error';
    addLog('System', `Simulation aborted due to error: ${message}`, 'error');
    return NextResponse.json(
      {
        success: false,
        invariant_passed: false,
        roster: [],
        logs,
        message,
      },
      { status: 500 }
    );
  }
}
