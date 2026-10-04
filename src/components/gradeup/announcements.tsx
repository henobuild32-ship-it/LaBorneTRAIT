'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CheckCheck,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Megaphone,
  RefreshCw,
  School,
  Send,
  Trash2,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import { CsvObject, pickValue } from '@/lib/csv';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  targetRole: string;
  targetClassId: string;
  userId: string | null;
  metadata: string;
  read: boolean;
  createdAt: string;
}

interface ClassOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  fullName: string;
  role: string;
}

type Audience = 'ALL' | 'STUDENT' | 'PARENT' | 'TEACHER' | 'CLASS' | 'USER';

const AUDIENCE_LABELS: Record<string, string> = {
  ALL: 'Tout le monde',
  STUDENT: 'Élèves',
  PARENT: 'Parents',
  TEACHER: 'Professeurs',
  ADMIN: 'Administration',
  CLASS: 'Une classe',
  USER: 'Un destinataire',
};

function audienceLabel(announcement: Announcement): string {
  if (announcement.userId) return 'Destinataire individuel';
  if (announcement.targetClassId) return 'Classe ciblée';
  return AUDIENCE_LABELS[announcement.targetRole] || announcement.targetRole;
}

function audienceFromLabel(label: string): Audience | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized || normalized.includes('tou')) return 'ALL';
  if (normalized.includes('élève') || normalized.includes('eleve') || normalized.includes('student')) return 'STUDENT';
  if (normalized.includes('parent')) return 'PARENT';
  if (normalized.includes('prof')) return 'TEACHER';
  if (normalized.includes('classe')) return 'CLASS';
  return null;
}

