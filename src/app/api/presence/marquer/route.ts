import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, AuthError } from '@/lib/auth/authenticate';
import { assertYearOpen } from '@/lib/year-status';

// Haversine formula — returns distance in meters between two GPS points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GEO_RADIUS_METERS = 300; // 300m tolerance around school
function isLate(now: Date, cutoff: string): boolean {
  const [hour, minute] = cutoff.split(':').map(Number);
  return now.getHours() > hour || (now.getHours() === hour && now.getMinutes() > minute);
}

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);

    const body = await request.json();
    const { userId, schoolId, latitude, longitude, justification } = body;

    if (!userId || !schoolId) {
      return NextResponse.json({ error: 'userId et schoolId requis' }, { status: 400 });
    }

    // Vérifier que l'utilisateur marque sa propre présence
    if (auth.userId !== userId) {
      return NextResponse.json({ error: 'Vous ne pouvez marquer que votre propre présence' }, { status: 403 });
    }

    // Fetch user and school data
    const [user, school] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, schoolId: true } }),
      db.school.findUnique({ where: { id: schoolId }, select: { id: true, latitude: true, longitude: true, heureArriveeScolaire: true } }),
    ]);

    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    if (user.schoolId !== schoolId) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    if (!school) return NextResponse.json({ error: 'École introuvable' }, { status: 404 });

    try {
      await assertYearOpen(schoolId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }

    // ─── Geolocation check ───
    let geoValid = true;
    let distanceMeters: number | null = null;

    if (school.latitude !== null && school.longitude !== null && latitude !== undefined && longitude !== undefined) {
      distanceMeters = haversineDistance(latitude, longitude, school.latitude, school.longitude);
      geoValid = distanceMeters <= GEO_RADIUS_METERS;
    }

    if (!geoValid) {
      return NextResponse.json(
        {
          error: 'Géolocalisation hors périmètre',
          distance: Math.round(distanceMeters!),
          radius: GEO_RADIUS_METERS,
          message: `Vous êtes à ${Math.round(distanceMeters!)}m de l'école. Maximum autorisé : ${GEO_RADIUS_METERS}m.`,
        },
        { status: 422 }
      );
    }

    // ─── Anti-fraud: one presence per day ───
    const now = new Date();
    // Normalize date to start of day (UTC midnight) for unique constraint
    const dateKey = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const existing = await db.presence.findUnique({
      where: { userId_date: { userId, date: dateKey } },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Présence déjà marquée', statut: existing.statut, heureArrivee: existing.heureArrivee },
        { status: 409 }
      );
    }

    // ─── Determine status ───
    let statut = 'PRESENT';
    if (isLate(now, school.heureArriveeScolaire || '08:00')) {
      statut = 'RETARD';
    }

    // Override for teacher with justification
    if (user.role === 'TEACHER' && justification) {
      statut = 'JUSTIFIE';
    }

    // ─── Save presence ───
    const presence = await db.presence.create({
      data: {
        schoolId,
        userId,
        date: dateKey,
        heureArrivee: now,
        statut,
        justification: justification || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      },
    });

    // ─── Notify admin via notification ───
    await db.notification.create({
      data: {
        schoolId,
        userId: null,
        senderId: userId,
        title: 'Présence enregistrée',
        message: `Pointage ${statut} enregistré à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
        type: statut === 'RETARD' ? 'WARNING' : 'INFO',
        targetRole: 'ADMIN',
      },
    });

    return NextResponse.json({
      success: true,
      presence,
      statut,
      message:
        statut === 'PRESENT'
          ? '✅ Présence marquée — À l\'heure !'
          : statut === 'RETARD'
          ? '⚠️ Présence marquée — En retard'
          : '📝 Présence avec justification enregistrée',
    });
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : 'Erreur interne';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
