'use client';

/**
 * CahierCotation
 * ─────────────────────────────────────────────────────────────────────────────
 * Digital RDC Secondary School Gradebook ("Cahier de Cotation").
 * Supports:
 *   1. Automatic class secondary checking (7e EB, 8e EB, 1e-4e Humanités).
 *   2. Enrolled student loading & order tracking.
 *   3. Perfect grid alignments for print (A4 landscape pagination).
 *   4. Dynamic columns (Interro, TP, Exam) with max scores.
 *   5. "Mettre en ordre alphabétique" action.
 *   6. Auto-save & local storage fallback (offline support).
 *   7. Security limits (Owner edits, Titulaire/Admin view/print).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  BookOpen,
  Users,
  Plus,
  Trash2,
  ListOrdered,
  Printer,
  RefreshCw,
  Save,
  CheckCircle,
  Wifi,
  WifiOff,
  UserCheck,
  Zap,
  Send,
  AlertCircle,
  Clock,
  Pencil,
  Camera,
  ImagePlus,
  Images,
  FilePlus2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchJsonWithCache } from '@/lib/offline-sync';

interface Student {
  id: string;
  fullName: string;
  postName: string;
  gender: string;
}

interface Evaluation {
  id: string;
  title: string;
  maxScore: number;
  period: string;
  date: string;
  marks: Array<{ studentId: string; score: number }>;
}

interface ClassInfo {
  id: string;
  name: string;
  level: string;
  cycle?: string;
  titulaireId?: string | null;
}

/** Une classe est « secondaire » si son niveau/cycle le dit ou si son nom
 *  correspond aux classes RDC (7e EB, 8e EB, 1e-4e Humanités). */
function isSecondaryClass(c: { name?: string; level?: string; cycle?: string }): boolean {
  const name = (c.name || '').toLowerCase();
  const level = (c.level || c.cycle || '').toLowerCase();
  return (
    level === 'secondaire' ||
    name.includes('7e') ||
    name.includes('8e') ||
    name.includes('humanit') ||
    name.includes('eb')
  );
}

interface CourseInfo {
  id: string;
  name: string;
  teacherId: string;
  teacher: { fullName: string };
}

interface CahierPhoto {
  id: string;
  url: string;
  fileName: string;
  page: number;
  period: string;
  courseId: string | null;
  size: number;
  mimeType: string;
  createdAt: string;
}

