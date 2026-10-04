'use client';

/**
 * AutoReportSyncPanel
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays all auto-synced bulletins for a class + trimester.
 * The titulaire / admin can:
 *   1. See the pre-computed average, total, mention for each student.
 *   2. Open the detailed grade breakdown per course.
 *   3. Validate (promote status → pending_admin) or directly mark as validated.
 *   4. Force a manual re-sync of the entire class.
 *   5. Print a single bulletin by linking to the main bulletin editor.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  Eye,
  Users,
  BookOpen,
  Send,
  Trophy,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface SyncedReport {
  id: string;
  reportNumber: string;
  studentId: string;
  studentName: string;
  trimester: string;
  academicYear: string;
  averageGrade: number;
  totalPointsObtained: number;
  totalPointsPossible: number;
  overallPercentage: number;
  classRank: number;
  mention: string;
  status: string;
  gradesData: Record<string, unknown>;
  student: { id: string; fullName: string; photoUrl: string; gender: string };
  class: { id: string; name: string; level: string };
  updatedAt?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  level: string;
}

type SerializedGrade = {
  courseId: string;
  courseName: string;
  coefficient: number;
  score: number;
  maxScore: number;
  normalizedScore: number;
  weightedScore: number;
  comment: string;
};

export default function AutoReportSyncPanel() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTrimester, setSelectedTrimester] = useState('1');
  const [reports, setReports] = useState<SyncedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [viewReport, setViewReport] = useState<SyncedReport | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPublishing, setBulkPublishing] = useState(false);

  // Load classes
  useEffect(() => {
    if (!user?.schoolId) return;
    fetch(`/api/classes?schoolId=${user.schoolId}`)
      .then((r) => r.json())
      .then((d) => setClasses(d.classes || []))
      .catch(() => {});
  }, [user?.schoolId]);

  const fetchReports = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      let url = `/api/grades/sync-report?schoolId=${user.schoolId}&trimester=${selectedTrimester}`;
      if (selectedClass) url += `&classId=${selectedClass}`;
      const res = await fetch(url);
      const data = await res.json();
      setReports(data.reportCards || []);
    } catch {
      toast.error('Erreur lors du chargement des bulletins synchronisés');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, selectedClass, selectedTrimester]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Force full re-sync for the selected class + trimester
  const handleBulkSync = async () => {
    if (!user?.schoolId) return;
    setSyncing(true);
    try {
      const body: Record<string, string> = {
        schoolId: user.schoolId,
        trimester: selectedTrimester,
      };
      if (selectedClass) body.classId = selectedClass;

      const res = await fetch('/api/grades/sync-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      toast.success(data.message || 'Synchronisation terminée');
      fetchReports();
    } catch {
      toast.error('Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === reports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(reports.map((r) => r.id)));
    }
  };

  // Bulk publish selected bulletins
  const handleBulkPublish = async () => {
    if (selectedIds.size === 0) return;
    setBulkPublishing(true);
    try {
      let published = 0;
      for (const id of selectedIds) {
        const report = reports.find((r) => r.id === id);
        if (report && report.status !== 'published') {
          const res = await fetch('/api/report-cards', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'published' }),
          });
          if (res.ok) published++;
        }
      }
      toast.success(`${published} bulletin(s) publié(s)`);
      setSelectedIds(new Set());
      fetchReports();
    } catch {
      toast.error("Erreur lors de la publication");
    } finally {
      setBulkPublishing(false);
    }
  };

  // Validate a single bulletin (titulaire approves → pending_admin)
  const handleValidate = async (report: SyncedReport) => {
    setValidating(report.id);
    try {
      const res = await fetch('/api/report-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: report.id,
          status: 'pending_admin',
          teacherId: user?.id,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Bulletin de ${report.studentName} transmis à l'administration`);
      fetchReports();
    } catch {
      toast.error('Erreur lors de la validation');
    } finally {
      setValidating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      auto_draft: {
        label: '⚡ Auto-synchronisé',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      draft: { label: 'Brouillon', className: 'bg-muted text-muted-foreground' },
      pending_admin: {
        label: '📤 En attente admin',
        className: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      validated: {
        label: '✅ Validé',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      published: {
        label: '🟢 Publié',
        className: 'bg-green-50 text-green-700 border-green-200',
      },
    };
    const s = map[status] || map['draft'];
    return <Badge className={s.className}>{s.label}</Badge>;
  };

  const getMentionColor = (mention: string) => {
    if (mention === 'Félicitations') return 'text-emerald-600 font-bold';
    if (mention === "Tableau d'honneur") return 'text-blue-600 font-bold';
    if (mention === 'Encouragements') return 'text-indigo-600 font-bold';
    if (mention === 'Passable') return 'text-amber-600 font-semibold';
    return 'text-red-500 font-semibold';
  };

  const autoSyncedCount = reports.filter((r) => r.status === 'auto_draft').length;
  const pendingCount = reports.filter((r) => r.status === 'pending_admin').length;
  const validatedCount = reports.filter((r) => r.status === 'validated').length;
  const publishedCount = reports.filter((r) => r.status === 'published').length;
  const passCount = reports.filter((r) => r.averageGrade >= 10).length;

  // Average of class
  const classAvg =
    reports.length > 0
      ? reports.reduce((sum, r) => sum + r.averageGrade, 0) / reports.length
      : 0;

  const serializedGrades = viewReport?.gradesData
    ? ((viewReport.gradesData as Record<string, unknown>)
        .serializedGrades as SerializedGrade[]) || []
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-6 relative overflow-hidden shadow-lg">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-6 h-6" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                Bulletins Synchronisés en Temps Réel
              </h1>
            </div>
            <p className="text-sm text-orange-100 max-w-xl">
              Dès qu'un professeur saisit une note, le bulletin de l'élève est
              automatiquement calculé et mis à jour. Le titulaire n'a plus qu'à
              vérifier et transmettre à l'administration.
            </p>
          </div>
          <Button
            onClick={handleBulkSync}
            disabled={syncing}
            className="bg-white text-orange-600 hover:bg-orange-50 font-bold shadow-md gap-2 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Forcer la re-synchro'}
          </Button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <Card className="shadow-sm border border-border">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="h-9 border border-input rounded-lg px-3 bg-background text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedTrimester}
              onChange={(e) => setSelectedTrimester(e.target.value)}
              className="h-9 border border-input rounded-lg px-3 bg-background text-sm font-medium focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="1">Trimestre 1</option>
              <option value="2">Trimestre 2</option>
              <option value="3">Trimestre 3</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchReports}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          {selectedClass && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user?.schoolId || !selectedClass) return;
                try {
                  const res = await fetch('/api/cahier/sync-to-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ schoolId: user.schoolId, classId: selectedClass, trimester: selectedTrimester }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(data.message || 'Cahier synchronisé');
                    fetchReports();
                  } else {
                    toast.error(data.error || 'Erreur');
                  }
                } catch { toast.error('Erreur réseau'); }
              }}
              className="gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Synchroniser le cahier
            </Button>
          )}

          {reports.length > 0 && (
            <div className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Moy. classe :{' '}
              <strong className="text-foreground">{classAvg.toFixed(2)}/20</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            label: 'Auto-synchronisés',
            value: autoSyncedCount,
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            color: 'text-amber-600',
          },
          {
            label: 'En attente admin',
            value: pendingCount,
            icon: <Send className="w-5 h-5 text-blue-500" />,
            color: 'text-blue-600',
          },
          {
            label: 'Validés',
            value: validatedCount,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            color: 'text-emerald-600',
          },
          {
            label: 'Publiés',
            value: publishedCount,
            icon: <Trophy className="w-5 h-5 text-green-500" />,
            color: 'text-green-600',
          },
          {
            label: 'Élèves admis (≥ 10)',
            value: passCount,
            icon: <Trophy className="w-5 h-5 text-purple-500" />,
            color: 'text-purple-600',
          },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </span>
              {stat.icon}
            </div>
            <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* ── Bulletin list ── */}
      <Card className="shadow-sm border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Bulletins des élèves (T{selectedTrimester})
              </CardTitle>
              <CardDescription>
                Cochez les élèves dont vous souhaitez publier le bulletin, puis cliquez sur{' '}
                <strong className="text-foreground">Publier la sélection</strong>.
              </CardDescription>
            </div>
            {selectedIds.size > 0 && (
              <Button
                onClick={handleBulkPublish}
                disabled={bulkPublishing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {bulkPublishing ? 'Publication...' : `Publier (${selectedIds.size})`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16">
              <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">
                Aucun bulletin synchronisé
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Les bulletins apparaîtront automatiquement dès que les
                professeurs saisiront leurs notes.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-bold text-xs w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === reports.length && reports.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead className="font-bold text-xs">Élève</TableHead>
                      <TableHead className="font-bold text-xs">Classe</TableHead>
                      <TableHead className="font-bold text-xs text-center">
                        Moy. /20
                      </TableHead>
                      <TableHead className="font-bold text-xs text-center">
                        %
                      </TableHead>
                      <TableHead className="font-bold text-xs">Mention</TableHead>
                      <TableHead className="font-bold text-xs">Statut</TableHead>
                      <TableHead className="font-bold text-xs text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow
                        key={report.id}
                        className={`hover:bg-muted/10 transition-colors ${selectedIds.has(report.id) ? 'bg-blue-50/50' : ''}`}
                      >
                        <TableCell className="w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(report.id)}
                            onChange={() => toggleSelect(report.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-semibold text-sm">
                          {report.studentName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {report.class?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold border ${
                              report.averageGrade >= 14
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : report.averageGrade >= 10
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}
                          >
                            {report.averageGrade.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {report.overallPercentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs ${getMentionColor(report.mention)}`}>
                            {report.mention}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(report.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-xs"
                              onClick={() => setViewReport(report)}
                            >
                              <Eye className="w-3.5 h-3.5" /> Voir
                            </Button>
                            {(report.status === 'auto_draft' ||
                              report.status === 'draft') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs text-blue-600 hover:bg-blue-50"
                                onClick={() => handleValidate(report)}
                                disabled={validating === report.id}
                              >
                                <Send className="w-3.5 h-3.5" />
                                {validating === report.id
                                  ? 'Envoi...'
                                  : 'Transmettre'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              Bulletin de {viewReport?.studentName}
            </DialogTitle>
          </DialogHeader>

          {viewReport && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 rounded-xl">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Classe
                  </p>
                  <p className="font-bold text-sm mt-0.5">{viewReport.class?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Trimestre
                  </p>
                  <p className="font-bold text-sm mt-0.5">T{viewReport.trimester}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Moyenne
                  </p>
                  <p className="font-bold text-blue-600 text-lg mt-0.5">
                    {viewReport.averageGrade.toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-0.5">
                      /20
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    Mention
                  </p>
                  <p className={`text-sm mt-0.5 ${getMentionColor(viewReport.mention)}`}>
                    {viewReport.mention}
                  </p>
                </div>
              </div>

              {/* Auto-sync badge */}
              {(() => {
                const gd = viewReport.gradesData as Record<string, unknown>;
                if (!gd?.autoSynced) return null;
                const syncedAt = typeof gd.lastSyncedAt === 'string'
                  ? new Date(gd.lastSyncedAt).toLocaleString('fr-FR')
                  : '—';
                return (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2.5">
                    <Zap className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Bulletin généré automatiquement à partir des notes saisies par
                      les professeurs.{' '}
                      <strong>Dernière mise à jour :</strong> {syncedAt}
                    </span>
                  </div>
                );
              })()}

              {/* Grades table */}
              <div className="border rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Cours</TableHead>
                      <TableHead className="font-bold text-xs text-center">Coeff.</TableHead>
                      <TableHead className="font-bold text-xs text-center">Note</TableHead>
                      <TableHead className="font-bold text-xs text-center">Max</TableHead>
                      <TableHead className="font-bold text-xs text-center">/20</TableHead>
                      <TableHead className="font-bold text-xs">Commentaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {serializedGrades.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground text-sm"
                        >
                          Aucune note enregistrée
                        </TableCell>
                      </TableRow>
                    ) : (
                      serializedGrades.map((g: SerializedGrade) => (
                        <TableRow
                          key={g.courseId}
                          className="even:bg-muted/10 hover:bg-blue-50/30"
                        >
                          <TableCell className="font-medium text-xs">
                            {g.courseName}
                          </TableCell>
                          <TableCell className="text-center text-xs font-mono">
                            {g.coefficient}
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                                g.normalizedScore >= 14
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : g.normalizedScore >= 10
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-red-50 text-red-600'
                              }`}
                            >
                              {g.score}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {g.maxScore}
                          </TableCell>
                          <TableCell className="text-center text-xs font-bold text-foreground">
                            {g.normalizedScore.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                            {g.comment || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex flex-wrap justify-end gap-4 text-sm">
                <div className="bg-muted/30 px-4 py-2.5 rounded-xl text-right">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">
                    Total points
                  </p>
                  <p className="font-bold text-base">
                    {viewReport.totalPointsObtained.toFixed(1)} /{' '}
                    {viewReport.totalPointsPossible}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 rounded-xl text-right">
                  <p className="text-[10px] uppercase text-blue-700/80 font-bold">
                    Moyenne générale
                  </p>
                  <p className="font-extrabold text-xl text-blue-700">
                    {viewReport.averageGrade.toFixed(2)}/20
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 flex-row justify-between">
            <Button variant="outline" onClick={() => setViewReport(null)}>
              Fermer
            </Button>
            {viewReport && viewReport.status !== 'published' && (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/report-cards', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: viewReport.id, status: 'published' }),
                    });
                    if (res.ok) {
                      setViewReport(null);
                      fetchReports();
                    }
                  } catch { /* ignore */ }
                }}
              >
                Publier aux élèves/parents
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
