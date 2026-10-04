import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get('schoolId');
    const studentId = searchParams.get('studentId');
    const status = searchParams.get('status');
    const month = searchParams.get('month');
    const classId = searchParams.get('classId');

    if (!schoolId || (schoolId !== auth.schoolId && auth.role !== 'PARENT')) {
      return NextResponse.json({ error: 'schoolId invalide' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId };

    if (studentId) {
      if (auth.role === 'PARENT') {
        const student = await db.user.findUnique({
          where: { id: studentId },
          select: { parentId: true, schoolId: true },
        });
        if (!student || student.parentId !== auth.userId || student.schoolId !== schoolId) {
          return NextResponse.json({ error: 'Vous ne pouvez consulter que les paiements de vos enfants' }, { status: 403 });
        }
      } else if (auth.role === 'STUDENT' && studentId !== auth.userId) {
        return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
      }
      where.studentId = studentId;
    } else if (auth.role === 'STUDENT') {
      where.studentId = auth.userId;
    }
    if (status) where.status = status;
    if (month) where.month = month;
    if (classId && auth.role === 'ADMIN') {
      // Filtrer aux paiements des élèves inscrits dans cette classe
      where.student = { classEnrollments: { some: { classId } } };
    }

    // ─── Règle métier : paiement en retard > 30 jours → statut LATE ───
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdue = await db.payment.findMany({
      where: {
        schoolId,
        status: 'pending',
        createdAt: { lt: cutoff },
        deletedAt: null,
      },
      select: { id: true, studentId: true },
      take: 200,
    });
    if (overdue.length > 0) {
      await db.payment.updateMany({
        where: { id: { in: overdue.map((p) => p.id) } },
        data: { status: 'late' },
      });
      // Notifier les élèves concernés (non bloquant)
      try {
        const { notifyUser } = await import('@/services/notifications/notificationEngine');
        for (const p of overdue) {
          notifyUser({
            schoolId,
            userId: p.studentId,
            senderId: auth.userId,
            title: '⚠️ Scolarité en retard',
            message: 'Un paiement en attente a plus de 30 jours de retard.',
            type: 'PAYMENT',
            priority: 'HIGH',
            metadata: { paymentId: p.id },
          }).catch(() => {});
        }
      } catch { /* notifications non bloquantes */ }
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            role: true,
            classEnrollments: { select: { class: { select: { id: true, name: true } } }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (auth.role === 'PARENT') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const { schoolId, studentId, amount, status, month, method } = body;

    if (!schoolId || !studentId || amount === undefined) {
      return NextResponse.json(
        { error: 'Champs requis manquants: schoolId, studentId, amount' },
        { status: 400 }
      );
    }

    const payment = await db.payment.create({
      data: {
        schoolId,
        studentId,
        amount: parseFloat(amount),
        status: status || 'pending',
        month: month || '',
        method: method || 'cash',
      },
      include: {
        student: { select: { id: true, fullName: true, parentId: true } },
      },
    });

    // Notify student and parent
    try {
      const { notifyUser } = await import('@/services/notifications/notificationEngine');
      const amountStr = `${payment.amount} FCFA`;
      const monthStr = payment.month ? ` (${payment.month})` : '';

      // Student
      notifyUser({
        schoolId,
        userId: studentId,
        senderId: auth.userId,
        title: `💳 Reçu de paiement : ${amountStr}`,
        message: `Paiement enregistré pour la scolarité${monthStr}. Statut : ${payment.status}`,
        type: 'PAYMENT',
        priority: 'NORMAL',
        metadata: { paymentId: payment.id, amount: payment.amount },
      }).catch((e) => console.error('[Payment] Student notification error:', e));

      // Parent
      if (payment.student?.parentId) {
        notifyUser({
          schoolId,
          userId: payment.student.parentId,
          senderId: auth.userId,
          title: `💳 Paiement scolarité (${payment.student.fullName})`,
          message: `Paiement de ${amountStr}${monthStr} enregistré (${payment.status}).`,
          type: 'PAYMENT',
          priority: 'NORMAL',
          metadata: { paymentId: payment.id, amount: payment.amount },
        }).catch((e) => console.error('[Payment] Parent notification error:', e));
      }
    } catch (e) {
      console.error('[Payment] Notification setup error:', e);
    }

    return NextResponse.json({ payment }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
