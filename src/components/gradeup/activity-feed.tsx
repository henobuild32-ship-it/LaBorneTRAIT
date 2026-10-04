'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Bell,
  UserPlus,
  BookOpen,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { NotificationInfo } from '@/lib/types';

interface ActivityFeedProps {
  schoolId: string;
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "À l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  if (diffHours < 24) return `il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getIconForMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes('paiement') || lower.includes('payment')) {
    return { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  }
  if (lower.includes('note') || lower.includes('grade')) {
    return { icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' };
  }
  if (lower.includes('inscrit') || lower.includes('ajouté') || lower.includes('utilisateur')) {
    return { icon: UserPlus, color: 'text-purple-600', bg: 'bg-purple-50' };
  }
  if (lower.includes('absence') || lower.includes('retard') || lower.includes('alerte')) {
    return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' };
  }
  if (lower.includes('succès') || lower.includes('terminé') || lower.includes('validé')) {
    return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' };
  }
  return { icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50' };
}

export default function ActivityFeed({ schoolId }: ActivityFeedProps) {
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;
    fetchNotifications();
  }, [schoolId]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?schoolId=${schoolId}&limit=10`);
      const data = await res.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50">
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          Activité récente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-96">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

            <div className="space-y-4">
              {notifications.slice(0, 10).map((notif, index) => {
                const { icon: IconComp, color, bg } = getIconForMessage(notif.message);
                return (
                  <div key={notif.id} className="relative flex gap-3 pl-0">
                    {/* Timeline dot */}
                    <div className="relative z-10 mt-0.5">
                      <div className={`h-[32px] w-[32px] rounded-full ${bg} flex items-center justify-center shrink-0 border-2 border-background`}>
                        <IconComp className={`h-3.5 w-3.5 ${color}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm text-foreground leading-relaxed">
                        {notif.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getTimeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
