import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Retourne le jeton porté par le header `Authorization: Bearer <token>`.
 * Les secrets système ne sont JAMAIS acceptés via query string ni body
 * (ils fuitent dans les logs, l'historique et les referers).
 */
export function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

/**
 * Compare un jeton fourni à une liste de secrets système autorisés.
 * Fail-closed : sans secret configuré, rien n'est accepté.
 */
export function systemSecretMatches(
  provided: string | null | undefined,
  allowed: Array<string | undefined | null>
): boolean {
  if (!provided) return false;
  return allowed.some((candidate) => Boolean(candidate) && safeEqual(provided, candidate as string));
}

export function bearerMatchesSystemSecret(
  request: Request,
  allowed: Array<string | undefined | null>
): boolean {
  return systemSecretMatches(getBearerToken(request), allowed);
}
