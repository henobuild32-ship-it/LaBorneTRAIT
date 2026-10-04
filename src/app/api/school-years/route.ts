import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';

// GET /api/school-years?schoolId=
export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolId = searchParams.get('schoolId') || auth.schoolId;

    const years = await db.schoolYear.findMany({
      where: { schoolId },
      select: { id: true, year: true, status: true, closedAt: true },
      orderBy: { year: 'desc' },
    });

    return NextResponse.json({ years });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/school-years]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}