export default function AnnouncementsPage() {
  const { user } = useAppStore();
  const isAdmin = user?.role === 'ADMIN';

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('ALL');
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [recipientRole, setRecipientRole] = useState('STUDENT');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfParsing, setPdfParsing] = useState(false);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfMessage, setPdfMessage] = useState('');
  const [pdfName, setPdfName] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const fetchAnnouncements = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/announcements?schoolId=${user.schoolId}`);
      const data = await res.json();
      if (res.ok) {
        setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
      } else {
        toast.error(data.error || 'Impossible de charger les communiqués');
      }
    } catch {
      toast.error('Impossible de charger les communiqués');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const fetchClasses = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/classes?schoolId=${user.schoolId}`);
      const data = await res.json();
      setClasses(Array.isArray(data.classes) ? data.classes : []);
    } catch {
      setClasses([]);
    }
  }, [user?.schoolId]);

  const fetchUsers = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/users?schoolId=${user.schoolId}&role=${recipientRole}`);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch {
      setUsers([]);
    }
  }, [user?.schoolId, recipientRole]);

  useEffect(() => {
    if (!isAdmin || (audience !== 'CLASS' && audience !== 'USER')) return;
    if (audience === 'CLASS') fetchClasses();
    if (audience === 'USER') fetchUsers();
  }, [isAdmin, audience, fetchClasses, fetchUsers]);

  const audiencePayload = useMemo(() => {
    if (audience === 'CLASS') return { classId: selectedClassId };
    if (audience === 'USER') return { userId: selectedUserId };
    return { targetRole: audience };
  }, [audience, selectedClassId, selectedUserId]);

  const canPublish = useMemo(() => {
    if (!message.trim()) return false;
    if (audience === 'CLASS' && !selectedClassId) return false;
    if (audience === 'USER' && !selectedUserId) return false;
    return true;
  }, [message, audience, selectedClassId, selectedUserId]);

  const publish = async () => {
    if (!canPublish || !user?.schoolId) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          title: title.trim() || '📢 Communiqué',
          message: message.trim(),
          ...audiencePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "La publication a échoué");
      toast.success('Communiqué publié');
      setTitle('');
      setMessage('');
      setSelectedClassId('');
      setSelectedUserId('');
      fetchAnnouncements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "La publication a échoué");
    } finally {
      setPublishing(false);
    }
  };

  const handleImport = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    const items = rows
      .map((row) => ({
        title: pickValue(row, ['titre', 'title', 'objet']).trim(),
        message: pickValue(row, ['message', 'contenu', 'texte', 'corps', 'description']).trim(),
        audience: audienceFromLabel(pickValue(row, ['destinataire', 'audience', 'public', 'cible'])),
      }))
      .filter((item) => item.message);

    if (items.length === 0) {
      throw new Error('Aucune ligne valide (la colonne Message est obligatoire).');
    }

    const groups = new Map<Audience, { title: string; message: string }[]>();
    const fallback: Audience = audience === 'CLASS' || audience === 'USER' ? 'ALL' : audience;
    for (const item of items) {
      const key = item.audience || fallback;
      const bucket = groups.get(key) || [];
      bucket.push({ title: item.title, message: item.message });
      groups.set(key, bucket);
    }

    let created = 0;
    for (const [key, bucket] of groups) {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          items: bucket,
          ...(key === 'CLASS' && selectedClassId ? { classId: selectedClassId } : {}),
          ...(key !== 'CLASS' ? { targetRole: key } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "L'import a échoué");
      created += data.created || bucket.length;
    }

    toast.success(`${created} communiqué${created > 1 ? 's' : ''} publié${created > 1 ? 's' : ''}`);
    fetchAnnouncements();
  };

  const unreadCount = announcements.filter((item) => !item.read).length;

  const markAsRead = async (id: string) => {
    setAnnouncements((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)));
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error('Impossible de marquer le communiqué comme lu');
      fetchAnnouncements();
    }
  };

  const markAllAsRead = async () => {
    const unread = announcements.filter((item) => !item.read);
    if (unread.length === 0) return;
    setAnnouncements((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await Promise.all(
        unread.map((item) =>
          fetch(`/api/notifications/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      );
      toast.success('Tous les communiqués sont marqués comme lus');
    } catch {
      toast.error('Impossible de marquer les communiqués comme lus');
      fetchAnnouncements();
    }
  };

  const handlePdfFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    setPdfParsing(true);
    setPdfName(file.name);
    setPdfTitle('');
    setPdfMessage('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/announcements/parse-pdf', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lecture du PDF impossible');
      setPdfTitle(data.title || '');
      setPdfMessage(data.message || '');
      const pages = Number(data.pages) || 1;
      toast.success(`PDF lu (${pages} page${pages > 1 ? 's' : ''})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lecture du PDF impossible');
      setPdfName('');
    } finally {
      setPdfParsing(false);
    }
  };

  const usePdfContent = () => {
    if (!pdfMessage.trim() && !pdfTitle.trim()) return;
    setTitle(pdfTitle);
    setMessage(pdfMessage);
    setPdfOpen(false);
    toast.success('Contenu du PDF importé : choisissez la destinataire puis publiez.');
    setTimeout(() => document.getElementById('announcement-title')?.focus(), 150);
  };

  const removeAnnouncement = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suppression impossible');
      toast.success('Communiqué retiré');
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-6 lg:p-8 text-white shadow-xl shadow-amber-500/20">
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <Megaphone className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Communiqués</h1>
              {unreadCount > 0 && (
                <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-white text-amber-600 text-xs font-bold shadow-sm">
                  {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-amber-100 text-sm">
              {isAdmin
                ? 'Rédigez, importez et publiez vos communiqués à tous ou à un destinataire'
                : 'Les derniers communiqués de votre établissement'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                onClick={markAllAsRead}
                variant="outline"
                size="sm"
                className="bg-white/15 hover:bg-white/25 border-white/30 text-white text-xs font-semibold"
              >
                <CheckCheck className="w-4 h-4 mr-1.5" />
                Tout lire
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setImportOpen(true)}
                variant="outline"
                size="sm"
                className="bg-white/15 hover:bg-white/25 border-white/30 text-white text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                Importer
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={() => setPdfOpen(true)}
                variant="outline"
                size="sm"
                className="bg-white/15 hover:bg-white/25 border-white/30 text-white text-xs font-semibold"
              >
                <FileText className="w-4 h-4 mr-1.5" />
                PDF
              </Button>
            )}
            <Button
              onClick={fetchAnnouncements}
              variant="outline"
              size="sm"
              className="bg-white/15 hover:bg-white/25 border-white/30 text-white"
              aria-label="Actualiser"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Composer (administration) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="w-4 h-4 text-orange-600" />
              Nouveau communiqué
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="announcement-title">Titre</Label>
                <Input
                  id="announcement-title"
                  placeholder="Ex. Réunion des parents"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="announcement-audience">Destinataires</Label>
                <Select value={audience} onValueChange={(value) => setAudience(value as Audience)}>
                  <SelectTrigger id="announcement-audience" className="w-full">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Tout le monde</span></SelectItem>
                    <SelectItem value="STUDENT"><span className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Élèves</span></SelectItem>
                    <SelectItem value="PARENT"><span className="flex items-center gap-2"><HeartHandshake className="w-4 h-4" /> Parents</span></SelectItem>
                    <SelectItem value="TEACHER"><span className="flex items-center gap-2"><UserCog className="w-4 h-4" /> Professeurs</span></SelectItem>
                    <SelectItem value="CLASS"><span className="flex items-center gap-2"><School className="w-4 h-4" /> Une classe</span></SelectItem>
                    <SelectItem value="USER"><span className="flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> Un destinataire</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {audience === 'CLASS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Classe</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionnez une classe" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {audience === 'USER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Rôle du destinataire</Label>
                  <Select value={recipientRole} onValueChange={setRecipientRole}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Élève</SelectItem>
                      <SelectItem value="TEACHER">Professeur</SelectItem>
                      <SelectItem value="PARENT">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Destinataire</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Sélectionnez une personne" /></SelectTrigger>
                    <SelectContent>
                      {users.map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="announcement-message">Message</Label>
              <Textarea
                id="announcement-message"
                placeholder="Rédigez votre communiqué..."
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={publish} disabled={!canPublish || publishing} className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600">
                {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Publier
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed">
          <Megaphone className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">Aucun communiqué</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Publiez votre premier communiqué ci-dessus.' : 'Aucun communiqué publié pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Card
              key={announcement.id}
              className={`border-l-4 hover:shadow-md transition-shadow ${
                announcement.read ? 'border-l-amber-500' : 'border-l-amber-600 bg-amber-50/50'
              }`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!announcement.read && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-label="Non lu" />
                      )}
                      <h3 className={`text-sm ${announcement.read ? 'font-semibold' : 'font-bold'}`}>
                        {announcement.title}
                      </h3>
                      <Badge variant="outline" className="text-[11px]">{audienceLabel(announcement)}</Badge>
                      {announcement.priority === 'HIGH' || announcement.priority === 'URGENT' ? (
                        <Badge className="text-[11px] bg-red-100 text-red-700 border-red-200">Urgent</Badge>
                      ) : null}
                      {announcement.userId && <Badge className="text-[11px] bg-blue-100 text-blue-700 border-blue-200">Individuel</Badge>}
                      {announcement.read && <Badge variant="outline" className="text-[11px] text-muted-foreground">Lu</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{announcement.message}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                      <CalendarClock className="w-3.5 h-3.5" />
                      {new Date(announcement.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!announcement.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-100"
                        onClick={() => markAsRead(announcement.id)}
                      >
                        <CheckCheck className="w-3.5 h-3.5 mr-1" />
                        Lu
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeAnnouncement(announcement.id)}
                        disabled={deletingId === announcement.id}
                        aria-label="Retirer le communiqué"
                      >
                        {deletingId === announcement.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Import PDF (administration) */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="flex-row items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
              <img
                src={user?.school?.logoUrl || '/trait-logo.png'}
                alt={user?.school?.logoUrl ? "Logo de l'école" : 'LaBorneTRAIT'}
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = '/trait-logo.png';
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                Importer un communiqué en PDF
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Logo de l&apos;école si défini, sinon logo de l&apos;application.
              </p>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-4 text-center space-y-2">
              <Button variant="outline" size="sm" asChild disabled={pdfParsing}>
                <label className="cursor-pointer">
                  {pdfParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {pdfParsing ? 'Lecture du PDF…' : pdfName ? 'Changer de fichier' : 'Choisir un PDF'}
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    disabled={pdfParsing}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      handlePdfFile(file);
                    }}
                  />
                </label>
              </Button>
              {pdfName && !pdfParsing && (
                <p className="text-xs text-muted-foreground break-all">{pdfName}</p>
              )}
            </div>

            {!pdfParsing && (pdfTitle || pdfMessage) && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pdf-announcement-title">Titre</Label>
                  <Input
                    id="pdf-announcement-title"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdf-announcement-message">Message</Label>
                  <Textarea
                    id="pdf-announcement-message"
                    rows={8}
                    value={pdfMessage}
                    onChange={(e) => setPdfMessage(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Vous pourrez ajuster le contenu avant publication.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>Annuler</Button>
            <Button
              onClick={usePdfContent}
              disabled={pdfParsing || (!pdfMessage.trim() && !pdfTitle.trim())}
            >
              <FileText className="mr-2 h-4 w-4" />
              Utiliser ce contenu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des communiqués"
        description="Préparez un document Word ou PDF avec un tableau (ou photographiez-le) : chaque ligne devient un communiqué publié."
                expectedColumns={['Titre', 'Message', 'Destinataire']}
        sampleRows={[
          ['Réunion des parents', 'Réunion générale des parents vendredi à 16h dans la grande salle.', 'Tous'],
          ['Journée sportive', 'La journée sportive aura lieu mardi sur le terrain scolaire.', 'Élèves'],
        ]}
        columnHints={[
          { header: 'Titre', hint: 'facultatif, sinon « Communiqué » est utilisé' },
          { header: 'Message', hint: 'obligatoire' },
          { header: 'Destinataire', hint: 'Tous, Élèves, Parents ou Professeurs (facultatif)' },
        ]}
        onImport={handleImport}
      />
    </div>
  );
}
