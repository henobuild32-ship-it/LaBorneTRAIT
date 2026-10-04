/**
 * grade-sync.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Synchronisation des notes et génération du bulletin conforme aux normes RDC :
 * - Intègre rdc-grading-engine.ts
 * - Charge les règles de cotation (SubjectRule) par classe/matière
 * - Charge les critères de délibération/passage (GradingDecisionRule)
 * - Calcule les totaux réels (pondération intrinsèque par maximums)
 * - Calcule les rangs avec ex-aequo au niveau de la classe
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from '@/lib/db';
import { resolveClassCoefficients } from '@/lib/coefficient-resolver';
import {
  detectCycle,
  computeStudentBulletin,
  computeClassCompetitionRankings,
  StudentCourseEvaluationMarks,
  SubjectRuleInput,
} from '@/lib/rdc-grading-engine';

export interface SyncResult {
  reportCardId: string;
  studentId: string;
  trimester: string;
  averageGrade: number;
  totalPointsObtained: number;
  totalPointsPossible: number;
  overallPercentage: number;
  courseCount: number;
}

/**
 * Recomputes and upserts the ReportCard for a given student + trimester.
 * Safe to call from both POST /api/grades and PUT /api/grades/[id].
 */
export async function syncStudentReport(
  schoolId: string,
  studentId: string,
  trimester: string
): Promise<SyncResult | null> {
  try {
    const currentAcademicYear = getCurrentAcademicYear();

    // ── 1. Fetch all grades for this student in this trimester/semester ──────────
    const grades = await db.grade.findMany({
      where: {
        schoolId,
        studentId,
        trimester: {
          in: trimester === '1'
            ? ['1', 'P1', 'P2', 'EX1']
            : trimester === '2'
            ? ['2', 'P3', 'P4', 'EX2']
            : [trimester]
        }
      },
      include: {
        course: {
          select: { id: true, name: true, maxScore: true, coefficient: true, classId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (grades.length === 0) return null;

    // ── 2. Find the student's class ─────────────────────────────────────────
    const classId = grades[0]?.course?.classId;
    if (!classId) return null;

    const classInfo = await db.schoolClass.findUnique({
      where: { id: classId },
      select: { id: true, name: true, level: true, cycle: true, section: true },
    });

    const cycle = detectCycle(classInfo);

    // ── 2b. Charger les règles de cotation configurées pour la classe ───────
    const subjectRulesDb = await db.subjectRule.findMany({
      where: { schoolId, classId, isActive: true },
    });

    const rulesByCourseId: Record<string, SubjectRuleInput> = {};
    for (const sr of subjectRulesDb) {
      rulesByCourseId[sr.courseId] = {
        courseId: sr.courseId,
        courseName: '',
        maximumPoints: sr.maximumPoints,
        dailyWorkMaximum: sr.dailyWorkMaximum,
        examMaximum: sr.examMaximum,
        coefficient: sr.coefficient,
        isQualitative: sr.isQualitative,
      };
    }

    // Coefficients effectifs en fallback
    const { byCourse: effectiveCoefficients } = await resolveClassCoefficients(
      schoolId,
      classId,
      grades.map((g) => g.course)
    );

    // ── 2c. Charger la règle de délibération configurée ────────────────────
    const decisionRule = await db.gradingDecisionRule.findFirst({
      where: {
        schoolId,
        OR: [
          { classId },
          { cycle },
          { cycle: 'ALL' },
        ],
        isActive: true,
      },
      orderBy: [{ classId: 'desc' }, { cycle: 'desc' }],
    });

    // ── 3. Fetch student info ───────────────────────────────────────────────
    const student = await db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        fullName: true,
        gender: true,
        birthDate: true,
        cardId: true,
        schoolId: true,
      },
    });
    if (!student) return null;

    // ── 4. Fetch school info ────────────────────────────────────────────────
    const school = await db.school.findUnique({
      where: { id: schoolId },
      select: { name: true, province: true, city: true, commune: true, schoolCode: true },
    });

    // Group grades by course to support period-based calculations
    const courseGradesMap: Record<string, StudentCourseEvaluationMarks> = {};

    for (const g of grades) {
      if (!courseGradesMap[g.courseId]) {
        courseGradesMap[g.courseId] = {
          courseId: g.courseId,
          courseName: g.course.name,
          otherScores: [],
        };
      }
      const item = courseGradesMap[g.courseId];
      if (g.trimester === 'P1') item.tj1 = g.score;
      else if (g.trimester === 'P2') item.tj2 = g.score;
      else if (g.trimester === 'EX1') item.exam1 = g.score;
      else if (g.trimester === 'P3') item.tj3 = g.score;
      else if (g.trimester === 'P4') item.tj4 = g.score;
      else if (g.trimester === 'EX2') item.exam2 = g.score;
      else item.otherScores?.push(g.score);
    }

    // Assurer les règles de fallback pour chaque cours
    Object.keys(courseGradesMap).forEach((cId) => {
      if (!rulesByCourseId[cId]) {
        const matchingCourse = grades.find((g) => g.courseId === cId)?.course;
        const coeff = effectiveCoefficients[cId] ?? matchingCourse?.coefficient ?? 1;
        const maxScore = matchingCourse?.maxScore || 20;
        rulesByCourseId[cId] = {
          courseId: cId,
          courseName: matchingCourse?.name || 'Matière',
          maximumPoints: maxScore > 20 ? maxScore : 100,
          dailyWorkMaximum: Math.round((maxScore > 20 ? maxScore : 100) * 0.4),
          examMaximum: Math.round((maxScore > 20 ? maxScore : 100) * 0.6),
          coefficient: coeff,
        };
      }
    });

    // ── 5. Calculer le bulletin via le moteur universel RDC ──────────────────
    const computedReport = computeStudentBulletin({
      studentId,
      studentName: student.fullName,
      cycle,
      trimesterOrSemester: trimester,
      evaluations: Object.values(courseGradesMap),
      rulesByCourseId,
      decisionConfig: decisionRule,
    });

    const totalPointsObtained = computedReport.totalPointsObtained;
    const totalPointsPossible = computedReport.totalPointsPossible;
    const overallPercentage = computedReport.overallPercentage;
    const averageGrade = Math.round((overallPercentage / 5) * 100) / 100; // Équivalent /20 informatif
    const mention = computedReport.mention;
    const decisionText = computedReport.decisionLabel;

    // ── 6. Préparer les données sérialisées et les lignes de bulletin ───────
    const serializedGrades = computedReport.subjects.map((sub) => ({
      courseId: sub.courseId,
      courseName: sub.courseName,
      coefficient: sub.coefficient,
      score: trimester === '1' ? sub.totalS1 : sub.totalS2,
      maxScore: trimester === '1' ? sub.maxS1 : sub.maxS2,
      percentage: trimester === '1' ? sub.percentageS1 : sub.percentageS2,
      normalizedScore: Math.round(((trimester === '1' ? sub.percentageS1 : sub.percentageS2) / 5) * 100) / 100,
      weightedScore: sub.percentageAnnual,
      totalAnnual: sub.totalAnnual,
      maxAnnual: sub.maxAnnual,
      isPassed: sub.isPassed,
      comment: '',
      updatedAt: new Date(),
    }));

    const rawRows = computedReport.subjects.map((sub) => ({
      id: sub.courseId,
      name: sub.courseName,
      maxTJ1: sub.maxTJ1,
      maxTJ2: sub.maxTJ2,
      maxExam1: sub.maxExam1,
      maxTJ3: sub.maxTJ3,
      maxTJ4: sub.maxTJ4,
      maxExam2: sub.maxExam2,
      tj1: sub.tj1 !== null ? String(sub.tj1) : '',
      tj2: sub.tj2 !== null ? String(sub.tj2) : '',
      exam1: sub.exam1 !== null ? String(sub.exam1) : '',
      tj3: sub.tj3 !== null ? String(sub.tj3) : '',
      tj4: sub.tj4 !== null ? String(sub.tj4) : '',
      exam2: sub.exam2 !== null ? String(sub.exam2) : '',
      totalS1: sub.totalS1,
      maxS1: sub.maxS1,
      totalS2: sub.totalS2,
      maxS2: sub.maxS2,
      totalAnnual: sub.totalAnnual,
      maxAnnual: sub.maxAnnual,
      percentageAnnual: sub.percentageAnnual,
      repechagePercent: '',
      repechageSign: '',
    }));

    // ── 7. Build full gradesData payload ────────────────────────────────────
    const gradesData = {
      autoSynced: true,
      lastSyncedAt: new Date().toISOString(),
      cycle,
      serializedGrades,
      rawRows,
      metadata: {
        schoolName: school?.name ?? '',
        province: school?.province ?? 'KINSHASA',
        city: school?.city ?? 'KINSHASA',
        commune: school?.commune ?? 'GOMBE',
        schoolCode: school?.schoolCode ?? '00000000',
        studentName: student.fullName ?? '',
        studentGender: student.gender ?? 'M',
        studentBirthDate: student.birthDate ?? '',
        permanentNumber: student.cardId ?? '',
        studentClass: classInfo?.name ?? '',
        academicYear: currentAcademicYear,
        trimesterText:
          trimester === '1' ? '1er TRIMESTRE / SEMESTRE 1'
          : trimester === '2' ? '2e TRIMESTRE / SEMESTRE 2'
          : '3e TRIMESTRE / BILAN ANNUEL',
        totalPointsObtained,
        totalPointsPossible,
        overallPercentage,
        placeInClass: '',
        effectif: '',
        conduite: 'A',
        application: 'A',
        decisionText,
        decisionCode: computedReport.decision,
      },
    };

    // ── 8. Upsert the ReportCard ────────────────────────────────────────────
    const existing = await db.reportCard.findFirst({
      where: {
        schoolId,
        studentId,
        trimester,
        status: { in: ['auto_draft', 'draft'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    let reportCard;

    if (existing) {
      reportCard = await db.reportCard.update({
        where: { id: existing.id },
        data: {
          classId,
          averageGrade,
          totalPointsObtained,
          totalPointsPossible,
          overallPercentage,
          mention,
          gradesData,
          studentName: student.fullName ?? '',
          studentGender: student.gender ?? 'M',
          studentBirthDate: student.birthDate ?? '',
          status: 'auto_draft',
        },
      });
    } else {
      const reportNumber = `AUTO-${schoolId.slice(0, 4).toUpperCase()}-${studentId.slice(0, 4).toUpperCase()}-T${trimester}-${Date.now()}`;

      reportCard = await db.reportCard.create({
        data: {
          reportNumber,
          schoolId,
          classId,
          studentId,
          trimester,
          academicYear: currentAcademicYear,
          studentName: student.fullName ?? '',
          studentGender: student.gender ?? 'M',
          studentBirthDate: student.birthDate ?? '',
          permanentNumber: student.cardId ?? '',
          totalPointsObtained,
          totalPointsPossible,
          overallPercentage,
          averageGrade,
          classRank: 0,
          mention,
          status: 'auto_draft',
          gradesData,
        },
      });
    }

    // ── 9. Recalculer le classement de la classe avec ex-aequo ──────────────
    recalculateClassCompetitionRanks(schoolId, classId, trimester).catch((e) =>
      console.error('[grade-sync] recalculateClassCompetitionRanks error:', e)
    );

    return {
      reportCardId: reportCard.id,
      studentId,
      trimester,
      averageGrade,
      totalPointsObtained,
      totalPointsPossible,
      overallPercentage,
      courseCount: grades.length,
    };
  } catch (err) {
    console.error('[grade-sync] syncStudentReport error:', err);
    return null;
  }
}

/**
 * Recalcule les rangs officiels avec ex-aequo pour toute la classe
 */
export async function recalculateClassCompetitionRanks(
  schoolId: string,
  classId: string,
  trimester: string
) {
  try {
    const reports = await db.reportCard.findMany({
      where: {
        schoolId,
        classId,
        trimester,
      },
      orderBy: { overallPercentage: 'desc' },
    });

    if (reports.length === 0) return;

    const totalStudents = reports.length;
    let currentRank = 1;

    for (let i = 0; i < reports.length; i++) {
      const current = reports[i];
      let rank = currentRank;

      if (i > 0 && current.overallPercentage === reports[i - 1].overallPercentage) {
        rank = reports[i - 1].classRank || 1;
      } else {
        rank = i + 1;
        currentRank = rank;
      }

      const suffix = rank === 1 ? 'er' : 'e';
      const isExAequo = i > 0 && current.overallPercentage === reports[i - 1].overallPercentage;
      const rankDisplay = `${rank}${suffix}${isExAequo ? ' ex-aequo' : ''} / ${totalStudents}`;

      const gd = (current.gradesData as Record<string, any>) || {};
      const metadata = gd.metadata || {};
      metadata.placeInClass = rankDisplay;
      metadata.effectif = String(totalStudents);

      await db.reportCard.update({
        where: { id: current.id },
        data: {
          classRank: rank,
          gradesData: { ...gd, metadata },
        },
      });
    }
  } catch (e) {
    console.error('[recalculateClassCompetitionRanks] Error:', e);
  }
}

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

