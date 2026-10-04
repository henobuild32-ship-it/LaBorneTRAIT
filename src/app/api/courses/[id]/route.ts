import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    authenticateRequest(request);
    const { id } = await params;

    const course = await db.course.findUnique({
      where: { id },
      include: {
        class: {
          include: {
            _count: {
              select: { enrollments: true },
            },
          },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
        _count: {
          select: {
            lessons: true,
            grades: true,
            homework: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    return NextResponse.json({ course });
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
    const { name, description, teacherId, classId } = body;

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const course = await db.course.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(teacherId !== undefined && { teacherId }),
        ...(classId !== undefined && { classId }),
      },
      include: {
        class: true,
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
        _count: {
          select: {
            lessons: true,
            grades: true,
            homework: true,
          },
        },
      },
    });

    return NextResponse.json({ course });
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

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    await db.course.delete({ where: { id } });

    return NextResponse.json({ message: 'Course deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
