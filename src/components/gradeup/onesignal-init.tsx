'use client';

import { useEffect } from 'react';
import { ensureWelcomeNotification } from '@/services/onesignal/welcome';

declare global {
  interface Window {
    OneSignal?: any;
    __gradeupOneSignalInit?: boolean;
  }
}

/**
 * OneSignalInit
 * ─────────────────────────────────────────────────────────────────────────────
 * Initialise le SDK OneSignal v16 (push notifications pour mobile + web) lorsque
 * NEXT_PUBLIC_ONESIGNAL_APP_ID est configuré, puis rattache l'utilisateur
 * connecté à son external_id OneSignal (permet l'envoi ciblé serveur).
 * Si la permission de notification est déjà accordée, envoie automatiquement
 * la notification de bienvenue une seule fois.
 */
export default function OneSignalInit({ userId }: { userId: string }) {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    if (!appId) return;
    if (typeof window === 'undefined') return;

    const loadAndInit = async () => {
      // Charge le SDK OneSignal (web). Idempotent.
      if (!window.OneSignal) {
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        script.id = 'onesignal-sdk';
        const loaded = new Promise<boolean>((resolve) => {
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
        });
        document.head.appendChild(script);
        const ok = await loaded;
        if (!ok) return;
      }

      if (!window.OneSignal) return;

      // Init (idempotent — ne fait rien si déjà initialisé)
      try {
        await window.OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          notifyButton: { enable: false },
          welcomeNotification: { enable: false },
        });
        window.__gradeupOneSignalInit = true;
      } catch (e) {
        console.warn('[OneSignal] Init échoué (non bloquant):', e);
        return;
      }

      // Login external id (v16: User.login, fallback: login)
      try {
        if (window.OneSignal.User?.login) {
          await window.OneSignal.User.login(userId);
        } else if (window.OneSignal.login) {
          await window.OneSignal.login(userId);
        }
      } catch (e) {
        console.warn('[OneSignal] Login échoué (non bloquant):', e);
      }

      // URL par défaut pour les clics de notification
      try {
        if (window.OneSignal.Notifications?.setDefaultUrl) {
          window.OneSignal.Notifications.setDefaultUrl('/');
        } else if (window.OneSignal.setDefaultNotificationUrl) {
          window.OneSignal.setDefaultNotificationUrl('/');
        }
      } catch { /* non bloquant */ }

      // Si la permission est déjà accordée, envoyer la bienvenue une seule fois
      try {
        const status = await window.OneSignal.Notifications?.getPermissionStatus?.();
        if (status === 'granted' || status === 'subscribed') {
          await ensureWelcomeNotification(userId);
        }
      } catch { /* non bloquant */ }
    };

    let cancelled = false;
    loadAndInit().catch(() => {});

    return () => { cancelled = true; };
  }, [userId]);

  return null;
}
