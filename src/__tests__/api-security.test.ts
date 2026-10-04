import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    school: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    payment: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('@/services/notifications/notificationEngine', () => ({
  notifyUser: vi.fn().mockResolvedValue(undefined),
}));

import { db } from '@/lib/db';
import {
  bearerMatchesSystemSecret,
  getBearerToken,
  systemSecretMatches,
} from '@/lib/auth/system-secret';
import {
  CARD_CALLBACK_MAX_AGE_MS,
  buildCardCreditValue,
  cardCreditCookieOptions,
  getPaymentId,
  isCardCreditValueValid,
  signCardCallback,
  verifyCardCallback,
} from '@/lib/payment-callback';
import { GET as dbHealthGET, POST as dbHealthPOST } from '@/app/api/admin/db-health/route';
import { GET as fixSubscriptionGET } from '@/app/api/admin/fix-subscription/route';
import { GET as successGET } from '@/app/api/payments/pawapay/success/route';

const ADMIN_SECRET = 'vitest-admin-api-secret';
const HEALTH_SECRET = 'vitest-healthcheck-secret';

type AnyMock = ReturnType<typeof vi.fn>;
const dbMocks = {
  userFindUnique: db.user.findUnique as unknown as AnyMock,
  userUpdate: db.user.update as unknown as AnyMock,
  paymentCreate: db.payment.create as unknown as AnyMock,
};

function request(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers });
}

function signedSuccessUrl(params: {
  schoolId?: string | null;
  action?: string | null;
  classId?: string | null;
  userId?: string | null;
}): string {
  const signature = signCardCallback(params);
  if (!signature) throw new Error('signature impossible');
  const url = new URL('http://localhost/api/payments/pawapay/success');
  for (const [key, value] of Object.entries(params)) {
    if (value !== null) url.searchParams.set(key, value);
  }
  url.searchParams.set('ts', signature.ts);
  url.searchParams.set('sgn', signature.sgn);
  return url.toString();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  dbMocks.userFindUnique.mockReset();
  dbMocks.userFindUnique.mockResolvedValue(null);
  dbMocks.userUpdate.mockClear();
  dbMocks.paymentCreate.mockClear();
});

describe('api-security : secrets système (header Bearer uniquement)', () => {
  it('lit le jeton du header Authorization', () => {
    expect(getBearerToken(new Request('http://localhost', { headers: { authorization: 'Bearer abc' } }))).toBe('abc');
    expect(getBearerToken(new Request('http://localhost', { headers: { authorization: 'bearer abc' } }))).toBeNull();
    expect(getBearerToken(new Request('http://localhost'))).toBeNull();
    expect(getBearerToken(new Request('http://localhost', { headers: { authorization: 'Bearer ' } }))).toBeNull();
  });

  it('accepte uniquement un secret configuré (fail-closed)', () => {
    expect(systemSecretMatches(ADMIN_SECRET, [ADMIN_SECRET])).toBe(true);
    expect(systemSecretMatches('mauvais', [ADMIN_SECRET])).toBe(false);
    expect(systemSecretMatches(ADMIN_SECRET, [undefined, null])).toBe(false);
    expect(systemSecretMatches('', [ADMIN_SECRET])).toBe(false);
    expect(systemSecretMatches(ADMIN_SECRET, [])).toBe(false);
  });

  it('ne retombe jamais sur JWT_SECRET pour un secret système', () => {
    const jwtSecret = process.env.JWT_SECRET as string;
    expect(systemSecretMatches(jwtSecret, [ADMIN_SECRET, HEALTH_SECRET])).toBe(false);
  });

  it('fonctionne à partir d’une NextRequest', () => {
    const req = request('http://localhost/x', { authorization: `Bearer ${HEALTH_SECRET}` });
    expect(bearerMatchesSystemSecret(req, [HEALTH_SECRET])).toBe(true);
    expect(bearerMatchesSystemSecret(req, [ADMIN_SECRET])).toBe(false);
  });
});

