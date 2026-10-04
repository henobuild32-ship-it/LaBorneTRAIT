/**
 * grade-service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Source unique de vérité pour les notes (RDC):
 *   Évaluation (CahierEvaluation) → Note de l'élève (CahierMark)
 *   → Calcul automatique → Grade (par période: P1..EX2) → Bulletin (ReportCard).
 *
 * Le module "Notes" (teacher-grades) et le "Cahier de Cotation" alimentent tous
 * les deux cette même chaîne. Une note saisie en saisie rapide devient une
 * colonne d'évaluation "Saisie rapide" dans le cahier, puis le même calcul
 * périodique produit la ligne `Grade`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from '@/lib/db';
import { syncStudentReport } from '@/lib/grade-sync';
export { isSecondaryClass } from '@/lib/grade-cycle';

/** Périodes RDC du secondaire (EB/Humanités). */
export const PERIODS_SECONDARY = ['P1', 'P2', 'EX1', 'P3', 'P4', 'EX2'] as const;

/** Titre de la colonne auto-créée par la saisie rapide du module Notes. */
export const QUICK_EVALUATION_TITLE = 'Saisie rapide';

/** Permet de savoir si une clé de note est une période RDC (P1..EX2). */
export function isPeriodKey(value: string | undefined | null): boolean {
  return !!value && (PERIODS_SECONDARY as readonly string[]).includes(value);
}

/**
 * Quel cycle RDC pour une classe ?
 *  - EB / Humanités (secondaire) → périodes P1..EX2.
 *  - Maternelle / Primaire      → trimestres T1..T3 (notes directes).
 */
/** Convertit une période du cahier (P1, EX1...) en trimestre académique (1, 2). */
export function periodToTrimester(period: string): string {
  if (period === 'P1' || period === 'P2' || period === 'EX1') return '1';
  if (period === 'P3' || period === 'P4' || period === 'EX2') return '2';
  return period;
}

/**
 * Trouve (ou crée) la colonne d'évaluation du cahier correspondant à une
 * saisie depuis le module Notes. Sans métadonnée, la colonne "Saisie rapide"
 * historique est conservée pour la grille rapide.
 */
