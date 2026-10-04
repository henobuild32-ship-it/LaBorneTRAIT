'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { VideoConferenceInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Video, Plus, Calendar, Clock, Radio, History, Lock, Play } from 'lucide-react';

export default function MeetingsHub() {
  const { user, setActiveMeeting, setCurrentPage } = useAppStore();
  const [meetings, setMeetings] = useState<VideoConferenceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<'upcoming' | 'live' | 'past'>('live');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    targetRole: 'ALL',
    targetClassId: '',
  });

  const canSchedule = user?.role === 'ADMIN' || user?.role === 'TEACHER';

  const fetchMeetings = async (s: string) => {
    if (!user?.schoolId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/meetings?schoolId=${user.schoolId}&userId=${user.id}&role=${user.role}&scope=${s}`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings(scope);
  }, [scope, user?.schoolId, user?.id, user?.role]);

  const startInstant = async () => {
    if (!user?.schoolId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          title: `Réunion de ${user.fullName}`,
          type: 'instant',
          creatorId: user.id,
          creatorName: user.fullName,
          targetRole: 'ALL',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success('Réunion instantanée démarrée.');
        setActiveMeeting(data.meeting.id);
        setCurrentPage('meeting-room');
      } else {
        toast.error('Impossible de démarrer la réunion.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.schoolId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          schoolId: user.schoolId,
          creatorId: user.id,
          creatorName: user.fullName,
          type: 'scheduled',
        }),
      });
      if (res.ok) {
        toast.success('Réunion programmée.');
        setIsDialogOpen(false);
        setFormData({ title: '', description: '', date: '', time: '', targetRole: 'ALL', targetClassId: '' });
        fetchMeetings(scope);
      } else {
        toast.error('Erreur lors de la programmation.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const join = (m: VideoConferenceInfo) => {
    setActiveMeeting(m.id);
    setCurrentPage('meeting-room');
  };

  const roleLabels: Record<string, string> = {
    ALL: 'Tous',
    TEACHER: 'Professeurs',
    STUDENT: 'Élèves',
    PARENT: 'Parents',
  };

  const filtered = meetings;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Visioconférences Grada Vio</h2>
          <p className="text-muted-foreground">Réunions intégrées, salle d'attente et contrôles d'organisateur.</p>
        </div>
        <div className="flex gap-2">
          {canSchedule && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={startInstant} disabled={isSubmitting}>
              <Plus className="w-4 h-4 mr-2" /> Réunion instantanée
            </Button>
          )}
          {canSchedule && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Calendar className="w-4 h-4 mr-2" /> Programmer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={schedule}>
                  <DialogHeader>
                    <DialogTitle>Programmer une visioconférence</DialogTitle>
                    <DialogDescription>Un lien sécurisé est généré et une notification envoyée.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Titre <span className="text-red-500">*</span></Label>
                      <Input id="title" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Réunion Parents-Professeurs" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date">Date <span className="text-red-500">*</span></Label>
                        <Input id="date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="time">Heure <span className="text-red-500">*</span></Label>
                        <Input id="time" type="time" required value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Audience</Label>
                      <Select value={formData.targetRole} onValueChange={(v) => setFormData({ ...formData, targetRole: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Tous</SelectItem>
                          <SelectItem value="TEACHER">Professeurs</SelectItem>
                          <SelectItem value="PARENT">Parents</SelectItem>
                          <SelectItem value="STUDENT">Élèves</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
                    <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
                      {isSubmitting ? 'Génération…' : 'Programmer'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
        <TabsList>
          <TabsTrigger value="live"><Radio className="w-4 h-4 mr-1" /> En direct</TabsTrigger>
          <TabsTrigger value="upcoming"><Calendar className="w-4 h-4 mr-1" /> À venir</TabsTrigger>
          <TabsTrigger value="past"><History className="w-4 h-4 mr-1" /> Historique</TabsTrigger>
        </TabsList>

        <TabsContent value={scope} className="mt-4">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <Video className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Aucune réunion</h3>
              <p className="text-muted-foreground max-w-sm mt-1">Aucune réunion dans cette catégorie pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((m) => (
                <Card key={m.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-2">{m.title}</CardTitle>
                      {m.status === 'live' && <Badge variant="destructive" className="shrink-0"><Radio className="w-2 h-2 mr-1 fill-current" />Live</Badge>}
                      {m.isLocked && <Badge variant="secondary" className="shrink-0"><Lock className="w-2 h-2 mr-1" />Verrou</Badge>}
                    </div>
                    <CardDescription className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{m.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.time}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col justify-between gap-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">{m.description || 'Réunion LaBorneTRAIT.'}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="font-normal">{roleLabels[m.targetRole] || m.targetRole}</Badge>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => join(m)}>
                        {m.status === 'live' ? <><Play className="w-3 h-3 mr-1" />Rejoindre</> : 'Ouvrir'}
                      </Button>
                    </div>
                    {m.recordings && m.recordings.length > 0 && (
                      <p className="text-xs text-muted-foreground">{m.recordings.length} enregistrement(s) disponible(s).</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
