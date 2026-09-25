-- ==============================================================================
-- Ottodot Trial Booking System - PostgreSQL / Supabase Production Schema
-- Designed for High Reliability, Strict Invariants, and Race Condition Defense
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS payment_attempts CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS trial_classes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS parents CASCADE;

-- 1. Parents Table
CREATE TABLE parents (
  id TEXT PRIMARY KEY DEFAULT ('parent-' || uuid_generate_v4()),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Students Table
CREATE TABLE students (
  id TEXT PRIMARY KEY DEFAULT ('student-' || uuid_generate_v4()),
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT NOT NULL CHECK (age >= 4 AND age <= 16),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Trial Classes Table
-- Invariant: Capacity is strictly 4 students per trial class
CREATE TABLE trial_classes (
  id TEXT PRIMARY KEY DEFAULT ('class-' || uuid_generate_v4()),
  title TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (subject IN ('science', 'math')),
  instructor_name TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 4 CHECK (capacity = 4),
  price_cents INT NOT NULL DEFAULT 2500, -- $25.00
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Bookings Table
-- Statuses: pending_payment, confirmed, payment_failed, cancelled
CREATE TABLE bookings (
  id TEXT PRIMARY KEY DEFAULT ('booking-' || uuid_generate_v4()),
  trial_class_id TEXT NOT NULL REFERENCES trial_classes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'payment_failed', 'cancelled')),
  payment_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- INVARIANT 1: Prevent duplicate confirmed bookings for the same child and class.
-- Partial Unique Index only constrains bookings that are actually 'confirmed'
CREATE UNIQUE INDEX idx_unique_confirmed_booking 
ON bookings (trial_class_id, student_id) 
WHERE (status = 'confirmed');

-- Index for fast roster queries and capacity counts
CREATE INDEX idx_bookings_class_status ON bookings (trial_class_id, status);

-- 5. Payment Attempts Table
CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY DEFAULT ('pay-' || uuid_generate_v4()),
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('initiated', 'succeeded', 'failed')),
  failure_reason TEXT,
  transaction_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_attempts_booking ON payment_attempts(booking_id);

-- ==============================================================================
-- INVARIANT 2 & 3: Stored Procedure for Atomic Booking Confirmation
-- Eliminates Last-Seat Race Condition via Row-Level Exclusive Lock (FOR UPDATE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION confirm_trial_booking(
  p_booking_id TEXT,
  p_payment_success BOOLEAN,
  p_transaction_id TEXT,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_booking RECORD;
  v_class RECORD;
  v_confirmed_count INT;
BEGIN
  -- 1. Fetch and lock booking row
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'BOOKING_NOT_FOUND', 
      'message', 'Booking record not found'
    );
  END IF;

  IF v_booking.status = 'confirmed' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'INVALID_STATUS', 
      'message', 'Booking is already confirmed'
    );
  END IF;

  -- 2. ACQUIRE EXCLUSIVE ROW LOCK ON THE TRIAL CLASS ROW
  -- Any concurrent transaction attempting to confirm a seat in this class
  -- MUST wait until this transaction commits or rolls back.
  SELECT * INTO v_class FROM trial_classes WHERE id = v_booking.trial_class_id FOR UPDATE;

  -- 3. Handle explicit payment gateway failure
  IF NOT p_payment_success THEN
    UPDATE bookings 
    SET status = 'payment_failed' 
    WHERE id = p_booking_id;

    INSERT INTO payment_attempts (booking_id, amount_cents, status, failure_reason, transaction_id)
    VALUES (
      p_booking_id, 
      v_class.price_cents, 
      'failed', 
      COALESCE(p_failure_reason, 'Card declined by payment gateway'), 
      p_transaction_id
    );

    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'PAYMENT_FAILED', 
      'message', 'Payment failed. Student was not added to the class roster.'
    );
  END IF;

  -- 4. Count current confirmed students inside the serialized critical section
  SELECT COUNT(*) INTO v_confirmed_count 
  FROM bookings 
  WHERE trial_class_id = v_class.id AND status = 'confirmed';

  -- 5. Hard Capacity Invariant check (Max 4 students)
  IF v_confirmed_count >= v_class.capacity THEN
    UPDATE bookings 
    SET status = 'payment_failed' 
    WHERE id = p_booking_id;

    INSERT INTO payment_attempts (booking_id, amount_cents, status, failure_reason, transaction_id)
    VALUES (
      p_booking_id, 
      v_class.price_cents, 
      'failed', 
      'Seat no longer available (race condition: another parent confirmed the last seat first)', 
      p_transaction_id
    );

    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'CLASS_FULL', 
      'message', 'Class reached maximum capacity (4 students) before your payment completed. Transaction safely rejected.'
    );
  END IF;

  -- 6. Duplicate Booking Check
  IF EXISTS (
    SELECT 1 FROM bookings 
    WHERE trial_class_id = v_class.id 
      AND student_id = v_booking.student_id 
      AND status = 'confirmed'
      AND id <> p_booking_id
  ) THEN
    UPDATE bookings 
    SET status = 'payment_failed' 
    WHERE id = p_booking_id;

    INSERT INTO payment_attempts (booking_id, amount_cents, status, failure_reason, transaction_id)
    VALUES (
      p_booking_id, 
      v_class.price_cents, 
      'failed', 
      'Duplicate confirmed booking detected for this student', 
      p_transaction_id
    );

    RETURN jsonb_build_object(
      'success', false, 
      'error_code', 'DUPLICATE_BOOKING', 
      'message', 'This student already has a confirmed seat in this trial class.'
    );
  END IF;

  -- 7. All invariants verified: Confirm booking and log successful payment
  UPDATE bookings 
  SET status = 'confirmed',
      confirmed_at = now(),
      payment_reference = p_transaction_id
  WHERE id = p_booking_id;

  INSERT INTO payment_attempts (booking_id, amount_cents, status, transaction_id)
  VALUES (p_booking_id, v_class.price_cents, 'succeeded', p_transaction_id);

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Trial class seat successfully confirmed!', 
    'booking_id', p_booking_id
  );
END;
$$;
