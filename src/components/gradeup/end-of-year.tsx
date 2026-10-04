'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  GraduationCap,
  ArrowUpCircle,
  RotateCcw,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  ChevronRight,
  Eye,
  TrendingUp,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ClassAnalysis {
  classId: string;
  className: string;
  totalStudents: number;
  passages: number;
  redoublements: number;
  finsCursus: number;
  enAttente: number;
  sansNotes?: number;
}

interface StudentAnalysis {
  studentId: string;
  fullName: string;
  matricule: string;
  overallAverage: number;
  subjectResults: { name: string; average: number; maxScore: number }[];
  totalAbsences: number;
  justifiedAbsences: number;
  unjustifiedAbsences: number;
  autoDecision: string;
  hasGrades: boolean;
  hasReportCard: boolean;
}

interface Recap {
  total: number;
  promoted: number;
  redoubling: number;
  leaving: number;
  byClass: Record<string, { className: string; total: number; promoted: number; redoubling: number; leaving: number }>;
}

interface Diagnostics {
  studentsWithoutGrades: number;
  unvalidatedBulletins: number;
  classesIncomplete: string[];
  anomalies: string[];
  canClose: boolean;
}

interface Progression {
  progression: number;
  components: { coverageCours: number; coverageNotes: number; coveragePresence: number; bulletins: number };
  raw: Record<string, number>;
}

