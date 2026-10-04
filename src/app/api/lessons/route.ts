import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const courseId = searchParams.get('courseId');
    const teacherId = searchParams.get('teacherId');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (courseId) {
      where.courseId = courseId;
    }

    if (teacherId) {
      where.teacherId = teacherId;
    }

    // STUDENT can only see lessons for courses they are enrolled in
    if (auth.role === 'STUDENT') {
      const enrollments = await db.enrolledClass.findMany({
        where: { userId: auth.userId },
        select: { classId: true },
      });
      const classIds = enrollments.map(e => e.classId);
      const accessibleCourses = await db.course.findMany({
        where: { classId: { in: classIds }, schoolId },
        select: { id: true },
      });
      const accessibleCourseIds = accessibleCourses.map(c => c.id);
      if (courseId && !accessibleCourseIds.includes(courseId)) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
      if (!courseId) {
        where.courseId = { in: accessibleCourseIds };
      }
    }

    const lessons = await db.lesson.findMany({
      where,
      include: {
        course: {
          select: { id: true, name: true, classId: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ lessons });
  } catch (error: unknown) {
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
    const { schoolId, courseId, teacherId, title, content, fileUrl, fileName } = body;

    if (!schoolId || !courseId || !teacherId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, courseId, teacherId, title' },
        { status: 400 }
      );
    }

    const lesson = await db.lesson.create({
      data: {
        schoolId,
        courseId,
        teacherId,
        title,
        content: content || '',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
      },
      include: {
        course: {
          select: { id: true, name: true, classId: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (lesson.course?.classId) {
      notifyUser({
        schoolId,
        targetRole: 'STUDENT',
        targetClassId: lesson.course.classId,
        senderId: teacherId,
        title: `📚 Nouveau cours : ${title}`,
        message: `${lesson.teacher?.fullName || 'Votre professeur'} a publié la leçon "${title}" pour le cours de ${lesson.course.name}.`,
        type: 'LESSON',
        priority: 'NORMAL',
        metadata: { lessonId: lesson.id, courseId },
      }).catch((err) => console.error('[Lessons] Notification trigger error:', err));
    }

    return NextResponse.json({ lesson }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
