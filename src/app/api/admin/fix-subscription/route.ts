import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bearerMatchesSystemSecret } from '@/lib/auth/system-secret';

function verifySystemAdmin(request: NextRequest): boolean {
  // Clé système dédiée uniquement (ADMIN_API_SECRET) : jamais de fallback JWT_SECRET.
  return bearerMatchesSystemSecret(request, [process.env.ADMIN_API_SECRET]);
}

// POST /api/admin/fix-subscription - Réservé à l'administration de la plateforme
export async function POST(request: NextRequest) {
  try {
    if (!verifySystemAdmin(request)) {
      return NextResponse.json({ error: 'Non autorisé. Clé système requise.' }, { status: 401 });
    }

    const { schoolId, months = 24 } = await request.json().catch(() => ({}));
    if (!schoolId) {
      return NextResponse.json({ error: 'schoolId requis.' }, { status: 400 });
    }

    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return NextResponse.json({ error: 'École introuvable.' }, { status: 404 });
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + Number(months));

    const updated = await db.school.update({
      where: { id: school.id },
      data: {
        subscriptionStatus: 'active',
        subscriptionExpiry: expiry,
      },
    });

    return NextResponse.json({
      success: true,
      school: {
        id: updated.id,
        name: updated.name,
        subscriptionStatus: updated.subscriptionStatus,
        subscriptionExpiry: updated.subscriptionExpiry,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/admin/fix-subscription - Réservé à l'administration de la plateforme
export async function GET(request: NextRequest) {
  try {
    if (!verifySystemAdmin(request)) {
      return NextResponse.json({ error: 'Non autorisé. Clé système requise.' }, { status: 401 });
    }

    const schools = await db.school.findMany({
      select: { id: true, name: true, subscriptionStatus: true, subscriptionExpiry: true },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ schools });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
