import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ReserveBookingInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReserveBookingInput;

    if (!body.trial_class_id || !body.student_id || !body.parent_id) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: trial_class_id, student_id, parent_id' },
        { status: 400 }
      );
    }

    const result = await bookingStore.reserveBooking({
      trial_class_id: body.trial_class_id,
      student_id: body.student_id,
      parent_id: body.parent_id,
    });

    if (!result.success) {
      const statusCode = result.error_code === 'DUPLICATE_BOOKING' ? 409 : 400;
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create reservation' },
      { status: 500 }
    );
  }
}
