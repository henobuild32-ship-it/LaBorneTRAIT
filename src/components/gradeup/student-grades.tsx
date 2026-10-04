'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { GradeInfo } from '@/lib/types';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { TrendingUp, Award, AlertTriangle, BarChart3, RefreshCw, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

type GradeWithMod = GradeInfo & { modStatus?: string };

export default function StudentGrades() {
  const user = useAppStore((s) => s.user);
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [trimester, setTrimester] = useState('1');
  const [refreshing, setRefreshing] = useState(false);
  const [modTarget, setModTarget] = useState<GradeWithMod | null>(null);
  const [modReason, setModReason] = useState('');
  const [modNewScore, setModNewScore] = useState('');
  const [modSending, setModSending] = useState(false);
  const [modStatusMap, setModStatusMap] = useState<Record<string, string>>({});

  const fetchGrades = async (showLoading = true) => {
    if (!user?.schoolId || !user?.id) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/grades?schoolId=${user.schoolId}&studentId=${user.id}&trimester=${trimester}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGrades(Array.isArray(data.grades) ? data.grades : []);
      // statut des demandes en cours pour ces notes
      try {
        const modRes = await fetch(`/api/note-modifications?schoolId=${user.schoolId}&studentId=${user.id}`);
        const modData = await modRes.json();
        const map: Record<string, string> = {};
        const mods = Array.isArray(modData.noteModifications) ? modData.noteModifications : [];
        for (const m of mods) {
          if (!map[m.noteId] || m.requestStatus === 'PENDING') map[m.noteId] = m.requestStatus;
        }
        setModStatusMap(map);
      } catch { /* silencieux */ }
    } catch {
      if (!showLoading) {
        toast.error('Erreur lors de l\'actualisation des notes');
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, [user?.schoolId, user?.id, trimester]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchGrades(false);
    setRefreshing(false);
  };

  const sendModification = async () => {
    if (!modTarget) return;
    const newValue = parseFloat(modNewScore);
    if (isNaN(newValue) || newValue < 0 || newValue > modTarget.maxScore) {
      toast.error(`La nouvelle note doit être entre 0 et ${modTarget.maxScore}`);
      return;
    }
    if (!modReason.trim()) {
      toast.error('Veuillez expliquer le motif de la demande');
      return;
    }
    setModSending(true);
    try {
      const res = await fetch('/api/note-modifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noteId: modTarget.id,
          oldValue: modTarget.score,
          newValue,
          oldMax: modTarget.maxScore,
          newMax: modTarget.maxScore,
          reason: modReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Demande envoyée. Le directeur sera notifié pour validation.');
      setModStatusMap((prev) => ({ ...prev, [modTarget.id]: 'PENDING' }));
      setModTarget(null); setModReason(''); setModNewScore('');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'envoi');
    } finally {
      setModSending(false);
    }
  };

  const modBadge = (gradeId: string) => {
    const status = modStatusMap[gradeId];
    if (!status) return null;
    if (status === 'PENDING') return <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">Demande en attente</Badge>;
    if (status === 'APPROVED') return <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">Corrigé</Badge>;
    return <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200">Refusé</Badge>;
  };

  const trimesterLabels: Record<string, string> = {
    '1': '1er Trimestre', '2': '2e Trimestre', '3': '3e Trimestre',
    P1: 'P1', P2: 'P2', EX1: 'Examen 1', P3: 'P3', P4: 'P4', EX2: 'Examen 2',
  };

  // Group grades by course so each course shows its period breakdown + average.
  const groupedByCourse = useMemo(() => {
    const map = new Map<string, GradeInfo[]>();
    for (const g of grades) {
      const list = map.get(g.courseId) || [];
      list.push(g);
      map.set(g.courseId, list);
    }
    return Array.from(map.entries()).map(([courseId, list]) => {
      const course = list[0].course;
      const normalized = list.map((g) => (g.score / g.maxScore) * 20);
      const avg = normalized.reduce((a, b) => a + b, 0) / normalized.length;
      return {
        courseId,
        courseName: course?.name || '—',
        coeff: list[0]?.effectiveCoefficient ?? course?.coefficient ?? 1,
        grades: list,
        average: Math.round(avg * 100) / 100,
      };
    });
  }, [grades]);

  // Weighted general average by course (coefficient-aware), matching the bulletin.
  const average = groupedByCourse.length > 0
      ? groupedByCourse.reduce((sum, e) => sum + e.average * e.coeff, 0) /
        groupedByCourse.reduce((sum, e) => sum + e.coeff, 0)
      : 0;

  const getGradeColor = (score: number, maxScore: number) => {
    const val = (score / maxScore) * 20;
    if (val >= 16) return 'text-green-600 dark:text-green-400';
    if (val >= 14) return 'text-blue-600 dark:text-blue-400';
    if (val >= 12) return 'text-yellow-600 dark:text-yellow-400';
    if (val >= 10) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getGradeBg = (score: number, maxScore: number) => {
    const val = (score / maxScore) * 20;
    if (val >= 16) return 'bg-green-50 text-green-700 border border-green-200';
    if (val >= 14) return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (val >= 12) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    if (val >= 10) return 'bg-orange-50 text-orange-700 border border-orange-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  };

  const getProgressColor = (score: number, maxScore: number) => {
    const val = (score / maxScore) * 20;
    if (val >= 16) return 'bg-green-500';
    if (val >= 14) return 'bg-blue-500';
    if (val >= 12) return 'bg-yellow-500';
    if (val >= 10) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getAverageBadge = (avg: number) => {
    if (avg >= 16) return { label: '🟢 Excellent', className: 'bg-green-50 text-green-700 border-green-200' };
    if (avg >= 14) return { label: '🔵 Très bien', className: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (avg >= 12) return { label: '🟡 Bien', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    if (avg >= 10) return { label: '🟠 Assez bien', className: 'bg-orange-50 text-orange-700 border-orange-200' };
    return { label: '🔴 Insuffisant', className: 'bg-red-50 text-red-700 border-red-200' };
  };

  const getAverageIcon = (avg: number) => {
    if (avg >= 14) return <Award className="h-8 w-8 text-emerald-600 animate-pulse-soft" />;
    if (avg >= 10) return <TrendingUp className="h-8 w-8 text-blue-500" />;
    return <AlertTriangle className="h-8 w-8 text-red-500" />;
  };

  const getSparkline = () => {
    if (grades.length < 2) return null;
    const width = 120;
    const height = 30;
    const maxVal = 20;
    const minVal = 0;
    
    const points = grades.map((g, idx) => {
      const x = (idx / (grades.length - 1)) * (width - 10) + 5;
      const normalizedScore = (g.score / g.maxScore) * 20;
      const y = height - ((normalizedScore - minVal) / (maxVal - minVal)) * (height - 10) - 5;
      return `${x},${y}`;
    }).join(' ');
    
    return (
      <svg className="w-28 h-8 text-blue-600 dark:text-blue-400 shrink-0 hidden sm:block" viewBox={`0 0 ${width} ${height}`}>
        <polyline fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {grades.map((g, idx) => {
          const x = (idx / (grades.length - 1)) * (width - 10) + 5;
          const normalizedScore = (g.score / g.maxScore) * 20;
          const y = height - ((normalizedScore - minVal) / (maxVal - minVal)) * (height - 10) - 5;
          return (
            <circle key={idx} cx={x} cy={y} r="2.5" className="fill-blue-600 dark:fill-blue-400 stroke-background stroke-[1.5px]" />
          );
        })}
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-9 w-80 rounded-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mes notes</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivez vos performances académiques par trimestre</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          className="rounded-full shadow-sm"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* Average Card */}
      <Card className="bg-gradient-to-r from-blue-50 via-blue-50 to-indigo-50 border-blue-200 shadow-sm relative overflow-hidden">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <CardDescription className="text-sm font-medium text-blue-700">
              Moyenne générale — Trimestre {trimester}
            </CardDescription>
            <p className="text-4xl font-bold mt-1" style={{ color: average >= 16 ? '#16a34a' : average >= 14 ? '#2563eb' : average >= 12 ? '#ca8a04' : average >= 10 ? '#ea580c' : '#dc2626' }}>
              {grades.length > 0 ? average.toFixed(2) : '—'}
              <span className="text-lg text-muted-foreground ml-1">/20</span>
            </p>
            <div className="mt-2">
              {grades.length > 0 && (() => { const badge = getAverageBadge(average); return <Badge variant="outline" className={badge.className}>{badge.label}</Badge>; })()}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {grades.length >= 2 && getSparkline()}
            <div className="flex items-center gap-3">
              {grades.length > 0 && getAverageIcon(average)}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{grades.length} note(s)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trimester Tabs */}
      <Tabs value={trimester} onValueChange={setTrimester}>
        <TabsList>
          <TabsTrigger value="1" className="gap-1.5"><BarChart3 className="h-4 w-4" />Trimestre 1</TabsTrigger>
          <TabsTrigger value="2" className="gap-1.5"><BarChart3 className="h-4 w-4" />Trimestre 2</TabsTrigger>
          <TabsTrigger value="3" className="gap-1.5"><BarChart3 className="h-4 w-4" />Trimestre 3</TabsTrigger>
        </TabsList>

        <TabsContent value={trimester} className="mt-4">
          {grades.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"><BarChart3 className="h-10 w-10 text-muted-foreground/50" /></div>
              <h3 className="text-lg font-semibold mb-1">Aucune note</h3>
              <p className="text-muted-foreground">Aucune note enregistrée pour ce trimestre.</p>
            </div>
          ) : (
            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="text-sm min-w-[600px]">
                    <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur z-10">
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="pl-6">Cours</TableHead>
                        <TableHead className="text-center">Note</TableHead>
                        <TableHead className="text-center">Note max</TableHead>
                        <TableHead className="text-center">Moyenne</TableHead>
                        <TableHead className="hidden sm:table-cell">Commentaire/Appréciation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
                      {groupedByCourse.map((entry) => {
                        const pct = Math.round((entry.average / 20) * 100);
                        return (
                          <TableRow key={entry.courseId} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                            <TableCell className="pl-6 font-medium">
                              {entry.courseName}
                              <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                                Coef. {entry.coeff} · {entry.grades.length} note(s)
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-wrap justify-center gap-1">
                                {entry.grades.map((g) => (
                                  <div key={g.id} className="inline-flex flex-col items-center gap-0.5">
                                    <span
                                      title={`${trimesterLabels[g.trimester] || g.trimester} : ${g.score}/${g.maxScore}`}
                                      className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold ${getGradeBg(g.score, g.maxScore)}`}
                                    >
                                      {g.score}
                                    </span>
                                    {modBadge(g.id)}
                                    <button
                                      type="button"
                                      onClick={() => { setModTarget(g as GradeWithMod); setModReason(''); setModNewScore(''); }}
                                      className="text-[9px] text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                    >
                                      <PenLine className="h-2.5 w-2.5" /> Signal erreur
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              <div className="flex flex-wrap justify-center gap-1">
                                {entry.grades.map((g) => (
                                  <span key={g.id} className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold bg-muted">
                                    /{g.maxScore}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${getProgressColor(entry.average, 20)}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground">{entry.average.toFixed(1)}/20 ({pct}%)</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-muted-foreground text-sm">
                              {entry.grades.map((g) => g.comment).filter(Boolean).join(' · ') || '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Average Row */}
                      <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold">
                        <TableCell className="pl-6 text-blue-700">Moyenne</TableCell>
                        <TableCell colSpan={2}></TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm">{average.toFixed(2)}/20</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell"></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Demande de correction de note */}
      <Dialog open={!!modTarget} onOpenChange={(o) => { if (!o) { setModTarget(null); setModReason(''); setModNewScore(''); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenLine className="w-5 h-5 text-blue-600" /> Demander une correction de note</DialogTitle>
            <DialogDescription>
              {modTarget ? `${modTarget.course?.name || 'Cette matière'} — note actuelle : ${modTarget.score}/${modTarget.maxScore}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nouvelle note (sur {modTarget?.maxScore ?? 20})</Label>
              <Input type="number" min={0} max={modTarget?.maxScore ?? 20} step={0.01} value={modNewScore} onChange={(e) => setModNewScore(e.target.value)} placeholder="Ex : 15" />
            </div>
            <div className="space-y-1.5">
              <Label>Motif de la demande *</Label>
              <Textarea value={modReason} onChange={(e) => setModReason(e.target.value)} placeholder="Expliquez pourquoi la note vous semble erronée (relecture, oubli, calcul…)…" className="min-h-[90px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModTarget(null)}>Annuler</Button>
            <Button onClick={sendModification} disabled={modSending} className="bg-blue-600 hover:bg-blue-700 text-white">
              {modSending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