export default function EndOfYear() {
  const user = useAppStore((s) => s.user);
  const schoolId = user?.schoolId;
  const { toast } = useToast();

  const [classes, setClasses] = useState<ClassAnalysis[]>([]);
  const [students, setStudents] = useState<StudentAnalysis[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const [lockDialog, setLockDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [newYear, setNewYear] = useState('2026-2027');
  const [decisions, setDecisions] = useState<Record<string, string>>({});

  const [recap, setRecap] = useState<Recap | null>(null);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [closeDialog, setCloseDialog] = useState(false);
  const [closing, setClosing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';

  const fetchProgression = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/stats/progression?schoolId=${schoolId}`);
      if (res.ok) setProgression(await res.json());
    } catch {
      /* silencieux */
    }
  }, [schoolId]);

  const fetchGlobal = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId });
      if (isTeacher && user) params.set('teacherId', user.id);
      params.set('scope', 'global');
      const res = await fetch(`/api/end-of-year?${params}`);
      const data = await res.json();
      setClasses(data.classes || []);
      if (isAdmin) {
        setRecap(data.recap || null);
        setDiagnostics(data.diagnostics || null);
      }
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [schoolId, user?.id, isTeacher, isAdmin, toast]);

  const fetchStudents = useCallback(async (classId: string) => {
    setStudentLoading(true);
    setSelectedClass(classId);
    try {
      const params = new URLSearchParams({ schoolId: schoolId ?? '', classId });
      if (isTeacher && user) params.set('teacherId', user.id);
      const res = await fetch(`/api/end-of-year?${params}`);
      const data = await res.json();
      setStudents(data.students || []);
      const auto: Record<string, string> = {};
      (data.students || []).forEach((s: StudentAnalysis) => { auto[s.studentId] = s.autoDecision; });
      setDecisions(auto);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les élèves', variant: 'destructive' });
    } finally {
      setStudentLoading(false);
    }
  }, [schoolId, isTeacher, user?.id, toast]);

  useEffect(() => {
    fetchGlobal();
    fetchProgression();
  }, [fetchGlobal, fetchProgression]);

  // Temps réel : rafraîchit automatiquement quand une clôture est diffusée.
  useEffect(() => {
    if (!schoolId || !isAdmin) return;
    const channel = supabase
      .channel(`school-year-${schoolId}`)
      .on('broadcast', { event: 'year-closed' }, () => {
        fetchGlobal();
        fetchProgression();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [schoolId, isAdmin, fetchGlobal, fetchProgression]);

  if (!user) return null;

  const handleLockYear = async () => {
    if (!schoolId) return;
    try {
      const res = await fetch('/api/end-of-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lock-year', schoolId, adminId: user.id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Succès', description: 'Année scolaire verrouillée' });
      setLockDialog(false);
    } catch {
      toast({ title: 'Erreur', description: 'Échec du verrouillage', variant: 'destructive' });
    }
  };

  const handleGenerateClasses = async () => {
    if (!schoolId || !selectedClass) return;
    try {
      const decisionsArr = students.map((s) => ({
        studentId: s.studentId,
        status: decisions[s.studentId] || s.autoDecision,
      }));
      const res = await fetch('/api/end-of-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-classes',
          schoolId,
          adminId: user.id,
          classId: selectedClass,
          decisions: decisionsArr,
          newAcademicYear: newYear,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Succès', description: 'Classes générées pour la nouvelle année' });
      setGenerateDialog(false);
      fetchGlobal();
    } catch {
      toast({ title: 'Erreur', description: 'Échec de génération', variant: 'destructive' });
    }
  };

  const openCloseDialog = () => {
    setCloseDialog(true);
  };

  const handleCloseYear = async () => {
    if (!schoolId) return;
    setClosing(true);
    try {
      const res = await fetch('/api/end-of-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close-year',
          schoolId,
          adminId: user.id,
          newAcademicYear: newYear,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec');
      toast({ title: 'Clôture effectuée', description: `Promus: ${data.promoted} · Redoublants: ${data.redoubling} · Sortants: ${data.leaving}` });
      setCloseDialog(false);
      fetchGlobal();
      fetchProgression();
      // Diffuse en temps réel à tous les tableaux de bord
      channelRef.current?.send({ type: 'broadcast', event: 'year-closed', payload: { newYear: data.newYear } });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message || 'Échec de la clôture', variant: 'destructive' });
    } finally {
      setClosing(false);
    }
  };

  const totalAll = classes.reduce((s, c) => s + c.totalStudents, 0);
  const passagesAll = classes.reduce((s, c) => s + c.passages, 0);
  const redoublementsAll = classes.reduce((s, c) => s + c.redoublements, 0);
  const enAttenteAll = classes.reduce((s, c) => s + c.enAttente, 0);

  const getDecisionBadge = (d: string) => {
    switch (d) {
      case 'passage': return <Badge className="bg-green-100 text-green-700"><ArrowUpCircle className="w-3 h-3 mr-1" />Passage</Badge>;
      case 'redoublement': return <Badge variant="destructive"><RotateCcw className="w-3 h-3 mr-1" />Redoublement</Badge>;
      case 'fin_cursus': return <Badge className="bg-blue-100 text-blue-700"><Award className="w-3 h-3 mr-1" />Fin de cursus</Badge>;
      default: return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Délibération</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fin du cursus scolaire</h1>
          <p className="text-muted-foreground">Analyse, clôture et transition des élèves en temps réel</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Button variant="outline" onClick={() => setLockDialog(true)}>
                <Lock className="w-4 h-4 mr-2" /> Verrouiller l'année
              </Button>
              {selectedClass && (
                <Button onClick={() => setGenerateDialog(true)}>
                  <GraduationCap className="w-4 h-4 mr-2" /> Générer classes N+1
                </Button>
              )}
              <Button variant="destructive" onClick={openCloseDialog} disabled={diagnostics ? !diagnostics.canClose : false}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Clôturer &amp; transitionner
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => { fetchGlobal(); fetchProgression(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Progression annuelle globale (calculée sur données réelles) */}
      {progression && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Progression annuelle globale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-indigo-600">{progression.progression}%</span>
              <div className="flex-1">
                <Progress value={progression.progression} className="h-3" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
              <div>Cours couverts : <span className="font-semibold text-foreground">{progression.components.coverageCours}%</span></div>
              <div>Notes saisies : <span className="font-semibold text-foreground">{progression.components.coverageNotes}%</span></div>
              <div>Présences : <span className="font-semibold text-foreground">{progression.components.coveragePresence}%</span></div>
              <div>Bulletins validés : <span className="font-semibold text-foreground">{progression.components.bulletins}%</span></div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Calculé en temps réel à partir des cours, leçons, notes, présences et bulletins enregistrés ({progression.raw.totalCourses} cours, {progression.raw.totalStudents} élèves, {progression.raw.lessonsPublished} leçons, {progression.raw.totalGrades} notes, {progression.raw.validatedBulletins} bulletins validés).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics */}
      {isAdmin && diagnostics && (
        <Card className={diagnostics.canClose ? 'border-green-200' : 'border-amber-300'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              {diagnostics.canClose ? (
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              )}
              Vérification avant clôture
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnostics.canClose ? (
              <p className="text-sm text-green-700">Aucune anomalie détectée. La clôture peut être validée.</p>
            ) : (
              <ul className="list-disc pl-5 space-y-1 text-sm text-amber-700">
                {diagnostics.anomalies.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total élèves</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{totalAll}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Passages</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{passagesAll}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-red-600">Redoublements</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{redoublementsAll}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-blue-600">Fin de cursus</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{classes.reduce((s, c) => s + c.finsCursus, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-yellow-600">En attente</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-600">{enAttenteAll}</div></CardContent></Card>
      </div>

      {isAdmin && recap && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Récapitulatif consolidé (modifications prévues)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Total concerné :</span> <strong>{recap.total}</strong></div>
              <div><span className="text-green-600">Promus :</span> <strong>{recap.promoted}</strong></div>
              <div><span className="text-red-600">Redoublants :</span> <strong>{recap.redoubling}</strong></div>
              <div><span className="text-blue-600">Sortants :</span> <strong>{recap.leaving}</strong></div>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.values(recap.byClass).map((c) => (
                <div key={c.className} className="text-xs border rounded p-2">
                  <div className="font-medium">{c.className}</div>
                  <div className="text-muted-foreground">
                    {c.total} élèves · <span className="text-green-600">{c.promoted}↑</span> · <span className="text-red-600">{c.redoubling}↻</span> · <span className="text-blue-600">{c.leaving}⤴</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Classes</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <button
                      key={cls.classId}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedClass === cls.classId ? 'border-primary bg-primary/5' : 'hover:bg-accent'}`}
                      onClick={() => fetchStudents(cls.classId)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{cls.className}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{cls.totalStudents} élèves</span>
                        <span className="text-green-600">{cls.passages} ✅</span>
                        <span className="text-red-600">{cls.redoublements} 🔄</span>
                        {cls.finsCursus > 0 && <span className="text-blue-600">{cls.finsCursus} 🎓</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{selectedClass ? `Élèves de la classe sélectionnée` : 'Sélectionnez une classe'}</CardTitle></CardHeader>
          <CardContent>
            {!selectedClass ? (
              <div className="text-center py-12 text-muted-foreground">Cliquez sur une classe pour voir les élèves</div>
            ) : studentLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Aucun élève trouvé</div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {students.map((s) => (
                    <Card key={s.studentId} className="border-l-4 border-l-transparent hover:border-l-primary">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{s.fullName}</span>
                              {getDecisionBadge(decisions[s.studentId] || s.autoDecision)}
                              {!s.hasGrades && <Badge variant="outline" className="text-amber-600">Sans notes</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Moyenne: {s.overallAverage.toFixed(1)}/20 · Absences: {s.totalAbsences} ({s.justifiedAbsences} justifiées)
                            </p>
                          </div>
                          {isAdmin && (
                            <select
                              className="border rounded px-2 py-1 text-sm"
                              value={decisions[s.studentId] || s.autoDecision}
                              onChange={(e) => setDecisions({ ...decisions, [s.studentId]: e.target.value })}
                            >
                              <option value="passage">Passage</option>
                              <option value="redoublement">Redoublement</option>
                              <option value="en_deliberation">Délibération</option>
                              <option value="transfert">Transfert</option>
                              <option value="abandon">Abandon</option>
                              <option value="fin_cursus">Fin de cursus</option>
                            </select>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={lockDialog} onOpenChange={setLockDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verrouiller l'année scolaire</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action verrouille l'année en cours. Après cela, aucun changement ne sera possible. Confirmez-vous ?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLockDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleLockYear}>Verrouiller</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Générer les classes N+1</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Les décisions seront appliquées : passage → promotion, redoublement → maintien.</p>
            <div>
              <Label>Nouvelle année scolaire</Label>
              <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {students.map((s) => (
                <div key={s.studentId} className="flex justify-between text-sm py-1 border-b">
                  <span>{s.fullName}</span>
                  <Badge variant="outline">{decisions[s.studentId] || s.autoDecision}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Annuler</Button>
            <Button onClick={handleGenerateClasses}>Générer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clôture &amp; transition de l'année scolaire</DialogTitle>
            <DialogDescription>
              Vérifiez le récapitulatif. Après validation, les transitions sont appliquées et enregistrées de manière irréversible, avec synchronisation temps réel sur tous les tableaux de bord.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nouvelle année scolaire</Label>
              <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} />
            </div>
            {recap && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border p-3"><div className="text-muted-foreground">Total</div><div className="text-xl font-bold">{recap.total}</div></div>
                <div className="rounded-lg border p-3"><div className="text-green-600">Promus</div><div className="text-xl font-bold text-green-600">{recap.promoted}</div></div>
                <div className="rounded-lg border p-3"><div className="text-red-600">Redoublants</div><div className="text-xl font-bold text-red-600">{recap.redoubling}</div></div>
                <div className="rounded-lg border p-3"><div className="text-blue-600">Sortants</div><div className="text-xl font-bold text-blue-600">{recap.leaving}</div></div>
              </div>
            )}
            {diagnostics && !diagnostics.canClose && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                <strong>Anomalies détectées :</strong>
                <ul className="list-disc pl-5 mt-1">
                  {diagnostics.anomalies.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
                <p className="mt-1">La clôture est bloquée tant que ces points ne sont pas corrigés.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCloseYear} disabled={closing || (diagnostics ? !diagnostics.canClose : true)}>
              {closing ? 'Clôture en cours…' : 'Valider la clôture définitive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
