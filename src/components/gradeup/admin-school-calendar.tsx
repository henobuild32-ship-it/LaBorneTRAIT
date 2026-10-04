'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CalendarDays,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const CYCLES = ['Maternelle', 'Primaire', 'EB', 'Humanites'];

interface CalendarRow {
  id: string;
  schoolYearId: string;
  month: number;
  monthName: string;
  trimester: number | null;
  semester: number | null;
  period: string;
  cycle: string;
}

interface SchoolYearRow {
  id: string;
  year: string;
  status: string;
}

export default function AdminSchoolCalendar() {
  const { user } = useAppStore();
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [cycle, setCycle] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Édition en cours : { schoolYearId_month_cycle: { period, trimester, semester } }
  const [edits, setEdits] = useState<Record<string, { period: string; trimester: number | null; semester: number | null }>>({});
  const dirtyCount = Object.keys(edits).length;

  const loadYears = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const res = await fetch(`/api/school-years?schoolId=${user.schoolId}`);
      const data = await res.json();
      const list = Array.isArray(data.years) ? data.years : [];
      setYears(list);
      const active = list.find((y: SchoolYearRow) => y.status === 'OPEN') || list[0];
      if (active) setSelectedYearId(active.id);
    } catch {
      toast.error('Erreur lors du chargement des années scolaires');
    }
  }, [user?.schoolId]);

  const loadCalendar = useCallback(async () => {
    if (!user?.schoolId || !selectedYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ schoolId: user.schoolId, schoolYearId: selectedYearId });
      if (cycle !== 'ALL') params.set('cycle', cycle);
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data.calendar) ? data.calendar : []);
    } catch {
      toast.error('Erreur lors du chargement du calendrier');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, selectedYearId, cycle]);

  useEffect(() => {
    if (user?.schoolId) loadYears();
  }, [user?.schoolId, loadYears]);

  useEffect(() => {
    if (selectedYearId) loadCalendar();
  }, [selectedYearId, loadCalendar]);

  // Filtrer par cycle en local si serveur renvoie tout
  const displayRows = cycle === 'ALL' ? rows : rows.filter((r) => r.cycle === cycle || r.cycle === 'ALL');

  const setEdit = (key: string, patch: Partial<{ period: string; trimester: number | null; semester: number | null }>) => {
    setEdits((prev) => {
      const next = { ...prev };
      const base = next[key] ?? { period: 'P1', trimester: null, semester: null };
      next[key] = { ...base, ...patch };
      return next;
    });
  };

  const editKey = (r: CalendarRow) => `${r.schoolYearId}_${r.month}_${r.cycle}`;

  const periodColor = (p: string) => {
    if (p.startsWith('Ex')) return 'bg-red-100 text-red-700 border-red-200';
    if (p === 'P2' || p === 'P4') return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    if (p === 'P3') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-blue-100 text-blue-700 border-blue-200';
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      const entries = Object.entries(edits);
      for (const [key, val] of entries) {
        const [schoolYearId, monthStr, cycleVal] = key.split('_');
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schoolYearId,
            month: parseInt(monthStr, 10),
            cycle: cycleVal,
            period: val.period,
            trimester: val.trimester,
            semester: val.semester,
          }),
        });
        if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      }
      toast.success('Calendrier mis à jour');
      setEdits({});
      loadCalendar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const seedDefault = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/calendar/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolYearId: selectedYearId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast.success(`${data.seeded} entrées générées (calendrier par défaut RDC)`);
      loadCalendar();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erreur seed');
    } finally {
      setSeeding(false);
    }
  };

  const monthsCovered = new Set(displayRows.map((r) => r.month));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <CalendarDays className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calendrier scolaire</h1>
            <p className="text-blue-100 text-sm">
              Configurez le mapping mois → période pour chaque cycle (RDC)
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-end justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Année scolaire</label>
                <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Choisir l'année" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y.id} value={y.id}>
                        {y.year} {y.status === 'OPEN' ? '(ouverte)' : y.status === 'LOCKED' ? '(verrouillée)' : '(clôturée)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Cycle</label>
                <Select value={cycle} onValueChange={setCycle}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Tous les cycles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tous les cycles</SelectItem>
                    {CYCLES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={seedDefault}
              disabled={seeding}
              className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            >
              {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Générer le calendrier par défaut
            </Button>
          </div>

          {monthsCovered.size > 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {monthsCovered.size} mois couverts sur 12 pour la sélection actuelle.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : displayRows.length === 0 ? (
        <Card className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
          <p>Aucune entrée pour cette année scolaire / ce cycle.</p>
          <p className="text-sm mt-1">Cliquez sur « Générer le calendrier par défaut » pour initialiser.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayRows.map((r) => {
            const key = editKey(r);
            const edit = edits[key];
            const cur = edit ?? { period: r.period, trimester: r.trimester, semester: r.semester };
            return (
              <Card key={r.id} className={`rounded-xl ${edit ? 'ring-2 ring-blue-300 border-blue-200' : ''}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{MONTH_NAMES[r.month - 1]} <span className="text-muted-foreground font-normal">({r.month})</span></span>
                    <Badge variant="outline" className={`text-[10px] ${periodColor(cur.period)}`}>{cur.period}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Trimestre</label>
                      <Select
                        value={cur.trimester?.toString() ?? 'none'}
                        onValueChange={(v) => setEdit(key, { trimester: v && v !== 'none' ? parseInt(v, 10) : null })}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {['none', '1', '2', '3'].map((t) => <SelectItem key={t} value={t}>{t === 'none' ? '—' : t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Semestre</label>
                      <Select
                        value={cur.semester?.toString() ?? 'none'}
                        onValueChange={(v) => setEdit(key, { semester: v && v !== 'none' ? parseInt(v, 10) : null })}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {['none', '1', '2'].map((s) => <SelectItem key={s} value={s}>{s === 'none' ? '—' : s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Période</label>
                    <Select
                      value={cur.period}
                      onValueChange={(v) => setEdit(key, { period: v })}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['P1', 'P2', 'P3', 'P4', 'ExT1', 'ExT2', 'ExT3', 'ExS1', 'ExS2'].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Cycle : {r.cycle}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Save bar */}
      {dirtyCount > 0 && (
        <div className="sticky bottom-4 z-10">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-white/95 backdrop-blur shadow-lg p-4">
            <p className="text-sm font-medium text-blue-800">{dirtyCount} modification(s) en attente</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEdits({})}>Annuler</Button>
              <Button size="sm" onClick={saveAll} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}