'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { NotificationInfo } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, CheckCheck, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentNotifications() {
  const user = useAppStore((s) => s.user);
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/notifications?schoolId=${user.schoolId}&targetRole=STUDENT`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Safe, flexible parsing supporting both flat array and object formats
      const rawList = Array.isArray(data) ? data : (Array.isArray(data?.notifications) ? data.notifications : []);
      const sorted = [...rawList].sort((a: NotificationInfo, b: NotificationInfo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(sorted);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user?.schoolId]);

  useEffect(() => { setLoading(true); fetchNotifications(); }, [fetchNotifications]);

  // Setup auto-update listeners for active page
  useEffect(() => {
    window.addEventListener('gradeup-notification', fetchNotifications);
    return () => {
      window.removeEventListener('gradeup-notification', fetchNotifications);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notif: NotificationInfo) => {
    if (notif.read) return;
    try {
      const res = await fetch(`/api/notifications/${notif.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) });
      if (res.ok) { 
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))); 
        toast.success('Notification marquée comme lue');
        // Notify the layout shell to refresh badge count
        window.dispatchEvent(new CustomEvent('gradeup-notification-read'));
      }
    } catch { toast.error('Impossible de marquer la notification comme lue'); }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Toutes les notifications ont été marquées comme lues');
      // Notify the layout shell to refresh badge count
      window.dispatchEvent(new CustomEvent('gradeup-notification-read'));
    } catch { toast.error('Impossible de marquer toutes les notifications'); }
  };

  const formatRelativeTime = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Mes notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">{unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Aucune notification non lue'}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-all gap-1.5">
              <CheckCheck className="h-4 w-4" />Tout marquer comme lu
            </Button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4"><BellOff className="h-12 w-12 text-muted-foreground/50" /></div>
          <h3 className="text-xl font-semibold mb-2">Aucune notification</h3>
          <p className="text-muted-foreground">Vous n&apos;avez pas encore reçu de notifications.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-3">
            {notifications.map((notif) => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-all hover:shadow-md ${!notif.read ? 'border-blue-300 bg-gradient-to-r from-blue-50/80 to-white' : ''}`}
                onClick={() => markAsRead(notif)}
              >
                <CardContent className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${notif.read ? 'bg-muted' : 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-sm shadow-blue-500/25'}`}>
                    <Bell className={`h-5 w-5 ${notif.read ? 'text-muted-foreground' : 'text-white'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-relaxed break-words ${notif.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>{notif.message}</p>
                      {!notif.read && <div className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0 mt-1.5 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">{formatRelativeTime(notif.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
