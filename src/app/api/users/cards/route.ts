import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';
import { notifyUser } from '@/services/notifications/notificationEngine';

async function generateUniqueCardId(fullName: string) {
  const firstLetter = fullName.trim().charAt(0).toUpperCase() || 'X';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const baseId = `${firstLetter}${year}${month}`;

  let cardId = baseId;
  let counter = 1;
  while (true) {
    const existing = await db.user.findUnique({ where: { cardId } });
    if (!existing) {
      break;
    }
    cardId = `${baseId}${counter}`;
    counter++;
  }
  return cardId;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    const { schoolId, action, classId, userId } = await request.json();

    if (!schoolId || !action) {
      return NextResponse.json({ error: 'schoolId and action are required' }, { status: 400 });
    }

    // Admin uniquement, et admin de la même école
    if (auth.role !== 'ADMIN' || auth.schoolId !== schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    if (action === 'generate-all' || (action === 'generate-class' && classId)) {
      const whereClause: Record<string, any> = {
        schoolId,
        role: 'STUDENT',
        cardId: null, // generate only for those who don't have it
      };
      
      if (action === 'generate-class' && classId !== 'all') {
        if (classId === 'unassigned') {
          whereClause.classEnrollments = { none: {} };
        } else {
          whereClause.classEnrollments = { some: { classId } };
        }
      }

      const students = await db.user.findMany({ where: whereClause });
      
      let generatedCount = 0;
      for (const student of students) {
        const newCardId = await generateUniqueCardId(student.fullName);
        const issued = new Date().toISOString().slice(0, 10);
        const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        await db.user.update({
          where: { id: student.id },
          data: {
            cardId: newCardId,
            cardIssuedDate: issued,
            cardExpiryDate: expiry,
          },
        });

        // 1. Notify Student in real-time
        try { await notifyUser({
          schoolId,
          userId: student.id,
          title: 'Carte Élève Générée 🆔',
          message: `Félicitations ! Votre carte d'identité scolaire LaBorneTRAIT a été générée. Code : ${newCardId}`,
          type: 'CARD',
          priority: 'NORMAL',
          metadata: { cardId: newCardId, studentName: student.fullName },
        }); } catch (e) { console.error('[Cards] Student notification failed (non-blocking):', e); }

        // 2. Notify Parent if linked
        if (student.parentId) {
          try { await notifyUser({
            schoolId,
            userId: student.parentId,
            title: 'Carte Scolaire Enfant Disponible 🆔',
            message: `La carte d'identité scolaire LaBorneTRAIT de votre enfant ${student.fullName} a été générée.`,
            type: 'CARD',
            priority: 'NORMAL',
            metadata: { cardId: newCardId, studentId: student.id, studentName: student.fullName },
          }); } catch (e) { console.error('[Cards] Parent notification failed (non-blocking):', e); }
        }

        generatedCount++;
      }
      return NextResponse.json({ success: true, generatedCount });
    } else if (action === 'generate-single') {
      if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      const student = await db.user.findUnique({ where: { id: userId } });
      if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
      if (student.schoolId !== schoolId) {
        return NextResponse.json({ error: 'Élève introuvable dans votre établissement.' }, { status: 403 });
      }

      const newCardId = await generateUniqueCardId(student.fullName);
      const updated = await db.user.update({
        where: { id: userId },
        data: { cardId: newCardId }
      });

      // 1. Notify Student in real-time
      try { await notifyUser({
        schoolId,
        userId: student.id,
        title: 'Carte Élève Générée 🆔',
        message: `Félicitations ! Votre carte d'identité scolaire LaBorneTRAIT a été générée. Code : ${newCardId}`,
        type: 'CARD',
        priority: 'NORMAL',
        metadata: { cardId: newCardId, studentName: student.fullName },
      }); } catch (e) { console.error('[Cards] Student notification failed (non-blocking):', e); }

      // 2. Notify Parent if linked
      if (student.parentId) {
        try { await notifyUser({
          schoolId,
          userId: student.parentId,
          title: 'Carte Scolaire Enfant Disponible 🆔',
          message: `La carte d'identité scolaire LaBorneTRAIT de votre enfant ${student.fullName} a été générée.`,
          type: 'CARD',
          priority: 'NORMAL',
          metadata: { cardId: newCardId, studentId: student.id, studentName: student.fullName },
        }); } catch (e) { console.error('[Cards] Parent notification failed (non-blocking):', e); }
      }

      return NextResponse.json({ success: true, user: updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
