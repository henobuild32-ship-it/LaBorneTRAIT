import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'PARENT') return NextResponse.json({ error: 'Accès réservé aux parents.' }, { status: 403 });
    const children = await db.user.findMany({
      where: { parentId: auth.userId, role: 'STUDENT', active: true },
      include: { school: { select: { id: true, name: true, logoUrl: true, academicYear: true } }, classEnrollments: { include: { class: { select: { id: true, name: true, level: true } } } } },
      orderBy: [{ school: { name: 'asc' } }, { fullName: 'asc' }],
    });
    return NextResponse.json({ children: children.map(child => ({ id: child.id, fullName: child.fullName, matricule: child.matricule, photoUrl: child.photoUrl, school: child.school, classEnrollments: child.classEnrollments })) });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 });
  }
}
