import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

// GET /api/deliberation?schoolId=...&classId=...&studentId=...&academicYear=...
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { searchParams } = new URL(request.url);
    const schoolId = auth.schoolId;
    const classId = searchParams.get('classId');
    const studentId = searchParams.get('studentId');
    const academicYear = searchParams.get('academicYear');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requis' }, { status: 400 });
    }

    const where: any = { schoolId };
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (academicYear) where.academicYear = academicYear;

    const decisions = await db.deliberationDecision.findMany({
      where,
      include: {
        student: { select: { id: true, fullName: true, gender: true, parentId: true } },
        validator: { select: { id: true, fullName: true } },
      },
      orderBy: { decidedAt: 'desc' },
    });

    return NextResponse.json(decisions);
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[GET /api/deliberation]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/deliberation
// Body: { schoolId, studentId, classId, academicYear, decision, validatedBy, comment }
// decision: "passage" | "redoublement" | "en_deliberation" | "admis_apres_deliberation" | "non_admis"
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Seul un administrateur peut valider une délibération.' }, { status: 403 });
    const body = await request.json();
    const { studentId, classId, academicYear, decision, comment } = body;
    const schoolId = auth.schoolId;
    const validatedBy = auth.userId;

    if (!schoolId || !studentId || !classId || !academicYear || !decision || !validatedBy) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être fournis' },
        { status: 400 }
      );
    }

    const validDecisions = [
      'passage',
      'redoublement',
      'en_deliberation',
      'admis_apres_deliberation',
      'non_admis',
    ];

    if (!validDecisions.includes(decision)) {
      return NextResponse.json(
        { error: `Décision invalide. Valeurs acceptées: ${validDecisions.join(', ')}` },
        { status: 400 }
      );
    }

    const [validatedStudent, schoolClass] = await Promise.all([
      db.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' }, select: { id: true } }),
      db.schoolClass.findFirst({ where: { id: classId, schoolId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!validatedStudent || !schoolClass) return NextResponse.json({ error: 'Élève ou classe introuvable dans cette école.' }, { status: 404 });

    // Verify admin exists
    const admin = await db.user.findFirst({
      where: { id: validatedBy, role: 'ADMIN', schoolId },
    });
    if (!admin) {
      return NextResponse.json(
        { error: 'Seul un administrateur principal peut valider une délibération' },
        { status: 403 }
      );
    }

    // Create deliberation record
    const deliberation = await db.deliberationDecision.create({
      data: {
        schoolId,
        studentId,
        classId,
        academicYear,
        decision,
        validatedBy,
        comment: comment || '',
      },
      include: {
        student: { select: { id: true, fullName: true, gender: true, parentId: true } },
        validator: { select: { id: true, fullName: true } },
      },
    });

    // Send notifications to student and parent
    const decisionLabel: Record<string, string> = {
      passage: 'Admis(e) en classe supérieure',
      redoublement: 'Non admis(e) — redoublement',
      en_deliberation: 'En délibération — décision en attente',
      admis_apres_deliberation: 'Admis(e) après délibération',
      non_admis: 'Non admis(e)',
    };
    const label = decisionLabel[decision] || decision;

    // Notify student
    await db.notification.create({
      data: {
        schoolId,
        userId: studentId,
        senderId: validatedBy,
        title: "Résultat de fin d'année",
        message: `Votre résultat de fin d'année scolaire ${academicYear} : ${label}. ${comment ? `Commentaire : ${comment}` : ''}`,
        type: 'DELIBERATION',
        priority: 'HIGH',
      },
    });

    // Notify parent if exists
    const studentParent = await db.user.findUnique({
      where: { id: studentId },
      select: { parentId: true },
    });

    if (studentParent?.parentId) {
      await db.notification.create({
        data: {
          schoolId,
          userId: studentParent.parentId,
          senderId: validatedBy,
          title: "Résultat de fin d'année de votre enfant",
          message: `Le résultat de fin d'année scolaire ${academicYear} de votre enfant : ${label}. ${comment ? `Commentaire : ${comment}` : ''}`,
          type: 'DELIBERATION',
          priority: 'HIGH',
        },
      });
    }

    return NextResponse.json(deliberation, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[POST /api/deliberation]', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
