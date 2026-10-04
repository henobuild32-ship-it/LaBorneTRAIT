'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { NotificationInfo } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, CheckCheck, Clock, BookOpen, FileText, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function TeacherNotifications() {
  const user = useAppStore((s) => s.user);
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const fetchNotifications = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/notifications?schoolId=${user.schoolId}&targetRole=TEACHER`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : (Array.isArray(data?.notifications) ? data.notifications : []);
      const sorted = [...rawList].sort((a: NotificationInfo, b: NotificationInfo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(sorted);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user?.schoolId]);

  useEffect(() => { setLoading(true); fetchNotifications(); }, [fetchNotifications]);

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

  const getNotifIcon = (type?: string) => {
    switch (type) {
      case 'MESSAGE': return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'HOMEWORK_SUBMISSION': return <FileText className="h-5 w-5 text-indigo-500" />;
      case 'LESSON': return <BookOpen className="h-5 w-5 text-emerald-500" />;
      case 'ATTENDANCE': return <AlertCircle className="h-5 w-5 text-amber-500" />;
      default: return <Bell className="h-5 w-5 text-blue-500" />;
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'UNREAD') return !n.read;
    return (n as any).type === filterType;
  });

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
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-6 text-white shadow-xl shadow-blue-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/20 backdrop-blur-md shrink-0">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications Enseignant</h1>
              <p className="text-sm text-blue-100 mt-0.5">
                {unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Toutes les notifications sont à jour'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="bg-white/10 hover:bg-white/20 border-white/30 text-white text-xs gap-1.5"
            >
              <CheckCheck className="h-4 w-4" /> Tout marquer comme lu
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {[
          { id: 'ALL', label: 'Toutes' },
          { id: 'UNREAD', label: `Non lues (${unreadCount})` },
          { id: 'MESSAGE', label: 'Messages' },
          { id: 'HOMEWORK_SUBMISSION', label: 'Devoirs rendus' },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={filterType === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType(tab.id)}
            className={`text-xs rounded-full ${filterType === tab.id ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {filteredNotifications.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <BellOff className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Aucune notification</h3>
          <p className="text-xs text-muted-foreground">Vous n&apos;avez pas de notifications correspondant à ce filtre.</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[650px]">
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <Card
                key={notif.id}
                className={`cursor-pointer transition-all hover:shadow-md border ${
                  !notif.read
                    ? 'border-blue-300 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'bg-card'
                }`}
                onClick={() => markAsRead(notif)}
              >
                <CardContent className="p-4 flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl shrink-0 ${notif.read ? 'bg-muted' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                    {getNotifIcon((notif as any).type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {(notif as any).title && (
                          <h4 className={`max-w-full break-words whitespace-normal text-sm font-semibold mb-0.5 ${notif.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {(notif as any).title}
                          </h4>
                        )}
                        <p className={`max-w-full break-words whitespace-normal text-xs leading-relaxed ${notif.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {notif.message}
                        </p>
                      </div>
                      {!notif.read && (
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600 shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <p className="text-[11px] text-muted-foreground">{formatRelativeTime(notif.createdAt)}</p>
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
