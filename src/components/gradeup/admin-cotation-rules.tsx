'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  SlidersHorizontal,
  Save,
  School,
  BookOpen,
  Award,
  Sparkles,
  CheckCircle,
  HelpCircle,
  Baby,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface ClassInfo {
  id: string;
  name: string;
  cycle: string;
  level: string;
  section: string;
}

interface CourseInfo {
  id: string;
  name: string;
  maxScore: number;
  classId: string;
}

interface SubjectRuleData {
  id?: string;
  courseId: string;
  courseName: string;
  maximumPoints: number;
  dailyWorkMaximum: number;
  examMaximum: number;
  coefficient: number | null;
  isQualitative: boolean;
}

interface GradingDecisionRuleData {
  id?: string;
  passPercentage: number;
  retakeMinPercentage: number;
  maxFailedCourses: number;
  eliminationPercentage: number | null;
  maternelleMode: 'QUALITATIF' | 'NUMERIQUE';
}

export default function AdminCotationRules() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [subjectRules, setSubjectRules] = useState<SubjectRuleData[]>([]);
  const [decisionRule, setDecisionRule] = useState<GradingDecisionRuleData>({
    passPercentage: 50.0,
    retakeMinPercentage: 45.0,
    maxFailedCourses: 2,
    eliminationPercentage: 35.0,
    maternelleMode: 'QUALITATIF',
  });

  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);

  // Charger les classes de l'école
  useEffect(() => {
    if (!user?.schoolId) return;
    fetch(`/api/classes?schoolId=${user.schoolId}`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data.classes) ? data.classes : [];
        setClasses(list);
        if (list.length > 0 && !selectedClassId) {
          setSelectedClassId(list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.schoolId]);

  // Charger les règles de cotation de la classe sélectionnée
  const loadClassRules = useCallback(async () => {
    if (!user?.schoolId || !selectedClassId) return;
    try {
      const [coursesRes, rulesRes] = await Promise.all([
        fetch(`/api/courses?schoolId=${user.schoolId}&classId=${selectedClassId}`).then((r) => r.json()),
        fetch(`/api/subject-rules?schoolId=${user.schoolId}&classId=${selectedClassId}`).then((r) => r.json()),
      ]);

      const courseList: CourseInfo[] = Array.isArray(coursesRes.courses) ? coursesRes.courses : [];
      setCourses(courseList);

      const existingRules: any[] = Array.isArray(rulesRes.rules) ? rulesRes.rules : [];
      const ruleMap = new Map<string, any>();
      existingRules.forEach((r) => ruleMap.set(r.courseId, r));

      const mergedRules: SubjectRuleData[] = courseList.map((c) => {
        const found = ruleMap.get(c.id);
        const maxTotal = found?.maximumPoints ?? (c.maxScore > 20 ? c.maxScore : 100);
        return {
          id: found?.id,
          courseId: c.id,
          courseName: c.name,
          maximumPoints: maxTotal,
          dailyWorkMaximum: found?.dailyWorkMaximum ?? Math.round(maxTotal * 0.4),
          examMaximum: found?.examMaximum ?? Math.round(maxTotal * 0.6),
          coefficient: found?.coefficient ?? null,
          isQualitative: found?.isQualitative ?? false,
        };
      });

      setSubjectRules(mergedRules);
    } catch {
      toast.error('Erreur lors du chargement des matières');
    }
  }, [user?.schoolId, selectedClassId]);

  // Charger les règles de délibération
  const loadDecisionRule = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/grading-rules?schoolId=${user.schoolId}`);
      const data = await res.json();
      if (Array.isArray(data.rules) && data.rules.length > 0) {
        const r = data.rules[0];
        setDecisionRule({
          id: r.id,
          passPercentage: r.passPercentage ?? 50.0,
          retakeMinPercentage: r.retakeMinPercentage ?? 45.0,
          maxFailedCourses: r.maxFailedCourses ?? 2,
          eliminationPercentage: r.eliminationPercentage ?? 35.0,
          maternelleMode: r.maternelleMode === 'NUMERIQUE' ? 'NUMERIQUE' : 'QUALITATIF',
        });
      }
    } catch {
      // silencieux
    }
  }, [user?.schoolId]);

  useEffect(() => {
    if (selectedClassId) {
      loadClassRules();
    }
  }, [selectedClassId, loadClassRules]);

  useEffect(() => {
    loadDecisionRule();
  }, [loadDecisionRule]);

  // Mise à jour d'un champ pour un cours
  const updateCourseRule = (courseId: string, field: keyof SubjectRuleData, value: any) => {
    setSubjectRules((prev) =>
      prev.map((r) => {
        if (r.courseId !== courseId) return r;
        const updated = { ...r, [field]: value };
        // Ajustement automatique des TJ et Examen si le Total change
        if (field === 'maximumPoints') {
          const total = Number(value) || 100;
          updated.dailyWorkMaximum = Math.round(total * 0.4);
          updated.examMaximum = Math.round(total * 0.6);
        }
        return updated;
      })
    );
  };

  // Enregistrer les règles de cotation de la classe
  const handleSaveSubjectRules = async () => {
    if (!user?.schoolId || !selectedClassId) return;
    setSavingRules(true);
    try {
      const res = await fetch('/api/subject-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          classId: selectedClassId,
          batchRules: subjectRules,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Règles de cotation enregistrées avec succès !');
      loadClassRules();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingRules(false);
    }
  };

  // Enregistrer les règles de délibération
  const handleSaveDecisionRule = async () => {
    if (!user?.schoolId) return;
    setSavingDecision(true);
    try {
      const res = await fetch('/api/grading-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          ...decisionRule,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Critères de délibération et passage mis à jour !');
      loadDecisionRule();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSavingDecision(false);
    }
  };

  // Appliquer un modèle RDC officiel prédéfini
  const applyPreset = (presetName: string) => {
    setSubjectRules((prev) =>
      prev.map((r) => {
        const name = r.courseName.toLowerCase();
        let max = 40;
        let coeff = 1;

        if (presetName === 'SCIENTIFIQUE') {
          if (name.includes('math') || name.includes('physique') || name.includes('chimie')) {
            max = 80;
            coeff = 2;
          } else if (name.includes('bio') || name.includes('français') || name.includes('anglais')) {
            max = 60;
            coeff = 1;
          } else {
            max = 20;
            coeff = 1;
          }
        } else if (presetName === 'PEDAGOGIQUE') {
          if (name.includes('pédagogie') || name.includes('psychologie') || name.includes('français')) {
            max = 80;
            coeff = 2;
          } else if (name.includes('math') || name.includes('didactique')) {
            max = 60;
            coeff = 1;
          } else {
            max = 20;
            coeff = 1;
          }
        } else if (presetName === 'COMMERCIALE') {
          if (name.includes('comptabilité') || name.includes('économie') || name.includes('math')) {
            max = 80;
            coeff = 2;
          } else if (name.includes('informatique') || name.includes('droit') || name.includes('anglais')) {
            max = 60;
            coeff = 1;
          } else {
            max = 20;
            coeff = 1;
          }
        } else if (presetName === 'EB') {
          if (name.includes('français') || name.includes('math') || name.includes('sciences')) {
            max = 50;
          } else if (name.includes('anglais') || name.includes('histoire') || name.includes('géo')) {
            max = 30;
          } else {
            max = 20;
          }
        }

        return {
          ...r,
          maximumPoints: max,
          dailyWorkMaximum: Math.round(max * 0.4),
          examMaximum: Math.round(max * 0.6),
          coefficient: coeff,
        };
      })
    );
    toast.success(`Préset "${presetName}" appliqué au tableau. Cliquez sur "Enregistrer les modifications" pour valider.`);
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 p-6 text-white shadow-xl shadow-blue-600/20">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <SlidersHorizontal className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Système de Cotation & Délibération (RDC)</h1>
            <p className="text-blue-100 text-sm mt-0.5">
              Configuration des maxima variables, pondérations intrinsèques, coefficients et critères de passage conformes au Ministère de l'EPST
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="subjects" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="subjects" className="py-2.5 flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-sm">1. Maxima & Matières</span>
          </TabsTrigger>
          <TabsTrigger value="deliberation" className="py-2.5 flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Award className="w-4 h-4 text-amber-600" />
            <span className="font-semibold text-sm">2. Règles de Passage & Délibération</span>
          </TabsTrigger>
          <TabsTrigger value="maternelle" className="py-2.5 flex items-center gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Baby className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-sm">3. Cycle Maternelle</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Maxima & Pondérations par Matière ── */}
        <TabsContent value="subjects" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <School className="w-5 h-5 text-blue-600" />
                    Configuration de la Classe
                  </CardTitle>
                  <CardDescription>
                    Sélectionnez une classe pour configurer les maxima de points (TJ et Examen) de chaque cours.
                  </CardDescription>
                </div>

                {/* Sélecteur de classe */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Classe :</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="w-64 font-semibold">
                      <SelectValue placeholder="Choisir une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} {c.section ? `(${c.section})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Info pondération RDC */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <strong>Principe Fondamental RDC :</strong> Une matière ayant un maximum de 100 pèse naturellement plus lourd dans le total qu'une matière sur 20.
                  Le total général est calculé par la formule : <code className="bg-white/80 px-1.5 py-0.5 rounded font-mono font-bold text-blue-700">Σ(Points Obtenus) / Σ(Points Maxima) × 100</code>.
                </div>
              </div>

              {/* Barre de présets officiels RDC */}
              <div className="flex flex-wrap items-center gap-2 pt-1 pb-2">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Modèles prédéfinis RDC :</span>
                <Button variant="outline" size="sm" onClick={() => applyPreset('SCIENTIFIQUE')} className="text-xs h-8 gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600" /> Humanités Scientifiques
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('PEDAGOGIQUE')} className="text-xs h-8 gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-purple-600" /> Humanités Pédagogiques
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('COMMERCIALE')} className="text-xs h-8 gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" /> Commerciale & Gestion
                </Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('EB')} className="text-xs h-8 gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" /> Éducation de Base (7e/8e)
                </Button>
              </div>

              {/* Tableau des matières */}
              {loading ? (
                <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : subjectRules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="font-semibold">Aucun cours trouvé dans cette classe</p>
                  <p className="text-xs mt-1">Ajoutez d'abord des cours dans le module "Cours" de l'administration.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-bold text-foreground">Désignation du Cours</TableHead>
                        <TableHead className="text-center w-32 font-bold text-foreground">Total Max / Semestre</TableHead>
                        <TableHead className="text-center w-28 font-bold text-foreground">Max TJ (S1/S2)</TableHead>
                        <TableHead className="text-center w-28 font-bold text-foreground">Max Examen</TableHead>
                        <TableHead className="text-center w-28 font-bold text-foreground">Coeff. (Optionnel)</TableHead>
                        <TableHead className="text-center w-28 font-bold text-foreground">Mode Qualitatif</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subjectRules.map((rule) => (
                        <TableRow key={rule.courseId} className="hover:bg-muted/10">
                          <TableCell className="font-semibold">{rule.courseName}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={10}
                              max={200}
                              step={5}
                              value={rule.maximumPoints}
                              onChange={(e) => updateCourseRule(rule.courseId, 'maximumPoints', Number(e.target.value))}
                              className="w-24 h-9 mx-auto text-center font-bold text-blue-700 bg-blue-50/40"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={5}
                              max={100}
                              value={rule.dailyWorkMaximum}
                              onChange={(e) => updateCourseRule(rule.courseId, 'dailyWorkMaximum', Number(e.target.value))}
                              className="w-20 h-9 mx-auto text-center font-medium"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={5}
                              max={150}
                              value={rule.examMaximum}
                              onChange={(e) => updateCourseRule(rule.courseId, 'examMaximum', Number(e.target.value))}
                              className="w-20 h-9 mx-auto text-center font-medium"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              placeholder="1"
                              value={rule.coefficient ?? ''}
                              onChange={(e) => updateCourseRule(rule.courseId, 'coefficient', e.target.value ? Number(e.target.value) : null)}
                              className="w-16 h-9 mx-auto text-center"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex justify-center">
                              <Switch
                                checked={rule.isQualitative}
                                onCheckedChange={(val) => updateCourseRule(rule.courseId, 'isQualitative', val)}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={handleSaveSubjectRules}
                  disabled={savingRules || subjectRules.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 px-6 gap-2"
                >
                  {savingRules ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les Règles de la Classe
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Règles de Délibération & Passage ── */}
        <TabsContent value="deliberation" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-600" />
                Critères de Passage, Repêchage et Doublement
              </CardTitle>
              <CardDescription>
                Définissez les seuils de délibération sans code en dur. Le système appliquera automatiquement ces critères lors du calcul des bulletins.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Seuil de passage */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-sm">Seuil de passage direct (%)</Label>
                    <Badge className="bg-emerald-100 text-emerald-800 font-bold">{decisionRule.passPercentage}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pourcentage global minimum requis pour être déclaré <strong>PASSE / PROMU</strong> sans conditions.
                  </p>
                  <Input
                    type="number"
                    min={40}
                    max={70}
                    step={0.5}
                    value={decisionRule.passPercentage}
                    onChange={(e) => setDecisionRule({ ...decisionRule, passPercentage: Number(e.target.value) || 50 })}
                    className="mt-2 font-bold text-emerald-600 text-base"
                  />
                </div>

                {/* Seuil de repêchage */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-sm">Seuil minimal de repêchage (%)</Label>
                    <Badge className="bg-amber-100 text-amber-800 font-bold">{decisionRule.retakeMinPercentage}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pourcentage plancher donnant droit à la session de rattrapage / seconde session (<strong>REPÊCHAGE / AJOURNÉ</strong>).
                  </p>
                  <Input
                    type="number"
                    min={35}
                    max={50}
                    step={0.5}
                    value={decisionRule.retakeMinPercentage}
                    onChange={(e) => setDecisionRule({ ...decisionRule, retakeMinPercentage: Number(e.target.value) || 45 })}
                    className="mt-2 font-bold text-amber-600 text-base"
                  />
                </div>

                {/* Nombre max d'échecs */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-sm">Nombre maximum d'échecs tolérés</Label>
                    <Badge variant="outline" className="font-bold">{decisionRule.maxFailedCourses} matières</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nombre maximal de branches en dessous de 50% acceptées pour être délibéré ou admis au repêchage.
                  </p>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={decisionRule.maxFailedCourses}
                    onChange={(e) => setDecisionRule({ ...decisionRule, maxFailedCourses: Number(e.target.value) || 0 })}
                    className="mt-2 font-bold text-base"
                  />
                </div>

                {/* Note éliminatoire */}
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-bold text-sm">Seuil de note éliminatoire (%)</Label>
                    <Badge variant="outline" className="font-bold">{decisionRule.eliminationPercentage || 35}%</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Toute note inférieure à ce seuil dans une matière principale empêche la délibération positive automatique.
                  </p>
                  <Input
                    type="number"
                    min={20}
                    max={45}
                    value={decisionRule.eliminationPercentage ?? 35}
                    onChange={(e) => setDecisionRule({ ...decisionRule, eliminationPercentage: Number(e.target.value) || null })}
                    className="mt-2 font-bold text-base"
                  />
                </div>
              </div>

              {/* Résumé des statuts */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Statuts déterminés automatiquement par LaBorneTRAIT :</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <strong>PASSE :</strong> Moyenne \(\ge\) {decisionRule.passPercentage}% avec \(\le\) {decisionRule.maxFailedCourses} échecs.
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200">
                    <strong>REPÊCHAGE (AJOURNÉ) :</strong> Moyenne entre {decisionRule.retakeMinPercentage}% et {decisionRule.passPercentage - 0.1}%.
                  </div>
                  <div className="p-2.5 rounded-lg bg-red-50 text-red-900 border border-red-200">
                    <strong>DOUBLE :</strong> Moyenne &lt; {decisionRule.retakeMinPercentage}% ou trop d'échecs.
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={handleSaveDecisionRule}
                  disabled={savingDecision}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-lg shadow-amber-500/20 px-6 gap-2"
                >
                  {savingDecision ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les Critères de Délibération
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: Cycle Maternelle ── */}
        <TabsContent value="maternelle" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Baby className="w-5 h-5 text-emerald-600" />
                Configuration du Cycle Maternelle
              </CardTitle>
              <CardDescription>
                Adaptez l'évaluation des tout-petits. La logique numérique ne doit pas être imposée aux classes maternelles.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label className="text-sm font-bold">Mode d'évaluation pour la Maternelle :</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setDecisionRule({ ...decisionRule, maternelleMode: 'QUALITATIF' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      decisionRule.maternelleMode === 'QUALITATIF'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                        : 'border-border hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-emerald-800">Mode Qualitatif (Recommandé)</span>
                      {decisionRule.maternelleMode === 'QUALITATIF' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Suivi par compétences et appréciations : <em>Acquis</em>, <em>En cours d'acquisition</em>, <em>À renforcer</em>.
                    </p>
                  </div>

                  <div
                    onClick={() => setDecisionRule({ ...decisionRule, maternelleMode: 'NUMERIQUE' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      decisionRule.maternelleMode === 'NUMERIQUE'
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                        : 'border-border hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-blue-800">Mode Numérique (Points)</span>
                      {decisionRule.maternelleMode === 'NUMERIQUE' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Possibilité d'attribuer des points et des scores sur les évaluations selon le choix de l'établissement.
                    </p>
                  </div>
                </div>
              </div>

              {/* Domaines d'apprentissage */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                <h4 className="font-bold text-xs uppercase text-muted-foreground">Domaines d'apprentissage pris en charge en Maternelle :</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Badge variant="outline" className="p-2 justify-center bg-background">Langage & Communication</Badge>
                  <Badge variant="outline" className="p-2 justify-center bg-background">Motricité & Éveil Corporel</Badge>
                  <Badge variant="outline" className="p-2 justify-center bg-background">Activités Scientifiques / Math</Badge>
                  <Badge variant="outline" className="p-2 justify-center bg-background">Socialisation & Vie Pratique</Badge>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  onClick={handleSaveDecisionRule}
                  disabled={savingDecision}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/20 px-6 gap-2"
                >
                  {savingDecision ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les Paramètres Maternelle
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
