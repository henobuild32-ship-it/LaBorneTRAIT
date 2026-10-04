import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const titulaireId = searchParams.get('titulaireId');
    const schoolId = searchParams.get('schoolId');
    const classId = searchParams.get('classId');
    const status = searchParams.get('status');
    const trimester = searchParams.get('trimester');

    if (!titulaireId || !schoolId) {
      return NextResponse.json({ error: 'titulaireId et schoolId requis' }, { status: 400 });
    }

    const where: Record<string, unknown> = {
      titulaireId,
      schoolId,
    };

    if (classId) where.classId = classId;
    if (status) where.status = status;
    if (trimester) {
      // Filtrer par trimestre via l'évaluation
      where.evaluation = { trimester };
    }

    const transmissions = await db.cotationTransmission.findMany({
      where,
      include: {
        evaluation: {
          include: {
            marks: true,
          },
        },
        course: true,
        class: { select: { id: true, name: true, level: true } },
        teacher: { select: { id: true, fullName: true, photoUrl: true } },
      },
      orderBy: { sentAt: 'desc' },
    });

    return NextResponse.json({ transmissions });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const msg = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}