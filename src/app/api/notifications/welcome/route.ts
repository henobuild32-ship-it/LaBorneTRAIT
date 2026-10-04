import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';

export const runtime = 'nodejs';

/**
 * POST /api/notifications/welcome
 * Envoie une notification de bienvenue à l'utilisateur connecté, une seule fois.
 * Déclenché côté client dès que l'utilisateur a autorisé les notifications
 * (navigateur / OneSignal). La notification est persistée en base (Realtime)
 * puis diffusée en Web Push (PWA) et en push OneSignal.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, fullName: true, schoolId: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    // Déduplication : une seule notification de bienvenue par utilisateur
    const alreadySent = await db.notification.findFirst({
      where: {
        userId: user.id,
        metadata: { contains: '"kind":"welcome"' },
      },
      select: { id: true },
    });
    if (alreadySent) {
      return NextResponse.json({ success: true, alreadySent: true });
    }

    await notifyUser({
      schoolId: user.schoolId,
      userId: user.id,
      senderId: user.id,
      title: '👋 Bienvenue sur LaBorneTRAIT !',
      message: `Bonjour ${user.fullName}, vos notifications sont activées. Vous recevrez désormais vos cours, notes, devoirs et messages en temps réel.`,
      type: 'SYSTEM',
      priority: 'NORMAL',
      metadata: { kind: 'welcome' },
    });

    return NextResponse.json({ success: true, alreadySent: false });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[WelcomeNotification] Erreur:', err);
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
