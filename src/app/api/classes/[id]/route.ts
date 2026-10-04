import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Lecture : utilisateur authentifié de la même école
    const auth = authenticateRequest(request);
    const { id } = await params;

    const schoolClass = await db.schoolClass.findUnique({
      where: { id },
      include: {
        school: { select: { id: true } },
        _count: {
          select: {
            enrollments: true,
            courses: true,
          },
        },
        enrollments: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                photoUrl: true,
                parentId: true,
              },
            },
          },
        },
      },
    });

    if (!schoolClass) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (schoolClass.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ class: schoolClass });
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
    // Modification : ADMIN uniquement + même école
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut modifier une classe.' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const { name, level, fees, section, option, capacity, cycle } = body;

    const existing = await db.schoolClass.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const schoolClass = await db.schoolClass.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(level !== undefined && { level }),
        ...(cycle !== undefined && { cycle }),
        ...(section !== undefined && { section }),
        ...(option !== undefined && { option }),
        ...(capacity !== undefined && { capacity: typeof capacity === 'number' && capacity > 0 ? Math.trunc(capacity) : 0 }),
        ...(fees !== undefined && { fees }),
      },
      include: {
        _count: {
          select: {
            enrollments: true,
            courses: true,
          },
        },
      },
    });

    return NextResponse.json({ class: schoolClass });
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
    // Suppression : ADMIN uniquement + même école
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut supprimer une classe.' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.schoolClass.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }
    if (existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    await db.enrolledClass.deleteMany({ where: { classId: id } });
    await db.schoolClass.delete({ where: { id } });

    return NextResponse.json({ message: 'Class deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}