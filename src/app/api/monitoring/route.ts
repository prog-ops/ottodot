import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { MonitoringApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<MonitoringApiResponse>> {
  try {
    const metrics = await bookingStore.getMetrics();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: metrics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve system metrics';
    return NextResponse.json(
      {
        success: false,
        message,
        timestamp: new Date().toISOString(),
        data: {
          status: 'degraded',
          uptime_seconds: 0,
          database: 'in_memory',
          invariants: {
            overbooked_classes_count: 0,
            duplicate_confirmed_count: 0,
            all_invariants_pass: false,
          },
          stats: {
            total_classes: 0,
            total_capacity: 0,
            total_confirmed_students: 0,
            capacity_utilization_percent: 0,
            total_bookings_created: 0,
            bookings_by_status: {
              confirmed: 0,
              pending_payment: 0,
              payment_failed: 0,
              cancelled: 0,
            },
            total_payment_attempts: 0,
            payment_attempts_by_status: {
              succeeded: 0,
              failed: 0,
            },
            race_condition_conflicts: 0,
          },
          recent_payment_attempts: [],
        },
      },
      { status: 500 }
    );
  }
}
