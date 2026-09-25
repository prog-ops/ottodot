import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';

export async function POST() {
  try {
    bookingStore.reset();
    return NextResponse.json({
      success: true,
      message: 'Seed data successfully reset to initial state.',
      classes: bookingStore.getTrialClasses(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to reset seed data' },
      { status: 500 }
    );
  }
}
