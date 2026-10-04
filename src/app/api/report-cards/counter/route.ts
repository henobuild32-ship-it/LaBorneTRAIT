import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function POST(request: NextRequest) {
  try {
    authenticateRequest(request);
    const body = await request.json();
    const { schoolId, classId, trimester } = body;

    if (!schoolId || !classId || !trimester) {
      return NextResponse.json({ error: 'schoolId, classId, trimester are required' }, { status: 400 });
    }

    // Obtenir ou créer le compteur pour l'école/classe/trimestre
    let counter = await db.reportCounter.findUnique({
      where: { schoolId_classId_trimester: { schoolId, classId, trimester } }
    });

    if (!counter) {
      counter = await db.reportCounter.create({
        data: {
          schoolId,
          classId,
          trimester,
          count: 0
        }
      });
    }

    // Incrémenter le compteur
    const updatedCounter = await db.reportCounter.update({
      where: { id: counter.id },
      data: { count: { increment: 1 } }
    });

    return NextResponse.json({
      canGenerate: true,
      counter: updatedCounter.count
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Failed to process report counter' }, { status: 500 });
  }
}
