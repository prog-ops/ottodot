import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/client';
import { 
  Parent, 
  Student, 
  TrialClass, 
  RosterEntry, 
  ReserveBookingInput, 
  ProcessPaymentInput, 
  BookingResult, 
  Booking,
  PaymentAttempt,
  SystemMetrics
} from '@/types';

const serverStartTime = Date.now();

export class SupabaseBookingStore {
  /**
   * Get all parents from Supabase
   */
  async getParents(): Promise<Parent[]> {
    if (!supabaseAdmin) return [];
    const { data, error } = await supabaseAdmin
      .from('parents')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching parents from Supabase:', error);
      return [];
    }
    return (data as Parent[]) || [];
  }

  /**
   * Get students, optionally filtered by parent_id
   */
  async getStudents(parentId?: string): Promise<Student[]> {
    if (!supabaseAdmin) return [];
    let query = supabaseAdmin
      .from('students')
      .select('*')
      .order('created_at', { ascending: true });

    if (parentId) {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching students from Supabase:', error);
      return [];
    }
    return (data as Student[]) || [];
  }

  /**
   * Add a new student to Supabase
   */
  async addStudent(parentId: string, name: string, age: number): Promise<Student | null> {
    if (!supabaseAdmin) return null;
    const newId = `student-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { data, error } = await supabaseAdmin
      .from('students')
      .insert({
        id: newId,
        parent_id: parentId,
        name,
        age,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to add student to Supabase:', error);
      return null;
    }
    return data as Student;
  }

  /**
   * Get trial classes with real-time confirmed count from Supabase
   */
  async getTrialClasses(): Promise<TrialClass[]> {
    if (!supabaseAdmin) return [];

    const { data: classes, error: classError } = await supabaseAdmin
      .from('trial_classes')
      .select('*')
      .order('scheduled_at', { ascending: true });

    if (classError || !classes) {
      console.error('Error fetching trial_classes from Supabase:', classError);
      return [];
    }

    const { data: confirmedBookings, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('trial_class_id')
      .eq('status', 'confirmed');

    if (bookingError) {
      console.error('Error fetching bookings from Supabase:', bookingError);
    }

    const counts: Record<string, number> = {};
    if (confirmedBookings) {
      for (const b of confirmedBookings) {
        counts[b.trial_class_id] = (counts[b.trial_class_id] || 0) + 1;
      }
    }

    return (classes as TrialClass[]).map((cls) => {
      const confirmed_count = counts[cls.id] || 0;
      return {
        ...cls,
        confirmed_count,
        available_seats: Math.max(0, cls.capacity - confirmed_count),
      };
    });
  }

  /**
   * Get trial class by ID
   */
  async getTrialClassById(id: string): Promise<TrialClass | undefined> {
    const classes = await this.getTrialClasses();
    return classes.find((c) => c.id === id);
  }

  /**
   * Get confirmed teacher roster directly from Supabase
   */
  async getRoster(classId?: string): Promise<RosterEntry[]> {
    if (!supabaseAdmin) return [];

    let query = supabaseAdmin
      .from('bookings')
      .select(`
        id,
        trial_class_id,
        student_id,
        parent_id,
        status,
        confirmed_at,
        created_at,
        trial_classes:trial_class_id (title, subject),
        students:student_id (name, age),
        parents:parent_id (name, email)
      `)
      .eq('status', 'confirmed');

    if (classId) {
      query = query.eq('trial_class_id', classId);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.error('Error fetching roster from Supabase:', error);
      return [];
    }

    return data.map((b: any) => ({
      booking_id: b.id,
      trial_class_id: b.trial_class_id,
      class_title: b.trial_classes?.title || 'Unknown Class',
      subject: b.trial_classes?.subject || 'science',
      student_id: b.student_id,
      student_name: b.students?.name || 'Unknown Student',
      student_age: b.students?.age || 0,
      parent_id: b.parent_id,
      parent_name: b.parents?.name || 'Unknown Parent',
      parent_email: b.parents?.email || 'unknown@example.com',
      confirmed_at: b.confirmed_at || b.created_at,
    }));
  }

  /**
   * Step 1: Reserve booking in Supabase with status 'pending_payment'
   */
  async reserveBooking(input: ReserveBookingInput): Promise<BookingResult> {
    if (!supabaseAdmin) {
      return {
        success: false,
        booking: null,
        error_code: 'BOOKING_NOT_FOUND',
        message: 'Supabase client is not configured.',
      };
    }

    // 1. Check duplicate confirmed booking
    const { data: existingConfirmed } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('trial_class_id', input.trial_class_id)
      .eq('student_id', input.student_id)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (existingConfirmed) {
      return {
        success: false,
        booking: null,
        error_code: 'DUPLICATE_BOOKING',
        message: 'This student already has a confirmed seat in this trial class.',
      };
    }

    // 2. Check current capacity
    const { count, error: countError } = await supabaseAdmin
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('trial_class_id', input.trial_class_id)
      .eq('status', 'confirmed');

    if (countError) {
      return {
        success: false,
        booking: null,
        error_code: 'INVALID_STATUS',
        message: 'Failed to verify class capacity.',
      };
    }

    if ((count ?? 0) >= 4) {
      return {
        success: false,
        booking: null,
        error_code: 'CLASS_FULL',
        message: 'Class has reached its maximum capacity of 4 students.',
      };
    }

    // 3. Insert reservation
    const newId = `booking-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const { data: newBooking, error: insertError } = await supabaseAdmin
      .from('bookings')
      .insert({
        id: newId,
        trial_class_id: input.trial_class_id,
        student_id: input.student_id,
        parent_id: input.parent_id,
        status: 'pending_payment',
      })
      .select()
      .single();

    if (insertError || !newBooking) {
      return {
        success: false,
        booking: null,
        error_code: 'INVALID_STATUS',
        message: insertError?.message || 'Failed to create booking reservation in Supabase.',
      };
    }

    return {
      success: true,
      booking: newBooking as Booking,
      message: 'Seat reserved. Please complete payment within the time limit.',
    };
  }

  /**
   * Step 2: Atomic Confirmation via Supabase Stored Procedure (confirm_trial_booking)
   * This executes the PostgreSQL SELECT ... FOR UPDATE exclusive row lock!
   */
  async processPayment(input: ProcessPaymentInput): Promise<BookingResult> {
    if (!supabaseAdmin) {
      return {
        success: false,
        booking: null,
        error_code: 'BOOKING_NOT_FOUND',
        message: 'Supabase client is not configured.',
      };
    }

    const txId = input.payment_token || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Call stored procedure confirm_trial_booking in Supabase
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('confirm_trial_booking', {
      p_booking_id: input.booking_id,
      p_payment_success: input.simulate_outcome === 'success',
      p_transaction_id: txId,
      p_failure_reason: input.simulate_outcome === 'failure' ? 'Card declined by payment gateway' : null,
    });

    if (rpcError) {
      console.error('Supabase RPC confirm_trial_booking error:', rpcError);
      return {
        success: false,
        booking: null,
        error_code: 'INVALID_STATUS',
        message: rpcError.message || 'Database error during payment processing.',
      };
    }

    // Fetch the updated booking row
    const { data: updatedBooking } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', input.booking_id)
      .maybeSingle();

    if (!rpcResult.success) {
      return {
        success: false,
        booking: (updatedBooking as Booking) || null,
        error_code: rpcResult.error_code,
        message: rpcResult.message,
      };
    }

    return {
      success: true,
      booking: updatedBooking as Booking,
      message: rpcResult.message || 'Payment successful! Trial class seat confirmed.',
    };
  }

  /**
   * Compute real-time invariants and metrics directly from Supabase
   */
  async getMetrics(): Promise<SystemMetrics | null> {
    if (!supabaseAdmin) return null;

    try {
      const { data: classes, error: classesErr } = await supabaseAdmin
        .from('trial_classes')
        .select('*');
      if (classesErr || !classes) return null;

      const { data: bookings, error: bookingsErr } = await supabaseAdmin
        .from('bookings')
        .select('*');
      if (bookingsErr || !bookings) return null;

      const { data: payments, error: paymentsErr } = await supabaseAdmin
        .from('payment_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15);

      const paymentAttempts = (payments as PaymentAttempt[]) || [];

      // Calculate invariant checks
      const confirmedBookings = bookings.filter((b: any) => b.status === 'confirmed');
      const countsByClass: Record<string, number> = {};
      const pairCounts: Record<string, number> = {};
      let duplicateConfirmedCount = 0;

      for (const b of confirmedBookings) {
        countsByClass[b.trial_class_id] = (countsByClass[b.trial_class_id] || 0) + 1;
        const pair = `${b.trial_class_id}_${b.student_id}`;
        pairCounts[pair] = (pairCounts[pair] || 0) + 1;
        if (pairCounts[pair] > 1) {
          duplicateConfirmedCount++;
        }
      }

      let overbookedClassesCount = 0;
      for (const cls of classes) {
        if ((countsByClass[cls.id] || 0) > cls.capacity) {
          overbookedClassesCount++;
        }
      }

      const totalCapacity = classes.reduce((sum: number, c: any) => sum + (c.capacity || 4), 0);
      const totalConfirmed = confirmedBookings.length;

      const raceConflicts = paymentAttempts.filter(
        (p) =>
          p.status === 'failed' &&
          (p.failure_reason?.includes('Seat taken') ||
            p.failure_reason?.includes('capacity') ||
            p.failure_reason?.includes('race condition'))
      ).length;

      return {
        status: overbookedClassesCount === 0 && duplicateConfirmedCount === 0 ? 'healthy' : 'degraded',
        uptime_seconds: Math.floor((Date.now() - serverStartTime) / 1000),
        database: 'supabase',
        invariants: {
          overbooked_classes_count: overbookedClassesCount,
          duplicate_confirmed_count: duplicateConfirmedCount,
          all_invariants_pass: overbookedClassesCount === 0 && duplicateConfirmedCount === 0,
        },
        stats: {
          total_classes: classes.length,
          total_capacity: totalCapacity,
          total_confirmed_students: totalConfirmed,
          capacity_utilization_percent: Math.round((totalConfirmed / (totalCapacity || 1)) * 100),
          total_bookings_created: bookings.length,
          bookings_by_status: {
            confirmed: confirmedBookings.length,
            pending_payment: bookings.filter((b: any) => b.status === 'pending_payment').length,
            payment_failed: bookings.filter((b: any) => b.status === 'payment_failed').length,
            cancelled: bookings.filter((b: any) => b.status === 'cancelled').length,
          },
          total_payment_attempts: paymentAttempts.length,
          payment_attempts_by_status: {
            succeeded: paymentAttempts.filter((p) => p.status === 'succeeded').length,
            failed: paymentAttempts.filter((p) => p.status === 'failed').length,
          },
          race_condition_conflicts: raceConflicts,
        },
        recent_payment_attempts: paymentAttempts.slice(0, 8),
      };
    } catch (err) {
      console.error('Error computing Supabase metrics:', err);
      return null;
    }
  }
}

export const supabaseStore = new SupabaseBookingStore();
