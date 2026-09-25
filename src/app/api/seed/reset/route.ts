import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { TrialClass } from '@/types';

interface ResetApiResponse {
  success: boolean;
  message: string;
  classes?: TrialClass[];
}

export async function POST(): Promise<NextResponse<ResetApiResponse>> {
  try {
    bookingStore.reset();
    return NextResponse.json({
      success: true,
      message: 'Seed data successfully reset to initial state.',
      classes: await bookingStore.getTrialClasses(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to reset seed data';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
