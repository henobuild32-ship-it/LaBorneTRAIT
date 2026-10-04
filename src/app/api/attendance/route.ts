import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { assertYearOpen } from '@/lib/year-status';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const studentId = searchParams.get('studentId');
    const date = searchParams.get('date');
    const courseId = searchParams.get('courseId');

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
          return NextResponse.json({ error: 'Vous ne pouvez consulter que les absences de vos enfants' }, { status: 403 });
        }
      } else if (auth.role === 'STUDENT' && studentId !== auth.userId) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
      where.studentId = studentId;
    } else if (auth.role === 'STUDENT') {
      where.studentId = auth.userId;
    }
    if (date) where.date = date;
    if (courseId) where.courseId = courseId;

    const attendance = await db.attendance.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ attendance });
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
    if (auth.role === 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { studentId, courseId, date, status, reason } = body;
    const schoolId = auth.schoolId;
    const teacherId = auth.userId;

    if (auth.role !== 'TEACHER' && auth.role !== 'ADMIN') return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    if (!studentId || !date) {
      return NextResponse.json(
        { error: 'Champs requis manquants: schoolId, studentId, teacherId, date' },
        { status: 400 }
      );
    }
    if (auth.role === 'TEACHER' && !(await db.course.findFirst({ where: { id: courseId || undefined, schoolId, teacherId } }))) return NextResponse.json({ error: 'Matière non affectée.' }, { status: 403 });

    try {
      await assertYearOpen(schoolId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    const attCourseId = courseId || '';
    const existing = await db.attendance.findUnique({
      where: { studentId_date_courseId: { studentId, date, courseId: attCourseId } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Présence déjà enregistrée pour cet étudiant à cette date' },
        { status: 409 }
      );
    }

    const attendance = await db.attendance.create({
      data: {
        schoolId,
        studentId,
        teacherId,
        courseId: attCourseId,
        date,
        status: status || 'absent',
        reason: reason || '',
      },
      include: {
        student: { select: { id: true, fullName: true, parentId: true } },
      },
    });

    if (attendance.status === 'absent' || attendance.status === 'late') {
      try {
        const { notifyUser } = await import('@/services/notifications/notificationEngine');
        const label = attendance.status === 'absent' ? 'Absence' : 'Retard';
        
        // Student
        notifyUser({
          schoolId,
          userId: studentId,
          senderId: teacherId,
          title: `⚠️ Notification : ${label}`,
          message: `Vous avez été marqué(e) ${attendance.status} le ${date}.`,
          type: 'ATTENDANCE',
          priority: 'HIGH',
          metadata: { attendanceId: attendance.id, date },
        }).catch((e) => console.error('[Attendance] Student notification error:', e));

        // Parent
        if (attendance.student?.parentId) {
          notifyUser({
            schoolId,
            userId: attendance.student.parentId,
            senderId: teacherId,
            title: `⚠️ ${label} de ${attendance.student.fullName}`,
            message: `${attendance.student.fullName} a été marqué(e) ${attendance.status} le ${date}.`,
            type: 'ATTENDANCE',
            priority: 'HIGH',
            metadata: { attendanceId: attendance.id, date },
          }).catch((e) => console.error('[Attendance] Parent notification error:', e));
        }
      } catch (e) { console.error('[Attendance] Notification setup error:', e); }
    }

    return NextResponse.json({ attendance }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
