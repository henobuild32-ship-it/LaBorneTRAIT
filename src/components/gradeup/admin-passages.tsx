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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  GraduationCap,
  Loader2,
  Plus,
  ArrowRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

interface PassageRow {
  id: string;
  studentId: string;
  sourceClassId: string;
  targetClassId: string;
  sourceYear: string;
  targetYear: string;
  result: string;
  verified: boolean;
  datePassage: string;
  student?: { id: string; fullName: string; matricule: string; photoUrl: string };
  sourceClass?: { id: string; name: string };
  targetClass?: { id: string; name: string };
}

interface StudentInfo { id: string; fullName: string; matricule: string }
interface ClassInfo { id: string; name: string; cycle: string }

const RESULTS = [
  { value: 'PASSE', label: 'Passe', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'REDOUBLE', label: 'Redouble', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'ORIENTE', label: 'Orienté', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'EXAMEN_NATIONAL', label: 'Examen national', color: 'bg-blue-100 text-blue-700 border-blue-200' },
];

export default function AdminPassages() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<PassageRow[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [studentQuery, setStudentQuery] = useState('');

  const [form, setForm] = useState({ studentId: '', sourceClassId: '', targetClassId: '', result: 'PASSE' });

  const filteredStudents = studentQuery.trim()
    ? students.filter((s) => s.fullName.toLowerCase().includes(studentQuery.trim().toLowerCase()) || (s.matricule || '').toLowerCase().includes(studentQuery.trim().toLowerCase()))
    : students;

  const load = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const params = new URLSearchParams({ schoolId: user.schoolId });
      if (yearFilter) params.set('year', yearFilter);
      if (resultFilter && resultFilter !== 'all') params.set('result', resultFilter);
      const res = await fetch(`/api/passages?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data.passages) ? data.passages : []);
    } catch {
      toast.error('Erreur lors du chargement des passages');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, yearFilter, resultFilter]);

  useEffect(() => {
    if (user?.schoolId) {
      load();
      Promise.all([
        fetch(`/api/users?schoolId=${user.schoolId}&role=STUDENT&limit=500`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/classes?schoolId=${user.schoolId}`).then((r) => r.json()).catch(() => ({})),
      ]).then(([uData, cData]) => {
        setStudents(Array.isArray(uData.users) ? uData.users : []);
        setClasses(Array.isArray(cData.classes) ? cData.classes : []);
      });
    }
  }, [user?.schoolId, load]);

  const openAdd = () => setDialogOpen(true);

  const save = async () => {
    if (!form.studentId || !form.targetClassId || !form.result) {
      toast.error('Élève, classe cible et résultat sont requis');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/passages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: form.studentId,
          sourceClassId: form.sourceClassId || undefined,
          targetClassId: form.targetClassId,
          result: form.result,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success('Passage enregistré — l‘élève a été inscrit dans la nouvelle classe');
      setDialogOpen(false);
      setForm({ studentId: '', sourceClassId: '', targetClassId: '', result: 'PASSE' });
      load();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-6 lg:p-8 text-white shadow-xl shadow-emerald-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWRvZHRoPSI0MCIgaGVpZ2h0PSI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA4KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Passages et promotions</h1>
            <p className="text-emerald-100 text-sm">Historisez les passages d‘une classe à l‘autre (fin d’année)</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-end justify-between">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Année cible</label>
              <Input placeholder="Ex : 2025-2026" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="sm:w-44" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Résultat</label>
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="sm:w-44"><SelectValue placeholder="Tous" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {RESULTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-2" /> Enregistrer un passage
          </Button>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <GraduationCap className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
          <p>Aucun passage enregistré.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border">
                {rows.map((r) => {
                  const res = RESULTS.find((x) => x.value === r.result);
                  return (
                    <div key={r.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 text-xs font-bold">
                          {(r.student?.fullName || r.studentId).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{r.student?.fullName || r.studentId}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.sourceClass?.name || '—'} <ArrowRight className="inline h-3 w-3" /> {r.targetClass?.name || '—'}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {r.sourceYear || '—'} → {r.targetYear || '—'} · {new Date(r.datePassage).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-[10px] ${res?.color || ''}`}>{res?.label || r.result}</Badge>
                        {r.verified ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Vérifié</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]"><AlertCircle className="h-3 w-3 mr-1" /> Non vérifié</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-emerald-600" /> Enregistrer un passage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Élève</label>
              <Input placeholder="Rechercher par nom ou matricule" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} />
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setForm({ ...form, studentId: s.id })}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors ${form.studentId === s.id ? 'bg-emerald-50' : ''}`}
                  >
                    <span className="font-medium">{s.fullName}</span>
                    {s.matricule && <span className="text-xs text-muted-foreground ml-2">{s.matricule}</span>}
                  </button>
                ))}
                {filteredStudents.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Aucun élève</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Classe source (facultatif)</label>
                <Select value={form.sourceClassId || 'none'} onValueChange={(v) => setForm({ ...form, sourceClassId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Classe cible *</label>
                <Select value={form.targetClassId} onValueChange={(v) => setForm({ ...form, targetClassId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Résultat</label>
              <Select value={form.result} onValueChange={(v) => setForm({ ...form, result: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RESULTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}