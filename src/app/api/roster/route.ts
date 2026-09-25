import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId') || undefined;

    const roster = bookingStore.getRoster(classId);
    const classes = bookingStore.getTrialClasses();

    return NextResponse.json({
      success: true,
      total_confirmed: roster.length,
      data: roster,
      summary: classes.map(c => ({
        class_id: c.id,
        title: c.title,
        confirmed_count: c.confirmed_count,
        capacity: c.capacity,
        is_full: (c.confirmed_count ?? 0) >= c.capacity,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch roster' },
      { status: 500 }
    );
  }
}
