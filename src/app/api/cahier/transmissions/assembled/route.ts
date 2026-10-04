import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const titulaireId = searchParams.get('titulaireId');
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const trimester = searchParams.get('trimester');

    if (!titulaireId || !schoolId) {
      return NextResponse.json({ error: 'titulaireId et schoolId requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur est bien titulaire de la classe
    const classInfo = classId
      ? await db.schoolClass.findFirst({
          where: { id: classId, titulaireId, schoolId },
          select: { id: true, name: true },
        })
      : null;

    // Récupérer les classes du titulaire
    const classes = await db.schoolClass.findMany({
      where: {
        schoolId,
        titulaireId,
        deletedAt: null,
        ...(classId ? { id: classId } : {}),
      },
      select: { id: true, name: true, level: true },
    });

    if (classes.length === 0) {
      return NextResponse.json({ students: [], courses: [] });
    }

    const classIds = classes.map(c => c.id);

    // Récupérer tous les élèves inscrits dans ces classes
    const enrollments = await db.enrolledClass.findMany({
      where: { classId: { in: classIds } },
      include: {
        user: {
          select: { id: true, fullName: true, postName: true, gender: true, cardId: true },
        },
        class: { select: { id: true, name: true } },
      },
    });

    const students = enrollments.map(e => ({
      id: e.user.id,
      fullName: e.user.fullName,
      postName: e.user.postName,
      gender: e.user.gender,
      cardId: e.user.cardId,
      classId: e.class.id,
      className: e.class.name,
    }));

    // Récupérer tous les cours de ces classes
    const courses = await db.course.findMany({
      where: { classId: { in: classIds }, deletedAt: null },
      select: { id: true, name: true, classId: true, teacherId: true },
    });

    // Récupérer toutes les transmissions REÇUES (SENT, RECEIVED, RESENT) pour ces classes
    const transmissionWhere: Record<string, unknown> = {
      classId: { in: classIds },
      status: { in: ['SENT', 'RECEIVED', 'RESENT'] },
    };
    if (trimester) {
      transmissionWhere.evaluation = { trimester };
    }

    const transmissions = await db.cotationTransmission.findMany({
      where: transmissionWhere,
      include: {
        evaluation: {
          include: {
            marks: {
              select: { studentId: true, score: true, evaluationId: true },
            },
          },
        },
        course: { select: { id: true, name: true, classId: true } },
        teacher: { select: { id: true, fullName: true } },
      },
    });

    // Organiser les notes par élève, par cours, par évaluation
    const studentNotes: Record<string, Record<string, Record<string, number>>> = {};
    const courseNames: Record<string, string> = {};

    for (const c of courses) {
      courseNames[c.id] = c.name;
    }

    for (const trans of transmissions) {
      if (trans.status === 'PENDING' || !trans.evaluation) continue;

      const courseId = trans.courseId;
      const evaluationId = trans.evaluationId;
      const evaluation = trans.evaluation;

      for (const mark of evaluation.marks) {
        if (!studentNotes[mark.studentId]) studentNotes[mark.studentId] = {};
        if (!studentNotes[mark.studentId][courseId]) studentNotes[mark.studentId][courseId] = {};
        // Prendre la meilleure note si plusieurs évaluations (on peut faire la moyenne plus tard)
        const existing = studentNotes[mark.studentId][courseId][evaluationId] ?? 0;
        studentNotes[mark.studentId][courseId][evaluationId] = Math.max(existing, mark.score);
      }
    }

    // Construire la réponse consolidée par élève
    const consolidated = students.map(student => {
      const notesByCourse: Record<string, { evaluations: Record<string, number>; average: number; count: number }> = {};

      const sNotes = studentNotes[student.id] || {};

      for (const course of courses) {
        const courseId = course.id;
        const evals = sNotes[courseId] || {};
        const scores = Object.values(evals);
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          notesByCourse[course.name] = {
            evaluations: evals,
            average: Math.round(avg * 10) / 10,
            count: scores.length,
          };
        }
      }

      return {
        ...student,
        notesByCourse,
      };
    });

    return NextResponse.json({
      students: consolidated,
      courses: courses.map(c => ({ id: c.id, name: c.name, classId: c.classId })),
      classes: classes,
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}