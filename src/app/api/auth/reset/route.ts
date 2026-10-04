import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { verifyOtp, OTP_LENGTH } from '@/lib/otp';
import { setAuthCookies, serializeUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

/**
 * POST /api/auth/reset
 * Body: { email?, fullName?, inviteCode?, isAdminLogin?, code, newPassword }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, inviteCode, isAdminLogin, code, newPassword } = body;

    const normalizedCode = String(code || '').trim();
    if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizedCode)) {
      return NextResponse.json(
        { error: `Le code OTP doit contenir exactement ${OTP_LENGTH} chiffres.` },
        { status: 400 }
      );
    }
    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json(
        { error: 'Le nouveau mot de passe doit contenir au moins 4 caractères.' },
        { status: 400 }
      );
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedName = (fullName || '').trim();
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

    // Consomme le code OTP si valide (usage unique)
    const ok = await verifyOtp(user.id, normalizedCode);
    if (!ok) {
      return NextResponse.json(
        { error: 'Code invalide ou expiré. Redemandez un nouveau code.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { password: newHash },
      include: {
        school: true,
        classEnrollments: { include: { class: true } },
        children: true,
      },
    });

    const response = NextResponse.json({
      message: 'Mot de passe réinitialisé avec succès.',
      user: serializeUser(updatedUser, updatedUser.school),
    });
    setAuthCookies(response, updatedUser, updatedUser.school);
    return response;
  } catch (error) {
    console.error('[ResetPassword] Erreur:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
