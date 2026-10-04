import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { notifyUser } from '@/services/notifications/notificationEngine';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  CARD_CREDIT_COOKIE,
  CARD_CREDIT_TTL_MS,
  buildCardCreditValue,
  cardCreditCookieOptions,
  getPaymentId,
  verifyCardCallback,
  verifyGeniusPayPayment,
} from '@/lib/payment-callback';

const CARD_PRICE = Number(process.env.STUDENT_CARD_PRICE_USD || 10);

async function generateUniqueCardId(fullName: string) {
  const firstLetter = fullName.trim().charAt(0).toUpperCase() || 'X';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const baseId = `${firstLetter}${year}${month}`;

  let cardId = baseId;
  let counter = 1;
  while (true) {
    const existing = await db.user.findUnique({ where: { cardId } });
    if (!existing) break;
    cardId = `${baseId}${counter}`;
    counter++;
  }
  return cardId;
}

/**
 * Trace comptable (Phase 3) : chaque carte generee est enregistree comme
 * paiement PAYE de 10 USD dans la table Payment.
 */
async function recordCardPayment(schoolId: string, studentId: string): Promise<void> {
  try {
    await db.payment.create({
      data: {
        schoolId,
        studentId,
        amount: CARD_PRICE,
        status: 'paid',
        method: 'geniuspay',
        month: 'carte-scolaire',
      },
    });
  } catch (error) {
    console.error('[GeniusPay] Enregistrement du paiement de carte impossible:', error);
  }
}

/**
 * Ancien mecanisme : signature HMAC sur l'integralite de la query string
 * (callbacks webhook / tests internes). Garde en dernier recours.
 */
