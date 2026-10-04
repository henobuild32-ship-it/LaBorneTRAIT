import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const teacherId = searchParams.get('teacherId');
    const classId = searchParams.get('classId');

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (teacherId) {
      where.teacherId = teacherId;
    }

    if (classId) {
      where.classId = classId;
    }

    const courses = await db.course.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ courses });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const { schoolId, classId, teacherId, name, description, coefficient, maxScore } = body;

    if (!schoolId || !classId || !teacherId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, classId, teacherId, name' },
        { status: 400 }
      );
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN' || auth.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    const course = await db.course.create({
      data: {
        schoolId,
        classId,
        teacherId,
        name,
        description: description || '',
        ...(coefficient !== undefined && coefficient > 0 ? { coefficient: Math.min(parseInt(String(coefficient), 10) || 1, 10) } : {}),
        ...(maxScore !== undefined && maxScore > 0 ? { maxScore: parseFloat(String(maxScore)) } : {}),
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

    return NextResponse.json({ course }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const { id, name, description, teacherId, status, maxScore, coefficient } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }
    const existing = await db.course.findUnique({ where: { id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Cours introuvable dans votre établissement.' }, { status: 403 });
    }

    const course = await db.course.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(teacherId !== undefined && { teacherId }),
        ...(status !== undefined && { status }),
        ...(maxScore !== undefined && { maxScore: parseFloat(maxScore) }),
        ...(coefficient !== undefined && { coefficient: parseInt(coefficient, 10) }),
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
