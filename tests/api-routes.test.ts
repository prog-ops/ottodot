import { describe, test, expect, beforeEach } from 'bun:test';
import { NextRequest } from 'next/server';
import { GET as getClasses } from '../src/app/api/classes/route';
import { GET as getParents } from '../src/app/api/parents/route';
import { GET as getRoster } from '../src/app/api/roster/route';
import { POST as reserveBooking } from '../src/app/api/bookings/reserve/route';
import { POST as processPayment } from '../src/app/api/bookings/pay/route';
import { POST as simulateRace } from '../src/app/api/simulate-race/route';
import { POST as resetSeed } from '../src/app/api/seed/reset/route';
import { GET as getMonitoring } from '../src/app/api/monitoring/route';
import { POST as addStudent } from '../src/app/api/students/route';
import { bookingStore } from '../src/lib/db/store';

describe('Next.js API Route Handlers Integration Test Suite', () => {
  beforeEach(async () => {
    // Reset seed before each test
    await resetSeed();
  });

  test('1. GET /api/classes - returns list of classes with correct capacities', async () => {
    const res = await getClasses();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(3);

    // Verify hard capacity invariant on all classes
    for (const cls of body.data) {
      expect(cls.capacity).toBe(4);
      expect(cls.confirmed_count + cls.available_seats).toBe(4);
    }
  });

  test('2. GET /api/parents - returns parents with nested students', async () => {
    const res = await getParents();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);

    const sarah = body.data.find((p: any) => p.email === 'sarah.connor@example.com');
    expect(sarah).toBeDefined();
    expect(sarah.students.length).toBe(2); // John and Mia
  });

  test('3. GET /api/roster - returns only confirmed students', async () => {
    const req = new NextRequest('http://localhost:3000/api/roster');
    const res = await getRoster(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.total_confirmed).toBe(body.data.length);

    // Verify seed count: Class 1 (1) + Class 2 (3) + Class 3 (4) = 8 confirmed students
    expect(body.total_confirmed).toBe(8);

    // Filter by class query param
    const filteredReq = new NextRequest('http://localhost:3000/api/roster?classId=class-race-3');
    const filteredRes = await getRoster(filteredReq);
    const filteredBody = await filteredRes.json();
    expect(filteredBody.data.length).toBe(3);
  });

  test('4. POST /api/bookings/reserve - validates required input fields', async () => {
    const req = new NextRequest('http://localhost:3000/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify({ trial_class_id: 'class-avail-1' }), // Missing student_id and parent_id
    });

    const res = await reserveBooking(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toContain('Missing required fields');
  });

  test('5. POST /api/bookings/reserve - returns 409 Conflict on duplicate booking', async () => {
    // John Connor is already confirmed in class-avail-1
    const req = new NextRequest('http://localhost:3000/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify({
        trial_class_id: 'class-avail-1',
        student_id: 'student-1',
        parent_id: 'parent-1',
      }),
    });

    const res = await reserveBooking(req);
    expect(res.status).toBe(409);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error_code).toBe('DUPLICATE_BOOKING');
  });

  test('6. POST /api/bookings/reserve - returns 400 when class is fully booked (4/4)', async () => {
    // class-full-4 is already full (4/4)
    const req = new NextRequest('http://localhost:3000/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify({
        trial_class_id: 'class-full-4',
        student_id: 'student-5',
        parent_id: 'parent-5',
      }),
    });

    const res = await reserveBooking(req);
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error_code).toBe('CLASS_FULL');
  });

  test('7. POST /api/bookings/pay - handles payment decline with status 402', async () => {
    // Step 1: Create reservation
    const reserveReq = new NextRequest('http://localhost:3000/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify({
        trial_class_id: 'class-avail-1',
        student_id: 'student-5',
        parent_id: 'parent-5',
      }),
    });
    const reserveRes = await reserveBooking(reserveReq);
    expect(reserveRes.status).toBe(201);
    const reserveBody = await reserveRes.json();

    // Step 2: Pay with simulated failure
    const payReq = new NextRequest('http://localhost:3000/api/bookings/pay', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: reserveBody.booking.id,
        simulate_outcome: 'failure',
      }),
    });

    const payRes = await processPayment(payReq);
    expect(payRes.status).toBe(402); // Payment Required / Payment Failed

    const payBody = await payRes.json();
    expect(payBody.success).toBe(false);
    expect(payBody.error_code).toBe('PAYMENT_FAILED');
    expect(payBody.booking.status).toBe('payment_failed');
  });

  test('8. POST /api/bookings/pay - confirms seat atomically and updates roster with status 200', async () => {
    // Step 1: Create reservation
    const reserveReq = new NextRequest('http://localhost:3000/api/bookings/reserve', {
      method: 'POST',
      body: JSON.stringify({
        trial_class_id: 'class-avail-1',
        student_id: 'student-5',
        parent_id: 'parent-5',
      }),
    });
    const reserveRes = await reserveBooking(reserveReq);
    expect(reserveRes.status).toBe(201);
    const reserveBody = await reserveRes.json();

    // Step 2: Complete payment successfully
    const payReq = new NextRequest('http://localhost:3000/api/bookings/pay', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: reserveBody.booking.id,
        simulate_outcome: 'success',
      }),
    });

    const payRes = await processPayment(payReq);
    expect(payRes.status).toBe(200);

    const payBody = await payRes.json();
    expect(payBody.success).toBe(true);
    expect(payBody.booking.status).toBe('confirmed');
    expect(payBody.payment_attempt.status).toBe('succeeded');

    // Step 3: Check that child is now on roster
    const rosterRes = await getRoster(new NextRequest('http://localhost:3000/api/roster?classId=class-avail-1'));
    const rosterBody = await rosterRes.json();
    expect(rosterBody.data.some((r: any) => r.student_id === 'student-5')).toBe(true);
  });

  test('9. POST /api/simulate-race - orchestrates User A & User B competition and verifies invariant', async () => {
    const res = await simulateRace();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.invariant_passed).toBe(true);
    expect(body.logs.length).toBeGreaterThanOrEqual(5);

    // Verify final roster count for the contested class is strictly 4
    expect(body.roster.length).toBe(4);
  });

  test('10. POST /api/seed/reset - resets state back to initial seed data', async () => {
    const res = await resetSeed();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('reset to initial state');
  });

  test('11. GET /api/monitoring - reports system health, invariants status, and telemetry', async () => {
    const res = await getMonitoring();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe('healthy');
    expect(body.data.invariants.all_invariants_pass).toBe(true);
    expect(body.data.invariants.overbooked_classes_count).toBe(0);
    expect(body.data.invariants.duplicate_confirmed_count).toBe(0);
    expect(body.data.stats.total_classes).toBe(3);
    expect(body.data.stats.total_capacity).toBe(12);
    expect(body.data.stats.total_confirmed_students).toBe(8);
    expect(body.data.stats.capacity_utilization_percent).toBe(67);
    expect(Array.isArray(body.data.recent_payment_attempts)).toBe(true);
  });

  test('12. POST /api/students - validates input and allows registering a custom child', async () => {
    // Missing fields
    const invalidReq = new NextRequest('http://localhost:3000/api/students', {
      method: 'POST',
      body: JSON.stringify({ parent_id: 'parent-1' }),
    });
    const invalidRes = await addStudent(invalidReq);
    expect(invalidRes.status).toBe(400);

    // Invalid age (< 4)
    const invalidAgeReq = new NextRequest('http://localhost:3000/api/students', {
      method: 'POST',
      body: JSON.stringify({ parent_id: 'parent-1', name: 'Baby Connor', age: 2 }),
    });
    const invalidAgeRes = await addStudent(invalidAgeReq);
    expect(invalidAgeRes.status).toBe(400);

    // Successful student registration
    const validReq = new NextRequest('http://localhost:3000/api/students', {
      method: 'POST',
      body: JSON.stringify({ parent_id: 'parent-1', name: 'Kyle Connor', age: 9 }),
    });
    const validRes = await addStudent(validReq);
    expect(validRes.status).toBe(201);

    const validBody = await validRes.json();
    expect(validBody.success).toBe(true);
    expect(validBody.data.name).toBe('Kyle Connor');
    expect(validBody.data.age).toBe(9);
    expect(validBody.data.parent_id).toBe('parent-1');
  });
});
