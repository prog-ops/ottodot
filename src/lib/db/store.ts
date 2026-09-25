import { 
  Parent, 
  Student, 
  TrialClass, 
  Booking, 
  PaymentAttempt, 
  RosterEntry, 
  ReserveBookingInput, 
  ProcessPaymentInput, 
  BookingResult 
} from '@/types';
import { 
  INITIAL_PARENTS, 
  INITIAL_STUDENTS, 
  INITIAL_CLASSES, 
  INITIAL_BOOKINGS, 
  INITIAL_PAYMENT_ATTEMPTS 
} from './seed-data';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { supabaseStore } from './supabase-store';

// ==============================================================================
// In-Memory Transactional Mutex Engine
// Replicates PostgreSQL row-level locks (SELECT ... FOR UPDATE) and ACID guarantees
// in zero-dependency Node/Bun environment.
// ==============================================================================

class AsyncClassMutex {
  private locks: Map<string, Promise<void>> = new Map();

  /**
   * Acquire an exclusive lock on a specific trial class.
   * Concurrent requests for the same class ID will queue and execute sequentially.
   */
  async acquire(classId: string): Promise<() => void> {
    while (this.locks.has(classId)) {
      await this.locks.get(classId);
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    this.locks.set(classId, lockPromise);

    return () => {
      this.locks.delete(classId);
      releaseLock!();
    };
  }
}

export class InMemoryBookingStore {
  private parents: Parent[] = [];
  private students: Student[] = [];
  private trialClasses: TrialClass[] = [];
  private bookings: Booking[] = [];
  private paymentAttempts: PaymentAttempt[] = [];
  private classMutex = new AsyncClassMutex();

  constructor() {
    this.reset();
  }

  /**
   * Reset data to initial synthetic seed state
   */
  public reset(): void {
    this.parents = JSON.parse(JSON.stringify(INITIAL_PARENTS));
    this.students = JSON.parse(JSON.stringify(INITIAL_STUDENTS));
    this.trialClasses = JSON.parse(JSON.stringify(INITIAL_CLASSES));
    this.bookings = JSON.parse(JSON.stringify(INITIAL_BOOKINGS));
    this.paymentAttempts = JSON.parse(JSON.stringify(INITIAL_PAYMENT_ATTEMPTS));
  }

  // --- Read Methods ---

  public async getParents(): Promise<Parent[]> {
    return [...this.parents];
  }

  public async getStudents(parentId?: string): Promise<Student[]> {
    if (parentId) {
      return this.students.filter(s => s.parent_id === parentId);
    }
    return [...this.students];
  }

  public async getTrialClasses(): Promise<TrialClass[]> {
    return this.trialClasses.map(cls => {
      const confirmed_count = this.bookings.filter(
        b => b.trial_class_id === cls.id && b.status === 'confirmed'
      ).length;
      return {
        ...cls,
        confirmed_count,
        available_seats: Math.max(0, cls.capacity - confirmed_count),
      };
    });
  }

  public async getTrialClassById(id: string): Promise<TrialClass | undefined> {
    const cls = this.trialClasses.find(c => c.id === id);
    if (!cls) return undefined;
    const confirmed_count = this.bookings.filter(
      b => b.trial_class_id === cls.id && b.status === 'confirmed'
    ).length;
    return {
      ...cls,
      confirmed_count,
      available_seats: Math.max(0, cls.capacity - confirmed_count),
    };
  }

  public async getBookings(classId?: string): Promise<Booking[]> {
    if (classId) {
      return this.bookings.filter(b => b.trial_class_id === classId);
    }
    return [...this.bookings];
  }

  public async getBookingById(id: string): Promise<Booking | undefined> {
    return this.bookings.find(b => b.id === id);
  }

  public async getPaymentAttempts(bookingId?: string): Promise<PaymentAttempt[]> {
    if (bookingId) {
      return this.paymentAttempts.filter(p => p.booking_id === bookingId);
    }
    return [...this.paymentAttempts];
  }

  public async getRoster(classId?: string): Promise<RosterEntry[]> {
    const confirmedBookings = this.bookings.filter(
      b => b.status === 'confirmed' && (!classId || b.trial_class_id === classId)
    );

    return confirmedBookings.map(b => {
      const cls = this.trialClasses.find(c => c.id === b.trial_class_id)!;
      const student = this.students.find(s => s.id === b.student_id)!;
      const parent = this.parents.find(p => p.id === b.parent_id)!;

      return {
        booking_id: b.id,
        trial_class_id: b.trial_class_id,
        class_title: cls ? cls.title : 'Unknown Class',
        subject: cls ? cls.subject : 'science',
        student_id: b.student_id,
        student_name: student ? student.name : 'Unknown Student',
        student_age: student ? student.age : 0,
        parent_id: b.parent_id,
        parent_name: parent ? parent.name : 'Unknown Parent',
        parent_email: parent ? parent.email : 'unknown@example.com',
        confirmed_at: b.confirmed_at || b.created_at,
      };
    });
  }

