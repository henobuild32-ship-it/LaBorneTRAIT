import { createHmac, timingSafeEqual } from 'crypto';

const isProd = process.env.NODE_ENV === 'production';

function requiredSecret(name: string, devFallback: string): string {
  if (isProd && !process.env[name]) {
    throw new Error(`Variable d'environnement manquante en production : ${name}`);
  }
  return process.env[name] || devFallback;
}

const ACCESS_SECRET = requiredSecret('JWT_SECRET', 'gradeup-dev-access-secret-change-me');
const REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET', 'gradeup-dev-refresh-secret-change-me');

const ACCESS_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 jours

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: Record<string, unknown>, secret: string, expiresInSec: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSec };
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verify(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (typeof decoded.exp === 'number' && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface SessionClaims {
  sub: string;
  schoolId: string;
  role: string;
  name: string;
}

export function signAccessToken(claims: SessionClaims): string {
  return sign({ ...claims }, ACCESS_SECRET, ACCESS_TTL_SECONDS);
}

export function signRefreshToken(claims: SessionClaims): string {
  return sign({ ...claims }, REFRESH_SECRET, REFRESH_TTL_SECONDS);
}

export function verifyAccessToken(token: string): SessionClaims | null {
  const decoded = verify(token, ACCESS_SECRET);
  if (!decoded || !decoded.sub) return null;
  return decoded as unknown as SessionClaims;
}

export function verifyRefreshToken(token: string): SessionClaims | null {
  const decoded = verify(token, REFRESH_SECRET);
  if (!decoded || !decoded.sub) return null;
  return decoded as unknown as SessionClaims;
}

export const ACCESS_COOKIE = 'gradeup_token';
export const REFRESH_COOKIE = 'gradeup_refresh';
