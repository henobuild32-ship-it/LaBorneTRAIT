import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyRefreshToken,
  signAccessToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SessionClaims,
} from '@/lib/auth/jwt';
import { serializeUser } from '@/lib/auth/session';

export const runtime = 'nodejs';

function cookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSec,
  };
}

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
    }

    const claims = verifyRefreshToken(refreshToken) as SessionClaims | null;
    if (!claims) {
      return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: claims.sub },
      include: { school: true, classEnrollments: { include: { class: true } }, children: true },
    });
    if (!user || !user.active) {
      return NextResponse.json({ error: 'Compte introuvable.' }, { status: 401 });
    }

    const newAccessToken = signAccessToken({
      sub: user.id,
      schoolId: user.schoolId,
      role: user.role,
      name: user.fullName,
    });

    const response = NextResponse.json({ user: serializeUser(user, user.school), ok: true });
    response.cookies.set(ACCESS_COOKIE, newAccessToken, cookieOptions(15 * 60));
    return response;
  } catch (error) {
    console.error('Error in /api/auth/refresh:', error);
    return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
  }
}
