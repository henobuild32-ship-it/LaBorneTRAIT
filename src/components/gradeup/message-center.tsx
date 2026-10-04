'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { NotificationInfo, ClassInfo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageSquare,
  Send,
  Inbox,
  Mail,
  MailOpen,
  Users,
  GraduationCap,
  Eye,
  Clock,
  User,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchJsonWithCache, queueOrFetch } from '@/lib/offline-sync';

export default function MessageCenter() {
  const { user } = useAppStore();
  const isAdmin = user?.role === 'ADMIN';

  const [messages, setMessages] = useState<NotificationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

  // Compose state (admin only)
  const [targetType, setTargetType] = useState<'all' | 'role' | 'class'>('all');
  const [targetRole, setTargetRole] = useState('');
  const [targetClassId, setTargetClassId] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ schoolId: user.schoolId });

        // Fetch messages/notifications
        const notifsData = await fetchJsonWithCache(`/api/notifications?${params}`, { notifications: [] });
        const allNotifs: NotificationInfo[] = Array.isArray(notifsData) ? notifsData : notifsData?.notifications || [];
        // Sort by date descending
        allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setMessages(allNotifs);

        // Fetch classes for admin compose
        if (isAdmin) {
          const classesData = await fetchJsonWithCache(`/api/classes?${params}`, { classes: [] });
          setClasses(Array.isArray(classesData) ? classesData : classesData?.classes || []);
        }
      } catch {
        // silencieux
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.schoolId, isAdmin]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await queueOrFetch(`/api/notifications/${notifId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === notifId ? { ...m, read: true } : m))
      );
    } catch {
      // silently fail
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unread = messages.filter((m) => !m.read);
      await Promise.all(
        unread.map((m) =>
          queueOrFetch(`/api/notifications/${m.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      );
      setMessages((prev) => prev.map((m) => ({ ...m, read: true })));
      toast.success('Tous les messages marqués comme lus.');
    } catch {
      toast.error('Erreur lors du marquage.');
    }
  };

  const handleSendMessage = async () => {
    if (!subject.trim() || !content.trim()) {
      toast.error('Veuillez remplir le sujet et le contenu du message.');
      return;
    }

    if (targetType === 'role' && !targetRole) {
      toast.error('Veuillez sélectionner un rôle cible.');
      return;
    }

    if (targetType === 'class' && !targetClassId) {
      toast.error('Veuillez sélectionner une classe cible.');
      return;
    }

    setSending(true);
    try {
      const targetRoleValue = targetType === 'all' ? 'ALL' : targetType === 'role' ? targetRole : '';
      const targetClassValue = targetType === 'class' ? targetClassId : '';

      const fullMessage = subject.trim() + '\n' + content.trim();

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          senderId: user?.id,
          targetRole: targetRoleValue,
          targetClassId: targetClassValue,
          message: fullMessage,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur lors de l\'envoi');
      }

      toast.success('Message envoyé avec succès !');
      setSubject('');
      setContent('');
      setTargetType('all');
      setTargetRole('');
      setTargetClassId('');

      // Refresh messages
      const notifsRes = await fetch(`/api/notifications?schoolId=${user?.schoolId}`);
      const notifsData = await notifsRes.json();
      const allNotifs: NotificationInfo[] = Array.isArray(notifsData) ? notifsData : [];
      allNotifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMessages(allNotifs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const unreadCount = messages.filter((m) => !m.read).length;

  // Extract subject from message (first line)
  const extractSubject = (message: string) => {
    const lines = message.split('\n');
    return lines[0] || 'Sans sujet';
  };

  const extractBody = (message: string) => {
    const lines = message.split('\n');
    return lines.slice(1).join('\n').trim() || message;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Centre de messages</h1>
            <p className="text-blue-100 text-sm">
              {unreadCount > 0
                ? `${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}`
                : 'Aucun nouveau message'}
            </p>
          </div>
        </div>
      </div>

      {/* Admin: Compose Message */}
      {isAdmin && (
        <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50">
                <Send className="h-4 w-4 text-emerald-600" />
              </div>
              Nouveau message
            </CardTitle>
            <CardDescription>Envoyer un message aux membres de l&apos;école</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Destinataire</Label>
                <Select value={targetType} onValueChange={(v) => setTargetType(v as 'all' | 'role' | 'class')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" /> Tous
                      </span>
                    </SelectItem>
                    <SelectItem value="role">
                      <span className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" /> Par rôle
                      </span>
                    </SelectItem>
                    <SelectItem value="class">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5" /> Par classe
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {targetType === 'role' && (
                <div className="space-y-2">
                  <Label>Rôle cible</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEACHER">Professeur</SelectItem>
                      <SelectItem value="STUDENT">Élève</SelectItem>
                      <SelectItem value="PARENT">Parent</SelectItem>
                      <SelectItem value="ALL">Tous les rôles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {targetType === 'class' && (
                <div className="space-y-2">
                  <Label>Classe cible</Label>
                  <Select value={targetClassId} onValueChange={setTargetClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="msg-subject">Sujet</Label>
              <Input
                id="msg-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Sujet du message"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-content">Contenu</Label>
              <Textarea
                id="msg-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Écrivez votre message ici..."
                rows={4}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={sending}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-md shadow-emerald-500/20"
            >
              {sending ? (
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? 'Envoi en cours...' : 'Envoyer le message'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Messages List */}
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Inbox className="h-4 w-4 text-blue-600" />
              </div>
              Messages reçus
              {unreadCount > 0 && (
                <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 font-semibold">
                  {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Tout marquer comme lu
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-8 w-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Chargement des messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="p-4 rounded-full bg-blue-50">
                <Mail className="h-10 w-10 text-blue-300" />
              </div>
              <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {messages.map((msg) => {
                  const isExpanded = expandedMessage === msg.id;
                  const msgSubject = extractSubject(msg.message);
                  const msgBody = extractBody(msg.message);

                  return (
                    <div
                      key={msg.id}
                      className={`
                        rounded-xl border p-4 transition-all duration-200 cursor-pointer
                        ${isExpanded
                          ? 'bg-card shadow-sm border-blue-200'
                          : msg.read
                            ? 'bg-background border-border hover:bg-accent/30 hover:shadow-sm'
                            : 'bg-gradient-to-r from-blue-50/80 to-card border-blue-200 hover:shadow-sm'
                        }
                      `}
                      onClick={() => {
                        if (!msg.read) handleMarkAsRead(msg.id);
                        setExpandedMessage(isExpanded ? null : msg.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          msg.read ? 'bg-muted' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {msg.read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-semibold truncate ${!msg.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {msgSubject}
                            </h4>
                            <div className="flex items-center gap-2 shrink-0">
                              {msg.targetRole && msg.targetRole !== 'ALL' && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {msg.targetRole}
                                </Badge>
                              )}
                              {!msg.read && (
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse-soft shrink-0" />
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <p className="text-[11px] text-muted-foreground">{formatDate(msg.createdAt)}</p>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                {msgBody}
                              </p>
                            </div>
                          )}
                        </div>
                        <Eye className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
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