export async function ensureQuickEvaluation(params: {
  schoolId: string;
  classId: string;
  courseId: string;
  teacherId: string;
  period: string;
  title?: string;
  maxScore?: number;
  date?: Date;
}) {
  const { schoolId, classId, courseId, teacherId, period } = params;
  const title = params.title?.trim() || QUICK_EVALUATION_TITLE;
  const maxScore = params.maxScore && params.maxScore > 0 ? params.maxScore : 20;

  const existing = await db.cahierEvaluation.findFirst({
    where: {
      schoolId,
      classId,
      courseId,
      teacherId,
      trimester: period,
      title,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) return existing;

  return db.cahierEvaluation.create({
    data: {
      schoolId,
      classId,
      courseId,
      teacherId,
      title,
      maxScore,
      trimester: period,
      date: params.date ?? new Date(),
    },
  });
}

/** Upsert de la note d'un élève sur une colonne du cahier. */
export async function upsertCahierMark(params: {
  evaluationId: string;
  studentId: string;
  score: number;
}) {
  const { evaluationId, studentId, score } = params;
  return db.cahierMark.upsert({
    where: { evaluationId_studentId: { evaluationId, studentId } },
    update: { score },
    create: { evaluationId, studentId, score },
  });
}

/**
 * Recalcule la note périodique d'un élève (moyenne normalisée des cotations
 * de la période) et la dépose dans `Grade` (trimester = période). Si aucune
 * cotation ne subsiste pour la période, la ligne `Grade` est supprimée.
 */
export async function recomputeStudentPeriodGrade(params: {
  schoolId: string;
  courseId: string;
  studentId: string;
  period: string;
  teacherId?: string;
  comment?: string;
}) {
  const { schoolId, courseId, studentId, period, comment } = params;

  const studentMarks = await db.cahierMark.findMany({
    where: {
      studentId,
      evaluation: { courseId, trimester: period },
    },
    include: { evaluation: true },
  });

  if (studentMarks.length === 0) {
    // Plus aucune cotation pour cette période : retirer la note héritée.
    await db.grade.deleteMany({
      where: { schoolId, courseId, studentId, trimester: period },
    });
    return;
  }

  // Récupérer le cours et la règle de cotation pour déterminer le maximum exact
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { teacherId: true, classId: true, maxScore: true },
  });
  const teacherId = params.teacherId ?? course?.teacherId ?? '';

  let periodMaxScore = 20;
  if (course) {
    const subjectRule = await db.subjectRule.findFirst({
      where: { schoolId, classId: course.classId, courseId, isActive: true },
    });

    if (period === 'EX1' || period === 'EX2') {
      periodMaxScore = subjectRule?.examMaximum ?? course.maxScore ?? 60;
    } else if (period === 'P1' || period === 'P2' || period === 'P3' || period === 'P4') {
      periodMaxScore = subjectRule?.dailyWorkMaximum ? Math.round(subjectRule.dailyWorkMaximum / 2) : 20;
    } else {
      periodMaxScore = subjectRule?.maximumPoints ?? course.maxScore ?? 20;
    }
  }

  let totalNormalizedScore = 0;
  for (const m of studentMarks) {
    const max = m.evaluation.maxScore > 0 ? m.evaluation.maxScore : periodMaxScore;
    totalNormalizedScore += (m.score / max) * periodMaxScore;
  }
  const averagePeriodScore = Math.round((totalNormalizedScore / studentMarks.length) * 10) / 10;

  const existingGrade = await db.grade.findFirst({
    where: { schoolId, courseId, studentId, trimester: period },
  });

  if (existingGrade) {
    await db.grade.update({
      where: { id: existingGrade.id },
      data: {
        score: averagePeriodScore,
        maxScore: periodMaxScore,
        teacherId,
        evaluationDate: studentMarks.reduce((latest, mark) => mark.evaluation.date > latest ? mark.evaluation.date : latest, studentMarks[0].evaluation.date),
        ...(comment !== undefined && { comment }),
      },
    });
  } else {
    await db.grade.create({
      data: {
        schoolId,
        courseId,
        studentId,
        teacherId,
        score: averagePeriodScore,
        maxScore: periodMaxScore,
        trimester: period,
        evaluationDate: studentMarks.reduce((latest, mark) => mark.evaluation.date > latest ? mark.evaluation.date : latest, studentMarks[0].evaluation.date),
        comment: comment ?? `Moyenne automatique - ${period}`,
      },
    });
  }

  // Le bulletin (ReportCard) est recalculé pour le trimestre correspondant.
  syncStudentReport(schoolId, studentId, periodToTrimester(period)).catch((e) =>
    console.error('[grade-service] syncStudentReport error:', e)
  );
}

/**
 * Recalcule les notes périodiques de tous les élèves d'une évaluation et
 * synchronise les bulletins. Utilisé par le cahier (PUT / PATCH / DELETE) et
 * par la saisie rapide.
 */
export async function recomputeEvaluationGrades(evaluation: {
  id: string;
  schoolId: string;
  courseId: string;
  classId?: string;
  trimester: string;
}) {
  const { schoolId, courseId, trimester, classId } = evaluation;

  const studentMarks = await db.cahierMark.findMany({
    where: { evaluation: { courseId, trimester } },
    select: { studentId: true },
  });

  // Tous les élèves ayant au moins une cotation dans la période (toutes
  // évaluations confondues), plus ceux ayant une note héritée à nettoyer.
  const markedIds: Record<string, boolean> = {};
  for (const m of studentMarks) markedIds[m.studentId] = true;

  const periodGrades = await db.grade.findMany({
    where: { schoolId, courseId, trimester },
    select: { studentId: true },
  });
  for (const g of periodGrades) markedIds[g.studentId] = true;

  const classIdResolved = classId ?? (await db.course.findUnique({
    where: { id: courseId },
    select: { classId: true },
  }))?.classId;

  // On vise aussi les élèves inscrits sans cotation : une période sans aucune
  // cotation ne garde pas de note héritée.
  const enrollments = classIdResolved
    ? await db.enrolledClass.findMany({ where: { classId: classIdResolved }, select: { userId: true } })
    : [];
  for (const e of enrollments) markedIds[e.userId] = true;

  for (const studentId of Object.keys(markedIds)) {
    await recomputeStudentPeriodGrade({ schoolId, courseId, studentId, period: trimester });
  }
}