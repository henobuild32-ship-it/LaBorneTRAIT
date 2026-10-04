import { useAppStore } from '@/lib/store';

// ------------------------------------------------------------------
// Maintien de la session :
//   - le jeton d'accès expire après 15 min (cookie `gradeup_token`),
//   - le client n'avait AUCUN mécanisme de renouvellement automatique :
//     `hydrateSession` ne s'exécute qu'au chargement de la page.
//   Résultat : après 15 min d'utilisation, toutes les requêtes /api
//   répondaient 401 et les modules semblaient « ne plus marcher ».
//   Ici on :
//     1. intercepte fetch() et, sur 401 d'une API, on rafraîchit la
//        session une fois puis on rejoue la requête (une seule fois) ;
//     2. rafraîchit la session toutes les 10 min tant qu'un utilisateur
//        est connecté (garde aussi vivant le flux EventSource).
// ------------------------------------------------------------------

const PROACTIVE_INTERVAL_MS = 10 * 60 * 1000;

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

let refreshInFlight: Promise<boolean> | null = null;
let proactiveTimer: ReturnType<typeof setInterval> | null = null;
let rawFetch: typeof fetch | null = null;

function absoluteUrl(input: FetchInput): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

function isApiUrl(url: string): boolean {
  if (url.startsWith('/api/')) return true;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function isAuthUrl(url: string): boolean {
  return /\/api\/auth\//.test(url);
}

export function refreshSession(): Promise<boolean> {
  if (!rawFetch) return Promise.resolve(false);
  if (!refreshInFlight) {
    const attempt = rawFetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((res) => res.ok)
      .catch(() => false);
    refreshInFlight = attempt;
    attempt.finally(() => {
      if (refreshInFlight === attempt) refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function startProactiveRefresh() {
  if (proactiveTimer !== null) return;
  proactiveTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!useAppStore.getState().user) return;
    void refreshSession();
  }, PROACTIVE_INTERVAL_MS);
}

export function installSessionAutoRefresh() {
  if (typeof window === 'undefined') return;
  if (rawFetch) return;

  rawFetch = window.fetch.bind(window);

  window.fetch = async (input: FetchInput, init?: FetchInit) => {
    const response = await rawFetch!(input, init);
    try {
      if (response.status !== 401) return response;

      const url = absoluteUrl(input);
      if (!isApiUrl(url) || isAuthUrl(url)) return response;
      // Une requête déjà rafraîchie n'est pas rafraîchie une seconde fois.
      if (init && (init as { __retried?: boolean }).__retried) return response;

      if (!(await refreshSession())) return response;

      const retryInit: FetchInit = { ...(init || {}), credentials: 'include' };
      (retryInit as { __retried?: boolean }).__retried = true;
      try {
        return await rawFetch!(input, retryInit);
      } catch {
        return response;
      }
    } catch {
      return response;
    }
  };

  startProactiveRefresh();
}