export default function CahierCotation() {
  const { user, setCurrentPage } = useAppStore();

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('P1'); // P1, P2, EX1, P3, P4, EX2

  const [students, setStudents] = useState<Student[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Send to titulaire state
  const [sendingEval, setSendingEval] = useState<string | null>(null);

  // Column creation dialog
  const [addColOpen, setAddColOpen] = useState(false);
  const [colTitle, setColTitle] = useState('');
  const [colMaxScore, setColMaxScore] = useState('20');
  const [addingCol, setAddingCol] = useState(false);

  // Column editing dialog
  const [editColOpen, setEditColOpen] = useState(false);
  const [editingEval, setEditingEval] = useState<Evaluation | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMaxScore, setEditMaxScore] = useState('20');
  const [editDate, setEditDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Offline status & unsaved changes
  const [isOnline, setIsOnline] = useState(true);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, Record<string, number>>>({}); // { [evalId]: { [studentId]: score } }

  // ── Photos du cahier (prise de vue / import d'image) ──
  const [photos, setPhotos] = useState<CahierPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // ── Impression du cahier vierge (modèles à reproduire) ──
  const [blankOpen, setBlankOpen] = useState(false);
  const [blankPages, setBlankPages] = useState(3);
  const [blankCols, setBlankCols] = useState(6);
  const [blankWithStudents, setBlankWithStudents] = useState(true);
  const [printingBlank, setPrintingBlank] = useState(false);

  // État de l'acquisition : le module n'existe que pour le secondaire.
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasSecondaryClass, setHasSecondaryClass] = useState(true);

  // Sync online/offline event handlers
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connexion rétablie. Synchronisation des notes...');
      syncOfflineChanges();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Mode hors-ligne activé. Les modifications seront enregistrées localement.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [unsavedChanges]);

  // Load offline data from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('gradeup_cahier_unsaved');
    if (saved) {
      try {
        setUnsavedChanges(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Sync offline changes helper
  const syncOfflineChanges = async () => {
    const saved = localStorage.getItem('gradeup_cahier_unsaved');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const evalIds = Object.keys(parsed);
      for (const evalId of evalIds) {
        const marks = parsed[evalId];
        await fetch('/api/cahier/evaluations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evaluationId: evalId, marks }),
        });
      }
      localStorage.removeItem('gradeup_cahier_unsaved');
      setUnsavedChanges({});
      toast.success('Notes synchronisées avec succès.');
      fetchData();
    } catch {
      toast.error('Échec de la synchronisation de certaines notes.');
    }
  };

  // Fetch classes + contrôle d'accès « secondaire uniquement »
  useEffect(() => {
    if (!user?.schoolId) return;
    setCheckingAccess(true);
    // Requêtes directes (sans cache partagé) : le contrôle d'accès « secondaire »
    // doit refléter la base, pas une réponse mise en cache par un autre compte.
    (async () => {
      try {
        const res = await fetch(`/api/classes?schoolId=${user.schoolId}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const all: ClassInfo[] = data.classes || [];
        // Classes de secondaire (RDC : 7e EB, 8e EB, 1e-4e Humanités, ou niveau « Secondaire »)
        const secondary = all.filter((c) => isSecondaryClass(c));
        setClasses(secondary);

        // Le professeur n'a accès au cahier que s'il enseigne (ou tient) une classe secondaire.
        let teachesSecondary = secondary.length > 0;
        if (user.role === 'TEACHER') {
          const courseRes = await fetch(
            `/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`,
            { credentials: 'include', cache: 'no-store' },
          );
          if (!courseRes.ok) throw new Error(`HTTP ${courseRes.status}`);
          const courseData = await courseRes.json();
          const courseList: { classId?: string }[] = Array.isArray(courseData)
            ? courseData
            : courseData.courses || [];
          const taughtIds = new Set(courseList.map((c) => c.classId));
          teachesSecondary =
            secondary.some((c) => taughtIds.has(c.id)) ||
            all.some((c) => c.titulaireId === user.id && isSecondaryClass(c));
        }

        setHasSecondaryClass(teachesSecondary);
        setSelectedClassId(teachesSecondary && secondary.length > 0 ? secondary[0].id : '');
      } catch {
        // API indisponible : on n'empêche pas l'accès, le module affichera son état vide.
        setHasSecondaryClass(true);
      } finally {
        setCheckingAccess(false);
      }
    })();
  }, [user?.schoolId, user?.id, user?.role]);

  // Fetch courses for the selected class (scoped to school and optionally teacher)
  useEffect(() => {
    if (!selectedClassId || !user?.schoolId) {
      setCourses([]);
      setSelectedCourseId('');
      return;
    }
    const teacherParam = user.role === 'TEACHER' ? `&teacherId=${user.id}` : '';
    fetchJsonWithCache(`/api/courses?schoolId=${user.schoolId}&classId=${selectedClassId}${teacherParam}`, { courses: [] })
      .then((d) => {
        const list = Array.isArray(d.courses) ? d.courses : Array.isArray(d) ? d : [];
        setCourses(list);
        if (list.length > 0) {
          // Auto select first course (prefer teacher's own course if available)
          setSelectedCourseId(list[0].id);
        } else {
          setSelectedCourseId('');
        }
      })
      .catch(() => {});
  }, [selectedClassId, user?.schoolId, user?.id, user?.role]);

  // Load students, evaluations & marks
  const fetchData = useCallback(async () => {
    if (!selectedClassId || !selectedCourseId) return;
    setLoading(true);
    try {
      const url = `/api/cahier/evaluations?schoolId=${user?.schoolId}&classId=${selectedClassId}&courseId=${selectedCourseId}&period=${selectedPeriod}`;
      const data = await fetchJsonWithCache(url, { students: [], evaluations: [] });
      setStudents(data.students || []);
      setEvaluations(data.evaluations || []);
    } catch {
      toast.error('Erreur lors du chargement des évaluations');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, selectedCourseId, selectedPeriod, user?.schoolId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sort students alphabetically
  const handleSortStudents = () => {
    const sorted = [...students].sort((a, b) => {
      const nameA = `${a.fullName} ${a.postName}`.toLowerCase();
      const nameB = `${b.fullName} ${b.postName}`.toLowerCase();
      return nameA.localeCompare(nameB, 'fr');
    });
    setStudents(sorted);
    toast.success('Liste des élèves triée par ordre alphabétique');
  };

  // Check editing permissions
  const canEdit = useMemo(() => {
    if (user?.role === 'ADMIN') return true;
    const currentCourse = courses.find((c) => c.id === selectedCourseId);
    if (!currentCourse) return false;
    return currentCourse.teacherId === user?.id;
  }, [user, selectedCourseId, courses]);

  // Handle cell score changes
  const handleScoreChange = (evaluationId: string, studentId: string, value: string) => {
    if (!canEdit) {
      toast.error('Modification refusée : Vous n\'êtes pas le professeur de ce cours.');
      return;
    }

    const score = parseFloat(value) || 0;

    // Update local state immediately for responsiveness
    setEvaluations((prev) =>
      prev.map((e) => {
        if (e.id !== evaluationId) return e;
        const index = e.marks.findIndex((m) => m.studentId === studentId);
        const updatedMarks = [...e.marks];
        if (index > -1) {
          updatedMarks[index] = { ...updatedMarks[index], score };
        } else {
          updatedMarks.push({ studentId, score });
        }
        return { ...e, marks: updatedMarks };
      })
    );

    // Save/buffer change
    const updatedUnsaved = {
      ...unsavedChanges,
      [evaluationId]: {
        ...(unsavedChanges[evaluationId] || {}),
        [studentId]: score,
      },
    };
    setUnsavedChanges(updatedUnsaved);
    localStorage.setItem('gradeup_cahier_unsaved', JSON.stringify(updatedUnsaved));

    // Save to server
    if (isOnline) {
      saveEvaluationMarks(evaluationId, updatedUnsaved[evaluationId]);
    }
  };

  const saveEvaluationMarks = async (evaluationId: string, evalMarks: Record<string, number>) => {
    try {
      const res = await fetch('/api/cahier/evaluations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationId, marks: evalMarks }),
      });
      if (res.ok) {
        // Clear this evaluation from unsaved state
        const nextUnsaved = { ...unsavedChanges };
        delete nextUnsaved[evaluationId];
        setUnsavedChanges(nextUnsaved);
        localStorage.setItem('gradeup_cahier_unsaved', JSON.stringify(nextUnsaved));
      }
    } catch {
      // Offline fallback already handled
    }
  };

  // Add a new evaluation column
  const handleAddColumn = async () => {
    if (!colTitle.trim()) {
      toast.error('Le titre de l\'évaluation est requis');
      return;
    }
    setAddingCol(true);
    try {
      const res = await fetch('/api/cahier/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user?.schoolId,
          classId: selectedClassId,
          courseId: selectedCourseId,
          teacherId: user?.id,
          title: colTitle,
          maxScore: parseFloat(colMaxScore) || 20,
          period: selectedPeriod,
        }),
      });
      if (res.ok) {
        toast.success(`Colonne "${colTitle}" ajoutée`);
        setColTitle('');
        setAddColOpen(false);
        fetchData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Erreur lors de l\'ajout de la colonne');
    } finally {
      setAddingCol(false);
    }
  };

  // Delete an evaluation column
  const handleDeleteColumn = async (evaluationId: string, title: string) => {
    if (!confirm(`Supprimer la colonne "${title}" et toutes ses notes ?`)) return;
    try {
      const res = await fetch(`/api/cahier/evaluations?evaluationId=${evaluationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`Colonne "${title}" supprimée`);
        fetchData();
      } else {
        throw new Error();
      }
    } catch {
      toast.error('Erreur lors de la suppression de la colonne');
    }
  };

  // Open the edit dialog for an evaluation column
  const openEditColumn = (evaluation: Evaluation) => {
    setEditingEval(evaluation);
    setEditTitle(evaluation.title);
    setEditMaxScore(String(evaluation.maxScore));
    setEditDate(evaluation.date ? evaluation.date.slice(0, 10) : '');
    setEditColOpen(true);
  };

  // Save edited evaluation metadata (title, max score, date)
  const handleEditColumn = async () => {
    if (!editingEval) return;
    if (!editTitle.trim()) {
      toast.error('Le titre de l\'évaluation est requis');
      return;
    }
    const parsedMax = parseFloat(editMaxScore);
    if (isNaN(parsedMax) || parsedMax <= 0) {
      toast.error('Veuillez saisir une note maximale valide');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch('/api/cahier/evaluations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId: editingEval.id,
          title: editTitle.trim(),
          maxScore: parsedMax,
          date: editDate || undefined,
        }),
      });
      if (res.ok) {
        toast.success(`Colonne "${editTitle.trim()}" modifiée`);
        setEditColOpen(false);
        setEditingEval(null);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la modification de la colonne');
      }
    } catch {
      toast.error('Erreur lors de la modification de la colonne');
    } finally {
      setSavingEdit(false);
    }
  };

  // Send evaluations to titular professor
  const handleSendToTitulaire = async (courseId: string) => {
    if (!courseId || evaluations.length === 0) return;

    if (!confirm(`Envoyer TOUTES les cotations de ce cours au professeur titulaire ?`)) return;

    setSendingEval('all');
    try {
      const evaluationIds = evaluations.map((e) => e.id);
      const res = await fetch('/api/cahier/transmissions/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationIds, courseId, teacherId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      toast.success(`Cotations envoyées au titulaire ✅`);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      toast.error(msg);
    } finally {
      setSendingEval(null);
    }
  };

  // Calculate average out of 20 for a student across all period evaluations
  const getStudentPeriodAverage = (studentId: string) => {
    if (evaluations.length === 0) return 0;
    let sum = 0;
    let count = 0;
    for (const e of evaluations) {
      const mark = e.marks.find((m) => m.studentId === studentId);
      if (!mark) continue;
      const max = e.maxScore > 0 ? e.maxScore : 20;
      sum += (mark.score / max) * 20;
      count++;
    }
    return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  };

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // ── Photos du cahier de cotation ────────────────────────────────
  const fetchPhotos = useCallback(async () => {
    if (!user?.schoolId || !selectedClassId) {
      setPhotos([]);
      return;
    }
    setPhotosLoading(true);
    try {
      const params = new URLSearchParams({
        schoolId: user.schoolId,
        classId: selectedClassId,
      });
      if (selectedCourseId) params.set('courseId', selectedCourseId);
      params.set('period', selectedPeriod);
      const res = await fetch(`/api/cahier/photos?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setPhotos(Array.isArray(data.photos) ? data.photos : []);
    } catch {
      setPhotos([]);
    } finally {
      setPhotosLoading(false);
    }
  }, [user?.schoolId, selectedClassId, selectedCourseId, selectedPeriod]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handlePickFiles = (input: HTMLInputElement | null) => {
    if (!input?.files?.length) return;
    void uploadFiles(input.files);
    input.value = '';
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast.error('Formats acceptés : JPEG, PNG, WebP, HEIC…');
      return;
    }
    if (!selectedClassId) {
      toast.error("Sélectionnez d'abord une classe");
      return;
    }
    setUploading(true);
    let done = 0;
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('classId', selectedClassId);
        if (selectedCourseId) fd.append('courseId', selectedCourseId);
        fd.append('period', selectedPeriod);
        const res = await fetch('/api/cahier/photos', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}) as { error?: string });
        if (!res.ok) throw new Error(data?.error || "Échec de l'envoi");
        done++;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Échec de l'envoi de la photo");
      }
    }
    setUploading(false);
    if (done > 0) {
      toast.success(
        done === 1
          ? 'Photo ajoutée au cahier de cotation.'
          : `${done} photos ajoutées au cahier de cotation.`,
      );
      await fetchPhotos();
    }
  };

  const deletePhoto = async (id: string) => {
    setDeletingPhotoId(id);
    try {
      const res = await fetch(`/api/cahier/photos?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error();
      const remaining = photos.filter((p) => p.id !== id);
      setPhotos(remaining);
      if (viewerIndex !== null) {
        setViewerIndex(
          remaining.length === 0
            ? null
            : viewerIndex >= remaining.length
              ? remaining.length - 1
              : viewerIndex,
        );
      }
      toast.success('Photo supprimée.');
    } catch {
      toast.error('Impossible de supprimer cette photo.');
    } finally {
      setDeletingPhotoId(null);
    }
  };

  // ── Cahier vierge : impression de modèles reproductibles ────────
  const startBlankPrint = () => {
    setBlankOpen(false);
    setPrintingBlank(true);
  };

  useEffect(() => {
    if (!printingBlank) return;
    const stop = () => setPrintingBlank(false);
    window.addEventListener('afterprint', stop);
    const timer = setTimeout(() => window.print(), 300);
    return () => {
      window.removeEventListener('afterprint', stop);
      clearTimeout(timer);
    };
  }, [printingBlank]);

  const blankRowCount = blankWithStudents && students.length > 0 ? students.length : 20;
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const schoolYearLabel = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const start = now.getMonth() >= 8 ? y : y - 1;
    return `${start}-${start + 1}`;
  })();

  // ── Accès réservé au secondaire : les classes primaires saisissent
  //    leurs notes dans le bulletin généré (module Notes / Bulletins).
  if (!checkingAccess && !hasSecondaryClass) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="border-amber-300 bg-amber-50/60 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <CardContent className="py-8 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-500/20">
              <BookOpen className="h-7 w-7 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-900 dark:text-amber-200">
                Cahier de cotation réservé au secondaire
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-amber-800/90 dark:text-amber-200/80">
                Ce module est disponible uniquement pour les professeurs de secondaire
                (7e et 8e EB, 1e à 4e Humanités). Vous n'avez aucune classe secondaire
                assignée : saisissez vos notes dans le module <strong>Notes</strong>, elles
                alimentent automatiquement le <strong>bulletin généré</strong> de vos élèves.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={() => setCurrentPage('teacher-grades')}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Save className="w-4 h-4" /> Saisir mes notes
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentPage('teacher-reports')}
                className="gap-2"
              >
                <Printer className="w-4 h-4" /> Voir les bulletins
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
    <div
      className={`space-y-6 animate-fade-in print:bg-white print:p-0 ${
        printingBlank ? 'print:hidden' : ''
      }`}
    >
      {/* ── Header (hidden in print) ── */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white p-6 relative overflow-hidden shadow-lg print:hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-6 h-6" />
              <h1 className="text-2xl font-extrabold tracking-tight">
                Cahier de Cotation Numérique (RDC)
              </h1>
            </div>
            <p className="text-sm text-teal-100 max-w-xl">
              Modèle conforme à l'enseignement secondaire RDC. Synchronisation en temps
              réel des notes avec les bulletins mensuels et semestriels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isOnline ? (
              <Badge className="bg-emerald-700 text-emerald-100 hover:bg-emerald-800 gap-1.5 py-1 px-2.5">
                <Wifi className="w-3.5 h-3.5" /> En ligne
              </Badge>
            ) : (
              <Badge className="bg-amber-600 text-amber-100 hover:bg-amber-700 gap-1.5 py-1 px-2.5">
                <WifiOff className="w-3.5 h-3.5" /> Mode local
              </Badge>
            )}
            <Button
              onClick={() => setBlankOpen(true)}
              disabled={!hasSecondaryClass}
              className="bg-white/15 hover:bg-white/25 text-white font-bold shadow-md gap-2 backdrop-blur border border-white/30"
            >
              <FilePlus2 className="w-4 h-4" /> Cahier vierge
            </Button>
            <Button
              onClick={handlePrint}
              className="bg-white text-emerald-700 hover:bg-teal-50 font-bold shadow-md gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimer le Cahier
            </Button>
          </div>
        </div>
      </div>

      {/* ── Selection controls (hidden in print) ── */}
      <Card className="shadow-sm border border-border print:hidden">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="h-9 border border-input rounded-lg px-3 bg-background text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
            >
              {classes.length === 0 ? (
                <option value="">Aucune classe secondaire</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="h-9 border border-input rounded-lg px-3 bg-background text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 max-w-[200px]"
            >
              {courses.length === 0 ? (
                <option value="">Aucun cours</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-muted-foreground" />
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="h-9 border border-input rounded-lg px-3 bg-background text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="P1">1ère Période (P1)</option>
              <option value="P2">2ème Période (P2)</option>
              <option value="EX1">Examen 1er Semestre (EX1)</option>
              <option value="P3">3ème Période (P3)</option>
              <option value="P4">4ème Période (P4)</option>
              <option value="EX2">Examen 2ème Semestre (EX2)</option>
            </select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSortStudents}
            className="gap-1.5"
            disabled={students.length === 0}
          >
            <ListOrdered className="w-3.5 h-3.5" /> Trier A-Z
          </Button>

          {canEdit && (
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendToTitulaire(selectedCourseId)}
                disabled={!selectedCourseId || !evaluations.length || sendingEval !== null}
                className="gap-1.5"
              >
                {sendingEval !== null ? (
                  <>
                    <span className="animate-spin">⏳</span> Envoi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Envoyer au titulaire
                  </>
                )}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                onClick={() => setAddColOpen(true)}
                disabled={!selectedCourseId}
              >
                <Plus className="w-4 h-4" /> Ajouter Évaluation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Photos du cahier (prise de vue / import d'image) ── */}
      <Card className="shadow-sm border border-border print:hidden">
        <CardContent className="py-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Images className="w-4 h-4 mt-1 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Photos du cahier de cotation</p>
                <p className="text-xs text-muted-foreground max-w-xl">
                  Photographiez le cahier papier ou importez une image numérisée : elle est
                  classée avec la classe, le cours et la période sélectionnés et reste
                  consultable (zoom, rotation) à tout moment.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={() => handlePickFiles(cameraInputRef.current)}
              />
              <input
                ref={importInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={() => handlePickFiles(importInputRef.current)}
              />
              <Button
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading || !selectedClassId}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Camera className="w-4 h-4" /> Prendre une photo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => importInputRef.current?.click()}
                disabled={uploading || !selectedClassId}
                className="gap-1.5"
              >
                <ImagePlus className="w-4 h-4" /> Importer une photo
              </Button>
            </div>
          </div>

          {photosLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-center">
              <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucune photo pour cette sélection
              </p>
              <p className="text-xs text-muted-foreground/70">
                Scannez les pages du cahier papier pour les conserver ici.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {photos.map((photo, idx) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => {
                    setViewerIndex(idx);
                    setViewerRotation(0);
                  }}
                  className="group relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted/40 transition hover:ring-2 hover:ring-emerald-500"
                  title={photo.fileName}
                >
                  <img
                    src={photo.url}
                    alt={photo.fileName || `Page ${photo.page}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    p.{photo.page}
                  </span>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white">
                    {new Date(photo.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {uploading && (
            <p className="text-xs animate-pulse text-emerald-600">
              Envoi de la photo en cours…
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Cotation Grid Card ── */}
      <Card className="shadow-md border border-border relative overflow-hidden print:border-none print:shadow-none">
        <CardContent className="p-0 sm:p-6 print:p-0">
          {/* Printable Header Section (visible in print only) */}
          <div className="hidden print:block text-center space-y-2 mb-6">
            <h2 className="text-sm font-bold tracking-widest uppercase">
              République Démocratique du Congo
            </h2>
            <p className="text-xs uppercase font-medium">
              Ministère de l'Enseignement Primaire, Secondaire et Technique (EPST)
            </p>
            <div className="border-b-2 border-double border-foreground py-1" />
            <div className="flex justify-between items-center text-xs mt-3">
              <div>
                <strong>École:</strong> {user?.school?.name || 'École Secondaire RDC'}
              </div>
              <div>
                <strong>Classe:</strong>{' '}
                {classes.find((c) => c.id === selectedClassId)?.name || '—'}
              </div>
              <div>
                <strong>Période:</strong> {selectedPeriod}
              </div>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <div>
                <strong>Cours:</strong>{' '}
                {courses.find((c) => c.id === selectedCourseId)?.name || '—'}
              </div>
              <div>
                <strong>Enseignant:</strong>{' '}
                {courses.find((c) => c.id === selectedCourseId)?.teacher?.fullName ||
                  user?.fullName}
              </div>
              <div>
                <strong>Année Scolaire:</strong>{' '}
                {(() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const start = now.getMonth() >= 8 ? y : y - 1;
                  return `${start}-${start + 1}`;
                })()}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-20">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-semibold text-muted-foreground">Aucun élève dans cette classe</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Les élèves inscrits à cette classe apparaîtront automatiquement ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto print:overflow-visible">
              <Table className="border-collapse border border-foreground print:text-[10px]">
                <TableHeader className="bg-muted/40 print:bg-transparent">
                  <TableRow className="border-b border-foreground">
                    <TableHead className="w-12 text-center font-bold text-foreground border-r border-foreground">
                      N°
                    </TableHead>
                    <TableHead className="w-64 font-bold text-foreground border-r border-foreground">
                      Nom, Postnom & Prénom
                    </TableHead>
                    <TableHead className="w-12 text-center font-bold text-foreground border-r border-foreground">
                      Sexe
                    </TableHead>

                    {/* Dynamic evaluations columns */}
                    {evaluations.map((e) => (
                      <TableHead
                        key={e.id}
                        className="text-center min-w-[80px] border-r border-foreground font-semibold text-foreground p-1"
                      >
                        <div className="flex flex-col items-center justify-between h-14">
                          <span className="text-xs font-bold truncate max-w-[100px]" title={e.title}>
                            {e.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            /{e.maxScore}
                          </span>
                          {canEdit && (
                            <div className="flex items-center gap-1.5 mt-1 print:hidden">
                              <button
                                onClick={() => openEditColumn(e)}
                                className="text-blue-500 hover:text-blue-700"
                                title="Modifier la colonne"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteColumn(e.id, e.title)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    ))}

                    <TableHead className="w-20 text-center font-extrabold text-emerald-700 dark:text-emerald-400">
                      Moyenne /20
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, idx) => {
                    const avg = getStudentPeriodAverage(student.id);
                    return (
                      <TableRow
                        key={student.id}
                        className="hover:bg-muted/10 transition-colors border-b border-foreground even:bg-muted/5 print:bg-transparent"
                      >
                        <TableCell className="text-center font-bold border-r border-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="font-semibold border-r border-foreground text-sm uppercase print:text-[10px]">
                          {student.fullName} {student.postName}
                        </TableCell>
                        <TableCell className="text-center font-mono border-r border-foreground">
                          {student.gender}
                        </TableCell>

                        {/* Evaluation inputs */}
                        {evaluations.map((e) => {
                          const mark = e.marks.find((m) => m.studentId === student.id);
                          const scoreVal = mark ? String(mark.score) : '';

                          return (
                            <TableCell
                              key={e.id}
                              className="text-center p-1 border-r border-foreground"
                            >
                              {canEdit ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={e.maxScore}
                                  step="0.5"
                                  value={scoreVal}
                                  onChange={(evt) =>
                                    handleScoreChange(e.id, student.id, evt.target.value)
                                  }
                                  placeholder="—"
                                  className="w-12 h-8 text-center border rounded font-mono font-bold text-sm bg-transparent focus:bg-white focus:text-black focus:ring-1 focus:ring-emerald-500 print:border-none print:w-auto print:text-xs"
                                />
                              ) : (
                                <span className="font-mono font-bold text-sm">
                                  {scoreVal || '—'}
                                </span>
                              )}
                            </TableCell>
                          );
                        })}

                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center justify-center font-extrabold text-sm rounded-lg px-2 py-0.5 border ${
                              avg >= 14
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : avg >= 10
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-red-50 text-red-600 border-red-200'
                            } print:border-none print:bg-transparent`}
                          >
                            {avg.toFixed(1)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Column creation Dialog ── */}
      <Dialog open={addColOpen} onOpenChange={setAddColOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              Ajouter une évaluation
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle colonne d'évaluation pour la période en cours.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="col-title">Titre de l'évaluation</Label>
              <Input
                id="col-title"
                value={colTitle}
                onChange={(e) => setColTitle(e.target.value)}
                placeholder="Ex: Interrogation 1, TP 2"
                className="focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="col-max">Note maximale (Maximum)</Label>
              <Input
                id="col-max"
                type="number"
                min="1"
                value={colMaxScore}
                onChange={(e) => setColMaxScore(e.target.value)}
                placeholder="20"
                className="focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddColOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleAddColumn}
              disabled={addingCol}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {addingCol ? 'Création...' : 'Créer la colonne'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Column editing Dialog ── */}
      <Dialog open={editColOpen} onOpenChange={setEditColOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Modifier l'évaluation
            </DialogTitle>
            <DialogDescription>
              Modifiez les informations de la colonne. Les notes et bulletins seront
              recalculés automatiquement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Titre de l'évaluation</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Ex: Interrogation 1, TP 2"
                className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-max">Note maximale</Label>
                <Input
                  id="edit-max"
                  type="number"
                  min="1"
                  value={editMaxScore}
                  onChange={(e) => setEditMaxScore(e.target.value)}
                  placeholder="20"
                  className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditColOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleEditColumn}
              disabled={savingEdit || !editTitle.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {savingEdit ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Visionneuse des photos du cahier ── */}
      <Dialog
        open={viewerIndex !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewerIndex(null);
            setViewerRotation(0);
            setViewerZoom(1);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] p-4 sm:p-6">
          {viewerIndex !== null && photos[viewerIndex] && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    Page {photos[viewerIndex].page} — {selectedClass?.name || ''}
                    {selectedCourse ? ` · ${selectedCourse.name}` : ''} · {selectedPeriod}
                  </span>
                </DialogTitle>
                <DialogDescription className="truncate">
                  {photos[viewerIndex].fileName} ·{' '}
                  {new Date(photos[viewerIndex].createdAt).toLocaleString('fr-FR')}
                </DialogDescription>
              </DialogHeader>

              <div className="relative flex max-h-[65vh] items-center justify-center overflow-auto rounded-lg border bg-muted/40 p-2">
                <img
                  src={photos[viewerIndex].url}
                  alt={photos[viewerIndex].fileName || 'Photo du cahier'}
                  className="max-h-[60vh] w-auto max-w-full rounded object-contain transition-transform"
                  style={{
                    transform: `rotate(${viewerRotation}deg) scale(${viewerZoom})`,
                  }}
                />
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-2 sm:justify-between">
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewerIndex(Math.max(0, viewerIndex - 1));
                      setViewerRotation(0);
                      setViewerZoom(1);
                    }}
                    disabled={viewerIndex <= 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédente
                  </Button>
                  <span className="px-1 text-xs text-muted-foreground tabular-nums">
                    {viewerIndex + 1} / {photos.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setViewerIndex(Math.min(photos.length - 1, viewerIndex + 1));
                      setViewerRotation(0);
                      setViewerZoom(1);
                    }}
                    disabled={viewerIndex >= photos.length - 1}
                    className="gap-1"
                  >
                    Suivante <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewerZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))}
                    aria-label="Dézoomer"
                  >
                    −
                  </Button>
                  <span className="w-12 text-center text-xs tabular-nums">
                    {Math.round(viewerZoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewerZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
                    aria-label="Zoomer"
                  >
                    +
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewerRotation((r) => (r + 90) % 360)}
                    className="gap-1"
                  >
                    <RotateCw className="w-4 h-4" /> Pivoter
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deletePhoto(photos[viewerIndex].id)}
                    disabled={deletingPhotoId === photos[viewerIndex].id}
                    className="gap-1 text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                    {deletingPhotoId === photos[viewerIndex].id ? 'Suppression…' : 'Supprimer'}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Options d'impression du cahier vierge ── */}
      <Dialog open={blankOpen} onOpenChange={setBlankOpen}>
        <DialogContent className="sm:max-w-lg">
          <div className="h-2 -mx-6 -mt-6 mb-0 rounded-t-lg bg-gradient-to-r from-emerald-500 to-teal-600" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5 text-emerald-600" />
              Cahier vierge à reproduire
            </DialogTitle>
            <DialogDescription>
              Imprimez autant de pages vides que nécessaire pour cette classe de
              secondaire : chaque page reprend l'en-tête officiel RDC, les colonnes
              d'évaluation et les lignes des élèves.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="blank-pages">Nombre de pages</Label>
                <Input
                  id="blank-pages"
                  type="number"
                  min={1}
                  max={30}
                  value={blankPages}
                  onChange={(e) =>
                    setBlankPages(Math.min(30, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blank-cols">Colonnes d'évaluation</Label>
                <Input
                  id="blank-cols"
                  type="number"
                  min={2}
                  max={12}
                  value={blankCols}
                  onChange={(e) =>
                    setBlankCols(Math.min(12, Math.max(2, Number(e.target.value) || 2)))
                  }
                />
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <input
                type="checkbox"
                checked={blankWithStudents}
                onChange={(e) => setBlankWithStudents(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span>
                <span className="font-medium">Pré-remplir la liste des élèves</span>
                <span className="block text-xs text-muted-foreground">
                  {students.length > 0
                    ? `${students.length} élève(s) seront inscrits sur chaque page.`
                    : 'Aucun élève chargé : des lignes vides seront imprimées.'}
                </span>
              </span>
            </label>

            <div className="rounded-lg border border-border bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Classe :</strong> {selectedClass?.name || '—'} ·{' '}
                <strong>Cours :</strong> {selectedCourse?.name || '—'}
              </p>
              <p>
                <strong>Période :</strong> {selectedPeriod} ·{' '}
                <strong>Année :</strong> {schoolYearLabel}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlankOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={startBlankPrint}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Printer className="w-4 h-4" />
              Imprimer {blankPages} page{blankPages > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    {/* ── Pages vierges (visibles uniquement à l'impression) ── */}
    {printingBlank && (
      <div className="hidden print:block text-black">
        <style>{`@page { size: A4 landscape; margin: 8mm; }`}</style>
        {Array.from({ length: blankPages }).map((_, pageIdx) => (
          <div
            key={pageIdx}
            className="mb-4 break-after-page last:break-after-auto"
          >
            <div className="mb-2 text-center">
              <p className="text-[11px] font-bold uppercase tracking-widest">
                République Démocratique du Congo
              </p>
              <p className="text-[9px] uppercase">
                Ministère de l'Enseignement Primaire, Secondaire et Technique (EPST)
              </p>
              <div className="my-1 border-b-2 border-double border-black" />
              <p className="text-[12px] font-bold uppercase">
                Cahier de cotation — {selectedClass?.name || 'Classe'} ·{' '}
                {selectedCourse?.name || 'Cours'}
              </p>
              <div className="mt-1 flex justify-between text-[9px]">
                <span>
                  <strong>École :</strong> {user?.school?.name || '—'}
                </span>
                <span>
                  <strong>Période :</strong> {selectedPeriod}
                </span>
                <span>
                  <strong>Année :</strong> {schoolYearLabel}
                </span>
                <span>
                  <strong>Enseignant :</strong> {user?.fullName || '—'}
                </span>
                <span>
                  <strong>Page :</strong> {pageIdx + 1}/{blankPages}
                </span>
              </div>
            </div>

            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border border-black bg-transparent">
                  <th className="w-8 border border-black p-1 text-center">N°</th>
                  <th className="border border-black p-1 text-left">
                    Nom, Postnom &amp; Prénom
                  </th>
                  <th className="w-10 border border-black p-1 text-center">Sexe</th>
                  {Array.from({ length: blankCols }).map((_, ci) => (
                    <th key={ci} className="border border-black p-1 text-center">
                      Éval. {ci + 1}
                      <span className="block text-[8px] font-normal">/20</span>
                    </th>
                  ))}
                  <th className="w-14 border border-black p-1 text-center">
                    Moy.
                    <span className="block text-[8px] font-normal">/20</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: blankRowCount }).map((_, rowIdx) => {
                  const student = blankWithStudents ? students[rowIdx] : undefined;
                  return (
                    <tr key={rowIdx}>
                      <td className="border border-black p-1 text-center">{rowIdx + 1}</td>
                      <td className="border border-black p-1 h-6">
                        {student
                          ? `${student.fullName} ${student.postName || ''}`.trim()
                          : ''}
                      </td>
                      <td className="border border-black p-1 text-center">
                        {student ? student.gender : ''}
                      </td>
                      {Array.from({ length: blankCols }).map((_, ci) => (
                        <td key={ci} className="border border-black p-1 h-6" />
                      ))}
                      <td className="border border-black p-1 h-6" />
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-3 flex justify-between text-[9px]">
              <span>Le Titulaire ______________________</span>
              <span>L'Enseignant ______________________</span>
              <span>Le Chef d'Établissement ______________________</span>
            </div>
          </div>
        ))}
      </div>
    )}
    </>
  );
}
