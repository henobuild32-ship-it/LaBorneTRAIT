import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError, type AuthUser } from '@/lib/auth/authenticate';

type NotificationAccessShape = {
  id: string;
  schoolId: string;
  userId: string | null;
  targetRole: string;
  targetClassId: string;
};

async function isClassRecipient(auth: AuthUser, targetClassId: string): Promise<boolean> {
  if (!targetClassId) return false;
  if (auth.role === 'ADMIN') return true;

  if (auth.role === 'STUDENT') {
    const enrollment = await db.enrolledClass.findFirst({
      where: {
        userId: auth.userId,
        classId: targetClassId,
        class: { schoolId: auth.schoolId },
      },
      select: { id: true },
    });
    return Boolean(enrollment);
  }

  if (auth.role === 'TEACHER') {
    const [course, titulaireClass] = await Promise.all([
      db.course.findFirst({
        where: {
          schoolId: auth.schoolId,
          classId: targetClassId,
          teacherId: auth.userId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      db.schoolClass.findFirst({
        where: {
          schoolId: auth.schoolId,
          id: targetClassId,
          titulaireId: auth.userId,
        },
        select: { id: true },
      }),
    ]);
    return Boolean(course || titulaireClass);
  }

  if (auth.role === 'PARENT') {
    const childEnrollment = await db.enrolledClass.findFirst({
      where: {
        classId: targetClassId,
        class: { schoolId: auth.schoolId },
        user: {
          schoolId: auth.schoolId,
          parentId: auth.userId,
        },
      },
      select: { id: true },
    });
    return Boolean(childEnrollment);
  }

  return false;
}

async function canAccessNotification(auth: AuthUser, notif: NotificationAccessShape): Promise<boolean> {
  if (notif.schoolId !== auth.schoolId) return false;
  if (auth.role === 'ADMIN') return true;
  if (notif.userId && notif.userId === auth.userId) return true;
  if (notif.targetRole === 'ALL') return true;
  if (notif.targetRole === auth.role) return true;
  if (notif.targetRole === 'CLASS') {
    return isClassRecipient(auth, notif.targetClassId);
  }
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        userId: true,
        targetRole: true,
        targetClassId: true,
        senderId: true,
        title: true,
        message: true,
        type: true,
        priority: true,
        read: true,
        metadata: true,
        createdAt: true,
      },
    });

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const allowed = await canAccessNotification(auth, notification);
    if (!allowed) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ notification });
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
    const { id } = await params;
    const body = await request.json();
    const { read, message, targetRole } = body;

    const existing = await db.notification.findUnique({
      where: { id },
      select: {
        id: true,
        schoolId: true,
        userId: true,
        targetRole: true,
        targetClassId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const allowed = await canAccessNotification(auth, existing);
    if (!allowed) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    if (auth.role !== 'ADMIN' && (message !== undefined || targetRole !== undefined)) {
      return NextResponse.json(
        { error: 'Seule la mise à jour du statut de lecture est autorisée.' },
        { status: 403 }
      );
    }

    const notification = await db.notification.update({
      where: { id },
      data: {
        ...(read !== undefined && { read: Boolean(read) }),
        ...(message !== undefined && { message }),
        ...(targetRole !== undefined && { targetRole }),
      },
    });

    return NextResponse.json({ notification });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.notification.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    await db.notification.delete({ where: { id } });

    return NextResponse.json({ message: 'Notification deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
