'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  PenLine,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react';

interface ModRow {
  id: string;
  noteId: string;
  studentId: string;
  courseId: string;
  modifierId: string;
  oldValue: number;
  newValue: number;
  oldMax: number;
  newMax: number;
  reason: string;
  requestStatus: string;
  createdAt: string;
  student?: { id: string; fullName: string; matricule: string; photoUrl: string };
  course?: { id: string; name: string };
  modifier?: { id: string; fullName: string; role: string };
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

export default function AdminNoteModifications() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<ModRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [review, setReview] = useState<{ id: string; comment: string } | null>(null);

  const load = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const params = new URLSearchParams({ schoolId: user.schoolId });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/note-modifications?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data.noteModifications) ? data.noteModifications : []);
    } catch {
      toast.error('Erreur lors du chargement des demandes');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/note-modifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: review?.id === id ? review.comment : '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success(action === 'APPROVED' ? 'Demande approuvée — le professeur peut maintenant appliquer la correction' : 'Demande rejetée');
      setReview(null);
      load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setProcessingId(null);
    }
  };

  const counts = {
    pending: rows.filter((r) => r.requestStatus === 'PENDING').length,
    approved: rows.filter((r) => r.requestStatus === 'APPROVED').length,
    rejected: rows.filter((r) => r.requestStatus === 'REJECTED').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-orange-500 to-amber-600 p-6 lg:p-8 text-white shadow-xl shadow-orange-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWRvZHRoPSI0MCIgaGVpZ2h0PSI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <PenLine className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Demandes de modification de notes</h1>
            <p className="text-orange-100 text-sm">Approuvez ou rejetez les correctifs demandés</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50"><Clock className="h-5 w-5 text-amber-600" /></div>
            <div><p className="text-xs text-muted-foreground">En attente</p><p className="text-xl font-bold">{counts.pending}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
            <div><p className="text-xs text-muted-foreground">Approuvées</p><p className="text-xl font-bold">{counts.approved}</p></div>
          </CardContent>
        </Card>
        <Card className="rounded-xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-50"><XCircle className="h-5 w-5 text-red-600" /></div>
            <div><p className="text-xs text-muted-foreground">Rejetées</p><p className="text-xl font-bold">{counts.rejected}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end justify-between">
          <div className="space-y-1.5 sm:w-56">
            <label className="text-xs font-semibold text-muted-foreground">Statut</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue placeholder="Tous" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="PENDING">En attente</SelectItem>
                <SelectItem value="APPROVED">Approuvées</SelectItem>
                <SelectItem value="REJECTED">Rejetées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <PenLine className="h-10 w-10 text-orange-300 mx-auto mb-3" />
          <p>Aucune demande de modification.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 text-xs font-bold">
                          {(r.student?.fullName || r.studentId).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{r.student?.fullName || r.studentId}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.course?.name || r.courseId} · demandé par {r.modifier?.fullName || r.modifierId} · {new Date(r.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[r.requestStatus] || ''}`}>
                        {r.requestStatus === 'PENDING' ? 'En attente' : r.requestStatus === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-accent/30 border border-border p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground line-through">{r.oldValue}/{r.oldMax}</span>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      </div>
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-emerald-700">{r.newValue}/{r.newMax}</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2.5">
                      <span className="font-semibold">Motif :</span> {r.reason}
                    </p>

                    {r.requestStatus === 'PENDING' && (
                      <div className="flex flex-col sm:flex-row items-end gap-2">
                        <Textarea
                          placeholder="Commentaire (facultatif)"
                          value={review?.id === r.id ? review.comment : ''}
                          onChange={(e) => setReview({ id: r.id, comment: e.target.value })}
                          className="flex-1 min-h-[60px] text-sm"
                        />
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => decide(r.id, 'REJECTED')}
                            disabled={processingId === r.id}
                          >
                            {processingId === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                            Rejeter
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => decide(r.id, 'APPROVED')}
                            disabled={processingId === r.id}
                          >
                            {processingId === r.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                            Approuver
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}