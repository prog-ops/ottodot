import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ProcessPaymentInput, BookingResult } from '@/types';

export async function POST(request: NextRequest): Promise<NextResponse<BookingResult>> {
  try {
    const body = (await request.json()) as Partial<ProcessPaymentInput>;

    if (!body.booking_id) {
      return NextResponse.json(
        {
          success: false,
          booking: null,
          error_code: 'BOOKING_NOT_FOUND',
          message: 'Missing required field: booking_id',
        },
        { status: 400 }
      );
    }

    const simulateOutcome = body.simulate_outcome ?? 'success';

    const result = await bookingStore.processPayment({
      booking_id: body.booking_id,
      simulate_outcome: simulateOutcome,
      payment_token: body.payment_token,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error_code === 'CLASS_FULL' || result.error_code === 'DUPLICATE_BOOKING') {
        statusCode = 409; // Conflict
      } else if (result.error_code === 'PAYMENT_FAILED') {
        statusCode = 402; // Payment Required / Payment Failed
      } else if (result.error_code === 'BOOKING_NOT_FOUND') {
        statusCode = 404;
      }
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Payment processing failed';
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
