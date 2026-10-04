import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { bearerMatchesSystemSecret } from '@/lib/auth/system-secret';

/**
 * Route de diagnostic - accessible uniquement avec une clé système dédiée,
 * transmise EXCLUSIVEMENT via le header Authorization: Bearer <SECRET>.
 * Les paramètres ?secret= et le corps de requête ne sont plus acceptés.
 */
export async function GET(request: NextRequest) {
  try {
    const authorized = bearerMatchesSystemSecret(request, [
      process.env.HEALTHCHECK_SECRET_KEY,
      process.env.ADMIN_API_SECRET,
    ]);
    if (!authorized) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    // Compter les écoles et leurs statuts (sans exposer les codes d'invitation)
    const schools = await db.school.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionStatus: true,
        subscriptionExpiry: true,
        _count: { select: { users: true } },
      },
    });

    const now = new Date();
    const expiredByDate = schools.filter(
      s => s.subscriptionExpiry && new Date(s.subscriptionExpiry) < now && s.subscriptionStatus === 'active'
    );

    return NextResponse.json({
      totalSchools: schools.length,
      schools: schools.map(s => ({
        ...s,
        isExpiredByDate: s.subscriptionExpiry ? new Date(s.subscriptionExpiry) < now : false,
      })),
      expiredByDateCount: expiredByDate.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/db-health - Remet tous les abonnements à active
export async function POST(request: NextRequest) {
  try {
    const authorized = bearerMatchesSystemSecret(request, [
      process.env.HEALTHCHECK_SECRET_KEY,
      process.env.ADMIN_API_SECRET,
    ]);
    if (!authorized) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }

    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

    // Réactiver tous les abonnements non-suspendus
    const result = await db.school.updateMany({
      where: {
        subscriptionStatus: { not: 'suspended' },
      },
      data: {
        subscriptionStatus: 'active',
        subscriptionExpiry: twoYearsFromNow,
      },
    });

    // Réactiver tous les comptes désactivés par accident
    const usersResult = await db.user.updateMany({
      where: { active: false },
      data: { active: true },
    });

    return NextResponse.json({
      success: true,
      schoolsFixed: result.count,
      usersReactivated: usersResult.count,
      newExpiry: twoYearsFromNow.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erreur interne.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
