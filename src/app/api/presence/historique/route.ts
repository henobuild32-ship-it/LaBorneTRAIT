import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const daysStr = searchParams.get('days') || '30';
    const days = Math.min(parseInt(daysStr, 10) || 30, 90);

    if (!schoolId || schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    if (auth.role === 'PARENT' && userId) {
      const student = await db.user.findUnique({
        where: { id: userId },
        select: { parentId: true, schoolId: true },
      });
      if (!student || student.parentId !== auth.userId || student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const where: Record<string, unknown> = {
      schoolId,
      date: { gte: since },
    };
    if (userId) where.userId = userId;
    if (role) where.user = { role };

    const presences = await db.presence.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            role: true,
            photoUrl: true,
            classEnrollments: {
              select: { class: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const dailyMap = new Map<string, { present: number; retard: number; justifie: number; absent: number }>();
    presences.forEach((p) => {
      const key = p.date.toISOString().split('T')[0];
      if (!dailyMap.has(key)) dailyMap.set(key, { present: 0, retard: 0, justifie: 0, absent: 0 });
      const d = dailyMap.get(key)!;
      if (p.statut === 'PRESENT') d.present++;
      else if (p.statut === 'RETARD') d.retard++;
      else if (p.statut === 'JUSTIFIE') d.justifie++;
    });
    const chartData = Array.from(dailyMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({ presences, chartData, total: presences.length });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Seul un administrateur peut valider des justifications' }, { status: 403 });
    }

    const body = await request.json();
    const { presenceId } = body;

    if (!presenceId) {
      return NextResponse.json({ error: 'presenceId requis' }, { status: 400 });
    }

    const updated = await db.presence.update({
      where: { id: presenceId },
      data: {
        statut: 'JUSTIFIE',
        validePar: auth.userId,
      },
    });

    return NextResponse.json({ presence: updated });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
