import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authenticateRequestActive, AuthError } from '@/lib/auth/authenticate';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    const { id } = await params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, fullName: true, role: true, schoolId: true },
        },
      },
    });

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Vérifier que l'utilisateur appartient à la même école
    const paymentSchoolId = (payment as any).schoolId || payment.student?.schoolId;
    if (auth.role !== 'ADMIN' && paymentSchoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 });
    }

    return NextResponse.json({ payment });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestActive(request);
    const { id } = await params;
    const body = await request.json();
    const { amount, status, month, method } = body;

    const existing = await db.payment.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Admin uniquement, et admin de la même école
    const existingSchoolId = (existing as any).schoolId || existing.student?.schoolId;
    if (auth.role !== 'ADMIN' || existingSchoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    const payment = await db.payment.update({
      where: { id },
      data: {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(status !== undefined && { status }),
        ...(month !== undefined && { month }),
        ...(method !== undefined && { method }),
      },
      include: {
        student: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    return NextResponse.json({ payment });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestActive(request);
    const { id } = await params;

    const existing = await db.payment.findUnique({
      where: { id },
      include: { student: { select: { schoolId: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Admin uniquement, et admin de la même école
    const existingSchoolId = (existing as any).schoolId || existing.student?.schoolId;
    if (auth.role !== 'ADMIN' || existingSchoolId !== auth.schoolId) {
      return NextResponse.json({ error: 'Accès non autorisé. Action réservée aux administrateurs.' }, { status: 403 });
    }

    await db.payment.delete({ where: { id } });

    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
