import { NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';

export async function GET() {
  try {
    const parents = bookingStore.getParents();
    const students = bookingStore.getStudents();

    const data = parents.map(p => ({
      ...p,
      students: students.filter(s => s.parent_id === p.id),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch parents and students' },
      { status: 500 }
    );
  }
}
