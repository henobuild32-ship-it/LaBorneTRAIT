import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function POST(request: NextRequest) {
  try {
    // Sécurité : l'utilisateur connecté doit correspondre au userId fourni
    const auth = authenticateRequest(request);
    const body = await request.json();
    const { userId, subscription } = body;

    if (!userId || !subscription || !subscription.endpoint) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId, subscription' },
        { status: 400 }
      );
    }

    if (userId !== auth.userId && auth.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Vous ne pouvez enregistrer vos propres abonnements push.' },
        { status: 403 }
      );
    }

    const { endpoint, keys } = subscription;
    const p256dh = keys?.p256dh || '';
    const authKey = keys?.auth || '';

    // upsert subscription based on the unique endpoint string
    const pushSub = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh,
        auth: authKey,
      },
      create: {
        userId,
        endpoint,
        p256dh,
        auth: authKey,
      },
    });

    return NextResponse.json({ success: true, subscription: pushSub });
  } catch (err: any) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('[PushSubscribeAPI] Error storing browser push subscription:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}