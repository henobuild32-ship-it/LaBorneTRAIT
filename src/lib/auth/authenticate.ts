import { NextRequest } from 'next/server';
import { verifyAccessToken, ACCESS_COOKIE } from './jwt';
import { db } from '@/lib/db';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

export interface AuthUser {
  userId: string;
  schoolId: string;
  role: string;
  name: string;
}

export function authenticateRequest(req: NextRequest): AuthUser {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) throw new AuthError('Non authentifié. Veuillez vous connecter.', 401);

  const claims = verifyAccessToken(token);
  if (!claims) throw new AuthError('Session expirée ou invalide. Veuillez vous reconnecter.', 401);

  return {
    userId: claims.sub,
    schoolId: claims.schoolId,
    role: claims.role,
    name: claims.name,
  };
}

/**
 * Comme authenticateRequest, mais vérifie en base que le compte est toujours actif.
 * Utiliser dans les routes sensibles (admin, finances, etc.).
 */
export async function authenticateRequestActive(req: NextRequest): Promise<AuthUser> {
  const auth = authenticateRequest(req);
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, active: true, deletedAt: true },
  });
  if (!user || user.active === false || user.deletedAt) {
    throw new AuthError('Compte désactivé ou supprimé. Veuillez contacter l’administrateur.', 403);
  }
  return auth;
}
