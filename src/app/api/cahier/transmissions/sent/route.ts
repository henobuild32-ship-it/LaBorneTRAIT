import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const schoolId = searchParams.get('schoolId');

    if (!teacherId || !schoolId) {
      return NextResponse.json({ error: 'teacherId et schoolId requis' }, { status: 400 });
    }

    const transmissions = await db.cotationTransmission.findMany({
      where: {
        teacherId,
        schoolId,
      },
      include: {
        evaluation: {
          include: {
            class: { select: { id: true, name: true } },
            course: { select: { id: true, name: true } },
          },
        },
        class: { select: { id: true, name: true } },
        course: { select: { id: true, name: true } },
        titulaire: { select: { id: true, fullName: true, photoUrl: true } },
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