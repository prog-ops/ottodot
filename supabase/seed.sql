-- ==============================================================================
-- Ottodot Trial Booking System - Supabase Seed Data
-- Pre-configured test scenarios for edge cases and reliability demonstration
-- ==============================================================================

-- 1. Parents
INSERT INTO parents (id, name, email, phone) VALUES
('parent-1', 'Sarah Connor', 'sarah.connor@example.com', '+6281234567890'),
('parent-2', 'Bruce Wayne', 'bruce.wayne@example.com', '+6281234567891'),
('parent-3', 'Diana Prince', 'diana.prince@example.com', '+6281234567892'),
('parent-4', 'Clark Kent', 'clark.kent@example.com', '+6281234567893'),
('parent-5', 'Barry Allen', 'barry.allen@example.com', '+6281234567894')
ON CONFLICT (id) DO NOTHING;

-- 2. Students
INSERT INTO students (id, parent_id, name, age) VALUES
('student-1', 'parent-1', 'John Connor', 8),
('student-2', 'parent-2', 'Damian Wayne', 9),
('student-3', 'parent-3', 'Cassandra Sandsmark', 7),
('student-4', 'parent-4', 'Jon Kent', 8),
('student-5', 'parent-5', 'Iris Allen Jr.', 6),
('student-6', 'parent-1', 'Mia Connor', 6)
ON CONFLICT (id) DO NOTHING;

-- 3. Trial Classes
-- Note: All have capacity 4.
INSERT INTO trial_classes (id, title, subject, instructor_name, scheduled_at, capacity, price_cents) VALUES
('class-avail-1', 'Junior Chemistry: Slime & Bubbles Lab', 'science', 'Dr. Evelyn Reed', '2026-10-05 10:00:00+00', 4, 2500),
('class-race-3', 'Speed Math: Mental Arithmetic Quest', 'math', 'Prof. Alan Turing Jr.', '2026-10-06 14:00:00+00', 4, 2500),
('class-full-4', 'Galaxy Explorers: Rocketry & Solar System', 'science', 'Commander Chris', '2026-10-07 16:00:00+00', 4, 2500)
ON CONFLICT (id) DO NOTHING;

-- 4. Bookings demonstrating Edge Cases

-- Case 1: Class 1 has 1 confirmed student (3 seats available)
INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, payment_reference, confirmed_at) VALUES
('booking-c1-s1', 'class-avail-1', 'student-1', 'parent-1', 'confirmed', 'pay_ref_c1_s1', '2026-09-10 09:02:15+00');

-- Case 4 (Payment Failure): Mia Connor had payment failure for Class 1 (NOT on roster)
INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, payment_reference, confirmed_at) VALUES
('booking-c1-fail', 'class-avail-1', 'student-6', 'parent-1', 'payment_failed', 'pay_ref_fail_demo', NULL);

-- Case 2: Class 2 has EXACTLY 3 confirmed students (1 seat left - Race Condition candidate!)
INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, payment_reference, confirmed_at) VALUES
('booking-c2-s2', 'class-race-3', 'student-2', 'parent-2', 'confirmed', 'pay_ref_c2_s2', '2026-09-12 10:01:00+00'),
('booking-c2-s3', 'class-race-3', 'student-3', 'parent-3', 'confirmed', 'pay_ref_c2_s3', '2026-09-12 10:06:12+00'),
('booking-c2-s4', 'class-race-3', 'student-4', 'parent-4', 'confirmed', 'pay_ref_c2_s4', '2026-09-12 10:11:45+00');

-- Case 3: Class 3 is FULL (4 confirmed students)
INSERT INTO bookings (id, trial_class_id, student_id, parent_id, status, payment_reference, confirmed_at) VALUES
('booking-c3-s1', 'class-full-4', 'student-1', 'parent-1', 'confirmed', 'pay_ref_c3_s1', '2026-09-13 08:01:20+00'),
('booking-c3-s2', 'class-full-4', 'student-2', 'parent-2', 'confirmed', 'pay_ref_c3_s2', '2026-09-13 08:06:10+00'),
('booking-c3-s3', 'class-full-4', 'student-3', 'parent-3', 'confirmed', 'pay_ref_c3_s3', '2026-09-13 08:11:00+00'),
('booking-c3-s4', 'class-full-4', 'student-4', 'parent-4', 'confirmed', 'pay_ref_c3_s4', '2026-09-13 08:16:30+00');

-- 5. Payment Attempts Log
INSERT INTO payment_attempts (id, booking_id, amount_cents, status, failure_reason, transaction_id) VALUES
('pay-1', 'booking-c1-s1', 2500, 'succeeded', NULL, 'tx_success_c1_s1'),
('pay-fail-1', 'booking-c1-fail', 2500, 'failed', 'Card declined: Insufficient funds simulated', 'tx_failed_simulated'),
('pay-2', 'booking-c2-s2', 2500, 'succeeded', NULL, 'tx_success_c2_s2'),
('pay-3', 'booking-c2-s3', 2500, 'succeeded', NULL, 'tx_success_c2_s3'),
('pay-4', 'booking-c2-s4', 2500, 'succeeded', NULL, 'tx_success_c2_s4'),
('pay-5', 'booking-c3-s1', 2500, 'succeeded', NULL, 'tx_success_c3_s1'),
('pay-6', 'booking-c3-s2', 2500, 'succeeded', NULL, 'tx_success_c3_s2'),
('pay-7', 'booking-c3-s3', 2500, 'succeeded', NULL, 'tx_success_c3_s3'),
('pay-8', 'booking-c3-s4', 2500, 'succeeded', NULL, 'tx_success_c3_s4')
ON CONFLICT (id) DO NOTHING;
