'use client';

/**
 * Welcome notification helper (côté client)
 * ─────────────────────────────────────────────────────────────────────────────
 * Envoie une seule fois la notification de bienvenue à l'utilisateur connecté
 * via l'API /api/notifications/welcome (persistée en base + push PWA + OneSignal).
 * Garde une trace en localStorage pour éviter les doublons par utilisateur.
 */

const WELCOME_FLAG_PREFIX = 'gradeup-welcome-sent-';

export function hasWelcomeBeenSent(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(`${WELCOME_FLAG_PREFIX}${userId}`) === '1';
  } catch {
    return true;
  }
}

export function markWelcomeSent(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${WELCOME_FLAG_PREFIX}${userId}`, '1');
  } catch {
    // ignore
  }
}

/**
 * Envoie la notification de bienvenue si elle n'a pas encore été envoyée
 * pour cet utilisateur (vérifie aussi côté serveur, déduplication par metadata).
 */
export async function ensureWelcomeNotification(userId: string): Promise<boolean> {
  if (hasWelcomeBeenSent(userId)) return false;
  try {
    const res = await fetch('/api/notifications/welcome', { method: 'POST' });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (!data.alreadySent) {
        markWelcomeSent(userId);
      } else {
        // Serveur : déjà envoyé → on mémorise pour éviter les appels inutiles
        markWelcomeSent(userId);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
