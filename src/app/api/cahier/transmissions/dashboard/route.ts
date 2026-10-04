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

    // Récupérer les classes dont l'utilisateur est titulaire
    const classes = await db.schoolClass.findMany({
      where: {
        schoolId,
        titulaireId,
        deletedAt: null,
      },
      select: { id: true, name: true, level: true },
    });

    if (classes.length === 0) {
      return NextResponse.json({ classes: [], summary: {} });
    }

    const classIds = classes.map(c => c.id);
    const whereClass = classId ? { id: classId } : { id: { in: classIds } };

    // Pour chaque classe, récupérer les cours et leur statut de transmission
    const classProgress = await Promise.all(
      classIds.map(async (cid) => {
        const classInfo = classes.find(c => c.id === cid)!;

        // Récupérer tous les cours de cette classe
        const courses = await db.course.findMany({
          where: { classId: cid, deletedAt: null },
          select: { id: true, name: true },
        });

        // Pour chaque cours, trouver les évaluations du trimestre
        const courseProgress = await Promise.all(
          courses.map(async (course) => {
            const evalWhere: Record<string, unknown> = {
              classId: cid,
              courseId: course.id,
              deletedAt: null,
            };
            if (trimester) evalWhere.trimester = trimester;

            const evaluations = await db.cahierEvaluation.findMany({
              where: evalWhere,
              select: { id: true, title: true, trimester: true },
            });

            if (evaluations.length === 0) {
              return null;
            }

            // Vérifier les transmissions pour chaque évaluation
            const evalIds = evaluations.map(e => e.id);
            const transmissions = await db.cotationTransmission.findMany({
              where: {
                evaluationId: { in: evalIds },
                classId: cid,
              },
              select: { evaluationId: true, status: true, sentAt: true, receivedAt: true, teacher: { select: { fullName: true } } },
            });

            const receivedEvals = transmissions.filter(t => t.status === 'RECEIVED' || t.status === 'SENT' || t.status === 'RESENT').length;
            const totalEvals = evalIds.length;

            return {
              courseId: course.id,
              courseName: course.name,
              totalEvaluations: totalEvals,
              receivedEvaluations: receivedEvals,
              pendingEvaluations: totalEvals - receivedEvals,
              progressPercent: totalEvals > 0 ? Math.round((receivedEvals / totalEvals) * 100) : 0,
              evaluations: evaluations.map(e => {
                const trans = transmissions.find(t => t.evaluationId === e.id);
                return {
                  evaluationId: e.id,
                  title: e.title,
                  trimester: e.trimester,
                  status: trans?.status || 'PENDING',
                  sentAt: trans?.sentAt,
                  receivedAt: trans?.receivedAt,
                  teacherName: trans?.teacher?.fullName,
                };
              }),
            };
          })
        );

        const validCourses = courseProgress.filter((c): c is NonNullable<typeof c> => Boolean(c));
        const totalEvals = validCourses.reduce((sum, c) => sum + c.totalEvaluations, 0);
        const receivedEvals = validCourses.reduce((sum, c) => sum + c.receivedEvaluations, 0);

        return {
          classId: cid,
          className: classInfo.name,
          classLevel: classInfo.level,
          totalCourses: validCourses.length,
          totalEvaluations: totalEvals,
          receivedEvaluations: receivedEvals,
          pendingEvaluations: totalEvals - receivedEvals,
          progressPercent: totalEvals > 0 ? Math.round((receivedEvals / totalEvals) * 100) : 0,
          courses: validCourses,
        };
      })
    );

    const totalEvals = classProgress.reduce((sum, c) => sum + c.totalEvaluations, 0);
    const totalReceived = classProgress.reduce((sum, c) => sum + c.receivedEvaluations, 0);
    const totalPending = totalEvals - totalReceived;

    return NextResponse.json({
      classes: classProgress,
      summary: {
        totalClasses: classes.length,
        totalEvaluations: totalEvals,
        receivedEvaluations: totalReceived,
        pendingEvaluations: totalPending,
        globalProgressPercent: totalEvals > 0 ? Math.round((totalReceived / totalEvals) * 100) : 0,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}