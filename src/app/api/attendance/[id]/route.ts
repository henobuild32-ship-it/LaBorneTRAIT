import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { assertYearOpen } from '@/lib/year-status';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    authenticateRequest(request);
    const { id } = await params;

    const attendance = await db.attendance.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!attendance) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    return NextResponse.json({ attendance });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    authenticateRequest(request);
    const { id } = await params;
    const body = await request.json();
    const { status, reason, date, courseId } = body;

    const existing = await db.attendance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    try {
      await assertYearOpen(existing.schoolId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    if (date && date !== existing.date) {
      const newCourseId = courseId || existing.courseId;
      const conflicting = await db.attendance.findUnique({
        where: {
          studentId_date_courseId: {
            studentId: existing.studentId,
            date,
            courseId: newCourseId,
          },
        },
      });

      if (conflicting && conflicting.id !== id) {
        return NextResponse.json(
          { error: 'Attendance already recorded for this student on the new date' },
          { status: 409 }
        );
      }
    }

    const attendance = await db.attendance.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(reason !== undefined && { reason }),
        ...(date !== undefined && { date }),
        ...(courseId !== undefined && { courseId }),
      },
      include: {
        student: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return NextResponse.json({ attendance });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    authenticateRequest(request);
    const { id } = await params;

    const existing = await db.attendance.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    await db.attendance.delete({ where: { id } });

    return NextResponse.json({ message: 'Attendance record deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
