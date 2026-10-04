import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Sécurité des callbacks GeniusPay (Phase 3 - plan de mise en production).
 *
 * Deux mécanismes coexistent :
 *  1. Signature interne `sgn` : posée par NOTRE serveur sur l'URL de succès
 *     au moment de l'initiation du paiement. Elle prouve que le navigateur
 *     revient d'un paiement que nous avons nous-mêmes ouvert.
 *  2. Vérification d'état côté GeniusPay (`GET /payments/{id}`) : prouve que
 *     le paiement est bien COMPLETED au montant attendu.
 * Une callback de production doit passer par (1) et, si un identifiant de
 * paiement est présent, par (2). À défaut, l'ancienne signature HMAC globale
 * sur la query string reste acceptée (callbacks webhook/test).
 */

const SIGNED_FIELDS = ['schoolId', 'action', 'classId', 'userId'] as const;
export type SignedField = (typeof SIGNED_FIELDS)[number];

/** Durée de validité d'une signature de callback (anti-rejeu). */
export const CARD_CALLBACK_MAX_AGE_MS = 15 * 60 * 1000;
/** Tolérance d'horloge. */
export const CARD_CALLBACK_CLOCK_SKEW_MS = 60 * 1000;

/** Cookie httpOnly attestant qu'un paiement de carte a été confirmé. */
export const CARD_CREDIT_COOKIE = 'gp_paid';
export const CARD_CREDIT_TTL_MS = 30 * 60 * 1000;

function getSecret(): string | null {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.JWT_SECRET;
  return secret || null;
}