  // --- Write Methods with ACID Guarantees & Concurrency Control ---

  public async reserveBooking(input: ReserveBookingInput): Promise<BookingResult> {
    const releaseLock = await this.classMutex.acquire(input.trial_class_id);

    try {
      const cls = this.trialClasses.find(c => c.id === input.trial_class_id);
      if (!cls) {
        return {
          success: false,
          booking: null,
          error_code: 'BOOKING_NOT_FOUND',
          message: 'Trial class does not exist.',
        };
      }

      // 1. Check duplicate confirmed booking
      const duplicateConfirmed = this.bookings.find(
        b => b.trial_class_id === input.trial_class_id &&
             b.student_id === input.student_id &&
             b.status === 'confirmed'
      );
      if (duplicateConfirmed) {
        return {
          success: false,
          booking: duplicateConfirmed,
          error_code: 'DUPLICATE_BOOKING',
          message: 'This student already has a confirmed seat in this trial class.',
        };
      }

      // 2. Check current capacity
      const confirmedCount = this.bookings.filter(
        b => b.trial_class_id === input.trial_class_id && b.status === 'confirmed'
      ).length;

      if (confirmedCount >= cls.capacity) {
        return {
          success: false,
          booking: null,
          error_code: 'CLASS_FULL',
          message: `Class has reached its maximum capacity of ${cls.capacity} students.`,
        };
      }

      // Create new booking with 'pending_payment'
      const newBooking: Booking = {
        id: `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        trial_class_id: input.trial_class_id,
        student_id: input.student_id,
        parent_id: input.parent_id,
        status: 'pending_payment',
        created_at: new Date().toISOString(),
        confirmed_at: null,
      };

      this.bookings.push(newBooking);

      return {
        success: true,
        booking: newBooking,
        message: 'Seat reserved. Please complete payment within the time limit.',
      };
    } finally {
      releaseLock();
    }
  }

  public async processPayment(input: ProcessPaymentInput): Promise<BookingResult> {
    const booking = this.bookings.find(b => b.id === input.booking_id);
    if (!booking) {
      return {
        success: false,
        booking: null,
        error_code: 'BOOKING_NOT_FOUND',
        message: 'Booking not found.',
      };
    }

    if (booking.status === 'confirmed') {
      return {
        success: false,
        booking,
        error_code: 'INVALID_STATUS',
        message: 'Booking is already confirmed.',
      };
    }

    // EXCLUSIVE LOCK on class row
    const releaseLock = await this.classMutex.acquire(booking.trial_class_id);

    try {
      const cls = this.trialClasses.find(c => c.id === booking.trial_class_id)!;
      const txId = input.payment_token || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // 1. Check for payment failure simulation/outcome
      if (input.simulate_outcome === 'failure') {
        booking.status = 'payment_failed';
        const failedAttempt: PaymentAttempt = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          booking_id: booking.id,
          amount_cents: cls.price_cents,
          status: 'failed',
          failure_reason: 'Payment declined: Simulated payment failure / card declined',
          transaction_id: txId,
          created_at: new Date().toISOString(),
        };
        this.paymentAttempts.push(failedAttempt);

        return {
          success: false,
          booking,
          payment_attempt: failedAttempt,
          error_code: 'PAYMENT_FAILED',
          message: 'Payment failed. The student was not added to the class roster.',
        };
      }

      // 2. Critical Section Check: Re-verify confirmed count under lock (Last-Seat Race Defense)
      const confirmedCount = this.bookings.filter(
        b => b.trial_class_id === cls.id && b.status === 'confirmed'
      ).length;

      if (confirmedCount >= cls.capacity) {
        booking.status = 'payment_failed';
        const raceFailedAttempt: PaymentAttempt = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          booking_id: booking.id,
          amount_cents: cls.price_cents,
          status: 'failed',
          failure_reason: 'Seat taken by another user during checkout (Class reached 4/4 capacity)',
          transaction_id: txId,
          created_at: new Date().toISOString(),
        };
        this.paymentAttempts.push(raceFailedAttempt);

        return {
          success: false,
          booking,
          payment_attempt: raceFailedAttempt,
          error_code: 'CLASS_FULL',
          message: 'The last available seat in this class was confirmed by another parent while your payment was processing. You have not been charged.',
        };
      }

      // 3. Duplicate check under lock
      const existingConfirmed = this.bookings.find(
        b => b.trial_class_id === cls.id &&
             b.student_id === booking.student_id &&
             b.status === 'confirmed' &&
             b.id !== booking.id
      );
      if (existingConfirmed) {
        booking.status = 'payment_failed';
        const dupAttempt: PaymentAttempt = {
          id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          booking_id: booking.id,
          amount_cents: cls.price_cents,
          status: 'failed',
          failure_reason: 'Duplicate confirmed booking detected for student',
          transaction_id: txId,
          created_at: new Date().toISOString(),
        };
        this.paymentAttempts.push(dupAttempt);

        return {
          success: false,
          booking,
          payment_attempt: dupAttempt,
          error_code: 'DUPLICATE_BOOKING',
          message: 'This student already has a confirmed seat in this trial class.',
        };
      }

      // 4. All invariants met: Atomically confirm seat
      booking.status = 'confirmed';
      booking.confirmed_at = new Date().toISOString();
      booking.payment_reference = txId;

      const successAttempt: PaymentAttempt = {
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        booking_id: booking.id,
        amount_cents: cls.price_cents,
        status: 'succeeded',
        failure_reason: null,
        transaction_id: txId,
        created_at: new Date().toISOString(),
      };
      this.paymentAttempts.push(successAttempt);

      return {
        success: true,
        booking,
        payment_attempt: successAttempt,
        message: 'Payment successful! Trial class seat confirmed.',
      };
    } finally {
      releaseLock();
    }
  }
}

// ==============================================================================
// Unified Booking Store Facade
// Automatically routes to live Supabase server when credentials are configured;
// otherwise falls back to the in-memory transactional mutex store.
// ==============================================================================

class UnifiedBookingStore {
  private inMemoryStore = new InMemoryBookingStore();

  async getParents(): Promise<Parent[]> {
    if (isSupabaseConfigured) {
      try {
        const parents = await supabaseStore.getParents();
        if (Array.isArray(parents) && parents.length > 0) {
          return parents;
        }
      } catch (err) {
        console.error('Failed to get parents from Supabase, using seed fallback:', err);
      }
    }
    return this.inMemoryStore.getParents();
  }

  async getStudents(parentId?: string): Promise<Student[]> {
    if (isSupabaseConfigured) {
      try {
        const students = await supabaseStore.getStudents(parentId);
        if (Array.isArray(students) && students.length > 0) {
          return students;
        }
      } catch (err) {
        console.error('Failed to get students from Supabase, using seed fallback:', err);
      }
    }
    return this.inMemoryStore.getStudents(parentId);
  }

  async getTrialClasses(): Promise<TrialClass[]> {
    if (isSupabaseConfigured) {
      try {
        const classes = await supabaseStore.getTrialClasses();
        if (Array.isArray(classes) && classes.length > 0) {
          return classes;
        }
      } catch (err) {
        console.error('Failed to get classes from Supabase, using seed fallback:', err);
      }
    }
    return this.inMemoryStore.getTrialClasses();
  }

  async getTrialClassById(id: string): Promise<TrialClass | undefined> {
    if (isSupabaseConfigured) {
      try {
        const cls = await supabaseStore.getTrialClassById(id);
        if (cls) return cls;
      } catch (err) {
        console.error('Failed to get class by id from Supabase, using seed fallback:', err);
      }
    }
    return this.inMemoryStore.getTrialClassById(id);
  }

  async getRoster(classId?: string): Promise<RosterEntry[]> {
    if (isSupabaseConfigured) {
      try {
        const roster = await supabaseStore.getRoster(classId);
        if (Array.isArray(roster) && roster.length > 0) {
          return roster;
        }
      } catch (err) {
        console.error('Failed to get roster from Supabase, using seed fallback:', err);
      }
    }
    return this.inMemoryStore.getRoster(classId);
  }

  async reserveBooking(input: ReserveBookingInput): Promise<BookingResult> {
    if (isSupabaseConfigured) {
      try {
        return await supabaseStore.reserveBooking(input);
      } catch (err) {
        console.error('Failed to reserve booking in Supabase, falling back to local:', err);
      }
    }
    return this.inMemoryStore.reserveBooking(input);
  }

  async processPayment(input: ProcessPaymentInput): Promise<BookingResult> {
    if (isSupabaseConfigured) {
      try {
        return await supabaseStore.processPayment(input);
      } catch (err) {
        console.error('Failed to process payment in Supabase, falling back to local:', err);
      }
    }
    return this.inMemoryStore.processPayment(input);
  }

  reset(): void {
    this.inMemoryStore.reset();
  }
}

export const bookingStore = new UnifiedBookingStore();