describe('api-security : /api/admin/db-health', () => {
  it('refuse sans header d’autorisation', async () => {
    const res = await dbHealthGET(request('http://localhost/api/admin/db-health'));
    expect(res.status).toBe(401);
  });

  it('refuse le secret passé en query string (?secret=)', async () => {
    const res = await dbHealthGET(
      request(`http://localhost/api/admin/db-health?secret=${HEALTH_SECRET}`)
    );
    expect(res.status).toBe(401);
  });

  it('refuse un mauvais jeton', async () => {
    const res = await dbHealthGET(
      request('http://localhost/api/admin/db-health', { authorization: 'Bearer wrong-token' })
    );
    expect(res.status).toBe(401);
  });

  it('accepte la clé dédiée transmise en Bearer', async () => {
    const res = await dbHealthGET(
      request('http://localhost/api/admin/db-health', { authorization: `Bearer ${HEALTH_SECRET}` })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalSchools).toBe(0);
  });

  it('le POST accepte aussi uniquement le header Bearer', async () => {
    const denied = await dbHealthPOST(request('http://localhost/api/admin/db-health'));
    expect(denied.status).toBe(401);

    const allowed = await dbHealthPOST(
      request('http://localhost/api/admin/db-health', { authorization: `Bearer ${ADMIN_SECRET}` })
    );
    expect(allowed.status).toBe(200);
  });
});

describe('api-security : /api/admin/fix-subscription', () => {
  it('refuse sans jeton', async () => {
    const res = await fixSubscriptionGET(request('http://localhost/api/admin/fix-subscription'));
    expect(res.status).toBe(401);
  });

  it('refuse un jeton qui n’est pas la clé système dédiée', async () => {
    const res = await fixSubscriptionGET(
      request('http://localhost/api/admin/fix-subscription', { authorization: 'Bearer pas-la-bonne-cle' })
    );
    expect(res.status).toBe(401);
  });

  it('n’accepte plus JWT_SECRET en fallback', async () => {
    const res = await fixSubscriptionGET(
      request('http://localhost/api/admin/fix-subscription', {
        authorization: `Bearer ${process.env.JWT_SECRET}`,
      })
    );
    expect(res.status).toBe(401);
  });

  it('accepte ADMIN_API_SECRET dédié', async () => {
    const res = await fixSubscriptionGET(
      request('http://localhost/api/admin/fix-subscription', { authorization: `Bearer ${ADMIN_SECRET}` })
    );
    expect(res.status).toBe(200);
  });
});

