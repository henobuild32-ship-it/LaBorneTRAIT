'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  SlidersHorizontal,
  Loader2,
  Save,
  Plus,
  School,
  BookOpen,
} from 'lucide-react';

interface CoeffRow {
  id: string;
  schoolId: string;
  classId: string;
  section: string;
  courseId: string;
  coefficient: number;
  schoolYearId: string;
  isActive: boolean;
  class?: { id: string; name: string; cycle: string; section: string };
  course?: { id: string; name: string; maxScore: number };
}

interface ClassInfo { id: string; name: string; cycle: string; section: string }
interface CourseInfo { id: string; name: string; maxScore: number }

export default function AdminCoefficients() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<CoeffRow[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fClass, setFClass] = useState('all');
  const [form, setForm] = useState({ classId: '', section: '', courseId: '', coefficient: 1 });

  const load = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const params = new URLSearchParams({ schoolId: user.schoolId });
      if (fClass && fClass !== 'all') params.set('classId', fClass);
      const res = await fetch(`/api/coefficients?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data.coefficients) ? data.coefficients : []);
    } catch {
      toast.error('Erreur lors du chargement des coefficients');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, fClass]);

  useEffect(() => {
    if (user?.schoolId) {
      load();
      Promise.all([
        fetch(`/api/classes?schoolId=${user.schoolId}`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/courses?schoolId=${user.schoolId}`).then((r) => r.json()).catch(() => ({})),
      ]).then(([cData, cuData]) => {
        setClasses(Array.isArray(cData.classes) ? cData.classes : []);
        setCourses(Array.isArray(cuData.courses) ? cuData.courses : []);
      });
    }
  }, [user?.schoolId, load]);

  const openAdd = () => {
    setForm({ classId: '', section: '', courseId: '', coefficient: 1 });
    if (fClass && fClass !== 'all') setForm((f) => ({ ...f, classId: fClass }));
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.classId || !form.courseId) {
      toast.error('Classe et cours sont requis');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/coefficients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: form.classId,
          section: form.section || (classes.find((c) => c.id === form.classId)?.section || ''),
          courseId: form.courseId,
          coefficient: form.coefficient,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Coefficient enregistré');
      setDialogOpen(false);
      load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // Group rows by class
  const byClass = new Map<string, { info?: ClassInfo; rows: CoeffRow[] }>();
  for (const row of rows) {
    const key = row.classId;
    if (!byClass.has(key)) byClass.set(key, { info: row.class, rows: [] });
    byClass.get(key)!.rows.push(row);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 p-6 lg:p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWRvZHRoPSI0MCIgaGVpZ2h0PSI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <SlidersHorizontal className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Coefficients des matières</h1>
            <p className="text-indigo-100 text-sm">Définissez les coefficients par classe et par cours</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="space-y-1.5 w-full sm:w-auto">
            <label className="text-xs font-semibold text-muted-foreground">Filtrer par classe</label>
            <Select value={fClass} onValueChange={(v) => { setFClass(v); }}>
              <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={openAdd} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Nouveau coefficient
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <SlidersHorizontal className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
          <p>Aucun coefficient configuré. Ajoutez-en un pour personnaliser les moyennes.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byClass.entries()).map(([classId, { info, rows: classRows }]) => (
            <Card key={classId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <School className="h-4 w-4 text-indigo-600" />
                  {info?.name || classId}
                  {info?.cycle && <Badge variant="outline" className="text-[10px]">{info.cycle}</Badge>}
                  {info?.section && <Badge variant="outline" className="text-[10px]">{info.section}</Badge>}
                </CardTitle>
                <CardDescription>Par défaut chaque matière a un coefficient de 1.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {classRows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-accent/30 border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{r.course?.name || r.courseId}</span>
                        {r.course?.maxScore ? <Badge variant="outline" className="text-[10px]">/{r.course.maxScore}</Badge> : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={r.coefficient}
                          onChange={async (e) => {
                            const coeff = Math.max(0, Number(e.target.value) || 1);
                            setRows((prev) => prev.map((x) => x.id === r.id ? { ...x, coefficient: coeff } : x));
                            try {
                              await fetch('/api/coefficients', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ classId: r.classId, section: r.section, courseId: r.courseId, coefficient: coeff }),
                              });
                            } catch { /* silencieux */ }
                          }}
                          className="w-16 h-9 text-center"
                        />
                        <span className="text-xs text-muted-foreground">x</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-indigo-600" /> Nouveau coefficient</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Classe</label>
              <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v, section: classes.find((c) => c.id === v)?.section || '' })}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Cours / Matière</label>
              <Select value={form.courseId} onValueChange={(v) => setForm({ ...form, courseId: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un cours" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Coefficient</label>
              <Input type="number" min={0} max={10} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: Math.max(0, Number(e.target.value) || 1) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}