import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

// GET /api/schedules?schoolId=...&classId=...&dayOfWeek=...
export async function GET(request: NextRequest) {
  try {
    // Lecture : utilisateur authentifié, depuis sa propre école
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const classId = searchParams.get('classId');
    const dayOfWeek = searchParams.get('dayOfWeek');
    const courseId = searchParams.get('courseId');

    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const where: any = { schoolId };
    if (courseId) where.courseId = courseId;
    if (dayOfWeek) where.dayOfWeek = parseInt(dayOfWeek);

    // If classId provided, filter by courses belonging to that class
    if (classId) {
      where.course = { classId };
    }

    const schedules = await db.courseSchedule.findMany({
      where,
      include: {
        course: {
          include: {
            teacher: { select: { id: true, fullName: true } },
            class: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(schedules);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[GET /api/schedules]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/schedules
export async function POST(request: NextRequest) {
  try {
    // Écrire : admin uniquement
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut créer un horaire.' }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, schoolId, dayOfWeek, startTime, endTime, room, periodStart, periodEnd, exceptions } = body;

    if (!courseId || !schoolId || !dayOfWeek || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'courseId, schoolId, dayOfWeek, startTime et endTime sont requis' },
        { status: 400 }
      );
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    // Check that course belongs to the school
    const course = await db.course.findFirst({
      where: { id: courseId, schoolId },
    });

    if (!course) {
      return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 });
    }

    const schedule = await db.courseSchedule.create({
      data: {
        courseId,
        schoolId,
        dayOfWeek: parseInt(String(dayOfWeek)),
        startTime,
        endTime,
        room: room || '',
        periodStart: periodStart ? new Date(periodStart) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        exceptions: exceptions || '[]',
      },
      include: {
        course: {
          include: {
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/schedules]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/schedules
export async function PUT(request: NextRequest) {
  try {
    // Écrire : admin uniquement
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut modifier un horaire.' }, { status: 403 });
    }

    const body = await request.json();
    const { id, courseId, dayOfWeek, startTime, endTime, room, periodStart, periodEnd, exceptions } = body;

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    const existing = await db.courseSchedule.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const updated = await db.courseSchedule.update({
      where: { id },
      data: {
        ...(courseId !== undefined && { courseId }),
        ...(dayOfWeek !== undefined && { dayOfWeek: parseInt(String(dayOfWeek)) }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(room !== undefined && { room: room || '' }),
        ...(periodStart !== undefined && { periodStart: periodStart ? new Date(periodStart) : null }),
        ...(periodEnd !== undefined && { periodEnd: periodEnd ? new Date(periodEnd) : null }),
        ...(exceptions !== undefined && { exceptions: exceptions || '[]' }),
      },
      include: {
        course: {
          include: {
            teacher: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[PUT /api/schedules]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/schedules?id=...
export async function DELETE(request: NextRequest) {
  try {
    // Admin uniquement
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut supprimer un horaire.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    const existing = await db.courseSchedule.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    await db.courseSchedule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[DELETE /api/schedules]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}