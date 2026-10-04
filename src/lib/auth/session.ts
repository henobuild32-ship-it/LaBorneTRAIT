import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  SessionClaims,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './jwt';
import type { UserInfo } from '@/lib/types';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export function serializeUser(user: any, school: any): UserInfo {
  return {
    id: user.id,
    schoolId: user.schoolId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    photoUrl: user.photoUrl,
    parentId: user.parentId,
    parentCode: user.parentCode,
    active: user.active,
    isTitulaire: user.isTitulaire,
    titulaireClassIds: (user.titulaireClasses || []).map((c: any) => c.id),
    school: school
      ? {
          id: school.id,
          name: school.name,
          email: school.email,
          currency: school.currency,
          inviteCode: school.inviteCode,
          subscriptionStatus: school.subscriptionStatus,
          subscriptionExpiry: school.subscriptionExpiry,
          latitude: school.latitude,
          longitude: school.longitude,
        }
      : undefined,
    classEnrollments: (user.classEnrollments || []).map((e: any) => ({
      id: e.id,
      userId: e.userId,
      classId: e.classId,
      class: e.class,
    })),
    children: (user.children || []).map((c: any) => ({
      id: c.id,
      fullName: c.fullName,
      role: c.role,
    })),
  };
}

export function setAuthCookies(response: NextResponse, user: any, school: any): void {
  const claims: SessionClaims = {
    sub: user.id,
    schoolId: user.schoolId,
    role: user.role,
    name: user.fullName,
  };
  response.cookies.set(ACCESS_COOKIE, signAccessToken(claims), cookieOptions(15 * 60));
  response.cookies.set(REFRESH_COOKIE, signRefreshToken(claims), cookieOptions(7 * 24 * 60 * 60));
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, '', { ...cookieOptions(0), maxAge: 0 });
}

export async function getSessionUser(req: NextRequest): Promise<UserInfo | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyAccessToken(token);
  if (!claims) return null;

  const user = await db.user.findUnique({
    where: { id: claims.sub },
    include: {
      school: true,
      classEnrollments: { include: { class: true } },
      children: true,
      titulaireClasses: true,
    },
  });
  if (!user || !user.active) return null;

  return serializeUser(user, user.school);
}

export { verifyRefreshToken };
