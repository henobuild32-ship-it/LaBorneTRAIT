'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Bell,
  Send,
  Users,
  GraduationCap,
  UserCheck,
  Globe,
  MessageSquare,
  BellRing,
  CheckCheck,
  Clock,
  Megaphone,
} from 'lucide-react';
import { toast } from 'sonner';

interface NotificationItem {
  id: string;
  senderId: string;
  targetRole: string;
  targetClassId: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
}

const targetLabels: Record<string, string> = {
  ALL: 'Tout le monde',
  STUDENT: 'Tous les élèves',
  TEACHER: 'Professeurs',
  PARENT: 'Parents',
  CLASS: 'Une classe spécifique',
};

const targetIcons: Record<string, typeof Users> = {
  ALL: Globe,
  STUDENT: UserCheck,
  TEACHER: GraduationCap,
  PARENT: Users,
  CLASS: Users,
};

const targetColors: Record<string, string> = {
  ALL: 'bg-gray-100 text-gray-700 border-gray-200',
  STUDENT: 'bg-blue-100 text-blue-700 border-blue-200',
  TEACHER: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PARENT: 'bg-purple-100 text-purple-700 border-purple-200',
  CLASS: 'bg-amber-100 text-amber-700 border-amber-200',
};

const targetBgColors: Record<string, string> = {
  ALL: 'bg-gray-100 text-gray-600',
  STUDENT: 'bg-blue-100 text-blue-600',
  TEACHER: 'bg-emerald-100 text-emerald-600',
  PARENT: 'bg-purple-100 text-purple-600',
  CLASS: 'bg-amber-100 text-amber-600',
};

export default function AdminNotifications() {
  const { user, setCurrentPage } = useAppStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formTarget, setFormTarget] = useState('ALL');
  const [formClassId, setFormClassId] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?schoolId=${user?.schoolId}`);
      const data = await res.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      toast.error('Erreur lors du chargement des notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/classes?schoolId=${user?.schoolId}`);
      if (!res.ok) return;
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchNotifications();
      fetchClasses();
    }
  }, [fetchNotifications, fetchClasses, user?.schoolId]);

  const resetForm = () => {
    setFormTarget('ALL');
    setFormClassId('');
    setFormMessage('');
  };

  const handleSubmit = async () => {
    if (!formMessage.trim()) {
      toast.error('Veuillez entrer un message');
      return;
    }
    if (formTarget === 'CLASS' && !formClassId) {
      toast.error('Veuillez sélectionner une classe');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          senderId: user?.id,
          targetRole: formTarget === 'CLASS' ? 'CLASS' : formTarget,
          targetClassId: formTarget === 'CLASS' ? formClassId : '',
          message: formMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Notification envoyée avec succès');
      setDialogOpen(false);
      resetForm();
      fetchNotifications();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
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

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    try {
      await Promise.all(unread.map((n) => fetch(`/api/notifications/${n.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: true }) })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success('Toutes les notifications ont été marquées comme lues');
    } catch {
      toast.error('Erreur lors du marquage');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Envoyez et gérez les notifications de l&apos;école</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('announcements')}
              className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:scale-[1.02] active:scale-[0.98] transition-transform gap-1.5"
            >
              <Megaphone className="h-4 w-4" />Communiqués
            </Button>
            {notifications.some((n) => !n.read) && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-transform gap-1.5">
                <CheckCheck className="h-4 w-4" />Tout marquer comme lu
              </Button>
            )}
            <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20">
              <BellRing className="h-4 w-4 mr-2" />
              Envoyer une notification
            </Button>
          </div>
        </div>
      </div>

      {/* Send Notification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Envoyer une notification
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notif-target">Destinataire</Label>
              <Select value={formTarget} onValueChange={(v) => { setFormTarget(v); setFormClassId(''); }}>
                <SelectTrigger id="notif-target" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tout le monde</SelectItem>
                  <SelectItem value="STUDENT">Tous les élèves</SelectItem>
                  <SelectItem value="TEACHER">Professeurs</SelectItem>
                  <SelectItem value="PARENT">Parents</SelectItem>
                  <SelectItem value="CLASS">Une classe spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formTarget === 'CLASS' && (
              <div className="space-y-2">
                <Label htmlFor="notif-class">Classe</Label>
                <Select value={formClassId} onValueChange={setFormClassId}>
                  <SelectTrigger id="notif-class" className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                    <SelectValue placeholder="Sélectionner une classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notif-message">Message</Label>
              <Textarea
                id="notif-message"
                value={formMessage}
                onChange={(e) => setFormMessage(e.target.value)}
                placeholder="Entrez votre message ici..."
                rows={4}
                className="resize-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-muted-foreground">
                Ce message sera envoyé à {targetLabels[formTarget]?.toLowerCase() || 'tous'}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="hover:scale-[1.02] active:scale-[0.98] transition-all">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formMessage.trim()}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {submitting ? (
                'Envoi en cours...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notifications List */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            Notifications envoyées
            {notifications.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {notifications.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Aucune notification</h3>
              <p className="text-muted-foreground mb-4">
                Envoyez votre première notification à la communauté scolaire
              </p>
              <Button onClick={() => { resetForm(); setDialogOpen(true); }} variant="outline" className="hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Plus className="h-4 w-4 mr-2" />
                Envoyer une notification
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {notifications.map((n) => {
                  const TargetIcon = targetIcons[n.targetRole] || Globe;
                  return (
                    <div
                      key={n.id}
                      className="p-4 rounded-lg border hover:bg-muted/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2.5 rounded-lg shrink-0 ${targetBgColors[n.targetRole] || 'bg-gray-100 text-gray-600'}`}>
                          <TargetIcon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-xs ${targetColors[n.targetRole] || ''}`}
                            >
                              {targetLabels[n.targetRole] || n.targetRole}
                            </Badge>
                            {n.targetClassId && (
                              <Badge variant="secondary" className="text-xs">
                                {classes.find((c) => c.id === n.targetClassId)?.name || 'Classe'}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap mb-2">{n.message}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(n.createdAt)}
                            </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
