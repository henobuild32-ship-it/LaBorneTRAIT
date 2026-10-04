import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { syncStudentReport } from '@/lib/grade-sync';
import { assertYearOpen } from '@/lib/year-status';
import { assertGradePeriodOpen } from '@/lib/academic-closures';
import {
  QUICK_EVALUATION_TITLE,
  ensureQuickEvaluation,
  isPeriodKey,
  periodToTrimester,
  recomputeStudentPeriodGrade,
  upsertCahierMark,
} from '@/lib/grade-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    const { id } = await params;

    const grade = await db.grade.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, name: true },
        },
        student: {
          select: { id: true, fullName: true, role: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!grade || grade.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }
    if (auth.role === 'STUDENT' && grade.studentId !== auth.userId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    if (auth.role === 'PARENT') {
      const student = await db.user.findFirst({ where: { id: grade.studentId, parentId: auth.userId, schoolId: auth.schoolId }, select: { id: true } });
      if (!student) return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ grade });
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
    const auth = authenticateRequest(request);
    if (auth.role === 'PARENT' || auth.role === 'STUDENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json();
    const { score, maxScore, trimester, comment, evaluationDate, reason, approvedModificationId, quickSave } = body;
    const modifiedBy = (auth as { fullName?: string; userId: string }).fullName || auth.userId;

    const existing = await db.grade.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }

    if (auth.role === 'TEACHER' && existing.teacherId !== auth.userId) {
      return NextResponse.json({ error: "Vous n'êtes pas le professeur de ce cours" }, { status: 403 });
    }
    try {
      await assertYearOpen(existing.schoolId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    try {
      await assertGradePeriodOpen({
        schoolId: existing.schoolId,
        schoolYearId: existing.schoolYearId || undefined,
        date: evaluationDate ? new Date(evaluationDate) : existing.evaluationDate,
        trimester: trimester !== undefined ? trimester : existing.trimester,
      });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

    const newScore = score !== undefined ? parseFloat(score) : existing.score;
    const newMax = maxScore !== undefined ? parseFloat(maxScore) : existing.maxScore;
    if (isNaN(newScore) || newScore < 0 || newScore > newMax) {
      return NextResponse.json(
        { error: `La note doit être comprise entre 0 et ${newMax}` },
        { status: 400 }
      );
    }
    if (auth.role === 'TEACHER' && !quickSave) {
      if (!approvedModificationId) {
        return NextResponse.json({ error: 'Soumettez une demande de modification et attendez son approbation avant de changer une note.' }, { status: 403 });
      }
      const request = await db.noteModification.findUnique({ where: { id: approvedModificationId } });
      if (
        !request
        || request.noteId !== existing.id
        || request.modifierId !== auth.userId
        || request.requestStatus !== 'APPROVED'
        || request.newValue !== newScore
        || request.newMax !== newMax
      ) {
        return NextResponse.json({ error: 'Cette correction n’est pas approuvée ou ne correspond pas à la demande validée.' }, { status: 403 });
      }
    }

    // ── Note de période (P1..EX2) : modifier la note dans le cahier (source unique) ──
    if (isPeriodKey(existing.trimester)) {
      const course = await db.course.findUnique({
        where: { id: existing.courseId },
        select: { classId: true, teacherId: true, name: true },
      });
      const teacherId = course?.teacherId ?? existing.teacherId;
      const courseId = existing.courseId;
      const studentId = existing.studentId;
      const period = existing.trimester;

      if (course?.classId) {
        const evaluation = await ensureQuickEvaluation({
          schoolId: existing.schoolId,
          classId: course.classId,
          courseId,
          teacherId,
          period,
        });
        await upsertCahierMark({ evaluationId: evaluation.id, studentId, score: newScore });
        await recomputeStudentPeriodGrade({
          schoolId: existing.schoolId,
          courseId,
          studentId,
          period,
          teacherId,
          comment: comment ?? undefined,
        });
      } else {
        await db.grade.update({
          where: { id },
          data: { score: newScore, maxScore: newMax },
        });
      }

      // Audit history if score actually changed
      if (score !== undefined && parseFloat(score) !== existing.score && modifiedBy) {
        await db.gradeHistory.create({
          data: {
            gradeId: id,
            schoolId: existing.schoolId,
            oldScore: existing.score,
            newScore: parseFloat(score),
            modifiedBy,
            reason: reason || '',
          },
        });
      }

      const grade = await db.grade.findUnique({
        where: { id },
        include: {
          course: { select: { id: true, name: true } },
          student: { select: { id: true, fullName: true, role: true } },
          teacher: { select: { id: true, fullName: true, role: true } },
        },
      });
      if (auth.role === 'TEACHER' && approvedModificationId) {
        await db.noteModification.update({
          where: { id: approvedModificationId },
          data: { requestStatus: 'APPLIED' },
        });
      }
      return NextResponse.json({ grade, fromCahier: true });
    }

    const updatedTrimester = trimester !== undefined ? trimester : existing.trimester;

    const grade = await db.grade.update({
      where: { id },
      data: {
        ...(score !== undefined && { score: parseFloat(score) }),
        ...(maxScore !== undefined && { maxScore: parseFloat(maxScore) }),
        ...(trimester !== undefined && { trimester }),
        ...(comment !== undefined && { comment }),
        ...(evaluationDate !== undefined && { evaluationDate: new Date(evaluationDate) }),
      },
      include: {
        course: {
          select: { id: true, name: true },
        },
        student: {
          select: { id: true, fullName: true, role: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    // Create audit history entry if score actually changed
    if (score !== undefined && parseFloat(score) !== existing.score && modifiedBy) {
      await db.gradeHistory.create({
        data: {
          gradeId: id,
          schoolId: existing.schoolId,
          oldScore: existing.score,
          newScore: parseFloat(score),
          modifiedBy,
          reason: reason || '',
        },
      });
    }

    // ── Auto-sync: recompute and update the student's report card ───────────
    syncStudentReport(existing.schoolId, existing.studentId, updatedTrimester).catch(() => {});
    if (auth.role === 'TEACHER' && approvedModificationId) {
      await db.noteModification.update({
        where: { id: approvedModificationId },
        data: { requestStatus: 'APPLIED' },
      });
    }

    return NextResponse.json({ grade });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    if (!['TEACHER', 'ADMIN'].includes(auth.role)) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json() as { status?: string };
    if (!body.status || !['SUBMITTED', 'VALIDATED'].includes(body.status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }
    const grade = await db.grade.findUnique({ where: { id } });
    if (!grade || grade.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Note introuvable' }, { status: 404 });
    }
    if (auth.role === 'TEACHER' && grade.teacherId !== auth.userId) {
      return NextResponse.json({ error: 'Vous n’êtes pas le professeur de cette note' }, { status: 403 });
    }
    if (body.status === 'VALIDATED' && auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut valider une note' }, { status: 403 });
    }
    const updated = await db.grade.update({
      where: { id },
      data: {
        status: body.status,
        ...(body.status === 'VALIDATED' ? { validatedAt: new Date(), validatedById: auth.userId } : { validatedAt: null, validatedById: null }),
      },
    });
    return NextResponse.json({ grade: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role === 'PARENT' || auth.role === 'STUDENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }
    if (auth.role === 'TEACHER') {
      return NextResponse.json({ error: 'Un professeur ne peut pas supprimer directement une note. Contactez un administrateur.' }, { status: 403 });
    }
    const { id } = await params;

    const existing = await db.grade.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Grade not found' }, { status: 404 });
    }
    try {
      await assertGradePeriodOpen({ schoolId: existing.schoolId, schoolYearId: existing.schoolYearId || undefined, date: existing.evaluationDate, trimester: existing.trimester });
    } catch (error: unknown) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Période clôturée' }, { status: 423 });
    }

    if (auth.role === 'TEACHER' && existing.teacherId !== auth.userId) {
      return NextResponse.json({ error: "Vous n'êtes pas le professeur de ce cours" }, { status: 403 });
    }

    // ── Note de période (P1..EX2) : retirer la cotation du cahier (source unique) ──
    if (isPeriodKey(existing.trimester)) {
      const course = await db.course.findUnique({
        where: { id: existing.courseId },
        select: { classId: true, teacherId: true },
      });
      const teacherId = course?.teacherId ?? existing.teacherId;
      const courseId = existing.courseId;
      const studentId = existing.studentId;
      const period = existing.trimester;

      if (course?.classId) {
        // Supprime la cotation de la colonne "Saisie rapide" de l'élève.
        await db.cahierMark.deleteMany({
          where: {
            studentId,
            evaluation: {
              courseId,
              trimester: period,
              title: QUICK_EVALUATION_TITLE,
              deletedAt: null,
            },
          },
        });
        // Recalcul : si aucune cotation ne subsiste pour la période, la Grade
        // disparaît ; sinon elle est réévaluée à partir des cotations restantes.
        await recomputeStudentPeriodGrade({
          schoolId: existing.schoolId,
          courseId,
          studentId,
          period,
          teacherId,
        });
      }

      syncStudentReport(existing.schoolId, existing.studentId, periodToTrimester(period)).catch(() => {});
      return NextResponse.json({ message: 'Grade deleted successfully', fromCahier: true });
    }

    await db.grade.delete({ where: { id } });

    // ── Auto-sync after deletion: recompute bulletin without the deleted grade
    syncStudentReport(existing.schoolId, existing.studentId, existing.trimester).catch(() => {});

    return NextResponse.json({ message: 'Grade deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
