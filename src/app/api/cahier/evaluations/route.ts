import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import {
  recomputeStudentPeriodGrade,
  recomputeEvaluationGrades,
} from '@/lib/grade-service';
import { assertGradePeriodOpen } from '@/lib/academic-closures';

/**
 * GET /api/cahier/evaluations
 * Query params: schoolId, classId, courseId, period (optional)
 * Returns all students, evaluations, and marks for a class + course.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const courseId = searchParams.get('courseId');
    const period = searchParams.get('period'); // "P1" | "P2" | "EX1" | "P3" | "P4" | "EX2" (optional)

    if (!schoolId || !classId || !courseId) {
      return NextResponse.json(
        { error: 'Missing required query parameters: schoolId, classId, courseId' },
        { status: 400 }
      );
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Établissement invalide.' }, { status: 403 });
    }
    const course = await db.course.findFirst({
      where: { id: courseId, schoolId, classId, deletedAt: null },
      select: { teacherId: true },
    });
    if (!course || (auth.role === 'TEACHER' && course.teacherId !== auth.userId)) {
      return NextResponse.json({ error: 'Vous n’êtes pas autorisé à consulter ce cahier.' }, { status: 403 });
    }
    // 1. Fetch all students enrolled in the class
    const enrollments = await db.enrolledClass.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            postName: true,
            gender: true,
          },
        },
      },
    });

    const students = enrollments
      .map((e) => e.user)
      .filter((u) => u !== null)
      .sort((a, b) =>
        `${a.fullName} ${a.postName}`.localeCompare(`${b.fullName} ${b.postName}`, 'fr', { sensitivity: 'base' })
      );

    // 2. Fetch all evaluations for this course (optionally filtered by period)
    const evaluationWhere: Record<string, unknown> = { schoolId, classId, courseId };
    if (period) {
      evaluationWhere.trimester = period;
    }

    const evaluations = await db.cahierEvaluation.findMany({
      where: evaluationWhere,
      include: {
        marks: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      students,
      evaluations,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/cahier/evaluations
 * Body: { schoolId, classId, courseId, title, maxScore, period, date }
 * Creates a new evaluation column in the cahier.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { schoolId, classId, courseId, title, maxScore, period, date, teacherId } = body;

    if (!schoolId || !classId || !courseId || !title || !period) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, classId, courseId, title, period' },
        { status: 400 }
      );
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Établissement invalide.' }, { status: 403 });
    }
    const course = await db.course.findFirst({
      where: { id: courseId, schoolId, classId, deletedAt: null },
      select: { teacherId: true },
    });
    if (!course || (auth.role === 'TEACHER' && course.teacherId !== auth.userId)) {
      return NextResponse.json({ error: 'Vous n’êtes pas autorisé à créer cette évaluation.' }, { status: 403 });
    }
    const evaluationDate = date ? new Date(date) : new Date();
    try {
      const schoolYear = await db.schoolYear.findFirst({ where: { schoolId, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      await assertGradePeriodOpen({ schoolId, schoolYearId: schoolYear?.id, date: evaluationDate, trimester: period || 'P1' });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

    const evaluation = await db.cahierEvaluation.create({
      data: {
        schoolId,
        classId,
        courseId,
        title,
        maxScore: maxScore ? parseFloat(maxScore) : 20,
        trimester: period,
        teacherId: auth.role === 'TEACHER' ? auth.userId : (teacherId || course.teacherId),
        date: evaluationDate,
      },
    });

    return NextResponse.json({ evaluation }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/cahier/evaluations
 * Body: { evaluationId, marks: { [studentId]: score } }
 * Updates the marks for a specific evaluation column, and recalculates the average period Grade.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { evaluationId, marks } = body;

    if (!evaluationId || !marks) {
      return NextResponse.json(
        { error: 'Missing required fields: evaluationId, marks' },
        { status: 400 }
      );
    }

    const evaluation = await db.cahierEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    if (auth.schoolId !== evaluation.schoolId) {
      return NextResponse.json({ error: 'Évaluation hors de votre établissement' }, { status: 403 });
    }
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'La modification des cotations existantes est réservée à l’administrateur.' }, { status: 403 });
    }
    try {
      const schoolYear = await db.schoolYear.findFirst({ where: { schoolId: evaluation.schoolId, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      await assertGradePeriodOpen({ schoolId: evaluation.schoolId, schoolYearId: schoolYear?.id, date: evaluation.date, trimester: evaluation.trimester });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

const { schoolId, courseId, trimester } = evaluation;

    // Update or create marks in transaction
    const studentIds = Object.keys(marks);
    await db.$transaction(
      studentIds.map((studentId) =>
        db.cahierMark.upsert({
          where: {
            evaluationId_studentId: {
              evaluationId,
              studentId,
            },
          },
          update: {
            score: parseFloat(marks[studentId]) || 0,
          },
          create: {
            evaluationId,
            studentId,
            score: parseFloat(marks[studentId]) || 0,
          },
        })
      )
    );

    // ── Sync with Grade model + bulletins (single source of truth) ──
    for (const studentId of studentIds) {
      await recomputeStudentPeriodGrade({ schoolId, courseId, studentId, period: trimester });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/cahier/evaluations
 * Body: { evaluationId, title?, maxScore?, date? }
 * Edits the metadata of an evaluation column (title, max score, date) and
 * recomputes the affected grades + bulletins in real time.
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { evaluationId, title, maxScore, date } = body;

    if (!evaluationId) {
      return NextResponse.json(
        { error: 'Missing required field: evaluationId' },
        { status: 400 }
      );
    }

    const evaluation = await db.cahierEvaluation.findUnique({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    // Only the course teacher or an admin may edit the evaluation.
    if (auth.role !== 'ADMIN') {
      const course = await db.course.findUnique({
        where: { id: evaluation.courseId },
        select: { teacherId: true },
      });
      if (!course || course.teacherId !== auth.userId) {
        return NextResponse.json(
          { error: 'Vous n\'êtes pas autorisé à modifier cette évaluation' },
          { status: 403 }
        );
      }
    }
    try {
      const schoolYear = await db.schoolYear.findFirst({ where: { schoolId: evaluation.schoolId, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' }, select: { id: true } });
      await assertGradePeriodOpen({ schoolId: evaluation.schoolId, schoolYearId: schoolYear?.id, date: date ? new Date(date) : evaluation.date, trimester: evaluation.trimester });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

    const data: Record<string, unknown> = {};
    if (typeof title === 'string' && title.trim()) data.title = title.trim();
    if (maxScore !== undefined && maxScore !== '') {
      const parsed = parseFloat(maxScore);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ error: 'Note maximale invalide' }, { status: 400 });
      }
      data.maxScore = parsed;
    }
    if (date) {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) data.date = parsedDate;
    }

    const updated = await db.cahierEvaluation.update({
      where: { id: evaluationId },
      data,
    });

    // Recompute grades & bulletins since maxScore / period may have changed.
    await recomputeEvaluationGrades(updated);

    return NextResponse.json({ evaluation: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/cahier/evaluations
 * Body: { evaluationId }
 * Deletes an evaluation column from the cahier.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const evaluationId = searchParams.get('evaluationId');

    if (!evaluationId) {
      return NextResponse.json({ error: 'evaluationId is required' }, { status: 400 });
    }

    const evaluation = await db.cahierEvaluation.findUnique({
      where: { id: evaluationId },
    });
    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    if (auth.role !== 'ADMIN' || auth.schoolId !== evaluation.schoolId) {
      return NextResponse.json({ error: 'Suppression réservée à l’administrateur de l’établissement.' }, { status: 403 });
    }

    await db.cahierEvaluation.delete({
      where: { id: evaluationId },
    });

    // Recompute grades & bulletins so deleted marks are reflected instantly.
    await recomputeEvaluationGrades(evaluation);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
