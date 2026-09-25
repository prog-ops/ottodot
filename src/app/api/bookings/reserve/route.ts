import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ReserveBookingInput, BookingResult } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<BookingResult>> {
  try {
    const body = (await request.json()) as Partial<ReserveBookingInput>;

    if (!body.trial_class_id || !body.student_id || !body.parent_id) {
      return NextResponse.json(
        {
          success: false,
          booking: null,
          error_code: 'BOOKING_NOT_FOUND',
          message: 'Missing required fields: trial_class_id, student_id, parent_id',
        },
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create reservation';
    return NextResponse.json(
      {
        success: false,
        booking: null,
        error_code: 'INVALID_STATUS',
        message,
      },
      { status: 500 }
    );
  }
}
