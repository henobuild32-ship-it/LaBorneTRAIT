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

    const homework = await db.homework.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!homework) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
    }

    return NextResponse.json({ homework });
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
    const { title, description, dueDate, gradingType, courseId, fileUrl, fileName } = body;

    const existing = await db.homework.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
    }

    const homework = await db.homework.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate }),
        ...(gradingType !== undefined && { gradingType }),
        ...(courseId !== undefined && { courseId }),
        ...(fileUrl !== undefined && { fileUrl }),
        ...(fileName !== undefined && { fileName }),
      },
      include: {
        course: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return NextResponse.json({ homework });
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

    const existing = await db.homework.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Homework not found' }, { status: 404 });
    }

    await db.homework.delete({ where: { id } });

    return NextResponse.json({ message: 'Homework deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
