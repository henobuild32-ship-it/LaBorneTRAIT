import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role !== 'PARENT') {
      return NextResponse.json({ error: 'Seul un parent peut lier un enfant' }, { status: 403 });
    }

    const { parentCode } = await request.json();

    if (!parentCode) {
      return NextResponse.json(
        { error: 'Code parent requis.' },
        { status: 400 }
      );
    }

    const cleanCode = (parentCode as string).trim().toUpperCase();

    // L'utilisateur authentifié est le parent
    const parentUser = await db.user.findUnique({ where: { id: auth.userId } });
    if (!parentUser || parentUser.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Compte parent invalide.' },
        { status: 404 }
      );
    }

    const student = await db.user.findUnique({ where: { parentCode: cleanCode } });
    if (!student || student.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'Code de parrainage invalide. Vérifiez le code fourni par votre enfant.' },
        { status: 404 }
      );
    }

    const updated = await db.user.update({
      where: { id: student.id },
      data: { parentId: auth.userId },
      include: {
        classEnrollments: {
          include: { class: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      student: {
        id: updated.id,
        fullName: updated.fullName,
        photoUrl: updated.photoUrl,
        classEnrollments: updated.classEnrollments,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
