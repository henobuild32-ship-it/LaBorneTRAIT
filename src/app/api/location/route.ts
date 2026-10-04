import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Seuls les étudiants peuvent mettre à jour leur position' }, { status: 403 });
    }

    const { latitude, longitude, accuracy } = await request.json();

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'latitude et longitude requis' }, { status: 400 });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Coordonnées invalides' }, { status: 400 });
    }

    const location = await db.liveLocation.upsert({
      where: { userId: auth.userId },
      update: { latitude, longitude, accuracy: accuracy || null, source: 'gps' },
      create: { userId: auth.userId, latitude, longitude, accuracy: accuracy || null, source: 'gps' },
    });

    return NextResponse.json({ success: true, location });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    if (auth.role === 'PARENT') {
      const student = await db.user.findUnique({
        where: { id: userId },
        select: { parentId: true, schoolId: true },
      });
      if (!student || student.parentId !== auth.userId || student.schoolId !== auth.schoolId) {
        return NextResponse.json({ error: 'Vous ne pouvez consulter que la position de vos enfants' }, { status: 403 });
      }
    } else if (auth.role !== 'ADMIN' && auth.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const location = await db.liveLocation.findUnique({
      where: { userId },
    });

    return NextResponse.json({ location });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
