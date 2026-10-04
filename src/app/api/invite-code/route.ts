import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

function generateCode(prefix: string, length: number = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = prefix + '-';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST: Generate or regenerate invite code for a school
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { schoolId } = await request.json();
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requis.' }, { status: 400 });
    }

    if (auth.role !== 'ADMIN' || auth.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée à l’administrateur de l’établissement.' }, { status: 403 });
    }

    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'École non trouvée.' }, { status: 404 });
    }

    let code = generateCode('ECOLE', 6);
    while (await db.school.findUnique({ where: { inviteCode: code } })) {
      code = generateCode('ECOLE', 6);
    }

    const updated = await db.school.update({
      where: { id: schoolId },
      data: { inviteCode: code },
    });

    return NextResponse.json({ inviteCode: updated.inviteCode });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
