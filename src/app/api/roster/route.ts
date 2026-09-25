import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { RosterApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<RosterApiResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId') || undefined;

    const [roster, classes] = await Promise.all([
      bookingStore.getRoster(classId),
      bookingStore.getTrialClasses(),
    ]);

    return NextResponse.json({
      success: true,
      total_confirmed: roster.length,
      data: roster,
      summary: classes.map((c) => ({
        class_id: c.id,
        title: c.title,
        confirmed_count: c.confirmed_count,
        capacity: c.capacity,
        is_full: (c.confirmed_count ?? 0) >= c.capacity,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch roster';
    return NextResponse.json(
      {
        success: false,
        total_confirmed: 0,
        data: [],
        summary: [],
        message,
      },
      { status: 500 }
    );
  }
}
