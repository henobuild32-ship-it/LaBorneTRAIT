'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { flushOfflineQueue } from '@/lib/offline-sync';

export default function OfflineSyncManager() {
  // Assume online on the server and on the first client render: Node exposes a
  // `navigator` global without `onLine`, which would render the offline banner
  // during SSR and break hydration. The effect below syncs the real value.
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const result = await flushOfflineQueue();
      setPending(result.pending);
      if (result.synced > 0) window.dispatchEvent(new Event('gradeup-offline-synced'));
    };

    const handleOffline = () => setOnline(false);
    const handleQueued = () => setPending((count) => count + 1);
    void sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('gradeup-offline-queued', handleQueued);
    const interval = window.setInterval(sync, 30000);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('gradeup-offline-queued', handleQueued);
      window.clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) return null;

  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs shadow-lg">
      {online ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      <span>{online ? `${pending} opération(s) en attente` : 'Mode hors ligne'}</span>
      {online ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : null}
    </div>
  );
}