import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { syncStudentReport } from '@/lib/grade-sync';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const teacherId = searchParams.get('teacherId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const studentId = searchParams.get('studentId');

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };
    if (classId) where.classId = classId;
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;

    if (auth.role === 'STUDENT') {
      where.studentId = auth.userId;
    } else if (auth.role === 'PARENT') {
      const children = await db.user.findMany({
        where: { schoolId, parentId: auth.userId },
        select: { id: true },
      });
      where.studentId = { in: children.map((child) => child.id) };
    } else if (auth.role === 'TEACHER') {
      const courses = await db.course.findMany({
        where: { schoolId, teacherId: auth.userId, deletedAt: null },
        select: { classId: true },
        distinct: ['classId'],
      });
      const classIds = courses.map((course) => course.classId);
      where.classId = classId && classIds.includes(classId) ? classId : { in: classIds };
    }

    const reportCards = await db.reportCard.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, photoUrl: true } },
        class: { select: { id: true, name: true, level: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reportCards });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { schoolId, studentId, trimester } = body;

    if (!schoolId || schoolId !== auth.schoolId || !studentId || !trimester) {
      return NextResponse.json({ error: 'schoolId, studentId et trimestre sont requis.' }, { status: 400 });
    }
    if (auth.role === 'STUDENT' || auth.role === 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }
    if (auth.role === 'TEACHER') {
      const grade = await db.grade.findFirst({
        where: { schoolId, studentId, teacherId: auth.userId },
        select: { id: true },
      });
      if (!grade) {
        return NextResponse.json({ error: 'Vous ne pouvez générer que les bulletins de vos classes attribuées.' }, { status: 403 });
      }
    }

    const result = await syncStudentReport(schoolId, studentId, trimester);
    if (!result) {
      return NextResponse.json({ error: 'Aucune cotation réelle ne permet de générer ce bulletin.' }, { status: 422 });
    }
    const reportCard = await db.reportCard.findUnique({
      where: { id: result.reportCardId },
    });
    return NextResponse.json({ reportCard, synchronized: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { id, status, teacherId, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.reportCard.findUnique({ where: { id } });
    if (!existing || existing.schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Bulletin introuvable dans cet établissement.' }, { status: 404 });
    }
    if (auth.role === 'STUDENT' || auth.role === 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }
    if (auth.role === 'TEACHER') {
      const course = await db.course.findFirst({
        where: { schoolId: auth.schoolId, classId: existing.classId, teacherId: auth.userId, deletedAt: null },
        select: { id: true },
      });
      if (!course || status !== 'pending_admin') {
        return NextResponse.json({ error: 'Un professeur peut uniquement transmettre le bulletin de ses classes.' }, { status: 403 });
      }
    }
    if (auth.role === 'ADMIN' && status !== undefined && !['pending_admin', 'validated', 'published'].includes(status)) {
      return NextResponse.json({ error: 'Statut de bulletin invalide.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = auth.role === 'ADMIN' ? { ...data } : {};
    if (status) updateData.status = status;

    const reportCard = await db.reportCard.update({
      where: { id },
      data: updateData,
    });

    if (status === 'pending_admin' && teacherId) {
      const report = await db.reportCard.findUnique({
        where: { id },
        select: { schoolId: true, student: { select: { id: true, fullName: true } } },
      });
      if (report) {
        try {
          const { notifyUser } = await import('@/services/notifications/notificationEngine');
          await notifyUser({
            schoolId: report.schoolId,
            targetRole: 'ADMIN',
            title: '📄 Bulletin transmis par un professeur',
            message: `Un bulletin pour ${report.student.fullName} a été créé et transmis pour validation.`,
            type: 'REPORT_CARD',
            priority: 'HIGH',
            senderId: teacherId,
            metadata: { reportCardId: id },
          });
        } catch { /* non-blocking */ }
      }
    }

    // When published, notify student and parent
    if (status === 'published') {
      const report = await db.reportCard.findUnique({
        where: { id },
        select: { schoolId: true, trimester: true, studentId: true, averageGrade: true, mention: true, student: { select: { id: true, fullName: true, parentId: true } } },
      });
      if (report) {
        try {
          const { notifyUser } = await import('@/services/notifications/notificationEngine');
          const avgStr = report.averageGrade ? ` (Moyenne : ${report.averageGrade}/20)` : '';

          // Student
          await notifyUser({
            schoolId: report.schoolId,
            userId: report.studentId,
            title: `📑 Bulletin publié (Trimestre ${report.trimester})`,
            message: `Votre bulletin du trimestre ${report.trimester} est maintenant disponible${avgStr}.`,
            type: 'REPORT_CARD',
            priority: 'HIGH',
            metadata: { reportCardId: id },
          });

          // Parent
          if (report.student?.parentId) {
            await notifyUser({
              schoolId: report.schoolId,
              userId: report.student.parentId,
              title: `📑 Bulletin de ${report.student.fullName} (Trimestre ${report.trimester})`,
              message: `Le bulletin de votre enfant pour le trimestre ${report.trimester} est disponible${avgStr}.`,
              type: 'REPORT_CARD',
              priority: 'HIGH',
              metadata: { reportCardId: id },
            });
          }
        } catch { /* non-blocking */ }
      }
    }

    return NextResponse.json({ reportCard });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const existing = await db.reportCard.findUnique({ where: { id }, select: { schoolId: true } });
    if (!existing || existing.schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Suppression réservée à l’administrateur de l’établissement.' }, { status: 403 });
    }
    await db.reportCard.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}