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
    const classId = searchParams.get('classId');

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

    // Filter by classId: find all courses in that class, then filter homework by those courses
    if (classId) {
      const classCoursesIds = await db.course.findMany({
        where: { classId, schoolId },
        select: { id: true },
      });
      where.courseId = { in: classCoursesIds.map((c) => c.id) };
    }

    const homework = await db.homework.findMany({
      where,
      include: {
        course: {
          select: { id: true, name: true, class: { select: { id: true, name: true } } },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ homework });
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
    const { schoolId, courseId, teacherId, title, description, dueDate, gradingType, fileUrl, fileName } = body;
    const operationId = request.headers.get('x-idempotency-key') || body.operationId;

    if (!schoolId || !courseId || !teacherId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, courseId, teacherId, title' },
        { status: 400 }
      );
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

    const homework = await db.homework.create({
      data: {
        schoolId,
        courseId,
        teacherId,
        title,
        description: description || '',
        dueDate: dueDate || '',
        gradingType: gradingType || 'manual',
        fileUrl: fileUrl || '',
        fileName: fileName || '',
      },
      include: {
        course: {
          select: { id: true, name: true },
        },
        teacher: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    const courseObj = await db.course.findUnique({
      where: { id: courseId },
      select: { classId: true, name: true },
    });

    if (courseObj?.classId) {
      notifyUser({
        schoolId,
        targetRole: 'STUDENT',
        targetClassId: courseObj.classId,
        senderId: teacherId,
        title: `📝 Nouveau devoir : ${title}`,
        message: `Devoir en ${courseObj.name}${dueDate ? ' à rendre pour le ' + dueDate : ''}.`,
        type: 'HOMEWORK',
        priority: 'HIGH',
        metadata: { homeworkId: homework.id, courseId },
      }).catch((err) => console.error('[Homework] Notification trigger error:', err));
    }

    const responseBody = { homework };
    if (operationId) {
      await db.syncOperation.create({
        data: {
          operationId,
          userId: auth.userId,
          schoolId,
          operationType: 'CREATE_HOMEWORK',
          statusCode: 201,
          response: responseBody,
        },
      });
    }
    return NextResponse.json(responseBody, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

