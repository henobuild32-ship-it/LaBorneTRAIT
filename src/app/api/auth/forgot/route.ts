import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createAndSendOtp } from '@/lib/otp';

export const runtime = 'nodejs';

const GENERIC_SUCCESS_MESSAGE =
  'Si un compte correspond à ces informations, un code OTP à 6 chiffres a été envoyé. Vérifiez aussi le dossier spam en cas de non noctification';

/**
 * POST /api/auth/forgot
 * Body: { email?, fullName?, inviteCode?, isAdminLogin? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, inviteCode, isAdminLogin } = body;

    const normalizedEmail = (email || '').trim().toLowerCase();
    const normalizedName = (fullName || '').trim();

    if (!normalizedEmail && !normalizedName) {
      return NextResponse.json(
        { error: 'Veuillez fournir votre email ou votre nom complet.' },
        { status: 400 }
      );
    }

    let user: any = null;

    if (normalizedEmail) {
      if (isAdminLogin) {
        const school = await db.school.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });
        if (school) {
          user = await db.user.findFirst({ where: { schoolId: school.id, role: 'ADMIN' } });
        }
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
      return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 });
    }

    const recipient = normalizedEmail && user.email ? user.email : user.email || null;
    if (!recipient) {
      return NextResponse.json(
        { message: 'Ce compte n’a pas d’adresse email associée. Contactez votre administrateur.' },
        { status: 200 }
      );
    }

    const school = await db.school.findUnique({ where: { id: user.schoolId } });
    await createAndSendOtp(user.id, recipient, school?.name || 'LaBorneTRAIT');

    return NextResponse.json({ message: GENERIC_SUCCESS_MESSAGE }, { status: 200 });
  } catch (error) {
    console.error('[ForgotPassword] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur interne lors de l’envoi.' },
      { status: 500 }
    );
  }
}
