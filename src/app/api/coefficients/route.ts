import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';

// GET /api/coefficients?classId=&section=&schoolYearId=&courseId=
export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const classId = searchParams.get('classId') || '';
    const section = searchParams.get('section') || '';
    const schoolYearId = searchParams.get('schoolYearId') || '';
    const courseId = searchParams.get('courseId') || '';

    const where: Record<string, unknown> = { schoolId, isActive: true };
    if (classId) where.classId = classId;
    if (section) where.section = section;
    if (schoolYearId) where.schoolYearId = schoolYearId;
    if (courseId) where.courseId = courseId;

    const coefficients = await db.coefficient.findMany({
      where,
      include: {
        class: { select: { id: true, name: true, cycle: true, section: true } },
        course: { select: { id: true, name: true, maxScore: true } },
      },
      orderBy: [{ classId: 'asc' }, { section: 'asc' }, { courseId: 'asc' }],
    });

    return NextResponse.json({ coefficients });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/coefficients]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/coefficients { classId, section, courseId, coefficient, schoolYearId }
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();
    const { classId, section, courseId, coefficient, schoolYearId } = body;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }
    if (!classId || !courseId) {
      return NextResponse.json({ error: 'classId et courseId sont requis.' }, { status: 400 });
    }

    // Applique aussi au niveau cours si flag "applyToCourse"
    const coeff = typeof coefficient === 'number' ? coefficient : 1;

    // Récupère l'année active si non fournie
    let schoolYearIdFinal = schoolYearId;
    if (!schoolYearIdFinal) {
      const activeYear = await db.schoolYear.findFirst({
        where: { schoolId: auth.schoolId, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      schoolYearIdFinal = activeYear?.id || '';
    }

    const record = await db.coefficient.upsert({
      where: { schoolId_classId_courseId_schoolYearId: { schoolId: auth.schoolId, classId, courseId, schoolYearId: schoolYearIdFinal } },
      update: { coefficient: coeff, section: section || '', isActive: true },
      create: {
        schoolId: auth.schoolId,
        classId,
        section: section || '',
        courseId,
        coefficient: coeff,
        schoolYearId: schoolYearIdFinal,
        isActive: true,
      },
      include: {
        class: { select: { id: true, name: true, cycle: true, section: true } },
        course: { select: { id: true, name: true, maxScore: true } },
      },
    });

    return NextResponse.json({ coefficient: record });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/coefficients]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}