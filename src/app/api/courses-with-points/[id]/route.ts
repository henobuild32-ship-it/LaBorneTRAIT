import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

const ALLOWED_FIELDS = ['name', 'maxScore', 'coefficient', 'description', 'status', 'weight', 'points'] as const;

function pickCourseData(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  return data;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ADMIN uniquement, scope école
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut modifier un cours.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.course.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const course = await db.course.update({
      where: { id },
      data: pickCourseData(body),
    });
    return NextResponse.json({ course });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating course:', error);
    return NextResponse.json({ error: 'Failed to update course' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ADMIN uniquement, scope école
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut supprimer un cours.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.course.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    await db.course.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting course:', error);
    return NextResponse.json({ error: 'Failed to delete course' }, { status: 500 });
  }
}