'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff } from 'lucide-react';

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

const getSnapshot = () => navigator.onLine;
const getServerSnapshot = () => true;

export default function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 lg:bottom-6 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/95 px-4 py-2 text-xs font-semibold text-amber-950 shadow-lg backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Hors ligne — vos données restent disponibles hors connexion
    </div>
  );
}
