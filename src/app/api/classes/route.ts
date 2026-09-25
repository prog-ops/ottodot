import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';

export async function GET() {
  try {
    const classes = bookingStore.getTrialClasses();
    return NextResponse.json({ success: true, data: classes });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch trial classes' },
      { status: 500 }
    );
  }
}
