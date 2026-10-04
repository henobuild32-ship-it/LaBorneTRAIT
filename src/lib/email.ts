import nodemailer from 'nodemailer';

/**
 * Email helper (Nodemailer + SMTP)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends transactional emails (OTP, réinitialisation de mot de passe…).
 * Variables d'environnement attendues :
 *   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const host = process.env.SMTP_HOST || '';
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || '';
const pass = process.env.SMTP_PASS || '';

const fromName = 'LaBorneTRAIT';
const fromAddress = process.env.SMTP_FROM || user;

function isConfigured(): boolean {
  return !!host && (!!user || !pass); // SMTP peut être open-relay (sans user)
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        user
          ? { user, pass }
          : undefined,
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
      },
    });
  }
  return transporter;
}

export interface MailPayload {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Envoie un email transactionnel.
 * Retourne `true` si l'email a été envoyé, `false` si le SMTP n'est pas configuré.
 * Lance une erreur si l'envoi échoue (pour logging côté appelant).
 */
export async function sendEmail(payload: MailPayload): Promise<boolean> {
  if (!isConfigured()) {
    console.warn('[Email] SMTP non configuré — envoi ignoré:', payload.subject);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return true;
  } catch (error) {
    console.error('[Email] Échec d\'envoi:', error);
    throw error;
  }
}