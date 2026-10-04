import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';

const SEED_CALENDAR: Record<string, { trimester: number | null; semester: number | null; period: string }[]> = {
  Maternelle: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
  ],
  Primaire: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 3, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 2, semester: 1, period: 'P2' },
    { trimester: 3, semester: 2, period: 'P3' },
  ],
  EB: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
  ],
  Humanites: [
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P1' },
    { trimester: 1, semester: 1, period: 'P2' },
    { trimester: 2, semester: 2, period: 'P3' },
  ],
};

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;
    const schoolYearId = searchParams.get('schoolYearId') || '';
    const cycle = searchParams.get('cycle') || '';

    if (!schoolId) return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });

    if (schoolYearId) {
      const calendar = await db.calendrierScolaire.findMany({
        where: { schoolId, schoolYearId, ...(cycle ? { cycle: { in: ['ALL', cycle] } } : {}) },
        orderBy: [{ cycle: 'asc' }, { month: 'asc' }],
      });
      return NextResponse.json({ calendar });
    }

    // Sans schoolYearId : retourne tous les calendriers de l'école
    const calendar = await db.calendrierScolaire.findMany({
      where: { schoolId, ...(cycle ? { cycle: { in: ['ALL', cycle] } } : {}) },
      orderBy: [{ schoolYearId: 'asc' }, { month: 'asc' }],
    });
    return NextResponse.json({ calendar });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/calendar]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Upsert un mapping mois -> période pour un cycle donné
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();
    const { schoolYearId, cycle, month, trimester, semester, period, dateStart, dateEnd } = body;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }
    if (!schoolYearId || !cycle || !month || !period) {
      return NextResponse.json({ error: 'schoolYearId, cycle, month et period sont requis.' }, { status: 400 });
    }

    const record = await db.calendrierScolaire.upsert({
      where: { schoolId_schoolYearId_month_cycle: { schoolId: auth.schoolId, schoolYearId, month, cycle } },
      update: {
        trimester: trimester ?? null,
        semester: semester ?? null,
        period,
        dateStart: dateStart ? new Date(dateStart) : null,
        dateEnd: dateEnd ? new Date(dateEnd) : null,
        monthName: MONTH_NAMES[(month - 1 + 12) % 12] || '',
      },
      create: {
        schoolId: auth.schoolId,
        schoolYearId,
        cycle,
        month,
        monthName: MONTH_NAMES[(month - 1 + 12) % 12] || '',
        trimester: trimester ?? null,
        semester: semester ?? null,
        period,
        dateStart: dateStart ? new Date(dateStart) : null,
        dateEnd: dateEnd ? new Date(dateEnd) : null,
      },
    });

    return NextResponse.json({ calendar: record });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/calendar]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Seed le calendrier par défaut pour tous les cycles (appelé à l'installation d'une année scolaire)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolYearId = searchParams.get('schoolYearId') || '';
    const cycle = searchParams.get('cycle') || 'ALL';

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    await db.calendrierScolaire.deleteMany({
      where: { schoolId: auth.schoolId, schoolYearId, ...(cycle !== 'ALL' ? { cycle } : {}) },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[DELETE /api/calendar]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}