function hmacHex(payload: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export interface CardCallbackFields {
  schoolId?: string | null;
  action?: string | null;
  classId?: string | null;
  userId?: string | null;
  ts?: string | null;
  sgn?: string | null;
}

function payloadOf(fields: CardCallbackFields, ts: string): string {
  const base = SIGNED_FIELDS.map((field) => `${field}=${fields[field] ?? ''}`).join('&');
  return `${base}&ts=${ts}`;
}

/** Signe l'URL de succès retournée à GeniusPay au moment de l'initiation. */
export function signCardCallback(
  fields: CardCallbackFields,
  now: number = Date.now()
): { ts: string; sgn: string } | null {
  const ts = String(now);
  const sgn = hmacHex(payloadOf(fields, ts));
  return sgn ? { ts, sgn } : null;
}

/** Vérifie la signature interne d'un callback (valide 15 minutes, anti-rejeu). */
export function verifyCardCallback(
  fields: CardCallbackFields,
  now: number = Date.now()
): boolean {
  const { ts, sgn } = fields;
  if (!ts || !sgn) return false;
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return false;
  const age = now - tsNum;
  if (age > CARD_CALLBACK_MAX_AGE_MS) return false;
  if (age < -CARD_CALLBACK_CLOCK_SKEW_MS) return false;
  const expected = hmacHex(payloadOf(fields, ts));
  if (!expected) return false;
  return safeEqualHex(sgn, expected);
}

/**
 * Identifiant de paiement GeniusPay retourné par la redirection.
 * Plusieurs alias sont acceptés selon la version de l'API.
 */
export function getPaymentId(params: URLSearchParams): string | null {
  const keys = [
    'payment_id',
    'paymentId',
    'payment',
    'id',
    'reference',
    'ref',
    'transaction_id',
    'transactionId',
    'txnid',
  ];
  for (const key of keys) {
    const value = params.get(key);
    if (value && value !== 'new-card') return value;
  }
  return null;
}

const COMPLETED_STATUSES = new Set([
  'completed',
  'complete',
  'successful',
  'success',
  'paid',
  'succeeded',
  'approved',
  'captured',
]);

export interface GeniusPayVerification {
  ok: boolean;
  /** confirmed = payé ; rejected = refusé par GeniusPay ; unreachable = API injoignable. */
  kind: 'confirmed' | 'rejected' | 'unreachable';
  detail: string;
}

function geniusPayConfigured(): { key: string; secret: string; baseUrl: string } | null {
  const key = process.env.GENIUSPAY_API_KEY;
  const secret = process.env.GENIUSPAY_API_SECRET;
  if (!key || !secret || key.includes('placeholder') || secret.includes('placeholder')) return null;
  const baseUrl = (process.env.GENIUSPAY_API_BASE_URL || 'https://geniuspay.ci/api/v1/merchant').replace(
    /\/$/,
    ''
  );
  return { key, secret, baseUrl };
}

/**
 * Confirme un paiement directement auprès de GeniusPay :
 * statut COMPLETED, montant et devise conformes.
 */
export async function verifyGeniusPayPayment(paymentId: string): Promise<GeniusPayVerification> {
  const config = geniusPayConfigured();
  if (!config) {
    return { ok: false, kind: 'unreachable', detail: 'identifiants GeniusPay non configurés' };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          'X-API-Key': config.key,
          'X-API-Secret': config.secret,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!response.ok) {
      // 404 = paiement inconnu (preuve negative) ; 401/403 = nos identifiants
      // sont invalides ; 5xx = service indisponible.
      const kind =
        response.status === 404 || (response.status >= 400 && response.status < 500 && response.status !== 401 && response.status !== 403)
          ? 'rejected'
          : 'unreachable';
      return { ok: false, kind, detail: `réponse HTTP ${response.status} pour ${paymentId}` };
    }

    const json = (await response.json()) as Record<string, unknown>;
    const data = (json?.data ?? json) as Record<string, unknown>;
    const rawStatus = String(data?.status ?? data?.state ?? '').toLowerCase();
    const status = COMPLETED_STATUSES.has(rawStatus);

    const expectedAmount = Number(process.env.STUDENT_CARD_PRICE_USD || 10);
    const amountRaw = data?.amount ?? data?.requested_amount ?? data?.value;
    const amount = amountRaw === undefined || amountRaw === null ? null : Number(amountRaw);
    const currency = String(data?.currency ?? '').toUpperCase();

    let detail = `status=${rawStatus || 'inconnu'}`;
    let ok = status;

    if (amount !== null && Number.isFinite(amount)) {
      const amountOk = Math.abs(amount - expectedAmount) < 0.001;
      detail += ` amount=${amount} (attendu ${expectedAmount})`;
      ok = ok && amountOk;
    } else {
      detail += ' amount=absent';
    }

    if (currency) {
      detail += ` currency=${currency}`;
      ok = ok && currency === 'USD';
    }

    if (!status) {
      detail += ' -> paiement NON confirme';
    }
    return { ok, kind: ok ? 'confirmed' : 'rejected', detail };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, kind: 'unreachable', detail: `échec de vérification GeniusPay: ${message}` };
  }
}

function cardCreditPayload(schoolId: string, expiresAt: number): string {
  return `${schoolId}.${expiresAt}`;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Crée le jeton de crédit de carte (1 paiement = 1 carte).
 * Valeur : `<schoolId>.<expiration>.<hmac>`.
 */
export function buildCardCreditValue(
  schoolId: string,
  now: number = Date.now()
): string | null {
  const expiresAt = now + CARD_CREDIT_TTL_MS;
  const payload = cardCreditPayload(schoolId, expiresAt);
  const signature = hmacHex(payload);
  if (!signature) return null;
  return `${payload}.${signature}`;
}

/**
 * Valide le jeton de crédit pour une école donnée (signature + expiration).
 */
export function isCardCreditValueValid(
  value: string | undefined | null,
  schoolId: string,
  now: number = Date.now()
): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [creditSchoolId, expiresAtRaw, signature] = parts;
  if (creditSchoolId !== schoolId) return false;
  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < now) return false;
  const expected = hmacHex(cardCreditPayload(creditSchoolId, expiresAt));
  if (!expected) return false;
  return safeEqualHex(signature, expected);
}

/** Attributs du cookie de crédit : httpOnly, limité à /api, Secure en production. */
export function cardCreditCookieOptions(maxAgeSeconds: number): string {
  const parts = [
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProduction()) parts.push('Secure');
  return parts.join('; ');
}
