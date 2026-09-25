import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ProcessPaymentInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ProcessPaymentInput;

    if (!body.booking_id) {
      return NextResponse.json(
        { success: false, message: 'Missing required field: booking_id' },
        { status: 400 }
      );
    }

    const simulateOutcome = body.simulate_outcome || 'success';

    const result = await bookingStore.processPayment({
      booking_id: body.booking_id,
      simulate_outcome: simulateOutcome,
      payment_token: body.payment_token,
    });

    if (!result.success) {
      let statusCode = 400;
      if (result.error_code === 'CLASS_FULL' || result.error_code === 'DUPLICATE_BOOKING') {
        statusCode = 409; // Conflict (Race condition or double booking)
      } else if (result.error_code === 'PAYMENT_FAILED') {
        statusCode = 402; // Payment Required / Payment Failed
      } else if (result.error_code === 'BOOKING_NOT_FOUND') {
        statusCode = 404;
      }
      return NextResponse.json(result, { status: statusCode });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Payment processing failed' },
      { status: 500 }
    );
  }
}
