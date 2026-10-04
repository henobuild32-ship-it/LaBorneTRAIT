import { randomInt, randomBytes, createHash, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email';

/**
 * Password reset OTP (mot de passe oublié) — tous types d'utilisateurs.
 * ─────────────────────────────────────────────────────────────────────────────
 * - OTP 6 chiffres, stocké HASHÉ (sha256 + sel) avec TTL (10 min)
 * - Envoi par email (Nodemailer/SMTP)
 * - Un seul OTP actif par utilisateur ; 5 essais max avant invalidation
 */

export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const OTP_LENGTH = 6;
const MAX_ATTEMPTS = 5;

function hashOtp(otp: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

async function getActivePasswordReset(userId: string) {
  return db.passwordReset.findFirst({
    where: { userId, used: false, otpExpiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Crée (ou remplace) un OTP pour l'utilisateur et envoie l'email.
 * Retourne l'OTP généré (uniquement utile en dev/logging).
 */
export async function createAndSendOtp(
  userId: string,
  email: string,
  schoolName = 'LaBorneTRAIT'
): Promise<string> {
  // Invalide les OTP précédents encore actifs
  await db.passwordReset.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const otp = randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, '0');
  const salt = randomBytes(16).toString('hex');
  const otpHash = hashOtp(otp, salt);

  await db.passwordReset.create({
    data: {
      userId,
      email,
      otpHash,
      otpSalt: salt,
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(90deg,#2563eb,#6d28d9);padding:16px 24px;color:#fff">
        <h2 style="margin:0;font-size:18px">🔐 ${schoolName} — Réinitialisation du mot de passe</h2>
      </div>
      <div style="padding:24px">
        <p style="color:#334155;font-size:14px;line-height:1.6">Bonjour,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">
          Vous avez demandé la réinitialisation de votre mot de passe.
          Utilisez le code ci-dessous pour continuer :
        </p>
        <div style="text-align:center;margin:24px 0">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#1e3a8a;background:#eff6ff;padding:12px 20px;border-radius:10px;display:inline-block">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:13px;line-height:1.6">
          Ce code est valable <strong>10 minutes</strong>. Si vous n'êtes pas à l'origine de cette demande,
          vous pouvez ignorer cet email — votre mot de passe reste inchangé.
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: `Code de réinitialisation — ${schoolName}`,
    text: `Votre code de réinitialisation est : ${otp}. Valable 10 minutes.`,
    html,
  });

  return otp;
}

/**
 * Vérifie un OTP pour un utilisateur. Invalide après MAX_ATTEMPTS échecs.
 */
export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const isValid = await checkOtpCode(userId, code);
  if (!isValid) return false;

  const record = await getActivePasswordReset(userId);
  if (!record) return false;

  await db.passwordReset.update({
    where: { id: record.id },
    data: { used: true },
  });
  return true;
}

/**
 * Vérifie le code OTP sans le consommer.
 * Utilisé pour l'étape intermédiaire "vérifier le code" avant l'étape reset.
 */
export async function checkOtpCode(userId: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const record = await getActivePasswordReset(userId);
  if (!record) return false;
  if (record.wrongAttempts >= MAX_ATTEMPTS) return false;

  const computed = hashOtp(code, record.otpSalt);
  if (!safeEqual(computed, record.otpHash)) {
    await db.passwordReset.update({
      where: { id: record.id },
      data: { wrongAttempts: record.wrongAttempts + 1 },
    });
    return false;
  }
  return true;
}
