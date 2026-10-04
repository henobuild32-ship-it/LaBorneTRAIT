import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';

interface AnnouncementInput {
  title?: string;
  message: string;
}

// GET /api/announcements — communiqués visibles par l'utilisateur connecté
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const where: Record<string, unknown> = {
      schoolId,
      type: 'ANNOUNCEMENT',
      deletedAt: null,
    };

    if (auth.role === 'STUDENT') {
      const enrollments = await db.enrolledClass.findMany({
        where: { userId: auth.userId },
        select: { classId: true },
      });
      where.OR = [
        { userId: auth.userId },
        { targetRole: 'STUDENT' },
        { targetRole: 'ALL' },
        { targetClassId: { in: enrollments.map((e) => e.classId) } },
      ];
    } else if (auth.role === 'TEACHER') {
      where.OR = [{ userId: auth.userId }, { targetRole: 'TEACHER' }, { targetRole: 'ALL' }];
    } else if (auth.role === 'PARENT') {
      where.OR = [{ userId: auth.userId }, { targetRole: 'PARENT' }, { targetRole: 'ALL' }];
    }

    const announcements = await db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      announcements,
      unreadCount: announcements.filter((item) => !item.read).length,
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/announcements — publication d'un communiqué (ou d'un lot importé) par l'administration
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const body = await request.json();
    const {
      schoolId,
      title,
      message,
      items,
      targetRole,
      classId,
      userId,
      priority,
    } = body as {
      schoolId?: string;
      title?: string;
      message?: string;
      items?: AnnouncementInput[];
      targetRole?: string;
      classId?: string;
      userId?: string;
      priority?: string;
    };

    if (!schoolId || schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs de cette école.' }, { status: 403 });
    }

    const inputs: AnnouncementInput[] = Array.isArray(items) && items.length > 0
      ? items
      : [{ title, message: message ?? '' }];

    const valid = inputs.filter((item) => item && item.message && item.message.trim().length > 0);
    if (valid.length === 0) {
      return NextResponse.json({ error: 'Le message du communiqué est obligatoire.' }, { status: 400 });
    }

    const audience = targetRole || 'ALL';
    if (!['ALL', 'STUDENT', 'TEACHER', 'PARENT', 'ADMIN'].includes(audience)) {
      return NextResponse.json({ error: 'Destinataire invalide.' }, { status: 400 });
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

    const published: Awaited<ReturnType<typeof notifyUser>>[] = [];
    for (const item of valid) {
      const announcement = await notifyUser({
        schoolId,
        userId: individualUserId,
        targetRole: individualUserId ? undefined : classId ? 'STUDENT' : audience,
        targetClassId: classId || '',
        senderId: auth.userId,
        title: (item.title || '').trim() || '📢 Communiqué',
        message: item.message.trim(),
        type: 'ANNOUNCEMENT',
        priority: (priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT') || 'NORMAL',
        metadata: { kind: 'announcement', publishedBy: auth.userId },
      });
      published.push(announcement);
    }

    return NextResponse.json({ announcements: published, created: published.length }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    console.error('[POST /api/announcements]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/announcements?id=... — retrait d'un communiqué
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    const existing = await db.notification.findFirst({
      where: { id, schoolId: auth.schoolId, type: 'ANNOUNCEMENT' },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Communiqué introuvable' }, { status: 404 });
    }

    await db.notification.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
