import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { ParentsApiResponse } from '@/types';

export async function GET(): Promise<NextResponse<ParentsApiResponse>> {
  try {
    const parents = bookingStore.getParents();
    const students = bookingStore.getStudents();

    const data = parents.map((p) => ({
      ...p,
      students: students.filter((s) => s.parent_id === p.id),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch parents and students';
    return NextResponse.json(
      { success: false, data: [], message },
      { status: 500 }
    );
  }
}
