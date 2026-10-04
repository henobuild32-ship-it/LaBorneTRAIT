'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { NotificationInfo } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, BellOff, CheckCheck, Clock, CircleDot, MessageSquare, AlertCircle, Info } from 'lucide-react';
import { toast } from 'sonner';

export default function ParentNotifications() {
  const { user } = useAppStore();
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const schoolId = user?.schoolId || '';

  const fetchNotifications = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?schoolId=${schoolId}&targetRole=PARENT`);
      if (res.ok) { 
        const data = await res.json();
        // Safe, flexible parsing supporting both flat array and object formats
        const rawList = Array.isArray(data) ? data : (Array.isArray(data?.notifications) ? data.notifications : []);
        setNotifications(rawList);
      } else {
        setNotifications([]);
      }
    } catch { 
      toast.error('Erreur lors du chargement des notifications');
      setNotifications([]);
    } finally { 
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Setup auto-update listeners for active page
  useEffect(() => {
    window.addEventListener('gradeup-notification', fetchNotifications);
    return () => {
      window.removeEventListener('gradeup-notification', fetchNotifications);
    };
  }, [fetchNotifications]);

  const markAsRead = async (notifId: string) => {
    const notif = Array.isArray(notifications) ? notifications.find(n => n.id === notifId) : undefined;
    if (!notif || notif.read) return;
    setMarkingId(notifId);
    try {
      const res = await fetch(`/api/notifications/${notifId}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ read: true }) 
      });
      if (res.ok) { 
        setNotifications(prev => Array.isArray(prev) ? prev.map(n => (n.id === notifId ? { ...n, read: true } : n)) : []); 
        toast.success('Notification marquée comme lue'); 
        // Notify layout bell count badge to decrement
        window.dispatchEvent(new CustomEvent('gradeup-notification-read'));
      }
    } catch { 
      toast.error('Erreur lors de la mise à jour'); 
    } finally { 
      setMarkingId(null); 
    }
  };

  const markAllAsRead = async () => {
    const unread = Array.isArray(notifications) ? notifications.filter(n => !n.read) : [];
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ read: true }) 
      })));
      setNotifications(prev => Array.isArray(prev) ? prev.map(n => ({ ...n, read: true })) : []);
      toast.success(`${unread.length} notification(s) marquée(s) comme lue(s)`);
      // Notify layout bell count badge to reset
      window.dispatchEvent(new CustomEvent('gradeup-notification-read'));
    } catch { 
      toast.error('Erreur lors de la mise à jour'); 
    }
  };

  const sortedNotifications = Array.isArray(notifications) 
    ? [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0;
  const readCount = Array.isArray(notifications) ? notifications.filter(n => n.read).length : 0;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Aujourd'hui";
    if (days === 1) return 'Hier';
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const getNotifIcon = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('urgent') || lower.includes('important') || lower.includes('retard')) 
      return <AlertCircle className="size-4 text-red-500" />;
    if (lower.includes('info') || lower.includes('rappel') || lower.includes('annonce')) 
      return <Info className="size-4 text-blue-500" />;
    return <MessageSquare className="size-4 text-muted-foreground" />;
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Messages et annonces de l&apos;école</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-2 text-blue-600 border-blue-200 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <CheckCheck className="size-4" />Tout marquer comme lu
            </Button>
          )}
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3 border-blue-200 text-blue-600">
          <CircleDot className="size-3.5" />{unreadCount} non lue{unreadCount > 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <CheckCheck className="size-3.5" />{readCount} lue{readCount > 1 ? 's' : ''}
        </Badge>
        <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
          <Bell className="size-3.5" />{notifications.length} au total
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !Array.isArray(notifications) || notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BellOff className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucune notification pour le moment</h3>
          <p className="text-sm text-muted-foreground/60">Les nouvelles notifications apparaîtront ici</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[700px]">
          <div className="space-y-3 pr-4">
            {sortedNotifications.map(notif => (
              <Card 
                key={notif.id} 
                className={`transition-all cursor-pointer hover:shadow-md ${notif.read ? 'bg-muted/20 border-muted' : 'bg-gradient-to-r from-blue-50/80 to-white border-blue-200 shadow-sm'}`} 
                onClick={() => markAsRead(notif.id)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <div className={`size-2.5 rounded-full shrink-0 ${notif.read ? 'bg-muted-foreground/20' : 'bg-blue-500 animate-pulse'}`} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start gap-2">
                        {getNotifIcon(notif.message)}
                        <p className={`text-sm leading-relaxed break-words ${notif.read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                          {notif.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />{formatDate(notif.createdAt)} à {formatTime(notif.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {!notif.read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-xs gap-1 hover:scale-[1.02] active:scale-[0.98] transition-all" 
                          disabled={markingId === notif.id} 
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                        >
                          {markingId === notif.id ? 
                            <span className="size-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : 
                            <CheckCheck className="size-3.5" />
                          }
                          <span className="hidden sm:inline">Lu</span>
                        </Button>
                      )}
                      {notif.read && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted">
                          <CheckCheck className="size-3 mr-0.5" />Lu
                        </Badge>
                      )}
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