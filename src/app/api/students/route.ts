import { NextRequest, NextResponse } from 'next/server';
import { bookingStore } from '@/lib/db/store';
import { Student } from '@/types';

interface AddStudentRequestBody {
  parent_id?: string;
  name?: string;
  age?: number;
}

interface StudentApiResponse {
  success: boolean;
  data?: Student;
  message?: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<StudentApiResponse>> {
  try {
    const body = (await req.json()) as AddStudentRequestBody;
    const { parent_id, name, age } = body;

    if (!parent_id || !name || age === undefined || age === null) {
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required fields: parent_id, name, and age are mandatory.',
        },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Child name cannot be empty.' },
        { status: 400 }
      );
    }

    const numAge = Number(age);
    if (isNaN(numAge) || numAge < 4 || numAge > 16) {
      return NextResponse.json(
        { success: false, message: 'Child age must be between 4 and 16 years old.' },
        { status: 400 }
      );
    }

    const student = await bookingStore.addStudent(parent_id, trimmedName, numAge);

    return NextResponse.json(
      {
        success: true,
        data: student,
        message: `Child "${student.name}" registered successfully.`,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to register student';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
