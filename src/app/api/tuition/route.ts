import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Accès réservé à l’administration.' }, { status: 403 });
    const { searchParams } = new URL(request.url);
    const schoolId = auth.schoolId;
    const status = searchParams.get('status');
    const classId = searchParams.get('classId');
    const search = searchParams.get('search');

    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId is required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { schoolId, role: 'STUDENT' };

    if (status === 'paid') {
      where.active = true;
    } else if (status === 'unpaid') {
      where.active = false;
    }

    const students = await db.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        ...(classId ? { classEnrollments: { some: { classId } } } : {}),
        ...(search ? { fullName: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        classEnrollments: {
          include: { class: { select: { id: true, name: true, fees: true } } },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const result = students.map((s) => {
      const lastPayment = s.payments[0] || null;
      const enrollment = s.classEnrollments[0] || null;
      const isPaid = lastPayment?.status === 'paid';

      return {
        id: s.id,
        fullName: s.fullName,
        matricule: s.matricule,
        active: s.active,
        classId: enrollment?.classId || null,
        className: enrollment?.class?.name || 'Non assigné',
        classFees: enrollment?.class?.fees || 0,
        paymentStatus: isPaid ? 'paid' : 'unpaid',
        lastPaymentDate: lastPayment?.createdAt || null,
        lastPaymentAmount: lastPayment?.amount || 0,
        lastPaymentMethod: lastPayment?.method || null,
        lastPaymentMonth: lastPayment?.month || null,
      };
    });

    const classes = await db.schoolClass.findMany({
      where: { schoolId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ students: result, classes });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestActive(request);
    if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'Accès réservé à l’administration.' }, { status: 403 });
    const body = await request.json();
    const { studentId, action, amount } = body;
    const adminId = auth.userId;

    if (!studentId || !action || !adminId) {
      return NextResponse.json({ error: 'Missing required fields: studentId, action, adminId' }, { status: 400 });
    }

    const student = await db.user.findFirst({ where: { id: studentId, schoolId: auth.schoolId, role: 'STUDENT' } });
    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    if (action === 'block') {
      await db.user.update({ where: { id: studentId }, data: { active: false } });
    } else if (action === 'restore') {
      await db.user.update({ where: { id: studentId }, data: { active: true } });
    } else if (action === 'mark-paid') {
      const { month, method } = body;
      if (!amount) {
        return NextResponse.json({ error: 'amount is required for mark-paid' }, { status: 400 });
      }
      await db.payment.create({
        data: {
          schoolId: student.schoolId,
          studentId,
          amount: parseFloat(amount),
          status: 'paid',
          month: month || '',
          method: method || 'cash',
        },
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    try {
      await db.notification.create({
        data: {
          schoolId: student.schoolId,
          userId: student.id,
          title: action === 'block' ? 'Accès bloqué' : action === 'restore' ? 'Accès rétabli' : 'Paiement enregistré',
          message:
            action === 'block'
              ? `Votre accès à la plateforme a été désactivé par l'administration. Veuillez contacter l'école.`
              : action === 'restore'
                ? `Votre accès à la plateforme a été rétabli. Bienvenue !`
                : `Un paiement de ${amount} FCFA a été enregistré sur votre compte.`,
          type: 'tuition',
          senderId: adminId,
        },
      });
    } catch (notifErr) {
      console.error('[Tuition] Notification failed (non-blocking):', notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
