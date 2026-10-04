/**
 * OneSignal sender (côté serveur)
 * ─────────────────────────────────────────────────────────────────────────────
 * Envoie des notifications push OneSignal via l'API REST, en ciblant les
 * external_ids (user ids LaBorneTRAIT) ou bien tous les appareils de l'application.
 *
 * Variables d'environnement :
 *   NEXT_PUBLIC_ONESIGNAL_APP_ID
 *   ONESIGNAL_REST_API_KEY
 */

const ONESIGNAL_ENDPOINT = 'https://onesignal.com/api/v1/notifications';
const oneSignalApiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_REST_API;

function isConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID && !!oneSignalApiKey;
}

export interface OneSignalPayload {
  title: string;
  message: string;
  url?: string;
  data?: Record<string, unknown>;
}

async function callOneSignal(body: Record<string, unknown>): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const res = await fetch(ONESIGNAL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${oneSignalApiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.warn('[OneSignal] Envoi refusé:', res.status, await res.text().catch(() => ''));
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[OneSignal] Erreur réseau (non bloquant):', error);
    return false;
  }
}

/**
 * Envoie une notification ciblée à des utilisateurs précis (par external_id).
 */
export async function sendOneSignalToUserIds(
  userIds: string[],
  payload: OneSignalPayload
): Promise<boolean> {
  const uniqueIds = Array.from(new Set(userIds)).filter(Boolean);
  if (uniqueIds.length === 0 || !isConfigured()) return false;
  return callOneSignal({
    app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    include_aliases: { external_id: uniqueIds },
    target_channel: 'push',
    headings: { en: payload.title, fr: payload.title },
    contents: { en: payload.message, fr: payload.message },
    url: payload.url || '/',
    data: payload.data || {},
    chrome_web_icon: '/icons/icon-192x192.png',
    safari_icon: '/icons/icon-192x192.png',
  });
}

/**
 * Envoie une notification à tous les appareils abonnés de l'application.
 */
export async function sendOneSignalBroadcast(
  payload: OneSignalPayload
): Promise<boolean> {
  if (!isConfigured()) return false;
  return callOneSignal({
    app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
    included_segments: ['All'],
    headings: { en: payload.title, fr: payload.title },
    contents: { en: payload.message, fr: payload.message },
    url: payload.url || '/',
    data: payload.data || {},
    chrome_web_icon: '/icons/icon-192x192.png',
  });
}

/**
 * Désinscrit/retire un utilisateur de OneSignal (au logout).
 */
export async function deleteOneSignalUser(userId: string): Promise<boolean> {
  if (!isConfigured() || !userId) return false;
  try {
    const res = await fetch(
      `https://api.onesignal.com/apps/${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID}/users/by/external_id/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Basic ${oneSignalApiKey}` },
      }
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}