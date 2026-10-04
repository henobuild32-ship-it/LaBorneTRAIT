/**
 * POST /api/cahier/sync-to-report
 * ─────────────────────────────────────────────────────────────────────────────
 * Synchronizes Cahier de Cotation marks into the ReportCard system.
 *
 * For each student enrolled in a given class, it fetches all CahierEvaluation
 * marks for the trimester, computes the coefficient-weighted average normalized
 * to /20, and upserts the corresponding ReportCard.
 *
 * Body: { schoolId, classId, trimester }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { getCurrentAcademicYear } from '@/lib/grade-sync';
import { resolveClassCoefficients } from '@/lib/coefficient-resolver';

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { classId, trimester } = body;
    const schoolId = auth.schoolId;

    if (!schoolId || !classId || !trimester) {
      return NextResponse.json(
        { error: 'schoolId, classId, and trimester are required' },
        { status: 400 }
      );
    }
    if (auth.role !== 'ADMIN' && auth.role !== 'TEACHER') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    if (auth.role === 'TEACHER') {
      const assigned = await db.course.findFirst({ where: { schoolId, classId, teacherId: auth.userId } });
      if (!assigned) return NextResponse.json({ error: 'Vous n’êtes pas affecté à cette classe.' }, { status: 403 });
    }

    // 1. Fetch all students enrolled in the class
    const enrollments = await db.enrolledClass.findMany({
      where: { classId },
      select: { userId: true },
    });
    const studentIds = enrollments.map((e) => e.userId);

    if (studentIds.length === 0) {
      return NextResponse.json({ message: 'No students enrolled in this class', synced: 0 });
    }

    // 2. Fetch all cahier evaluations for this class + trimester with their marks
    const evaluations = await db.cahierEvaluation.findMany({
      where: { classId, trimester },
      include: { marks: true, course: true },
    });

    if (evaluations.length === 0) {
      return NextResponse.json({ message: 'No cahier evaluations found for this class/trimester', synced: 0 });
    }

    // 3. Group evaluations by courseId, then by student
    //    For each course, compute the student's coefficient-weighted normalized average.
    const courseCoeffMap: Record<string, number> = {};
    const studentCourseData: Record<string, Record<string, { scoreSum: number; maxSum: number; coeff: number }>> = {};

    // Résolution des coefficients effectifs via la table Coefficient (priorité),
    // fallback sur le coefficient de l'évaluation / du cours.
    const { byCourse: effectiveCoefficients } = await resolveClassCoefficients(
      schoolId,
      classId,
      evaluations.flatMap((e) => (e.course ? [{ id: e.courseId, coefficient: e.course.coefficient ?? 1 }] : []))
    );

    for (const evaluation of evaluations) {
      const { courseId, coefficient, maxScore } = evaluation;
      const coeff = effectiveCoefficients[courseId] ?? coefficient ?? 1;
      const evalMax = maxScore > 0 ? maxScore : 20;

      // Track the coefficient for each course (use latest evaluation's coeff)
      courseCoeffMap[courseId] = coeff;

      for (const mark of evaluation.marks) {
        const { studentId, score } = mark;
        if (!studentCourseData[studentId]) {
          studentCourseData[studentId] = {};
        }
        if (!studentCourseData[studentId][courseId]) {
          studentCourseData[studentId][courseId] = { scoreSum: 0, maxSum: 0, coeff };
        }
        const entry = studentCourseData[studentId][courseId];
        entry.scoreSum += score;
        entry.maxSum += evalMax;
        entry.coeff = coeff;
      }
    }

    // 4. Fetch student info for all enrolled students
    const students = await db.user.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        fullName: true,
        gender: true,
        birthDate: true,
        cardId: true,
      },
    });

    const studentMap: Record<string, typeof students[number]> = {};
    for (const s of students) {
      studentMap[s.id] = s;
    }

    // 5. For each student, compute overall average and upsert ReportCard
    let syncedCount = 0;

    for (const studentId of studentIds) {
      const courseData = studentCourseData[studentId];
      if (!courseData || Object.keys(courseData).length === 0) continue;

      const student = studentMap[studentId];
      if (!student) continue;

      // Compute weighted average across all courses
      let weightedSum = 0;
      let totalCoefficients = 0;
      let totalPointsObtained = 0;
      let totalPointsPossible = 0;

      const serializedGrades: Array<{
        courseId: string;
        courseName: string;
        coefficient: number;
        score: number;
        maxScore: number;
        normalizedScore: number;
        weightedScore: number;
      }> = [];

      for (const [courseId, data] of Object.entries(courseData)) {
        const normalizedScore = data.maxSum > 0 ? (data.scoreSum / data.maxSum) * 20 : 0;
        const weightedScore = normalizedScore * data.coeff;

        weightedSum += weightedScore;
        totalCoefficients += data.coeff;
        totalPointsObtained += data.scoreSum;
        totalPointsPossible += data.maxSum || 20;

        // Resolve course name
        const evaluation = evaluations.find((e) => e.courseId === courseId);
        const courseName = evaluation?.course?.name ?? 'Inconnu';

        serializedGrades.push({
          courseId,
          courseName,
          coefficient: data.coeff,
          score: data.scoreSum,
          maxScore: data.maxSum || 20,
          normalizedScore: Math.round(normalizedScore * 100) / 100,
          weightedScore: Math.round(weightedScore * 100) / 100,
        });
      }

      const averageGrade =
        totalCoefficients > 0
          ? Math.round((weightedSum / totalCoefficients) * 100) / 100
          : 0;

      const overallPercentage =
        totalPointsPossible > 0
          ? Math.round((totalPointsObtained / totalPointsPossible) * 10000) / 100
          : 0;

      const mention = getMention(averageGrade);

      const gradesData = {
        autoSynced: true,
        source: 'cahier',
        lastSyncedAt: new Date().toISOString(),
        serializedGrades,
        metadata: {
          academicYear: getCurrentAcademicYear(),
          trimester,
          totalPointsObtained,
          totalPointsPossible,
          overallPercentage,
        },
      };

      // Find existing ReportCard (auto_draft or draft)
      const existing = await db.reportCard.findFirst({
        where: {
          schoolId,
          studentId,
          trimester,
          status: { in: ['auto_draft', 'draft'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        await db.reportCard.update({
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
        const reportNumber = `CAHIER-${schoolId.slice(0, 4).toUpperCase()}-${studentId.slice(0, 4).toUpperCase()}-T${trimester}-${Date.now()}`;

        await db.reportCard.create({
          data: {
            reportNumber,
            schoolId,
            classId,
            studentId,
            trimester,
            academicYear: getCurrentAcademicYear(),
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

      syncedCount++;
    }

    return NextResponse.json({
      message: `Synchronisation terminée : ${syncedCount} bulletins mis à jour depuis le cahier de cotation.`,
      synced: syncedCount,
      total: studentIds.length,
      evaluationsUsed: evaluations.length,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function getMention(avg: number): string {
  if (avg >= 16) return 'Félicitations';
  if (avg >= 14) return "Tableau d'honneur";
  if (avg >= 12) return 'Encouragements';
  if (avg >= 10) return 'Passable';
  return 'Insuffisant';
}
