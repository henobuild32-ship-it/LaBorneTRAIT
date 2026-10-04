import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkOtpCode, OTP_LENGTH } from '@/lib/otp';

export const runtime = 'nodejs';

/**
 * POST /api/auth/verify-otp
 * Body: { email?, fullName?, inviteCode?, isAdminLogin?, code }
 * Vérifie l'OTP sans le consommer, pour permettre l'étape reset juste après.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, inviteCode, isAdminLogin, code } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedName = (fullName || '').trim();
    const normalizedCode = String(code || '').trim();

    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizedCode)) {
      return NextResponse.json(
        { error: `Le code OTP doit contenir exactement ${OTP_LENGTH} chiffres.` },
        { status: 400 }
      );
    }
    if (!normalizedEmail && !normalizedName) {
      return NextResponse.json({ error: 'Informations de compte manquantes.' }, { status: 400 });
    }

    let user: any = null;

    if (normalizedEmail) {
      if (isAdminLogin) {
        const school = await db.school.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (school) user = await db.user.findFirst({ where: { schoolId: school.id, role: 'ADMIN' } });
      }
      if (!user) {
        user = await db.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
      }
    }

    if (!user && normalizedName) {
      const where: Record<string, unknown> = { fullName: normalizedName };
      if (inviteCode) {
        const school = await db.school.findUnique({
          where: { inviteCode: String(inviteCode).trim().toUpperCase() },
        });
        if (school) where.schoolId = school.id;
      }
      user = await db.user.findFirst({ where });
    }

    if (!user) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
    }

    const ok = await checkOtpCode(user.id, normalizedCode);
    if (!ok) {
      return NextResponse.json(
        { error: 'Code invalide ou expiré. Réessayez ou redemandez un nouveau code.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    console.error('[VerifyOtp] Erreur:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