function verifyHmacSignature(params: URLSearchParams): boolean {
  const sig = params.get('sig');
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET || process.env.JWT_SECRET;
  if (!secret || !sig) return false;

  const sortedEntries = [...params.entries()]
    .filter(([k]) => k !== 'sig')
    .sort(([a], [b]) => a.localeCompare(b));
  const payload = sortedEntries.map(([k, v]) => `${k}=${v}`).join('&');

  const expected = createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

interface CallbackVerification {
  ok: boolean;
  reason: string;
}

/**
 * Verification du callback (Phase 3) :
 *  1. confirmation d'etat cote GeniusPay si un identifiant de paiement est present ;
 *  2. signature interne `sgn` posee par notre serveur a l'initiation ;
 *  3. en dernier recours, la signature HMAC globale.
 */
async function verifyCallback(params: URLSearchParams): Promise<CallbackVerification> {
  const paymentId = getPaymentId(params);
  let apiDetail: string | null = null;

  // 1) Confirmation d'etat aupres de GeniusPay
  if (paymentId) {
    const result = await verifyGeniusPayPayment(paymentId);
    if (result.kind === 'confirmed') {
      return { ok: true, reason: `paiement ${paymentId} confirme (${result.detail})` };
    }
    if (result.kind === 'rejected') {
      return { ok: false, reason: `paiement ${paymentId} non confirme (${result.detail})` };
    }
    // kind === 'unreachable' : on retombe sur les signatures ci-dessous.
    apiDetail = result.detail;
  }

  // 2) Signature interne de l'URL de succes
  const internalSignatureOk = verifyCardCallback({
    schoolId: params.get('schoolId'),
    action: params.get('action'),
    classId: params.get('classId'),
    userId: params.get('userId'),
    ts: params.get('ts'),
    sgn: params.get('sgn'),
  });

  if (internalSignatureOk) {
    const suffix = paymentId && apiDetail ? ` (API GeniusPay injoignable: ${apiDetail})` : '';
    return { ok: true, reason: `signature interne valide${suffix}` };
  }

  // 3) Signature HMAC globale (webhook / tests)
  if (verifyHmacSignature(params)) {
    return { ok: true, reason: 'signature HMAC globale valide' };
  }

  return {
    ok: false,
    reason: paymentId
      ? `aucune signature valide et paiement ${paymentId} non confirme`
      : 'aucune signature ni paiement verifiable',
  };
}

function htmlResponse(body: string, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

const ERROR_HTML = `<html><head><title>Erreur</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;"><div style="text-align:center;padding:2rem;"><div style="font-size:3rem;margin-bottom:1rem;">⛔</div><h2 style="color:#1e293b;">Requete non autorisee</h2><p style="color:#64748b;">Signature de paiement invalide.</p></div></body></html>`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get('schoolId');
  const action = searchParams.get('action');
  const classId = searchParams.get('classId');
  const userId = searchParams.get('userId');

  console.log('GeniusPay success callback triggered:', { schoolId, action, classId, userId });

  let creditCookie: string | null = null;

  if (process.env.NODE_ENV === 'production') {
    const verification = await verifyCallback(searchParams);
    if (!verification.ok) {
      console.warn('[GeniusPay] Callback rejete:', verification.reason);
      return htmlResponse(ERROR_HTML, 403);
    }
    console.log('[GeniusPay] Callback accepte:', verification.reason);
  } else {
    console.warn('[GeniusPay] NODE_ENV!=production : verification du callback bypassee (dev uniquement).');
  }

  if (schoolId && action) {
    try {
      if (action === 'generate-all' || (action === 'generate-class' && classId)) {
        const whereClause: Record<string, unknown> = { schoolId, role: 'STUDENT', cardId: null };
        if (action === 'generate-class' && classId !== 'all') {
          whereClause.classEnrollments = classId === 'unassigned' ? { none: {} } : { some: { classId } };
        }
        const students = await db.user.findMany({ where: whereClause });
        for (const student of students) {
          const newCardId = await generateUniqueCardId(student.fullName);
          await db.user.update({ where: { id: student.id }, data: { cardId: newCardId } });
          await recordCardPayment(schoolId, student.id);
          try { await notifyUser({ schoolId, userId: student.id, title: 'Carte Eleve Generee', message: `Votre carte scolaire LaBorneTRAIT a ete generee. Code : ${newCardId}`, type: 'CARD', priority: 'NORMAL', metadata: { cardId: newCardId, studentName: student.fullName } }); } catch (e) { console.error('[GeniusPay] notif student failed:', e); }
          if (student.parentId) {
            try { await notifyUser({ schoolId, userId: student.parentId, title: 'Carte Scolaire Enfant Disponible', message: `La carte de votre enfant ${student.fullName} a ete generee.`, type: 'CARD', priority: 'NORMAL', metadata: { cardId: newCardId, studentId: student.id, studentName: student.fullName } }); } catch (e) { console.error('[GeniusPay] notif parent failed:', e); }
          }
        }
      } else if (action === 'generate-single' && userId && userId !== 'new-card') {
        const student = await db.user.findUnique({ where: { id: userId } });
        if (student && student.schoolId === schoolId) {
          const newCardId = await generateUniqueCardId(student.fullName);
          await db.user.update({ where: { id: userId }, data: { cardId: newCardId } });
          await recordCardPayment(schoolId, student.id);
          try { await notifyUser({ schoolId, userId: student.id, title: 'Carte Eleve Generee', message: `Votre carte scolaire LaBorneTRAIT a ete generee. Code : ${newCardId}`, type: 'CARD', priority: 'NORMAL', metadata: { cardId: newCardId, studentName: student.fullName } }); } catch (e) { console.error('[GeniusPay] notif student failed:', e); }
          if (student.parentId) {
            try { await notifyUser({ schoolId, userId: student.parentId, title: 'Carte Scolaire Enfant Disponible', message: `La carte de votre enfant ${student.fullName} a ete generee.`, type: 'CARD', priority: 'NORMAL', metadata: { cardId: newCardId, studentId: student.id, studentName: student.fullName } }); } catch (e) { console.error('[GeniusPay] notif parent failed:', e); }
          }
        }
      } else if (action === 'generate-single' && userId === 'new-card') {
        // Paiement pour une carte a creer : ouvre un credit d'utilisation.
        // Il sera consomme (et efface) a la creation effectives de l'eleve/prof.
        const credit = buildCardCreditValue(schoolId);
        if (credit) {
          creditCookie = `${CARD_CREDIT_COOKIE}=${credit}; ${cardCreditCookieOptions(Math.floor(CARD_CREDIT_TTL_MS / 1000))}`;
        }
      }
    } catch (e) {
      console.error('Error generating cards in GeniusPay success callback:', e);
    }
  }

  const headers: Record<string, string> = {};
  if (creditCookie) headers['Set-Cookie'] = creditCookie;

  return htmlResponse(
    `<html><head><title>Redirection...</title><script>window.location.href='/?page=admin-cards&payment=success';</script></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f8fafc;"><div style="text-align:center;padding:2rem;background:white;border-radius:1rem;box-shadow:0 4px 6px -1px rgb(0 0 0/0.1);"><div style="font-size:3rem;margin-bottom:1rem;">✅</div><h2 style="color:#1e293b;margin:0 0 0.5rem 0;">Paiement Reussi !</h2><p style="color:#64748b;margin:0 0 1.5rem 0;">${userId === 'new-card' ? 'Votre credit de carte est active. Creez maintenant votre carte.' : 'Vos cartes ont ete generees.'}</p><p style="color:#94a3b8;font-size:0.875rem;">Redirection vers LaBorneTRAIT...</p></div></body></html>`,
    200,
    headers
  );
}
