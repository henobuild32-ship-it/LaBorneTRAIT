import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';

// GET /api/schedules/timeslots?schoolId= – plages horaires de l'école
export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });
    if (schoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const slots = await db.schoolTimeSlot.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { start: 'asc' },
    });

    return NextResponse.json({ timeSlots: slots });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Timeslots] GET error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/schedules/timeslots?schoolId= – remplace toutes les plages horaires (ADMIN)
export async function PUT(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');

    if (!schoolId) return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });
    if (schoolId !== auth.schoolId || auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Accès non autorisé. Réservé aux administrateurs.' }, { status: 403 });
    }

    const body = await request.json();
    const timeSlots = Array.isArray(body.timeSlots) ? body.timeSlots : [];

    // Remplacement atomique : soft-delete des anciennes + création des nouvelles
    await db.$transaction(async (tx) => {
      await tx.schoolTimeSlot.updateMany({
        where: { schoolId },
        data: { deletedAt: new Date() },
      });

      for (const slot of timeSlots) {
        if (!slot.start || !slot.end) continue;
        await tx.schoolTimeSlot.create({
          data: {
            schoolId,
            start: slot.start,
            end: slot.end,
            isBreak: !!slot.isBreak,
          },
        });
      }
    });

    const updated = await db.schoolTimeSlot.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: { start: 'asc' },
    });

    return NextResponse.json({ timeSlots: updated });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[Timeslots] PUT error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
