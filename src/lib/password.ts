import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const PREFIX = 'scrypt$';

/**
 * Hache un mot de passe avec scrypt (sel aléatoire de 16 octets).
 * Format stocké : `scrypt$<saltHex>:<hashHex>`.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${PREFIX}${salt}:${derived.toString('hex')}`;
}

/**
 * Vérifie un mot de passe contre la valeur stockée.
 * Rétro-compatible avec le format scrypt (scrypt$salt:hash), scrypt$salt$hash et legacy en clair.
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;

  // Mot de passe en clair (legacy / dev)
  if (!stored.startsWith(PREFIX)) {
    return stored === password;
  }

  // Extraire la partie après 'scrypt$'
  const rest = stored.slice(PREFIX.length);
  // Séparer par ':' ou par '$' pour une compatibilité maximale
  const parts = rest.includes(':') ? rest.split(':') : rest.split('$');
  
  if (parts.length < 2) return false;

  const [salt, hash] = parts;
  if (!salt || !hash) return false;

  try {
    const derived = (await scryptAsync(password, salt, 64)) as Buffer;
    const hashBuf = Buffer.from(hash, 'hex');
    if (derived.length !== hashBuf.length) return false;
    return timingSafeEqual(derived, hashBuf);
  } catch (error) {
    console.error('[PasswordVerify] Scrypt error:', error);
    return false;
  }
}