describe('api-security : callback GeniusPay', () => {
  it('accepte une callback signée par notre serveur (crédit de carte)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const url = signedSuccessUrl({ schoolId: 'school-1', action: 'generate-single', userId: 'new-card' });
    const res = await successGET(new NextRequest(url));
    expect(res.status).toBe(200);
    const cookie = res.headers.get('set-cookie') || '';
    expect(cookie).toContain('gp_paid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Path=/api');
  });

  it('rejette une callback forgée sans signature (403 en production)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await successGET(
      new NextRequest('http://localhost/api/payments/pawapay/success?schoolId=school-1&action=generate-single&userId=new-card')
    );
    expect(res.status).toBe(403);
  });

  it('rejette une signature dont les paramètres ont été modifiés', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const url = signedSuccessUrl({ schoolId: 'school-1', action: 'generate-single', userId: 'new-card' });
    const tampered = url.replace('userId=new-card', 'userId=autre-eleve');
    const res = await successGET(new NextRequest(tampered));
    expect(res.status).toBe(403);
  });

  it('rejette une callback dont le paiement est confirmé "pending" par GeniusPay', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GENIUSPAY_API_KEY', 'pk_live_test');
    vi.stubEnv('GENIUSPAY_API_SECRET', 'sk_live_test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { status: 'pending', amount: 10, currency: 'USD' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const url = `${signedSuccessUrl({
      schoolId: 'school-1',
      action: 'generate-single',
      userId: 'new-card',
    })}&payment_id=pay_123`;
    const res = await successGET(new NextRequest(url));
    expect(res.status).toBe(403);
  });

  it('accepte une callback dont GeniusPay confirme le paiement COMPLETED', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('GENIUSPAY_API_KEY', 'pk_live_test');
    vi.stubEnv('GENIUSPAY_API_SECRET', 'sk_live_test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { status: 'completed', amount: 10, currency: 'USD' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const res = await successGET(
      new NextRequest('http://localhost/api/payments/pawapay/success?schoolId=school-1&action=generate-single&userId=new-card&payment_id=pay_456')
    );
    expect(res.status).toBe(200);
  });

  it('enregistre un paiement PAYÉ pour chaque carte générée', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    dbMocks.userFindUnique.mockImplementation((args: { where: { id?: string; cardId?: string } }) => {
      if (args.where?.id) {
        return Promise.resolve({
          id: args.where.id,
          fullName: 'Élève Test',
          schoolId: 'school-1',
          parentId: null,
        });
      }
      return Promise.resolve(null);
    });

    const url = signedSuccessUrl({
      schoolId: 'school-1',
      action: 'generate-single',
      userId: 'student-1',
    });
    const res = await successGET(new NextRequest(url));
    expect(res.status).toBe(200);

    expect(dbMocks.paymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: 'school-1',
          studentId: 'student-1',
          status: 'paid',
          amount: 10,
          method: 'geniuspay',
        }),
      })
    );
    expect(dbMocks.userUpdate).toHaveBeenCalled();
  });

  it('reste accessible sans signature hors production (dev uniquement)', async () => {
    const res = await successGET(
      new NextRequest('http://localhost/api/payments/pawapay/success?schoolId=school-1&action=generate-single&userId=new-card')
    );
    expect(res.status).toBe(200);
  });
});

describe('api-security : signatures de callback', () => {
  const fields = { schoolId: 'school-1', action: 'generate-single', userId: 'new-card' };

  it('valide une signature fraîche', () => {
    const now = Date.now();
    const signed = signCardCallback(fields, now);
    expect(signed).not.toBeNull();
    expect(verifyCardCallback({ ...fields, ...signed }, now)).toBe(true);
  });

  it('rejette une signature absente ou altérée', () => {
    const now = Date.now();
    const signed = signCardCallback(fields, now);
    expect(verifyCardCallback(fields, now)).toBe(false);
    expect(verifyCardCallback({ ...fields, ...signed, sgn: 'beef' }, now)).toBe(false);
    expect(verifyCardCallback({ ...fields, schoolId: 'school-2', ...signed }, now)).toBe(false);
  });

  it('expire après 15 minutes (anti-rejeu)', () => {
    const now = Date.now();
    const signed = signCardCallback(fields, now);
    expect(verifyCardCallback({ ...fields, ...signed }, now + CARD_CALLBACK_MAX_AGE_MS + 1000)).toBe(false);
    expect(verifyCardCallback({ ...fields, ...signed }, now + 60_000)).toBe(true);
  });

  it('rejette une signature datée dans le futur (trop lointain)', () => {
    const now = Date.now();
    const signed = signCardCallback(fields, now);
    expect(verifyCardCallback({ ...fields, ...signed }, now - 10 * 60_000)).toBe(false);
  });

  it('reconnaît les alias d’identifiant de paiement', () => {
    expect(getPaymentId(new URLSearchParams('payment_id=pay_1'))).toBe('pay_1');
    expect(getPaymentId(new URLSearchParams('paymentId=pay_2'))).toBe('pay_2');
    expect(getPaymentId(new URLSearchParams('reference=pay_3'))).toBe('pay_3');
    expect(getPaymentId(new URLSearchParams('userId=new-card'))).toBeNull();
    expect(getPaymentId(new URLSearchParams('a=1'))).toBeNull();
  });
});

describe('api-security : crédit de paiement (cookie gp_paid)', () => {
  it('valide un crédit émis pour la bonne école', () => {
    const value = buildCardCreditValue('school-1');
    expect(value).not.toBeNull();
    expect(isCardCreditValueValid(value, 'school-1')).toBe(true);
  });

  it('refuse un crédit pour une autre école', () => {
    const value = buildCardCreditValue('school-1');
    expect(isCardCreditValueValid(value, 'school-2')).toBe(false);
  });

  it('refuse un crédit expiré', () => {
    const now = Date.now();
    const value = buildCardCreditValue('school-1', now) as string;
    expect(isCardCreditValueValid(value, 'school-1', now + 31 * 60_000)).toBe(false);
  });

  it('refuse un crédit falsifié ou absent', () => {
    expect(isCardCreditValueValid('school-1.99999999999999.abc', 'school-1')).toBe(false);
    expect(isCardCreditValueValid('school-1.99999999999999', 'school-1')).toBe(false);
    expect(isCardCreditValueValid(null, 'school-1')).toBe(false);
    expect(isCardCreditValueValid(undefined, 'school-1')).toBe(false);
  });

  it('fabrique des attributs de cookie httpOnly et limités à /api', () => {
    const options = cardCreditCookieOptions(1800);
    expect(options).toContain('HttpOnly');
    expect(options).toContain('Path=/api');
    expect(options).toContain('Max-Age=1800');
    expect(options).not.toContain('Secure');
  });
});
