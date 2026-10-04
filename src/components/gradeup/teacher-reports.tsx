'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  CheckCircle2,
  Clock,
  Send,
  Eye,
  Plus,
  RefreshCw,
  GraduationCap,
  Users,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Check,
  FileCheck
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ReportCardItem {
  id: string;
  reportNumber: string;
  studentId: string;
  trimester: string;
  academicYear: string;
  studentName: string;
  overallPercentage: number;
  averageGrade: number;
  mention: string;
  status: string;
  createdAt: string;
  student: { id: string; fullName: string; photoUrl: string };
  class: { id: string; name: string; level: string };
  gradesData: Record<string, unknown>;
}

interface ClassInfo {
  id: string;
  name: string;
  level: string;
  _count: { enrollments: number };
}

export default function TeacherReports() {
  const user = useAppStore((s) => s.user);
  const schoolId = user?.schoolId;
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<{ id: string; fullName: string; gender?: string; birthDate?: string; classId?: string; classEnrollments?: { classId: string }[] }[]>([]);
  const [reportCards, setReportCards] = useState<ReportCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [viewReport, setViewReport] = useState<ReportCardItem | null>(null);

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizClassId, setWizClassId] = useState('');
  const [wizStudentId, setWizStudentId] = useState('');
  const [wizGrades, setWizGrades] = useState<Record<string, number>>({});
  const [wizTrimester, setWizTrimester] = useState('1');
  const [wizAppreciation, setWizAppreciation] = useState('');
  const [wizAverage, setWizAverage] = useState(0);
  const [submittingWiz, setSubmittingWiz] = useState(false);

  const fetchData = useCallback(async () => {
    if (!schoolId || !user) return;
    setLoading(true);
    try {
      const [classesRes, studentsRes, reportsRes] = await Promise.all([
        fetch(`/api/classes?schoolId=${schoolId}`),
        fetch(`/api/users?schoolId=${schoolId}&role=STUDENT&teacherId=${user.id}`),
        fetch(`/api/report-cards?schoolId=${schoolId}&teacherId=${user.id}`),
      ]);
      const classesData = await classesRes.json();
      const studentsData = await studentsRes.json();
      const reportsData = await reportsRes.json();
      setClasses(classesData.classes || []);
      setStudents(studentsData.users || []);
      setReportCards(reportsData.reportCards || []);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les données', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [schoolId, user?.id, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter students based on wizard class select
  const wizFilteredStudents = useMemo(() => {
    if (!wizClassId) return [];
    return students.filter(s => (s.classId ?? s.classEnrollments?.[0]?.classId) === wizClassId);
  }, [wizClassId, students]);

  // Fetch grades for wizard step 2
  const loadStudentGradesForWizard = async (studentId: string) => {
    if (!studentId || !schoolId) return;
    try {
      const res = await fetch(`/api/grades?schoolId=${schoolId}&studentId=${studentId}&trimester=${wizTrimester}`);
      const data = await res.json();
      const list = Array.isArray(data.grades) ? data.grades : [];
      const gradesMap: Record<string, number> = {};
      list.forEach((g: any) => {
        if (g.course?.name) {
          gradesMap[g.course.name] = g.score;
        }
      });
      setWizGrades(gradesMap);
      
      const avg = list.length > 0 ? list.reduce((sum: number, g: any) => sum + (g.score / g.maxScore) * 20, 0) / list.length : 0;
      setWizAverage(avg);

      // Auto-generate appreciation
      let app = "Travail satisfaisant ce trimestre.";
      if (avg >= 16) app = "Excellent trimestre. Félicitations pour ce travail exceptionnel !";
      else if (avg >= 14) app = "Très bon trimestre. Le travail est sérieux et régulier. Continuez ainsi !";
      else if (avg >= 12) app = "Bon trimestre. Élève attentif et soucieux de bien faire.";
      else if (avg >= 10) app = "Trimestre moyen. Des bases sont acquises mais des progrès sont encore possibles avec plus de rigueur.";
      else app = "Trimestre insuffisant. Un travail plus soutenu est indispensable.";
      setWizAppreciation(app);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les notes de l\'élève', variant: 'destructive' });
    }
  };

  const handleCreateReport = async () => {
    if (!wizStudentId || !schoolId || !user) return;
    setSubmittingWiz(true);
    try {
      const res = await fetch('/api/grades/sync-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId,
          classId: wizClassId,
          studentId: wizStudentId,
          trimester: wizTrimester,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de synchronisation');
      toast({ title: 'Succès', description: 'Bulletin généré à partir des cotations enregistrées.' });
      setWizardOpen(false);
      // Reset wizard
      setWizClassId('');
      setWizStudentId('');
      setWizGrades({});
      setWizAppreciation('');
      setWizAverage(0);
      setWizardStep(1);
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: error instanceof Error ? error.message : 'Échec de génération du bulletin', variant: 'destructive' });
    } finally {
      setSubmittingWiz(false);
    }
  };

  const handleTransmit = async (report: ReportCardItem) => {
    try {
      const res = await fetch('/api/report-cards', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, status: 'pending_admin', teacherId: user?.id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: 'Succès', description: 'Bulletin transmis à l\'administration' });
      fetchData();
    } catch {
      toast({ title: 'Erreur', description: 'Échec de transmission', variant: 'destructive' });
    }
  };

  const filteredReports = reportCards.filter((r) => {
    if (selectedClass !== 'all' && r.class.id !== selectedClass) return false;
    return true;
  });

  const draftCount = reportCards.filter((r) => r.status === 'draft').length;
  const pendingCount = reportCards.filter((r) => r.status === 'pending_admin').length;
  const validatedCount = reportCards.filter((r) => r.status === 'validated').length;

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bulletins scolaires</h1>
          <p className="text-sm text-muted-foreground mt-1">Créez, consultez et transmettez les bulletins de vos élèves</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform gap-1.5"
            onClick={() => { setWizardStep(1); setWizardOpen(true); }}
          >
            <Plus className="w-4 h-4" /> Créer bulletin
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="p-4 shadow-sm border border-border bg-card">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <span className="text-xs font-semibold text-muted-foreground">Brouillons</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </div>
          <div className="text-2xl font-bold text-yellow-600 mt-1">{draftCount}</div>
        </Card>
        <Card className="p-4 shadow-sm border border-border bg-card">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <span className="text-xs font-semibold text-muted-foreground">En attente</span>
            <Send className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600 mt-1">{pendingCount}</div>
        </Card>
        <Card className="p-4 shadow-sm border border-border bg-card">
          <div className="flex flex-row items-center justify-between space-y-0 pb-1">
            <span className="text-xs font-semibold text-muted-foreground">Validés</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{validatedCount}</div>
        </Card>
      </div>

      {/* Bulletins lists */}
      <Card className="shadow-sm border border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base font-bold">Bulletins émis</CardTitle>
            <select
              className="border border-input rounded-lg h-9 px-3 bg-background text-xs focus:ring-2 focus:ring-blue-500/20 font-medium"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="all">Toutes les classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-sm">Aucun bulletin disponible</p>
              <p className="text-xs text-muted-foreground mt-1">Créez votre premier bulletin à l'aide de l'assistant</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredReports.map((report) => (
                  <Card key={report.id} className="border-l-4 border-l-transparent hover:border-l-blue-500 transition-colors shadow-sm bg-card">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{report.studentName}</span>
                          <Badge variant={
                            report.status === 'validated' ? 'default' :
                            report.status === 'pending_admin' ? 'secondary' : 'outline'
                          }>
                            {report.status === 'draft' ? 'Brouillon' :
                             report.status === 'pending_admin' ? 'En attente' : 'Validé'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {report.class.name} · T{report.trimester} · Moyenne : <span className="font-semibold text-foreground">{report.averageGrade.toFixed(1)}/20</span>
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewReport(report)} className="rounded-lg">
                          <Eye className="w-4 h-4 mr-1.5" /> Voir
                        </Button>
                        {report.status === 'draft' && (
                          <Button variant="ghost" size="sm" className="text-blue-600 rounded-lg hover:bg-blue-50" onClick={() => handleTransmit(report)}>
                            <Send className="w-4 h-4 mr-1.5" /> Transmettre
                          </Button>
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

      {/* Bulletins Creation Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={(open) => !open && setWizardOpen(false)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-500" />
              Assistant de création de bulletin
            </DialogTitle>
            <CardDescription>
              Suivez les étapes pour configurer et générer le bulletin scolaire
            </CardDescription>
          </DialogHeader>

          {/* Progress Indicator */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground mb-1.5">
              <span>Étape {wizardStep} sur 5</span>
              <span>{Math.round((wizardStep / 5) * 100)}% complété</span>
            </div>
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${(wizardStep / 5) * 100}%` }}
              />
            </div>
          </div>

          <div className="py-2">
            {/* Step 1: Select Class & Student */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Sélectionner la classe</Label>
                  <select
                    value={wizClassId}
                    onChange={(e) => { setWizClassId(e.target.value); setWizStudentId(''); }}
                    className="w-full h-11 border border-input rounded-xl px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    <option value="">Sélectionner une classe</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.level})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Trimestre</Label>
                  <select
                    value={wizTrimester}
                    onChange={(e) => setWizTrimester(e.target.value)}
                    className="w-full h-11 border border-input rounded-xl px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    <option value="1">Trimestre 1</option>
                    <option value="2">Trimestre 2</option>
                    <option value="3">Trimestre 3</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Sélectionner l'élève</Label>
                  <select
                    value={wizStudentId}
                    onChange={(e) => {
                      setWizStudentId(e.target.value);
                      loadStudentGradesForWizard(e.target.value);
                    }}
                    disabled={!wizClassId}
                    className="w-full h-11 border border-input rounded-xl px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 font-medium"
                  >
                    <option value="">{wizClassId ? "Sélectionner l'élève" : "Sélectionnez d'abord une classe"}</option>
                    {wizFilteredStudents.map((s) => (
                      <option key={s.id} value={s.id}>{s.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Verification of Grades */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Notes enregistrées</h3>
                {Object.keys(wizGrades).length === 0 ? (
                  <div className="p-6 text-center border border-dashed rounded-xl text-muted-foreground">
                    Aucune note trouvée pour cet élève au Trimestre {wizTrimester}
                  </div>
                ) : (
                  <div className="border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Matière</TableHead>
                          <TableHead className="font-semibold text-xs text-center">Note /20</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(wizGrades).map(([subject, val]) => (
                          <TableRow key={subject}>
                            <TableCell className="font-medium text-xs">{subject}</TableCell>
                            <TableCell className="text-center font-bold text-xs text-blue-600 bg-blue-50/20">{val}/20</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100">
                  <span className="font-semibold text-sm text-blue-800">Moyenne calculée :</span>
                  <span className="font-bold text-lg text-blue-700">{wizAverage.toFixed(2)}/20</span>
                </div>
              </div>
            )}

            {/* Step 3: Auto-generated appreciation */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Appréciation générale</Label>
                  <Badge className="bg-amber-50 text-amber-700 border-amber-200">Génération IA</Badge>
                </div>
                <Textarea
                  value={wizAppreciation}
                  onChange={(e) => setWizAppreciation(e.target.value)}
                  className="rounded-xl h-32 focus:ring-2 focus:ring-blue-500/20 font-medium text-sm leading-relaxed"
                  placeholder="Écrivez ou modifiez l'appréciation..."
                />
                <p className="text-[10px] text-muted-foreground">Vous pouvez personnaliser cette appréciation générée automatiquement à partir des résultats scolaires.</p>
              </div>
            )}

            {/* Step 4: Preview Bulletin */}
            {wizardStep === 4 && (
              <div className="space-y-4 animate-fade-in border p-4 rounded-2xl bg-muted/20">
                <h3 className="font-bold text-center text-sm border-b pb-2 text-primary">APERÇU DU BULLETIN SCOLAIRE</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Élève :</span> <p className="font-bold mt-0.5">{students.find(s => s.id === wizStudentId)?.fullName}</p></div>
                  <div><span className="text-muted-foreground">Classe :</span> <p className="font-bold mt-0.5">{classes.find(c => c.id === wizClassId)?.name}</p></div>
                  <div><span className="text-muted-foreground">Moyenne :</span> <p className="font-bold text-blue-600 mt-0.5">{wizAverage.toFixed(2)}/20</p></div>
                  <div><span className="text-muted-foreground">Trimestre :</span> <p className="font-bold mt-0.5">Trimestre 3</p></div>
                </div>

                <div className="border-t pt-3 mt-1">
                  <span className="text-xs font-bold text-muted-foreground">Détail des notes</span>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {Object.entries(wizGrades).map(([subj, score]) => (
                      <div key={subj} className="flex justify-between p-2 rounded bg-background border text-xs">
                        <span>{subj}</span>
                        <span className="font-bold">{score}/20</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-3 mt-1 text-xs">
                  <span className="font-bold text-muted-foreground">Appréciation globale</span>
                  <p className="italic text-muted-foreground mt-1.5 leading-relaxed bg-background p-3 rounded-xl border">{wizAppreciation}</p>
                </div>
              </div>
            )}

            {/* Step 5: Confirm & Submit */}
            {wizardStep === 5 && (
              <div className="text-center py-6 animate-fade-in space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="font-extrabold text-base">Prêt pour la transmission ?</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Le bulletin sera enregistré comme brouillon. Vous pourrez ensuite le relire ou le transmettre directement à l'administration scolaire.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="mt-6 flex flex-row items-center justify-between gap-3 border-t pt-4">
            {wizardStep > 1 ? (
              <Button 
                variant="outline" 
                onClick={() => setWizardStep(prev => prev - 1)}
                className="gap-1.5 rounded-xl border border-input h-11"
              >
                <ArrowLeft className="w-4 h-4" /> Précédent
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setWizardOpen(false)}
                className="rounded-xl border border-input h-11"
              >
                Annuler
              </Button>
            )}

            {wizardStep < 5 ? (
              <Button 
                onClick={() => setWizardStep(prev => prev + 1)}
                disabled={wizardStep === 1 && (!wizClassId || !wizStudentId)}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 h-11"
              >
                Suivant <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleCreateReport}
                disabled={submittingWiz}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl gap-1.5 shadow-md shadow-emerald-500/20 h-11"
              >
                {submittingWiz ? "Génération..." : "Enregistrer bulletin"} <Check className="w-4 h-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Bulletin Detail */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bulletin scolaire - {viewReport?.studentName}</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl text-sm">
                <div><p className="text-xs text-muted-foreground">Classe</p><p className="font-bold">{viewReport.class.name}</p></div>
                <div><p className="text-xs text-muted-foreground">Moyenne générale</p><p className="font-bold text-blue-600">{viewReport.averageGrade.toFixed(2)}/20</p></div>
                <div><p className="text-xs text-muted-foreground">Mention attribuée</p><p className="font-bold">{viewReport.mention}</p></div>
                <div><p className="text-xs text-muted-foreground">Statut</p>
                  <p className="mt-0.5">
                    <Badge variant={
                      viewReport.status === 'validated' ? 'default' :
                      viewReport.status === 'pending_admin' ? 'secondary' : 'outline'
                    }>
                      {viewReport.status === 'draft' ? 'Brouillon' :
                       viewReport.status === 'pending_admin' ? 'En attente' : 'Validé'}
                    </Badge>
                  </p>
                </div>
              </div>

              {/* Show detail list of grades inside report card */}
              <div className="border rounded-xl overflow-hidden mt-3">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Matière</TableHead>
                      <TableHead className="font-bold text-xs text-center">Note /20</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries((viewReport.gradesData as any)?.grades || {}).map(([subj, score]) => (
                      <TableRow key={subj}>
                        <TableCell className="font-medium text-xs">{subj}</TableCell>
                        <TableCell className="text-center font-bold text-xs">{Number(score)}/20</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100/50 mt-2">
                <p className="text-xs font-bold text-blue-800">Appréciation globale du professeur</p>
                <p className="text-sm italic text-muted-foreground mt-1.5 leading-relaxed">
                  {(viewReport.gradesData as any)?.appreciation || 'Aucune appréciation formulée.'}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}