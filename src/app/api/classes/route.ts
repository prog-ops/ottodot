import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ClassesApiResponse } from '@/types';

export async function GET(): Promise<NextResponse<ClassesApiResponse>> {
  try {
    const classes = await bookingStore.getTrialClasses();
    return NextResponse.json({ success: true, data: classes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch trial classes';
    return NextResponse.json(
      { success: false, data: [], message },
      { status: 500 }
    );
  }
}
