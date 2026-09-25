export type BookingStatus = 'pending_payment' | 'confirmed' | 'payment_failed' | 'cancelled';

export type PaymentAttemptStatus = 'initiated' | 'succeeded' | 'failed';

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

export interface Student {
  id: string;
  parent_id: string;
  name: string;
  age: number;
  created_at: string;
}

export interface TrialClass {
  id: string;
  title: string;
  subject: 'science' | 'math';
  instructor_name: string;
  scheduled_at: string;
  capacity: number; // strictly 4 for Ottodot trial classes
  price_cents: number; // e.g. 2500 = $25.00
  created_at: string;
  // Computed fields
  confirmed_count?: number;
  available_seats?: number;
}

export interface Booking {
  id: string;
  trial_class_id: string;
  student_id: string;
  parent_id: string;
  status: BookingStatus;
  payment_reference?: string;
  created_at: string;
  confirmed_at?: string | null;
  cancelled_at?: string | null;
}

export interface PaymentAttempt {
  id: string;
  booking_id: string;
  amount_cents: number;
  status: PaymentAttemptStatus;
  failure_reason?: string | null;
  transaction_id: string;
  created_at: string;
}

export interface RosterEntry {
  booking_id: string;
  trial_class_id: string;
  class_title: string;
  subject: 'science' | 'math';
  student_id: string;
  student_name: string;
  student_age: number;
  parent_id: string;
  parent_name: string;
  parent_email: string;
  confirmed_at: string;
}

export interface ReserveBookingInput {
  trial_class_id: string;
  student_id: string;
  parent_id: string;
}

export interface ProcessPaymentInput {
  booking_id: string;
  simulate_outcome: 'success' | 'failure';
  payment_token?: string;
}

export interface BookingResult {
  success: boolean;
  booking: Booking;
  payment_attempt?: PaymentAttempt;
  error_code?: 'CLASS_FULL' | 'DUPLICATE_BOOKING' | 'PAYMENT_FAILED' | 'BOOKING_NOT_FOUND' | 'INVALID_STATUS';
  message: string;
}
