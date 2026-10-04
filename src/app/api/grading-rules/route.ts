import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentAcademicYear } from '@/lib/grade-sync';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

// GET: Récupérer les règles de délibération et de passage (par école / cycle / classe)
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const { searchParams } = new URL(req.url);
    const schoolId = auth.schoolId;
    const classId = searchParams.get('classId');
    const cycle = searchParams.get('cycle');
    const academicYear = searchParams.get('academicYear') || getCurrentAcademicYear();

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });
    }

    const whereClause: any = {
      schoolId,
      academicYear,
    };
    if (classId) whereClause.classId = classId;
    if (cycle) whereClause.cycle = cycle;

    const rules = await db.gradingDecisionRule.findMany({
      where: whereClause,
      include: {
        class: { select: { id: true, name: true, cycle: true, level: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Règle par défaut si aucune n'est encore configurée
    if (rules.length === 0) {
      const defaultRule = {
        schoolId,
        classId: classId || null,
        cycle: cycle || 'ALL',
        academicYear,
        passPercentage: 50.0,
        retakeMinPercentage: 45.0,
        maxFailedCourses: 2,
        eliminationPercentage: 35.0,
        maternelleMode: 'QUALITATIF',
        isActive: true,
      };
      return NextResponse.json({ rules: [defaultRule], isDefault: true });
    }

    return NextResponse.json({ rules, isDefault: false });
  } catch (error: any) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/grading-rules] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

// POST/PUT: Enregistrer ou modifier les règles de délibération
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequestActive(req);
    const body = await req.json();
    const {
      classId = null,
      cycle = 'ALL',
      academicYear = getCurrentAcademicYear(),
      passPercentage = 50.0,
      retakeMinPercentage = 45.0,
      maxFailedCourses = 2,
      eliminationPercentage = null,
      maternelleMode = 'QUALITATIF',
    } = body;
    const schoolId = auth.schoolId;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès réservé à l’administration.' }, { status: 403 });
    }
    const pass = Number(passPercentage);
    const retake = Number(retakeMinPercentage);
    const failedLimit = Number(maxFailedCourses);
    if (![pass, retake, failedLimit].every(Number.isFinite) || pass < 0 || pass > 100 || retake < 0 || retake > pass || failedLimit < 0) {
      return NextResponse.json({ error: 'Règles de délibération invalides.' }, { status: 400 });
    }

    const rule = await db.gradingDecisionRule.upsert({
      where: {
        schoolId_classId_cycle_academicYear: {
          schoolId,
          classId: classId || '',
          cycle,
          academicYear,
        },
      },
      update: {
        passPercentage: Number(passPercentage) || 50.0,
        retakeMinPercentage: Number(retakeMinPercentage) || 45.0,
        maxFailedCourses: Number(maxFailedCourses) !== undefined ? Number(maxFailedCourses) : 2,
        eliminationPercentage: eliminationPercentage !== null && eliminationPercentage !== undefined ? Number(eliminationPercentage) : null,
        maternelleMode: maternelleMode === 'NUMERIQUE' ? 'NUMERIQUE' : 'QUALITATIF',
        isActive: true,
      },
      create: {
        schoolId,
        classId: classId || null,
        cycle,
        academicYear,
        passPercentage: Number(passPercentage) || 50.0,
        retakeMinPercentage: Number(retakeMinPercentage) || 45.0,
        maxFailedCourses: Number(maxFailedCourses) !== undefined ? Number(maxFailedCourses) : 2,
        eliminationPercentage: eliminationPercentage !== null && eliminationPercentage !== undefined ? Number(eliminationPercentage) : null,
        maternelleMode: maternelleMode === 'NUMERIQUE' ? 'NUMERIQUE' : 'QUALITATIF',
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/grading-rules] Error:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
