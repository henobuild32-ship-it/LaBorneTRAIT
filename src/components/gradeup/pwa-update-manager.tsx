'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RefreshCw, CheckCircle2 } from 'lucide-react';
import { APP_VERSION, APP_VERSION_LABEL } from '@/lib/app-version';

const VERSION_KEY = 'gradeup-app-version';

export default function PWAUpdateManager() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);

  const showUpdateNotification = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((serviceWorkerRegistration) => serviceWorkerRegistration.showNotification('Nouvelle mise à jour LaBorneTRAIT', {
          body: `LaBorneTRAIT ${APP_VERSION_LABEL} est disponible ! Cliquez pour mettre à jour.`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'gradeup-update',
          requireInteraction: true,
          data: { url: '/' },
        }))
        .catch(() => {
          // The in-app update dialog remains available when the OS rejects a notification.
        });
    }
  }, []);

  // Check if a new version is available by comparing SW version
  const checkForUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      setRegistration(reg);

      // Check if there's a waiting worker (new version)
      if (reg.waiting) {
        const storedVersion = localStorage.getItem(VERSION_KEY);
        if (storedVersion !== APP_VERSION) {
          setAvailable(true);
          // Show native notification if permission granted
          showUpdateNotification();
        }
      }

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            const storedVersion = localStorage.getItem(VERSION_KEY);
            if (storedVersion !== APP_VERSION) {
              setAvailable(true);
              showUpdateNotification();
            }
          }
        });
      });

      void reg.update();
    } catch {
      // SW not supported
    }
  }, [showUpdateNotification]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // En développement, aucun service worker : il servirait des chunks JS
    // périmés depuis son cache et casserait le rendu (erreurs d'hydratation,
    // composants anciens). On retire les SW résiduels et leurs caches.
    if (process.env.NODE_ENV === 'development') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((reg) => void reg.unregister()));
      if ('caches' in window) {
        // On vide toutes les caches, dont "next-static-js-assets" qui
        // ressert des chunks JS périmés (erreur « row.map is not a function »).
        void caches
          .keys()
          .then((keys) => keys.forEach((key) => void caches.delete(key)))
          .catch(() => undefined);
      }
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
    const initialCheck = window.setTimeout(() => void checkForUpdate(), 0);
    const timer = window.setInterval(() => void checkForUpdate(), 30 * 60 * 1000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(timer);
    };
  }, [checkForUpdate]);

  const applyUpdate = async () => {
    setUpdating(true);
    // Simulate 5-second progress bar
    const started = Date.now();
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        const next = Math.min(100, Math.round(((Date.now() - started) / 5000) * 100));
        setProgress(next);
        if (next >= 100) {
          window.clearInterval(timer);
          resolve();
        }
      }, 80);
    });
    // Store the new version
    localStorage.setItem(VERSION_KEY, APP_VERSION);
    // Tell the SW to skip waiting and reload
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  };

  const handleDismiss = () => {
    setAvailable(false);
  };

  return (
    <Dialog open={available} onOpenChange={(open) => !updating && setAvailable(open)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-blue-600" />
            Nouvelle mise à jour disponible
          </DialogTitle>
          <DialogDescription>
            LaBorneTRAIT {APP_VERSION_LABEL} est prêt à être installé.
          </DialogDescription>
        </DialogHeader>
        {updating ? (
          <div className="space-y-3 py-4">
            <p className="text-sm font-semibold text-center">Mise à jour en cours : {progress}%</p>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-[width] duration-100 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Ne fermez pas cette page pendant la mise à jour...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Corrections de bugs et nouvelles fonctionnalités</span>
            </div>
            <Button onClick={applyUpdate} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Mettre à jour maintenant
            </Button>
            <Button onClick={handleDismiss} variant="ghost" className="w-full" size="sm">
              Plus tard
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
