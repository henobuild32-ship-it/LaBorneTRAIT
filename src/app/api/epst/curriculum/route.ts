import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/epst/curriculum?classLevel=...&subject=...&topic=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classLevel = searchParams.get('classLevel');
    const subject = searchParams.get('subject');
    const topic = searchParams.get('topic');

    if (!classLevel || !subject) {
      return NextResponse.json({ error: 'classLevel et subject sont requis' }, { status: 400 });
    }

    const curriculum = await db.ePSTCurriculum.findMany({
      where: {
        classLevel,
        subject,
        topic: topic || undefined,
      },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(curriculum);
  } catch (error) {
    console.error('[GET /api/epst/curriculum]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
