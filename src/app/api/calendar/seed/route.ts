import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { CYCLES } from '@/lib/school-calendar';

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

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();
    const { schoolYearId, imported } = body;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }

    // Si aucun schoolYearId, on prend l'année scolaire active
    let yearId = schoolYearId;
    if (!yearId) {
      const activeYear = await db.schoolYear.findFirst({
        where: { schoolId: auth.schoolId, status: { not: 'CLOSED' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!activeYear) {
        return NextResponse.json({ error: 'Aucune année scolaire ouverte. Créez une année scolaire d’abord.' }, { status: 400 });
      }
      yearId = activeYear.id;
    }

    // Import custom (fourni par le Super Admin) ou défaut
    const formatYear = (source: typeof SEED_CALENDAR) => source;
    const table = imported && imported[Object.keys(imported)[0]] ? imported : SEED_CALENDAR;
    const cyclesToSeed = Object.keys(table).length > 0 ? Object.keys(table) : CYCLES;

    const created: unknown[] = [];
    for (const cycle of cyclesToSeed) {
      const slots = table[cycle] || SEED_CALENDAR[cycle];
      if (!slots) continue;
      for (let month = 1; month <= 12; month++) {
        const slot = slots[month - 1];
        if (!slot) continue;
        const record = await db.calendrierScolaire.upsert({
          where: { schoolId_schoolYearId_month_cycle: { schoolId: auth.schoolId, schoolYearId: yearId, month, cycle } },
          update: {
            trimester: slot.trimester,
            semester: slot.semester,
            period: slot.period,
            schoolYearId: yearId,
          },
          create: {
            schoolId: auth.schoolId,
            schoolYearId: yearId,
            cycle,
            month,
            monthName: '',
            trimester: slot.trimester,
            semester: slot.semester,
            period: slot.period,
          },
        });
        created.push(record);
      }
    }

    return NextResponse.json({ seeded: created.length, schoolYearId: yearId });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/calendar/seed]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}