import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';

// GET /api/passages?studentId=&classId=&year=&result=
export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const schoolId = auth.schoolId;
    const studentId = searchParams.get('studentId') || '';
    const sourceClassId = searchParams.get('classId') || '';
    const year = searchParams.get('year') || '';
    const result = searchParams.get('result') || '';

    const where: Record<string, unknown> = { schoolId };
    if (studentId) where.studentId = studentId;
    if (sourceClassId) where.sourceClassId = sourceClassId;
    if (year) where.targetYear = year;
    if (result) where.result = result;

    // Sécurité : un élève ne voit que son propre parcours
    if (auth.role === 'STUDENT') where.studentId = auth.userId;
    if (auth.role === 'PARENT') {
      const children = await db.user.findMany({ where: { schoolId, parentId: auth.userId, role: 'STUDENT' }, select: { id: true } });
      where.studentId = { in: children.map(child => child.id) };
    }
    if (auth.role !== 'ADMIN' && auth.role !== 'TEACHER' && auth.role !== 'STUDENT' && auth.role !== 'PARENT') {
      return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
    }

    const passages = await db.passageHistorique.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, matricule: true, photoUrl: true } },
        sourceClass: { select: { id: true, name: true, cycle: true } },
        targetClass: { select: { id: true, name: true, cycle: true } },
      },
      orderBy: { datePassage: 'desc' },
    });

    return NextResponse.json({ passages });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/passages]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/passages { studentId, sourceClassId, targetClassId, sourceYear, targetYear, result }
// Verrouille la classe source (fin d'année) et inscrit l'élève dans la classe cible (année suivante).
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req);
    const body = await req.json();
    const { studentId, sourceClassId, targetClassId, sourceYear, targetYear, result } = body;

    if (auth.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Action réservée aux administrateurs.' }, { status: 403 });
    }
    if (!studentId || !targetClassId || !result) {
      return NextResponse.json({ error: 'studentId, targetClassId et result sont requis.' }, { status: 400 });
    }
    if (!['PROMOTED', 'REDOUBLE', 'LEAVING'].includes(result)) {
      return NextResponse.json({ error: 'Résultat de passage invalide.' }, { status: 400 });
    }

    // Vérifie l'élève et les classes
    const student = await db.user.findFirst({ where: { id: studentId, schoolId: auth.schoolId, role: 'STUDENT' } });
    if (!student) return NextResponse.json({ error: 'Élève introuvable dans cette école.' }, { status: 404 });

    const targetClass = await db.schoolClass.findFirst({
      where: { id: targetClassId, schoolId: auth.schoolId, deletedAt: null },
    });
    if (!targetClass) return NextResponse.json({ error: 'Classe cible introuvable.' }, { status: 404 });

    const sourceClass = sourceClassId
      ? await db.schoolClass.findFirst({ where: { id: sourceClassId, schoolId: auth.schoolId, deletedAt: null } })
      : null;
    const currentEnrollment = await db.enrolledClass.findFirst({ where: { userId: studentId, class: { schoolId: auth.schoolId, deletedAt: null } }, select: { classId: true } });
    const effectiveSourceClassId = sourceClass?.id || currentEnrollment?.classId;
    if (!effectiveSourceClassId) return NextResponse.json({ error: 'Classe source introuvable pour cet élève.' }, { status: 400 });
    const effectiveSourceClass = sourceClass || await db.schoolClass.findFirst({ where: { id: effectiveSourceClassId, schoolId: auth.schoolId, deletedAt: null } });
    if (!effectiveSourceClass) return NextResponse.json({ error: 'Classe source invalide.' }, { status: 400 });

    // SourceYear par défaut = année scolaire actuelle
    const activeYear = await db.schoolYear.findFirst({
      where: { schoolId: auth.schoolId, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
      select: { year: true },
    });
    const sourceYearFinal = sourceYear || activeYear?.year || '';
    const targetYearFinal = targetYear || nextAcademicYear(sourceYearFinal);

    const passage = await db.$transaction(async (tx) => {
      const duplicate = await tx.passageHistorique.findFirst({ where: { schoolId: auth.schoolId, studentId, sourceClassId: effectiveSourceClass.id, targetClassId: targetClass.id, sourceYear: sourceYearFinal, targetYear: targetYearFinal } });
      if (duplicate) return duplicate;
      // 1) archive passage
      const record = await tx.passageHistorique.create({
        data: {
          schoolId: auth.schoolId,
          studentId,
          sourceClassId: effectiveSourceClass.id,
          targetClassId: targetClass.id,
          sourceYear: sourceYearFinal,
          targetYear: targetYearFinal,
          result,
          verified: true,
        },
      });

      // 2) Si classe source fournie et différente : retirer l'élève de l'ancienne classe et l'ajouter à la nouvelle
      if (effectiveSourceClass.id !== targetClass.id) {
        await tx.enrolledClass.deleteMany({ where: { userId: studentId, classId: effectiveSourceClass.id } });
        await tx.enrolledClass.upsert({
          where: { userId_classId: { userId: studentId, classId: targetClass.id } },
          update: {},
          create: { userId: studentId, classId: targetClass.id },
        });
      } else {
        // juste s'assurer de l'inscription cible
        await tx.enrolledClass.upsert({
          where: { userId_classId: { userId: studentId, classId: targetClass.id } },
          update: {},
          create: { userId: studentId, classId: targetClass.id },
        });
      }

      return record;
    });

    return NextResponse.json({ passage }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/passages]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

function nextAcademicYear(year: string): string {
  const match = year.match(/^(\d{4})-(\d{4})$/);
  if (!match) return year;
  return `${Number(match[1]) + 1}-${Number(match[2]) + 1}`;
}
