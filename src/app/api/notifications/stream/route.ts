import { NextRequest } from 'next/server';
import { notificationEmitter } from '@/services/notifications/notificationEmitter';
import { verifyAccessToken, ACCESS_COOKIE } from '@/lib/auth/jwt';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const role = searchParams.get('role');
  const schoolId = searchParams.get('schoolId');

  if (!schoolId) {
    return new Response('schoolId is required', { status: 400 });
  }

  // Vérifier le JWT
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return new Response('Non authentifié', { status: 401 });
  }
  const claims = verifyAccessToken(token);
  if (!claims || claims.sub !== userId || claims.schoolId !== schoolId || claims.role !== role) {
    return new Response('Session invalide', { status: 401 });
  }

  const classIds = new Set<string>();
  if (claims.role === 'STUDENT') {
    const enrollments = await db.enrolledClass.findMany({
      where: {
        userId: claims.sub,
        class: { schoolId: claims.schoolId },
      },
      select: { classId: true },
    });
    for (const item of enrollments) classIds.add(item.classId);
  } else if (claims.role === 'TEACHER') {
    const [courses, titulaireClasses] = await Promise.all([
      db.course.findMany({
        where: {
          schoolId: claims.schoolId,
          teacherId: claims.sub,
          deletedAt: null,
        },
        select: { classId: true },
        distinct: ['classId'],
      }),
      db.schoolClass.findMany({
        where: {
          schoolId: claims.schoolId,
          titulaireId: claims.sub,
        },
        select: { id: true },
      }),
    ]);
    for (const item of courses) classIds.add(item.classId);
    for (const item of titulaireClasses) classIds.add(item.id);
  } else if (claims.role === 'PARENT') {
    const childrenEnrollments = await db.enrolledClass.findMany({
      where: {
        class: { schoolId: claims.schoolId },
        user: {
          schoolId: claims.schoolId,
          parentId: claims.sub,
        },
      },
      select: { classId: true },
    });
    for (const item of childrenEnrollments) classIds.add(item.classId);
  }

  const responseStream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper function to write SSE events
      const sendEvent = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (error) {
          // controller might already be closed
        }
      };

      // Send initial connection payload (keepalive / handshake)
      sendEvent({ heartbeat: true, timestamp: new Date().toISOString() });

      // Live notification event handler
      const onNotification = (notification: any) => {
        // Multi-tenant check
        if (notification.schoolId !== schoolId) return;

        // Recipient filtering rules:
        // 1. Direct recipient
        const isDirectRecipient = notification.userId && notification.userId === userId;

        // 2. Broadcast role target (e.g. STUDENT, PARENT, TEACHER)
        const isRoleTarget = notification.targetRole && 
                             notification.targetRole !== 'ALL' && 
                             notification.targetRole === role;

        // 3. Broadcast class target (restricted to class memberships)
        const isClassTarget =
          notification.targetRole === 'CLASS' &&
          typeof notification.targetClassId === 'string' &&
          classIds.has(notification.targetClassId);

        // 4. School-wide broadcast
        const isGlobalBroadcast = (!notification.userId || notification.userId === '') && 
                                  (!notification.targetRole || notification.targetRole === 'ALL');

        if (isDirectRecipient || isRoleTarget || isClassTarget || isGlobalBroadcast) {
          sendEvent(notification);
        }
      };

      // Register the event listener on the singleton emitter
      notificationEmitter.on('notification', onNotification);

      // Setup a heartbeat interval to keep connection alive (prevent Caddy / Cloudflare / Vercel timeouts)
      const heartbeatInterval = setInterval(() => {
        sendEvent({ heartbeat: true });
      }, 15000);

      // Clean up when the client aborts/closes the SSE stream
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval);
        notificationEmitter.off('notification', onNotification);
        try {
          controller.close();
        } catch {
          // ignore already closed stream errors
        }
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable buffering on Nginx proxies for instant delivery
    },
  });
}
