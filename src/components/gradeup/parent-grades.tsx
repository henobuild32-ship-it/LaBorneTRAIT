'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { UserInfo, GradeInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp, BookOpen, Award, BarChart3, PenLine,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function ParentGrades() {
  const { user } = useAppStore();
  const [children, setChildren] = useState<UserInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [trimester, setTrimester] = useState('1');
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [modTarget, setModTarget] = useState<GradeInfo | null>(null);
  const [modReason, setModReason] = useState('');
  const [modNewScore, setModNewScore] = useState('');
  const [modSending, setModSending] = useState(false);
  const [modStatusMap, setModStatusMap] = useState<Record<string, string>>({});
  const schoolId = user?.schoolId || '';

  useEffect(() => { fetchChildren(); }, [user]);
  useEffect(() => { if (selectedChildId && schoolId) { fetchGrades(); } }, [selectedChildId, trimester, schoolId]);

  const fetchChildren = async () => {
    if (!user?.id || !schoolId) {
      setLoadingChildren(false);
      return;
    }
    setLoadingChildren(true);
    try {
      const res = await fetch(`/api/users?schoolId=${schoolId}&role=STUDENT&parentId=${user.id}`);
      if (res.ok) { 
        const data = await res.json(); 
        const childrenArray = Array.isArray(data.users) ? data.users : [];
        setChildren(childrenArray); 
        if (childrenArray.length > 0 && !selectedChildId) { 
          setSelectedChildId(childrenArray[0].id); 
        } 
      } else {
        setChildren([]);
      }
    } catch { 
      toast.error('Erreur lors du chargement des enfants');
      setChildren([]);
    } finally { 
      setLoadingChildren(false);
    }
  };

  const fetchGrades = async () => {
    if (!selectedChildId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/grades?schoolId=${schoolId}&studentId=${selectedChildId}&trimester=${trimester}`);
      if (res.ok) { 
        const data = await res.json();
        setGrades(Array.isArray(data.grades) ? data.grades : []);
      } else {
        setGrades([]);
      }
      // Statut des demandes de correction pour cet enfant
      try {
        const modRes = await fetch(`/api/note-modifications?schoolId=${schoolId}&studentId=${selectedChildId}`);
        const modData = await modRes.json();
        const map: Record<string, string> = {};
        const mods = Array.isArray(modData.noteModifications) ? modData.noteModifications : [];
        for (const m of mods) {
          if (!map[m.noteId] || m.requestStatus === 'PENDING') map[m.noteId] = m.requestStatus;
        }
        setModStatusMap(map);
      } catch { /* silencieux */ }
    } catch { 
      toast.error('Erreur lors du chargement des notes');
      setGrades([]);
    } finally { 
      setLoading(false);
    }
  };

  // Vérification que children est bien un tableau avant d'utiliser find
  const selectedChild = Array.isArray(children) ? children.find(c => c.id === selectedChildId) : undefined;

  const gradesByCourse = (Array.isArray(grades) ? grades : []).reduce<Record<string, GradeInfo[]>>((acc, grade) => {
    const key = grade.courseId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(grade);
    return acc;
  }, {});

  const courseAverages = Object.entries(gradesByCourse).map(([courseId, courseGrades]) => {
    const validGrades = courseGrades.filter(g => g.maxScore > 0);
    const avg = validGrades.length > 0
      ? validGrades.reduce((sum, g) => sum + (g.score / g.maxScore) * 20, 0) / validGrades.length
      : 0;
    const courseName = courseGrades[0]?.course?.name || 'Cours inconnu';
    const coeff = courseGrades[0]?.effectiveCoefficient ?? courseGrades[0]?.course?.coefficient ?? 1;
    return { courseId, courseName, average: avg, coeff, grades: courseGrades };
  }).sort((a, b) => b.average - a.average);

  // Moyenne générale pondérée par les coefficients effectifs (cohérente avec le bulletin)
  const overallAverage = courseAverages.length > 0
    ? courseAverages.reduce((sum, e) => sum + e.average * e.coeff, 0) /
      courseAverages.reduce((sum, e) => sum + e.coeff, 0)
    : 0;

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

  const getGradeColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getGradeBg = (score: number, max: number) => {
    const normalized = max > 0 ? (score / max) * 20 : 0;
    if (normalized >= 10) return 'bg-emerald-50 text-emerald-700';
    if (normalized >= 7) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-red-700';
  };

  const getProgressColor = (avg: number) => {
    if (avg >= 16) return '[&>div]:bg-emerald-500';
    if (avg >= 12) return '[&>div]:bg-blue-500';
    if (avg >= 10) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-red-500';
  };

  const getAverageBadge = (avg: number) => {
    if (avg >= 16) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (avg >= 14) return { label: 'Très bien', className: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (avg >= 12) return { label: 'Bien', className: 'bg-sky-100 text-sky-700 border-sky-200' };
    if (avg >= 10) return { label: 'Assez bien', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Insuffisant', className: 'bg-red-100 text-red-700 border-red-200' };
  };

  const trimesterLabels: Record<string, string> = { '1': '1er Trimestre', '2': '2ème Trimestre', '3': '3ème Trimestre' };

  if (!user) return null;

  // Affichage du chargement des enfants
  if (loadingChildren) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi des notes de vos enfants</p>
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Aucun enfant trouvé
  if (Array.isArray(children) && children.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
          <h1 className="text-2xl font-bold">Notes</h1>
          <p className="text-sm text-muted-foreground mt-1">Suivi des notes de vos enfants</p>
        </div>
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucun enfant trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Notes</h1>
        <p className="text-sm text-muted-foreground mt-1">Suivi des notes de vos enfants</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {Array.isArray(children) && children.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Enfant :</span>
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-[200px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                <SelectValue placeholder="Sélectionner un enfant" />
              </SelectTrigger>
              <SelectContent>
                {children.map(child => <SelectItem key={child.id} value={child.id}>{child.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Trimestre :</span>
          <Select value={trimester} onValueChange={setTrimester}>
            <SelectTrigger className="w-[180px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1er Trimestre</SelectItem>
              <SelectItem value="2">2ème Trimestre</SelectItem>
              <SelectItem value="3">3ème Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !Array.isArray(grades) || grades.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucune note disponible pour ce trimestre</p>
        </div>
      ) : (
        <>
          {/* Overall Average */}
          <Card className="border-blue-100 bg-gradient-to-r from-blue-50/50 to-white shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="size-4 text-blue-600" />
                    Moyenne générale — {trimesterLabels[trimester]} — {selectedChild?.fullName}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold">{overallAverage.toFixed(2)}</span>
                    <span className="text-muted-foreground text-lg">/20</span>
                    {(() => { const badge = getAverageBadge(overallAverage); return <Badge variant="outline" className={badge.className}>{badge.label}</Badge>; })()}
                  </div>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{grades.length}</p>
                    <p>Évaluations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{courseAverages.length}</p>
                    <p>Matières</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* View Toggle */}
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview" className="gap-1.5">
                <BarChart3 className="size-4" />Vue d&apos;ensemble
              </TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5">
                <BookOpen className="size-4" />Détails
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="size-5 text-blue-600" />Moyennes par matière
                  </CardTitle>
                  <CardDescription>Performance par cours pour le {trimesterLabels[trimester].toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-5">
                      {courseAverages.map(({ courseId, courseName, average, coeff, grades: courseGrades }) => {
                        const badge = getAverageBadge(average);
                        return (
                          <div key={courseId} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium truncate">{courseName}</span>
                                <span className="text-xs text-muted-foreground">(coef. {coeff} · {courseGrades.length} éval.)</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-sm font-bold ${average >= 10 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {average.toFixed(1)}/20
                                </span>
                                <Badge variant="outline" className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                              </div>
                            </div>
                            <div className={`h-2.5 w-full rounded-full overflow-hidden bg-primary/10 ${getProgressColor(average)}`}>
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(average * 5, 100)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="size-5 text-blue-600" />Détail des évaluations
                  </CardTitle>
                  <CardDescription>Toutes les notes du {trimesterLabels[trimester].toLowerCase()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead>Cours</TableHead>
                          <TableHead className="text-center">Note</TableHead>
                          <TableHead className="text-center">Note max</TableHead>
                          <TableHead className="text-center">Moyenne (/20)</TableHead>
                          <TableHead className="hidden sm:table-cell">Commentaire</TableHead>
                          <TableHead className="hidden md:table-cell">Date</TableHead>
                          <TableHead className="text-center">Correction</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...grades].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(grade => {
                          const normalizedScore = grade.maxScore > 0 ? (grade.score / grade.maxScore) * 20 : 0;
                          const modStatus = modStatusMap[grade.id];
                          return (
                            <TableRow key={grade.id} className="even:bg-muted/20 hover:bg-blue-50/50 transition-colors">
                              <TableCell className="font-medium">{grade.course?.name || 'Cours'}</TableCell>
                              <TableCell className={`text-center font-semibold ${getGradeColor(grade.score, grade.maxScore)}`}>
                                {grade.score}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground">{grade.maxScore}</TableCell>
                              <TableCell className="text-center">
                                <span className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-sm font-bold shadow-sm ${getGradeBg(grade.score, grade.maxScore)}`}>
                                  {normalizedScore.toFixed(1)}
                                </span>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground max-w-[200px] truncate">
                                {grade.comment || '—'}
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                                {new Date(grade.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </TableCell>
                              <TableCell className="text-center">
                                {modStatus ? (
                                  <Badge className={`text-[9px] ${modStatus === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' : modStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                    {modStatus === 'PENDING' ? 'En attente' : modStatus === 'APPROVED' ? 'Corrigé' : 'Refusé'}
                                  </Badge>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { setModTarget(grade); setModReason(''); setModNewScore(''); }}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-0.5"
                                  >
                                    <PenLine className="h-3 w-3" /> Signaler
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {/* Average Row */}
                        <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold">
                          <TableCell className="text-blue-700">Moyenne</TableCell>
                          <TableCell colSpan={2}></TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200">{overallAverage.toFixed(2)}/20</Badge>
                          </TableCell>
                          <TableCell colSpan={2}></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Demande de correction de note */}
      <Dialog open={!!modTarget} onOpenChange={(o) => { if (!o) { setModTarget(null); setModReason(''); setModNewScore(''); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PenLine className="w-5 h-5 text-blue-600" /> Demander une correction de note</DialogTitle>
            <DialogDescription>
              {modTarget ? `${modTarget.course?.name || 'Cette matière'} de ${selectedChild?.fullName || ''} — note actuelle : ${modTarget.score}/${modTarget.maxScore}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nouvelle note (sur {modTarget?.maxScore ?? 20})</Label>
              <Input type="number" min={0} max={modTarget?.maxScore ?? 20} step={0.01} value={modNewScore} onChange={(e) => setModNewScore(e.target.value)} placeholder="Ex : 15" />
            </div>
            <div className="space-y-1.5">
              <Label>Motif de la demande *</Label>
              <Textarea value={modReason} onChange={(e) => setModReason(e.target.value)} placeholder="Expliquez pourquoi la note semble erronée…" className="min-h-[90px]" />
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