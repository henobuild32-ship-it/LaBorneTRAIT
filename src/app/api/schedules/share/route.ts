import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';

// POST /api/schedules/share — partage l'emploi du temps : à tous, à une classe, à un rôle ou à un individu
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const {
      schoolId,
      classId,
      targetRole,
      userId,
      message,
    } = body as {
      schoolId?: string;
      classId?: string;
      targetRole?: string;
      userId?: string;
      message?: string;
    };

    if (!schoolId || schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs de cette école.' }, { status: 403 });
    }

    if (classId) {
      const targetClass = await db.schoolClass.findFirst({ where: { id: classId, schoolId } });
      if (!targetClass) {
        return NextResponse.json({ error: 'Classe introuvable' }, { status: 404 });
      }
    }

    let individualUserId: string | undefined;
    if (userId) {
      const targetUser = await db.user.findFirst({ where: { id: userId, schoolId } });
      if (!targetUser) {
        return NextResponse.json({ error: 'Destinataire introuvable dans cette école' }, { status: 404 });
      }
      individualUserId = targetUser.id;
    }

    const className = classId
      ? (await db.schoolClass.findUnique({ where: { id: classId }, select: { name: true } }))?.name
      : null;

    const announcement = await notifyUser({
      schoolId,
      userId: individualUserId,
      targetRole: individualUserId ? undefined : classId ? 'STUDENT' : targetRole || 'ALL',
      targetClassId: classId || '',
      senderId: auth.userId,
      title: className ? `🗓️ Emploi du temps — ${className}` : '🗓️ Emploi du temps partagé',
      message:
        message ||
        (className
          ? `L'emploi du temps de la classe ${className} est disponible et à jour.`
          : "L'emploi du temps de l'école est disponible et à jour."),
      type: 'ANNOUNCEMENT',
      priority: 'NORMAL',
      metadata: { kind: 'schedule', classId: classId || '', sharedBy: auth.userId },
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne';
    console.error('[POST /api/schedules/share]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
