import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { createNotification } from '@/services/notifications/createNotification';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const targetRole = searchParams.get('targetRole');

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (auth.role === 'STUDENT') {
      const enrollments = await db.enrolledClass.findMany({
        where: { userId: auth.userId },
        select: { classId: true },
      });
      const classIds = enrollments.map(e => e.classId);
      where.OR = [
        { userId: auth.userId },
        { targetRole: 'STUDENT' },
        { targetRole: 'ALL' },
        { targetClassId: { in: classIds } },
      ];
    } else if (auth.role === 'TEACHER') {
      where.OR = [
        { userId: auth.userId },
        { targetRole: 'TEACHER' },
        { targetRole: 'ALL' },
      ];
    } else if (auth.role === 'PARENT') {
      where.OR = [
        { userId: auth.userId },
        { targetRole: 'PARENT' },
        { targetRole: 'ALL' },
      ];
    } else if (targetRole) {
      where.targetRole = targetRole;
    }

    const notifications = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (targetRole === 'STUDENT' || targetRole === 'PARENT' || targetRole === 'TEACHER') {
      return NextResponse.json(notifications);
    }

    return NextResponse.json({ notifications });
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
    const { schoolId, senderId, targetRole, targetClassId, message, title, type, priority, metadata } = body;

    if (!schoolId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: schoolId, message' },
        { status: 400 }
      );
    }

    // Persist notification to database first (this must succeed)
    const notification = await createNotification({
      schoolId,
      senderId: senderId || '',
      targetRole: targetRole || 'ALL',
      targetClassId: targetClassId || '',
      message,
      title: title || 'LaBorneTRAIT',
      type: type || 'INFO',
      priority: priority || 'NORMAL',
      metadata: metadata || {},
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
