import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/lib/auth/jwt';

const claims = {
  sub: 'user-123',
  schoolId: 'school-456',
  role: 'ADMIN',
  name: 'Administrateur Test',
};

/** Construit un jeton d'accès dont l'exp est déjà passé, avec une signature valide. */
function signExpiredAccessToken(payload: Record<string, unknown>, expEpochSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: expEpochSeconds - 900, exp: expEpochSeconds })
  ).toString('base64url');
  const secret = process.env.JWT_SECRET || 'gradeup-dev-access-secret-change-me';
  const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('auth-flow : hachage des mots de passe (scrypt)', () => {
  it('hache un mot de passe au format scrypt$salt:hash', async () => {
    const stored = await hashPassword('admin1234');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored.split('$')[1]).toContain(':');
  });

  it('deux hachages du même mot de passe diffèrent (sel aléatoire)', async () => {
    const a = await hashPassword('admin1234');
    const b = await hashPassword('admin1234');
    expect(a).not.toBe(b);
  });

  it('vérifie le bon mot de passe et rejette le mauvais', async () => {
    const stored = await hashPassword('admin1234');
    await expect(verifyPassword('admin1234', stored)).resolves.toBe(true);
    await expect(verifyPassword('mauvais-mdp', stored)).resolves.toBe(false);
  });

  it('rejette tout mot de passe si le hash est absent ou vide', async () => {
    await expect(verifyPassword('admin1234', null)).resolves.toBe(false);
    await expect(verifyPassword('admin1234', undefined)).resolves.toBe(false);
    await expect(verifyPassword('admin1234', '')).resolves.toBe(false);
  });

  it('rejette un hash corrompu sans planter', async () => {
    await expect(verifyPassword('admin1234', 'scrypt$invalide')).resolves.toBe(false);
    await expect(verifyPassword('admin1234', 'scrypt$abc:def')).resolves.toBe(false);
  });

  it('reste compatible avec les mots de passe stockés en clair (legacy)', async () => {
    await expect(verifyPassword('legacy123', 'legacy123')).resolves.toBe(true);
    await expect(verifyPassword('autre', 'legacy123')).resolves.toBe(false);
  });
});

describe('auth-flow : sessions JWT', () => {
  it('produit et vérifie un jeton d’accès', () => {
    const token = signAccessToken(claims);
    const verified = verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(claims.sub);
    expect(verified?.schoolId).toBe(claims.schoolId);
    expect(verified?.role).toBe(claims.role);
  });

  it('refuse un jeton d’accès dont la signature a été altérée', () => {
    const token = signAccessToken(claims);
    const tampered = `${token.slice(0, -3)}aaa`;
    expect(verifyAccessToken(tampered)).toBeNull();
  });

  it('refuse un jeton de refresh utilisé comme jeton d’accès (secret distinct)', () => {
    const refreshToken = signRefreshToken(claims);
    expect(verifyAccessToken(refreshToken)).toBeNull();
    expect(verifyRefreshToken(refreshToken)).not.toBeNull();
  });

  it('refuse un jeton arbitraire ou mal formé', () => {
    expect(verifyAccessToken('n.importe.quoi')).toBeNull();
    expect(verifyAccessToken('')).toBeNull();
    expect(verifyAccessToken('a.b')).toBeNull();
    expect(verifyAccessToken('a.b.c.d')).toBeNull();
  });

  it('refuse un jeton expiré', () => {
    const expired = signExpiredAccessToken(claims, Math.floor(Date.now() / 1000) - 3600);
    expect(verifyAccessToken(expired)).toBeNull();
  });
});
