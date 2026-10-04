'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { toast } from 'sonner';
import {
  BookOpen,
  Calendar,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import type { CsvObject } from '@/lib/csv';

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  gradingType: string;
  isPublished?: boolean;
  createdAt: string;
  course?: { id: string; name: string; class?: { id: string; name: string } };
  teacher?: { id: string; fullName: string };
}

const ALL = '__all__';

export default function AdminHomework() {
  const { user } = useAppStore();
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState(ALL);
  const [courseFilter, setCourseFilter] = useState(ALL);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);

  const fetchHomework = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/homework?schoolId=${user.schoolId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chargement impossible');
      setHomework(Array.isArray(data.homework) ? data.homework : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => {
    fetchHomework();
  }, [fetchHomework]);

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    homework.forEach((hw) => {
      const cls = hw.course?.class;
      if (cls) map.set(cls.id, cls.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [homework]);

  const courses = useMemo(() => {
    const map = new Map<string, string>();
    homework.forEach((hw) => {
      if (!hw.course) return;
      const cls = hw.course.class;
      if (classFilter !== ALL && cls?.id !== classFilter) return;
      map.set(hw.course.id, hw.course.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [homework, classFilter]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return homework.filter((hw) => {
      const cls = hw.course?.class;
      if (classFilter !== ALL && cls?.id !== classFilter) return false;
      if (courseFilter !== ALL && hw.course?.id !== courseFilter) return false;
      if (!term) return true;
      return (
        hw.title.toLowerCase().includes(term) ||
        (hw.description || '').toLowerCase().includes(term) ||
        (hw.course?.name || '').toLowerCase().includes(term) ||
        (cls?.name || '').toLowerCase().includes(term) ||
        (hw.teacher?.fullName || '').toLowerCase().includes(term)
      );
    });
  }, [homework, classFilter, courseFilter, search]);

  const handleImport = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    const res = await fetch('/api/homework/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: user.schoolId, rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "L'import a échoué");
    if (data.errors?.length) data.errors.forEach((message: string) => toast.warning(message));
    toast.success(`${data.created} devoir${data.created > 1 ? 's' : ''} importé${data.created > 1 ? 's' : ''}`);
    if (data.created > 0) fetchHomework();
  };

  const daysRemaining = (dueDate: string): number => {
    if (!dueDate) return 999;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="relative z-10 flex flex-wrap items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Devoirs de l'école</h1>
            <p className="text-blue-100 text-sm">
              {homework.length} devoir{homework.length > 1 ? 's' : ''} · {classes.length} classe{classes.length > 1 ? 's' : ''} · vue d'ensemble et import
            </p>          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowImport(true)}
              variant="outline"
              className="bg-white/15 hover:bg-white/25 border-white/30 text-white"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importer
            </Button>
            <Button
              onClick={fetchHomework}
              variant="outline"
              size="icon"
              className="bg-white/15 hover:bg-white/25 border-white/30 text-white"
              aria-label="Actualiser"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devoir, un cours, un professeur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toutes les classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={courseFilter} onValueChange={setCourseFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Cours" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Tous les cours</SelectItem>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>
                {course.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed">
          <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="font-semibold mb-1">Aucun devoir</h3>
          <p className="text-sm text-muted-foreground">
            {homework.length === 0
              ? 'Importez vos devoirs (PDF, Word ou photo) pour remplir cette page.'
              : 'Aucun devoir ne correspond à ces filtres.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((hw) => {
            const days = daysRemaining(hw.dueDate);
            const overdue = days < 0;
            const soon = days >= 0 && days <= 3;
            return (
              <Card
                key={hw.id}
                className={`border-l-4 hover:shadow-md transition-shadow ${
                  overdue ? 'border-l-red-500' : soon ? 'border-l-amber-500' : 'border-l-blue-500'
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sm">{hw.title}</h3>
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <BookOpen className="w-3 h-3" />
                          {hw.course?.name || '—'}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {hw.course?.class?.name || '—'}
                        </Badge>
                        {overdue && <Badge className="text-[11px] bg-red-100 text-red-700 border-red-200">En retard</Badge>}
                        {soon && !overdue && <Badge className="text-[11px] bg-amber-100 text-amber-700 border-amber-200">À rendre bientôt</Badge>}
                      </div>
                      {hw.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{hw.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          {hw.teacher?.fullName || 'Professeur inconnu'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {hw.dueDate ? `À rendre le ${hw.dueDate}` : 'Sans date limite'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DocumentImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Importer des devoirs (toute l'école)"
        description="Préparez un document Word ou PDF avec un tableau (ou photographiez-le) : les devoirs de toutes les classes sont importés."
                expectedColumns={['Classe', 'Cours', 'Titre', 'Date', 'Description']}
        sampleRows={[
          ['6ème A', 'Mathématiques', 'Exercices page 42', '2026-10-10', 'Résoudre les exercices 1 à 10'],
          ['5ème B', 'Français', 'Dictée', '2026-10-12', ''],
        ]}
        columnHints={[
          { header: 'Classe', hint: 'facultatif, précise le cours si homonyme' },
          { header: 'Cours', hint: 'nom exact du cours' },
          { header: 'Titre', hint: 'obligatoire' },
          { header: 'Date', hint: 'JJ/MM/AAAA ou AAAA-MM-JJ' },
          { header: 'Description', hint: 'facultatif' },
        ]}
        onImport={handleImport}
      />
    </div>
  );
}
