import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { syncStudentReport } from '@/lib/grade-sync';
import { assertYearOpen } from '@/lib/year-status';
import { assertGradePeriodOpen, calendarWeek } from '@/lib/academic-closures';
import { resolveClassCoefficients } from '@/lib/coefficient-resolver';
import {
  ensureQuickEvaluation,
  isPeriodKey,
  periodToTrimester,
  recomputeStudentPeriodGrade,
  upsertCahierMark,
} from '@/lib/grade-service';

function primaryTrimesterForDate(value: string | Date | undefined): string {
  const date = value ? new Date(value) : new Date();
  const month = date.getUTCMonth() + 1;
  if (month >= 9 && month <= 11) return '1';
  if (month === 12 || month <= 2) return '2';
  return '3';
}

function addDateRange(where: Record<string, unknown>, start: Date, end: Date) {
  where.evaluationDate = { gte: start, lt: end };
}

function applyTimeFilter(where: Record<string, unknown>, groupBy: string | null, groupValue: string | null) {
  if (!groupBy || groupBy === 'ALL' || !groupValue) return;
  if (groupBy === 'DAY') {
    const start = new Date(`${groupValue}T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) addDateRange(where, start, new Date(start.getTime() + 86400000));
  } else if (groupBy === 'MONTH' && /^\d{4}-\d{2}$/.test(groupValue)) {
    const start = new Date(`${groupValue}-01T00:00:00.000Z`);
    if (!Number.isNaN(start.getTime())) addDateRange(where, start, new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)));
  } else if (groupBy === 'YEAR' && /^\d{4}$/.test(groupValue)) {
    const start = new Date(`${groupValue}-01-01T00:00:00.000Z`);
    addDateRange(where, start, new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1)));
  } else if (groupBy === 'WEEK') {
    const match = /^(\d{4})-W(\d{1,2})$/.exec(groupValue);
    if (match) {
      const start = new Date(Date.UTC(Number(match[1]), 0, 1 + (Number(match[2]) - 1) * 7));
      addDateRange(where, start, new Date(start.getTime() + 7 * 86400000));
    }
  } else if (groupBy === 'TRIMESTER') {
    where.trimester = groupValue === '1' ? { in: ['1', 'P1', 'P2', 'EX1'] } : groupValue === '2' ? { in: ['2', 'P3', 'P4', 'EX2'] } : groupValue;
  } else if (groupBy === 'SEMESTER') {
    where.trimester = groupValue === '1' ? { in: ['1', 'P1', 'P2', 'EX1'] } : { in: ['2', 'P3', 'P4', 'EX2'] };
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const studentId = searchParams.get('studentId');
    const courseId = searchParams.get('courseId');
    const trimester = searchParams.get('trimester');
    const teacherId = searchParams.get('teacherId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const groupBy = searchParams.get('groupBy');
    const groupValue = searchParams.get('groupValue');

    if (!schoolId || (schoolId !== auth.schoolId && auth.role !== 'PARENT')) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (studentId) {
      if (auth.role === 'PARENT') {
        const student = await db.user.findUnique({
          where: { id: studentId },
          select: { parentId: true, schoolId: true },
        });
        if (!student || student.parentId !== auth.userId || student.schoolId !== schoolId) {
          return NextResponse.json({ error: 'Vous ne pouvez consulter que les notes de vos enfants' }, { status: 403 });
        }
      } else if (auth.role === 'STUDENT' && studentId !== auth.userId) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
      where.studentId = studentId;
    } else if (auth.role === 'STUDENT') {
      where.studentId = auth.userId;
    }
    if (courseId) where.courseId = courseId;
    if (teacherId) where.teacherId = teacherId;
    if (trimester) {
      // A trimester includes its monthly periods (P1/P2/EX1, P3/P4/EX2), so a
      // student sees ALL their points for the selected trimester.
      where.trimester =
        trimester === '1'
          ? { in: ['1', 'P1', 'P2', 'EX1'] }
          : trimester === '2'
          ? { in: ['2', 'P3', 'P4', 'EX2'] }
          : trimester;
    }
    if (from || to) {
      where.evaluationDate = {
        ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }),
        ...(to && { lt: new Date(`${to}T00:00:00.000Z`) }),
      };
    }
    applyTimeFilter(where, groupBy, groupValue);

    const grades = await db.grade.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, classId: true, coefficient: true } },
        student: { select: { id: true, fullName: true, role: true } },
        teacher: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: [{ courseId: 'asc' }, { createdAt: 'asc' }],
    });

    // Coefficients effectifs par classe (table Coefficient prioritaire)
    const byClass = new Map<string, Record<string, number>>();
    const coursesForClass = new Map<string, { id: string; coefficient: number }[]>();
    for (const g of grades) {
      const cid = g.course.classId || '';
      if (!cid) continue;
      if (!coursesForClass.has(cid)) coursesForClass.set(cid, []);
      coursesForClass.get(cid)!.push({ id: g.courseId, coefficient: g.course.coefficient });
    }
    for (const [cid, list] of coursesForClass) {
      const { byCourse } = await resolveClassCoefficients(schoolId, cid, list);
      byClass.set(cid, byCourse);
    }

    const enriched = grades.map((g) => ({
      ...g,
      effectiveCoefficient: (byClass.get(g.course.classId || '') || {})[g.courseId] ?? g.course.coefficient ?? 1,
    }));

    return NextResponse.json({ grades: enriched });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role === 'PARENT' || auth.role === 'STUDENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, courseId, studentId, teacherId, score, maxScore, trimester, period, comment, evaluationTitle, evaluationDate } = body;
    const operationId = request.headers.get('x-idempotency-key') || body.operationId;

    if (!schoolId || !courseId || !studentId || score === undefined) {
      return NextResponse.json(
        { error: 'Champs requis manquants: schoolId, courseId, studentId, score' },
        { status: 400 }
      );
    }
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Établissement invalide' }, { status: 403 });
    }
    const effectiveTeacherId = auth.role === 'TEACHER' ? auth.userId : teacherId;
    if (!effectiveTeacherId) {
      return NextResponse.json({ error: 'Professeur responsable requis' }, { status: 400 });
    }

    if (operationId) {
      const previous = await db.syncOperation.findUnique({ where: { operationId } });
      if (previous) {
        if (previous.userId !== auth.userId || previous.schoolId !== schoolId) {
          return NextResponse.json({ error: 'Clé de synchronisation invalide' }, { status: 403 });
        }
        return NextResponse.json(previous.response, { status: previous.statusCode });
      }
    }

    try {
      await assertYearOpen(schoolId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    // Permission : seuls le professeur titulaire du cours (ou un admin) notent.
    const course = await db.course.findUnique({
      where: { id: courseId, schoolId, deletedAt: null },
      select: {
        id: true,
        classId: true,
        teacherId: true,
        coefficient: true,
        maxScore: true,
        name: true,
        class: { select: { cycle: true } },
      },
    });
    if (!course) {
      return NextResponse.json({ error: 'Cours introuvable' }, { status: 404 });
    }
    if (auth.role === 'TEACHER' && course.teacherId !== auth.userId) {
      return NextResponse.json({ error: "Vous n'êtes pas le professeur de ce cours" }, { status: 403 });
    }

    const parsedScore = parseFloat(score);
    const parsedMax = maxScore ? parseFloat(maxScore) : 20;
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > parsedMax) {
      return NextResponse.json(
        { error: `La note doit être comprise entre 0 et ${parsedMax}` },
        { status: 400 }
      );
    }

    // Primaire : le trimestre est toujours dérivé de la date de l'évaluation.
    const isPrimary = !['EB', 'Humanites', 'Secondaire'].includes(course.class.cycle);
    const effectiveTrimester = isPrimary
      ? primaryTrimesterForDate(evaluationDate)
      : (trimester || period || 'P1');
    const evaluation = evaluationDate ? new Date(evaluationDate) : new Date();
    const week = calendarWeek(evaluation);
    const activeYear = await db.schoolYear.findFirst({
      where: { schoolId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    try {
      await assertGradePeriodOpen({ schoolId, schoolYearId: activeYear?.id, date: evaluation, trimester: effectiveTrimester });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

    // ── Saisie rapide via période RDC (P1..EX2) : alimente le cahier ──
    if (isPeriodKey(period ?? trimester)) {
      const evalPeriod = (period ?? trimester) as string;
      const evaluation = await ensureQuickEvaluation({
        schoolId,
        classId: course.classId,
        courseId,
        teacherId: effectiveTeacherId,
        period: evalPeriod,
        title: typeof evaluationTitle === 'string' ? evaluationTitle : undefined,
        maxScore: parsedMax,
        date: evaluationDate ? new Date(evaluationDate) : undefined,
      });
      await upsertCahierMark({ evaluationId: evaluation.id, studentId, score: parsedScore });
      await recomputeStudentPeriodGrade({
        schoolId,
        courseId,
        studentId,
        period: evalPeriod,
        teacherId: effectiveTeacherId,
        comment: comment ?? undefined,
      });

      // Recharger la note périodique produite pour la retourner au client.
      const grade = await db.grade.findFirst({
        where: { schoolId, courseId, studentId, trimester: evalPeriod },
        include: {
          course: { select: { id: true, name: true } },
          student: { select: { id: true, fullName: true, parentId: true } },
          teacher: { select: { id: true, fullName: true, role: true } },
        },
      });

      if (grade) {
        void notifyGrade(grade.id, schoolId, studentId, effectiveTeacherId, courseId, grade.score, 20, course.name || 'Matière', grade.comment).catch(() => {});
      }
      const responseBody = { grade: grade ?? null, fromCahier: true };
      if (operationId) {
        await db.syncOperation.create({
          data: {
            operationId,
            userId: auth.userId,
            schoolId,
            operationType: 'CREATE_GRADE',
            statusCode: 201,
            response: responseBody,
          },
        });
      }
      return NextResponse.json(responseBody, { status: 201 });
    }

    // ── Notes directes (trimestres Maternelle/Primaire : T1, T2, T3) ──
    const grade = await db.grade.create({
      data: {
        schoolId,
        courseId,
        studentId,
        teacherId: effectiveTeacherId,
        score: parsedScore,
        maxScore: parsedMax,
        trimester: effectiveTrimester,
        month: evaluation.getUTCMonth() + 1,
        week,
        comment: comment || '',
        evaluationDate: evaluation,
      },
      include: {
        course: { select: { id: true, name: true } },
        student: { select: { id: true, fullName: true, parentId: true } },
        teacher: { select: { id: true, fullName: true, role: true } },
      },
    });

    syncStudentReport(schoolId, studentId, effectiveTrimester).catch(() => {});

    // Trigger real-time and push notifications for student & parent
    try {
      const { notifyUser } = await import('@/services/notifications/notificationEngine');
      const courseName = grade.course?.name || 'Matière';
      const scoreStr = `${grade.score}/${grade.maxScore}`;

      // Notify Student
      notifyUser({
        schoolId,
        userId: studentId,
        senderId: effectiveTeacherId,
        title: `📊 Nouvelle note : ${courseName}`,
        message: `Note obtenue : ${scoreStr} (Trimestre ${grade.trimester})${grade.comment ? ' — ' + grade.comment : ''}`,
        type: 'GRADE',
        priority: 'HIGH',
        metadata: { gradeId: grade.id, courseId },
      }).catch((e) => console.error('[Grade] Student notification error:', e));

      // Notify Parent
      if (grade.student?.parentId) {
        notifyUser({
          schoolId,
          userId: grade.student.parentId,
          senderId: effectiveTeacherId,
          title: `📊 Note pour ${grade.student.fullName} (${courseName})`,
          message: `Note : ${scoreStr} (Trimestre ${grade.trimester})`,
          type: 'GRADE',
          priority: 'HIGH',
          metadata: { gradeId: grade.id, courseId },
        }).catch((e) => console.error('[Grade] Parent notification error:', e));
      }
    } catch (e) { console.error('[Grade] Notification setup error:', e); }

    const responseBody = { grade };
    if (operationId) {
      await db.syncOperation.create({
        data: {
          operationId,
          userId: auth.userId,
          schoolId,
          operationType: 'CREATE_GRADE',
          statusCode: 201,
          response: responseBody,
        },
      });
    }
    return NextResponse.json(responseBody, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Notification commune élève + parent après une note (qu'elle vienne de la
 * saisie rapide ou du cahier).
 */
async function notifyGrade(
  gradeId: string,
  schoolId: string,
  studentId: string,
  senderId: string,
  courseId: string,
  score: number,
  maxScore: number,
  courseName: string,
  comment?: string
) {
  const { notifyUser } = await import('@/services/notifications/notificationEngine');
  const student = await db.user.findUnique({
    where: { id: studentId },
    select: { fullName: true, parentId: true },
  });
  const scoreStr = `${score}/${maxScore}`;

  notifyUser({
    schoolId,
    userId: studentId,
    senderId,
    title: `📊 Nouvelle note : ${courseName}`,
    message: `Note obtenue : ${scoreStr}${comment ? ' — ' + comment : ''}`,
    type: 'GRADE',
    priority: 'HIGH',
    metadata: { gradeId, courseId },
  }).catch((e) => console.error('[Grade] Student notification error:', e));

  if (student?.parentId) {
    notifyUser({
      schoolId,
      userId: student.parentId,
      senderId,
      title: `📊 Note pour ${student.fullName} (${courseName})`,
      message: `Note : ${scoreStr}`,
      type: 'GRADE',
      priority: 'HIGH',
      metadata: { gradeId, courseId },
    }).catch((e) => console.error('[Grade] Parent notification error:', e));
  }
}
