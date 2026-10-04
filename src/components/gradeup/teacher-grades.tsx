'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, GraduationCap, Filter, Calculator, Sparkles, Check, Zap, RefreshCw, AlertTriangle, PenLine, CheckCircle2, Clock, XCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CourseInfo, GradeInfo, UserInfo } from '@/lib/types';
import { isSecondaryClass } from '@/lib/grade-cycle';
import { cacheJson, fetchJsonWithCache, queueOrFetch } from '@/lib/offline-sync';

const SECONDARY_PERIODS: { value: string; label: string }[] = [
  { value: 'P1', label: 'P1 — 1ère période (S1)' },
  { value: 'P2', label: 'P2 — 2ème période (S1)' },
  { value: 'EX1', label: 'Examen 1er semestre (EX1)' },
  { value: 'P3', label: 'P3 — 1ère période (S2)' },
  { value: 'P4', label: 'P4 — 2ème période (S2)' },
  { value: 'EX2', label: 'Examen 2ème semestre (EX2)' },
];

const PRIMARY_TRIMESTERS: { value: string; label: string }[] = [
  { value: '1', label: 'Trimestre 1' },
  { value: '2', label: 'Trimestre 2' },
  { value: '3', label: 'Trimestre 3' },
];

interface NoteModification {
  id: string;
  noteId: string;
  newValue: number;
  newMax: number;
  reason: string;
  requestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  createdAt: string;
  student?: { fullName: string };
  course?: { name: string };
}

function gradePeriodLabel(key: string): string {
  const found = SECONDARY_PERIODS.find((p) => p.value === key);
  if (found) return found.label;
  if (key === '1' || key === '2' || key === '3') return `Trimestre ${key}`;
  return key;
}

export default function TeacherGrades() {
  const { user } = useAppStore();
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [students, setStudents] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [filterCourseId, setFilterCourseId] = useState<string>('');
  const [filterTrimester, setFilterTrimester] = useState<string>('1');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [timeGrouping, setTimeGrouping] = useState<'ALL' | 'DAY' | 'WEEK' | 'MONTH' | 'TRIMESTER' | 'SEMESTER' | 'YEAR'>('ALL');
  const [timeValue, setTimeValue] = useState('');

  // Quick grading grid states
  const [gridStudents, setGridStudents] = useState<UserInfo[]>([]);
  const [gridScores, setGridScores] = useState<Record<string, string>>({});
  const [gridComments, setGridComments] = useState<Record<string, string>>({});

  const [formCourseId, setFormCourseId] = useState('');
  const [formStudentId, setFormStudentId] = useState('');
  const [formScore, setFormScore] = useState('');
  const [formMaxScore, setFormMaxScore] = useState('20');
  const [formEvaluationTitle, setFormEvaluationTitle] = useState('');
  const [formEvaluationDate, setFormEvaluationDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formTrimester, setFormTrimester] = useState('1');
  const [formComment, setFormComment] = useState('');
  const [formReason, setFormReason] = useState('');
  const [gradeHistoryList, setGradeHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [modificationRequests, setModificationRequests] = useState<NoteModification[]>([]);
  const [closures, setClosures] = useState<{ scope: string; key: string }[]>([]);
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const [schoolYearId, setSchoolYearId] = useState('');
  const [applyingRequestId, setApplyingRequestId] = useState<string | null>(null);

  // Sync state: tracks the last auto-sync event for the banner
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastSyncInfo, setLastSyncInfo] = useState<{ student: string; trimester: string; average: number } | null>(null);
  const [syncVisible, setSyncVisible] = useState(false);

  const showSyncBanner = (studentName: string, trimester: string, average: number) => {
    setLastSyncedAt(new Date());
    setLastSyncInfo({ student: studentName, trimester, average });
    setSyncVisible(true);
    // Auto-hide after 5 seconds
    setTimeout(() => setSyncVisible(false), 5000);
  };

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    const cacheKey = `/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`;
    try {
      const data = await fetchJsonWithCache<{ courses?: CourseInfo[] }>(cacheKey, { courses: [] });
      await cacheJson(cacheKey, data);
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch {
      setCourses([]);
    }
  }, [user]);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let url = `/api/grades?schoolId=${user.schoolId}&teacherId=${user.id}`;
      if (filterCourseId) url += `&courseId=${filterCourseId}`;
      if (filterTrimester) url += `&trimester=${filterTrimester}`;
      if (periodFrom) url += `&from=${periodFrom}`;
      if (periodTo) url += `&to=${periodTo}`;
      if (timeGrouping !== 'ALL') url += `&groupBy=${timeGrouping}`;
      if (timeValue) url += `&groupValue=${encodeURIComponent(timeValue)}`;
      const data = await fetchJsonWithCache<{ grades?: GradeInfo[] }>(url, { grades: [] });
      await cacheJson(url, data);
      setGrades(Array.isArray(data.grades) ? data.grades : []);
    } catch {
      const url = `/api/grades?schoolId=${user.schoolId}&teacherId=${user.id}${filterCourseId ? `&courseId=${filterCourseId}` : ''}${filterTrimester ? `&trimester=${filterTrimester}` : ''}`;
      setGrades([]);
      toast.error('Impossible de charger les notes : vérifiez la connexion ou les cours attribués.');
    } finally {
      setLoading(false);
    }
  }, [user, filterCourseId, filterTrimester, periodFrom, periodTo, timeGrouping, timeValue]);

  const printPeriod = () => {
    if (!grades.length) { toast.error('Aucune note dans cette période.'); return; }
    window.print();
  };

  const fetchStudents = useCallback(async (courseId: string) => {
    if (!user || !courseId) {
      setStudents([]);
      return;
    }
    try {
      const course = courses.find((c) => c.id === courseId);
      if (!course) return;
      const data = await fetchJsonWithCache<{ users?: UserInfo[] }>(`/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${course.classId}`, { users: [] });
      setStudents(Array.isArray(data.users) ? data.users : []);
    } catch {
      setStudents([]);
    }
  }, [user, courses]);

  const fetchModificationRequests = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const response = await fetch(`/api/note-modifications?schoolId=${user.schoolId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de chargement');
      setModificationRequests(Array.isArray(data.noteModifications) ? data.noteModifications : []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible de charger vos demandes de modification.');
    }
  }, [user?.schoolId]);

  // Cycle RDC : secondaire → périodes P1..EX2 ; Maternelle/Primaire → trimestres.
  const selectedCourse = courses.find((c) => c.id === filterCourseId) || null;
  const selectedIsSecondary = selectedCourse ? isSecondaryClass(selectedCourse.class ?? null) : false;
  const periodOptions = selectedIsSecondary ? SECONDARY_PERIODS : PRIMARY_TRIMESTERS;
  const currentScope = timeGrouping !== 'ALL' ? timeGrouping : (selectedIsSecondary ? (filterTrimester.startsWith('P') || filterTrimester.startsWith('EX') ? 'MONTH' : 'SEMESTER') : 'TRIMESTER');
  const closureKey = timeGrouping !== 'ALL' && timeValue
    ? timeValue
    : filterTrimester || '1';
  const isClosed = closures.some((c) => c.scope === currentScope && c.key === closureKey);

  const closeCurrentPeriod = async () => {
    if (!user?.schoolId || !schoolYearId || isClosed) return;
    if (!window.confirm(`Voulez-vous vraiment clôturer cette période (${currentScope.toLowerCase()}) ? Les notes ne pourront plus être ajoutées ou modifiées.`)) return;
    setClosingKey(`${currentScope}:${closureKey}`);
    try {
      const res = await fetch('/api/academic-closures', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ schoolYearId, scope: currentScope, key: closureKey }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec de la clôture');
      setClosures((prev) => [...prev, { scope: currentScope, key: closureKey }]);
      toast.success('Période clôturée');
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Échec de la clôture'); }
    finally { setClosingKey(null); }
  };

  useEffect(() => {
    if (!user?.schoolId) return;
    fetch(`/api/school-years?schoolId=${user.schoolId}`).then((r) => r.json()).then((d) => {
      const year = (d.years || []).find((y: { status: string }) => y.status === 'OPEN') || d.years?.[0];
      if (year) setSchoolYearId(year.id);
    }).catch(() => {});
  }, [user?.schoolId]);

  useEffect(() => {
    if (!schoolYearId) return;
    fetch(`/api/academic-closures?schoolYearId=${schoolYearId}`).then((r) => r.json()).then((d) => setClosures(d.closures || [])).catch(() => {});
  }, [schoolYearId]);

  // Cycle du cours sélectionné dans le dialog d'ajout/modification.
  const dialogCourse = courses.find((c) => c.id === formCourseId) || null;
  const dialogIsSecondary = dialogCourse ? isSecondaryClass(dialogCourse.class ?? null) : false;
  const dialogPeriodOptions = dialogIsSecondary ? SECONDARY_PERIODS : PRIMARY_TRIMESTERS;

  const autoPrimaryTrimester = useMemo(() => {
    const month = new Date(`${formEvaluationDate}T00:00:00Z`).getUTCMonth() + 1;
    if (month >= 9 && month <= 11) return '1';
    if (month === 12 || month <= 2) return '2';
    return '3';
  }, [formEvaluationDate]);

  // Quand un cours du secondaire est choisi, basculer sur une période RDC.
  useEffect(() => {
    if (!selectedCourse || !selectedIsSecondary) {
      if (!filterCourseId && !['1', '2', '3'].includes(filterTrimester)) {
        setFilterTrimester('1');
      }
      return;
    }
    const isSecondaryKey = SECONDARY_PERIODS.some((p) => p.value === filterTrimester);
    if (!isSecondaryKey) {
      const now = new Date();
      const month = now.getMonth() + 1; // 1-12
      // Sept-Juin : S1 = P1/P2 (examens EX1), S2 = P3/P4 (examens EX2).
      const defaultPeriod = month >= 3 && month <= 6 ? 'P3' : 'P1';
      setFilterTrimester(defaultPeriod);
    }
  }, [selectedCourse, selectedIsSecondary, filterTrimester]);

  useEffect(() => {
    if (!user) return;
    fetchCourses();
  }, [user, fetchCourses]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  useEffect(() => {
    fetchModificationRequests();
  }, [fetchModificationRequests]);

  useEffect(() => {
    if (formCourseId) fetchStudents(formCourseId);
  }, [formCourseId, fetchStudents]);

  // Dans le dialog, basculer sur une période RDC quand le cours est secondaire.
  useEffect(() => {
    if (!dialogCourse || !dialogIsSecondary) return;
    const isSecondaryKey = SECONDARY_PERIODS.some((p) => p.value === formTrimester);
    if (!isSecondaryKey) {
      const now = new Date();
      setFormTrimester(now.getMonth() < 2 || now.getMonth() > 7 ? 'P1' : 'P3');
    }
  }, [dialogCourse, dialogIsSecondary, formTrimester]);

  useEffect(() => {
    if (dialogCourse && !dialogIsSecondary && !editingGrade) setFormTrimester(autoPrimaryTrimester);
  }, [dialogCourse, dialogIsSecondary, editingGrade, autoPrimaryTrimester]);

  // Load students for grid mode when course/trimester changes
  useEffect(() => {
    if (!filterCourseId || !user) {
      setGridStudents([]);
      setGridScores({});
      setGridComments({});
      return;
    }

    // Immediately clear stale data to avoid showing previous class data
    setGridStudents([]);
    setGridScores({});
    setGridComments({});

    const controller = new AbortController();

    const loadGridStudents = async () => {
      try {
        const course = courses.find((c) => c.id === filterCourseId);
        if (!course) return;
        const res = await fetch(
          `/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${course.classId}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        const studentsList = Array.isArray(data.users) ? data.users : (Array.isArray(data) ? data : []);
        setGridStudents(studentsList);

        // Prepopulate gridScores and comments
        const scores: Record<string, string> = {};
        const comments: Record<string, string> = {};
        studentsList.forEach((s: UserInfo) => {
          const matching = grades.find(
            (g) => g.studentId === s.id && g.courseId === filterCourseId && g.trimester === filterTrimester
          );
          scores[s.id] = matching ? String(matching.score) : '';
          comments[s.id] = matching ? matching.comment : '';
        });
        setGridScores(scores);
        setGridComments(comments);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return; // requête annulée, pas d'erreur
      }
    };

    loadGridStudents();
    return () => controller.abort();
  }, [filterCourseId, filterTrimester, courses, grades, user]);


  const resetForm = () => {
    setFormCourseId('');
    setFormStudentId('');
    setFormScore('');
    setFormMaxScore('20');
    setFormEvaluationTitle('');
    setFormEvaluationDate(new Date().toISOString().slice(0, 10));
    setFormTrimester('1');
    setFormComment('');
    setFormReason('');
    setGradeHistoryList([]);
    setEditingGrade(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = async (grade: GradeInfo) => {
    setEditingGrade(grade);
    setFormCourseId(grade.courseId);
    setFormStudentId(grade.studentId);
    setFormScore(String(grade.score));
    setFormMaxScore(String(grade.maxScore));
    setFormTrimester(grade.trimester);
    setFormComment(grade.comment);
    setFormReason('');
    
    // Fetch grade history
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/grades/${grade.id}/history`);
      if (res.ok) {
        const hData = await res.json();
        setGradeHistoryList(hData.history || []);
      }
    } catch {
    } finally {
      setLoadingHistory(false);
    }

    const course = courses.find((c) => c.id === grade.courseId);
    if (course && user) {
      fetch(`/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${course.classId}`)
        .then((res) => res.json())
        .then((data) => setStudents(Array.isArray(data?.users) ? data.users : []))
        .catch(() => {});
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formCourseId || !formStudentId || !formScore || !formTrimester) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (editingGrade && !formReason.trim()) {
      toast.error('Veuillez renseigner un motif pour la modification de la note');
      return;
    }

    const score = parseFloat(formScore);
    const maxScore = parseFloat(formMaxScore);
    if (isNaN(score) || isNaN(maxScore) || maxScore <= 0) {
      toast.error('Veuillez saisir des notes valides');
      return;
    }
    if (score < 0 || score > maxScore) {
      toast.error(`La note doit être comprise entre 0 et ${maxScore}`);
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        schoolId: user.schoolId,
        courseId: formCourseId,
        studentId: formStudentId,
        teacherId: user.id,
        score,
        maxScore,
        evaluationTitle: formEvaluationTitle.trim() || undefined,
        evaluationDate: formEvaluationDate || undefined,
      trimester: dialogIsSecondary ? formTrimester : autoPrimaryTrimester,
      period: dialogIsSecondary ? formTrimester : undefined,
        comment: formComment.trim(),
        modifiedBy: user.id,
        reason: formReason.trim(),
      };

      if (editingGrade) {
        const requestResponse = await fetch('/api/note-modifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noteId: editingGrade.id,
            oldValue: editingGrade.score,
            newValue: score,
            oldMax: editingGrade.maxScore,
            newMax: maxScore,
            reason: formReason.trim(),
          }),
        });
        const requestData = await requestResponse.json();
        if (!requestResponse.ok) {
          throw new Error(requestData.error || 'Erreur lors de la demande de modification');
        }
        toast.success('Demande envoyée à l’administrateur. La note reste inchangée jusqu’à son approbation.');
        setDialogOpen(false);
        resetForm();
        fetchModificationRequests();
        return;
      }

      const res = await queueOrFetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res) {
        const studentName = students.find(s => s.id === formStudentId)?.fullName || 'Élève';
        toast.info('Note enregistrée hors ligne. Elle sera synchronisée au retour du réseau.');
        setDialogOpen(false);
        resetForm();
        showSyncBanner(studentName, dialogIsSecondary ? formTrimester : autoPrimaryTrimester, parseFloat(formScore) / parseFloat(formMaxScore) * 20);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de l\'enregistrement');
        return;
      }

      const studentName = students.find(s => s.id === formStudentId)?.fullName || 'Élève';
      toast.success('Note ajoutée avec succès');
      setDialogOpen(false);
      resetForm();
      fetchGrades();

      // Show sync banner
      showSyncBanner(studentName, dialogIsSecondary ? formTrimester : autoPrimaryTrimester, parseFloat(formScore) / parseFloat(formMaxScore) * 20);
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSubmitting(false);
    }
  };

  const applyApprovedModification = async (request: NoteModification) => {
    const grade = grades.find((item) => item.id === request.noteId);
    if (!grade) {
      toast.error('Rechargez les notes avant d’appliquer cette correction.');
      return;
    }
    setApplyingRequestId(request.id);
    try {
      const response = await fetch(`/api/grades/${grade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: request.newValue,
          maxScore: request.newMax,
          comment: grade.comment,
          reason: request.reason,
          approvedModificationId: request.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Impossible d’appliquer la correction.');
      toast.success('Correction approuvée appliquée et bulletin synchronisé.');
      fetchGrades();
      fetchModificationRequests();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Impossible d’appliquer la correction.');
    } finally {
      setApplyingRequestId(null);
    }
  };

  const lastSaved = useRef<Record<string, string>>({});

  const handleAutoSave = async (studentId: string, scoreStr: string, commentStr: string) => {
    if (!user || !filterCourseId) return;
    if (scoreStr === '') return;
    
    const key = `${studentId}-${filterCourseId}-${filterTrimester}`;
    const saveFingerprint = `${scoreStr}|${commentStr.trim()}`;
    if (lastSaved.current[key] === saveFingerprint) return;

    const score = parseFloat(scoreStr);
    if (isNaN(score)) return;

    try {
      const matchingGrade = grades.find((g) => g.studentId === studentId && g.courseId === filterCourseId && g.trimester === filterTrimester);
      
      const body = {
        schoolId: user.schoolId,
        courseId: filterCourseId,
        studentId,
        teacherId: user.id,
        score,
        maxScore: 20,
        trimester: filterTrimester,
        period: filterTrimester,
        comment: commentStr.trim(),
        quickSave: true,
      };

      const url = matchingGrade ? `/api/grades/${matchingGrade.id}` : '/api/grades';
      const method = matchingGrade ? 'PUT' : 'POST';
      
      const res = matchingGrade
        ? await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await queueOrFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res) {
        lastSaved.current[key] = saveFingerprint;
        const studentName = gridStudents.find(s => s.id === studentId)?.fullName || 'Élève';
        toast.info(`Note de ${studentName} mise en attente hors ligne`);
        return;
      }

      if (res.ok) {
        lastSaved.current[key] = saveFingerprint;
        const studentName = gridStudents.find(s => s.id === studentId)?.fullName || 'Élève';
        toast.success(`Note de ${studentName} enregistrée`);
        // Refresh local grades query
        const gradesRes = await fetch(`/api/grades?schoolId=${user.schoolId}&teacherId=${user.id}&courseId=${filterCourseId}&trimester=${filterTrimester}`);
        const data = await gradesRes.json();
        const freshGrades = Array.isArray(data.grades) ? data.grades : [];
        setGrades(freshGrades);

        // Compute local average for sync banner
        const studentGrades = freshGrades.filter((g: any) => g.studentId === studentId);
        const avg = studentGrades.length > 0
          ? studentGrades.reduce((s: number, g: any) => s + (g.score / g.maxScore) * 20, 0) / studentGrades.length
          : 0;
        showSyncBanner(studentName, filterTrimester, Math.round(avg * 100) / 100);
      }
    } catch {
      toast.error('Erreur lors de l\'enregistrement automatique');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/grades/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Erreur lors de la suppression');
        return;
      }
      toast.success('Note supprimée');
      fetchGrades();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const changeGradeStatus = async (id: string, status: 'SUBMITTED' | 'VALIDATED') => {
    try {
      const response = await fetch(`/api/grades/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action impossible');
      toast.success(status === 'SUBMITTED' ? 'Note soumise pour validation.' : 'Note validée.');
      fetchGrades();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Action impossible');
    }
  };

  const getStudentName = (studentId: string) => {
    return grades.find((g) => g.studentId === studentId)?.student?.fullName || 'Inconnu';
  };

  const getCourseName = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.name || 'Inconnu';
  };

  const getClassAverage = () => {
    if (grades.length === 0) return '—';
    const studentMap = new Map<string, { sum: number; count: number }>();
    for (const g of grades) {
      const entry = studentMap.get(g.studentId) || { sum: 0, count: 0 };
      entry.sum += g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
      entry.count++;
      studentMap.set(g.studentId, entry);
    }
    const studentAverages = Array.from(studentMap.values()).map((e) => e.sum / e.count);
    const avg = studentAverages.reduce((s, a) => s + a, 0) / studentAverages.length;
    return avg.toFixed(2);
  };

  const getPassCount = () => {
    const studentMap = new Map<string, number[]>();
    for (const g of grades) {
      const list = studentMap.get(g.studentId) || [];
      list.push(g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0);
      studentMap.set(g.studentId, list);
    }
    const studentAverages = Array.from(studentMap.values()).map((scores) => scores.reduce((a, b) => a + b, 0) / scores.length);
    return studentAverages.filter((avg) => avg >= 10).length;
  };

  // Real-time Class Grid stats
  const gridStats = useMemo(() => {
    const scores = Object.values(gridScores).map(s => parseFloat(s)).filter(s => !isNaN(s));
    const total = gridStudents.length;
    const graded = scores.length;
    const average = graded > 0 ? (scores.reduce((sum, s) => sum + s, 0) / graded).toFixed(2) : '—';
    return { total, graded, average };
  }, [gridScores, gridStudents]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Auto-sync confirmation banner ── */}
      {syncVisible && lastSyncInfo && (
        <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
          <div className="flex items-center gap-3 bg-emerald-600 text-white rounded-2xl px-5 py-3.5 shadow-2xl shadow-emerald-500/30 border border-emerald-500">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Bulletin mis à jour automatiquement</p>
              <p className="text-xs text-emerald-100 mt-0.5">
                {lastSyncInfo.student} · {gradePeriodLabel(lastSyncInfo.trimester)} · Moy. {lastSyncInfo.average.toFixed(1)}/20
              </p>
            </div>
            <button
              onClick={() => setSyncVisible(false)}
              className="ml-2 text-emerald-200 hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Gestion des Notes</h1>
            <p className="text-sm text-muted-foreground mt-1">Ajoutez, modifiez et consultez les notes de vos élèves</p>
          </div>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20 gap-2"
            onClick={openCreateDialog}
            disabled={courses.length === 0}
          >
            <Plus className="h-4 w-4" />
            Ajouter une note
          </Button>
        </div>
      </div>

      {modificationRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PenLine className="h-4 w-4 text-amber-700" />
              Mes demandes de correction
            </CardTitle>
            <CardDescription>Une correction ne peut être appliquée qu’après approbation de l’administrateur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {modificationRequests.slice(0, 5).map((request) => (
              <div key={request.id} className="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{request.student?.fullName || 'Élève'} · {request.course?.name || 'Cours'}</p>
                  <p className="text-xs text-muted-foreground">Correction demandée : {request.newValue}/{request.newMax} · {request.reason}</p>
                </div>
                {request.requestStatus === 'PENDING' ? (
                  <Badge variant="outline" className="w-fit border-amber-300 bg-amber-50 text-amber-800"><Clock className="mr-1 h-3 w-3" /> En attente</Badge>
                ) : request.requestStatus === 'REJECTED' ? (
                  <Badge variant="outline" className="w-fit border-red-300 bg-red-50 text-red-700"><XCircle className="mr-1 h-3 w-3" /> Refusée</Badge>
                ) : request.requestStatus === 'APPLIED' ? (
                  <Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" /> Appliquée</Badge>
                ) : (
                  <Button size="sm" onClick={() => applyApprovedModification(request)} disabled={applyingRequestId === request.id}>
                    <CheckCircle2 className={`mr-1 h-4 w-4 ${applyingRequestId === request.id ? 'animate-pulse' : ''}`} />
                    {applyingRequestId === request.id ? 'Application...' : 'Appliquer la correction'}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No courses assigned */}
      {!loading && courses.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Aucun cours ne vous est assigné. Veuillez contacter l&apos;administrateur pour qu&apos;il vous attribue des cours avant de pouvoir ajouter des notes.
          </AlertDescription>
        </Alert>
      )}

      {/* Controls / Filter Bar */}
      <Card className="shadow-sm border border-border bg-card">
       <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 flex-wrap py-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          
          {/* iOS native style select menu for Course */}
          <select
            value={filterCourseId}
            onChange={(e) => setFilterCourseId(e.target.value)}
           className="w-full sm:w-48 h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-medium"
          >
            <option value="">Tous les cours</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.class?.name}</option>
            ))}
          </select>

          <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} className="w-full sm:w-40" aria-label="Date de début" />
          <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} className="w-full sm:w-40" aria-label="Date de fin exclusive" />
          <select
            value={timeGrouping}
            onChange={(e) => { setTimeGrouping(e.target.value as typeof timeGrouping); setTimeValue(''); }}
            className="w-full sm:w-40 h-10 border border-input rounded-lg px-3 bg-background text-sm font-medium"
            aria-label="Regrouper les notes par"
          >
            <option value="ALL">Toutes les périodes</option>
            <option value="DAY">Jour</option>
            <option value="WEEK">Semaine</option>
            <option value="MONTH">Mois</option>
            <option value="TRIMESTER">Trimestre</option>
            <option value="SEMESTER">Semestre</option>
            <option value="YEAR">Année</option>
          </select>
          {timeGrouping === 'DAY' && <Input type="date" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-40" aria-label="Jour à consulter" />}
          {timeGrouping === 'MONTH' && <Input type="month" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-40" aria-label="Mois à consulter" />}
          {timeGrouping === 'YEAR' && <Input type="number" min="2000" max="2100" placeholder="2026" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-28" aria-label="Année à consulter" />}
          {timeGrouping === 'WEEK' && <Input placeholder="2026-W38" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-32" aria-label="Semaine à consulter" />}
          {timeGrouping === 'TRIMESTER' && <select value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-32 h-10 border border-input rounded-lg px-3 bg-background text-sm"><option value="">Choisir T</option><option value="1">Trimestre 1</option><option value="2">Trimestre 2</option><option value="3">Trimestre 3</option></select>}
          {timeGrouping === 'SEMESTER' && <select value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full sm:w-32 h-10 border border-input rounded-lg px-3 bg-background text-sm"><option value="">Choisir S</option><option value="1">Semestre 1</option><option value="2">Semestre 2</option></select>}
          <Button type="button" variant="outline" onClick={printPeriod} className="gap-2"><span aria-hidden="true">🖨</span> Imprimer la période</Button>

          {/* iOS native style select menu for Période / Trimestre */}
          <select
            value={filterTrimester}
            onChange={(e) => setFilterTrimester(e.target.value)}
            className="w-full sm:w-52 h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-medium"
          >
            {periodOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button type="button" variant={isClosed ? 'secondary' : 'destructive'} onClick={closeCurrentPeriod} disabled={isClosed || !!closingKey} className="gap-2">
            <Lock className="h-4 w-4" />
            {isClosed ? 'Période clôturée' : closingKey ? 'Clôture...' : `Clôturer ${currentScope === 'MONTH' ? 'la période' : currentScope === 'SEMESTER' ? 'le semestre' : 'le trimestre'}`}
          </Button>

          {!filterCourseId && (
            <div className="w-full sm:ml-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calculator className="h-4 w-4 text-blue-500" />
                Moyenne globale: <strong className="text-foreground">{getClassAverage()}</strong>/20
              </span>
              <span>Réussites: <strong className="text-emerald-600">{getPassCount()}</strong>/{grades.length}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Grid Quick Grading Mode vs List Mode */}
      {filterCourseId ? (
        <div className="space-y-6">
          {/* Grid Mode Stats & Progress bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 border-blue-150">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-blue-700/80 uppercase font-bold tracking-wider">Moyenne de classe</p>
                  <p className="text-3xl font-extrabold text-blue-600 mt-1">{gridStats.average}<span className="text-xs font-normal text-muted-foreground ml-0.5">/20</span></p>
                </div>
                <Calculator className="h-8 w-8 text-blue-500 opacity-60" />
              </div>
            </Card>
            
            <Card className="p-4 sm:col-span-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Progression de la notation</p>
                  <p className="text-base font-bold mt-0.5">{gridStats.graded} sur {gridStats.total} élèves notés</p>
                </div>
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${gridStats.total > 0 ? (gridStats.graded / gridStats.total) * 100 : 0}%` }}
                />
              </div>
            </Card>
          </div>

          {/* Saisie rapide table */}
          <Card className="shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/20 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">🟢 Grille de notation rapide</CardTitle>
              <CardDescription>Saisissez les notes. La validation s'effectue automatiquement lorsque vous quittez la case (perte de focus).</CardDescription>
            </CardHeader>
            <div className="hidden md:block overflow-x-auto">
              <Table className="text-sm min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="pl-6">Élève</TableHead>
                    <TableHead className="text-center w-36">Note (/20)</TableHead>
                    <TableHead className="w-80">Appréciation / Commentaire</TableHead>
                    <TableHead className="text-center w-24">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gridStudents.map((student) => {
                    const score = gridScores[student.id] || '';
                    const comment = gridComments[student.id] || '';
                    const hasGrade = score !== '';
                    const existingGrade = grades.find((grade) => grade.studentId === student.id && grade.courseId === filterCourseId && grade.trimester === filterTrimester);
                     
                    return (
                      <TableRow key={student.id} className="hover:bg-muted/10">
                        <TableCell className="pl-6 font-semibold">{student.fullName}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.25"
                            min="0"
                            max="20"
                            placeholder="—"
                            className="text-center font-bold text-sm h-10 w-24 mx-auto rounded-lg focus:ring-2 focus:ring-blue-500/20"
                            value={score}
                            onChange={(e) => setGridScores({ ...gridScores, [student.id]: e.target.value })}
                            onBlur={() => handleAutoSave(student.id, score, comment)}
                            disabled={!!existingGrade}
                            title={existingGrade ? 'Utilisez la liste des notes pour demander une correction.' : undefined}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Ajouter une appréciation..."
                            className="h-10 rounded-lg text-xs"
                            value={comment}
                            onChange={(e) => setGridComments({ ...gridComments, [student.id]: e.target.value })}
                            onBlur={() => handleAutoSave(student.id, score, comment)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {existingGrade ? (
                            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditDialog(existingGrade)}>
                              <PenLine className="mr-1 h-3 w-3" /> Demander
                            </Button>
                          ) : hasGrade ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><Check className="w-3 h-3" /> Validé</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground bg-muted/40">À saisir</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="block md:hidden space-y-3 p-4">
              {gridStudents.map((student) => {
                const score = gridScores[student.id] || '';
                const comment = gridComments[student.id] || '';
                const hasGrade = score !== '';
                const existingGrade = grades.find((grade) => grade.studentId === student.id && grade.courseId === filterCourseId && grade.trimester === filterTrimester);
                return (
                  <div key={student.id} className="rounded-xl border border-border bg-background/80 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">Saisie rapide</p>
                      </div>
                      {existingGrade ? (
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => openEditDialog(existingGrade)}>
                          <PenLine className="mr-1 h-3 w-3" /> Demander
                        </Button>
                      ) : hasGrade ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><Check className="w-3 h-3" /> Validé</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground bg-muted/40">À saisir</Badge>
                      )}
                    </div>
                    <div className="mt-3 space-y-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.25"
                        min="0"
                        max="20"
                        placeholder="Note /20"
                        className="text-center font-bold text-sm h-10 rounded-lg"
                        value={score}
                        onChange={(e) => setGridScores({ ...gridScores, [student.id]: e.target.value })}
                        onBlur={() => handleAutoSave(student.id, score, comment)}
                        disabled={!!existingGrade}
                        title={existingGrade ? 'Utilisez le bouton Demander pour une correction.' : undefined}
                      />
                      <Input
                        placeholder="Appréciation"
                        className="h-10 rounded-lg text-xs"
                        value={comment}
                        onChange={(e) => setGridComments({ ...gridComments, [student.id]: e.target.value })}
                        onBlur={() => handleAutoSave(student.id, score, comment)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      ) : (
        /* Standard Grade List View */
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : grades.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <GraduationCap className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Aucune note enregistrée</h3>
              <p className="text-muted-foreground mb-4">Sélectionnez un cours ci-dessus pour accéder à la grille de notation rapide ou créez une note individuelle.</p>
              <Button onClick={openCreateDialog} variant="outline" className="hover:scale-[1.02] active:scale-[0.98] transition-all gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une note
              </Button>
            </div>
          ) : (
            <Card className="shadow-sm">
              <ScrollArea className="max-h-[500px]">
                <div className="hidden md:block overflow-x-auto">
                  <Table className="min-w-[650px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Élève</TableHead>
                        <TableHead>Cours</TableHead>
                        <TableHead className="text-center">Note</TableHead>
                        <TableHead className="text-center">Note max</TableHead>
                        <TableHead>Trimestre</TableHead>
                        <TableHead className="hidden sm:table-cell">Commentaire</TableHead>
                        <TableHead className="text-center">Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((grade) => {
                        const normalizedScore = (grade.score / grade.maxScore) * 20;
                        return (
                          <TableRow key={grade.id} className="even:bg-muted/20 hover:bg-blue-50/50 transition-colors">
                            <TableCell className="font-medium">
                              {grade.student?.fullName || getStudentName(grade.studentId)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">
                                {grade.course?.name || getCourseName(grade.courseId)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold shadow-sm ${
                                  normalizedScore >= 16 ? 'bg-green-50 text-green-700 border border-green-200' :
                                  normalizedScore >= 14 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  normalizedScore >= 12 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                                  normalizedScore >= 10 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                                  'bg-red-50 text-red-700 border border-red-200'
                                }`}
                              >
                                {grade.score}
                              </span>
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">{grade.maxScore}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50">{grade.trimester && gradePeriodLabel(grade.trimester)}</Badge>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-muted-foreground text-xs">
                              {grade.comment || '—'}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={grade.status === 'VALIDATED' ? 'default' : 'outline'}>{grade.status || 'DRAFT'}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {grade.status !== 'SUBMITTED' && grade.status !== 'VALIDATED' && <Button variant="outline" size="sm" onClick={() => changeGradeStatus(grade.id, 'SUBMITTED')}>Soumettre</Button>}
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEditDialog(grade)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleDelete(grade.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Average Row */}
                      <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold">
                        <TableCell colSpan={2} className="text-blue-700">Moyenne</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm">
                            {getClassAverage()}/20
                          </Badge>
                        </TableCell>
                        <TableCell colSpan={4}></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                <div className="block md:hidden space-y-3 p-4">
                  {grades.map((grade) => {
                    const normalizedScore = (grade.score / grade.maxScore) * 20;
                    return (
                      <div key={grade.id} className="rounded-xl border border-border bg-background/80 p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{grade.student?.fullName || getStudentName(grade.studentId)}</p>
                            <p className="text-xs text-muted-foreground">{grade.course?.name || getCourseName(grade.courseId)}</p>
                          </div>
                          <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 bg-blue-50">{grade.trimester && gradePeriodLabel(grade.trimester)}</Badge>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold shadow-sm ${
                            normalizedScore >= 16 ? 'bg-green-50 text-green-700 border border-green-200' :
                            normalizedScore >= 14 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            normalizedScore >= 12 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            normalizedScore >= 10 ? 'bg-orange-50 text-orange-700 border border-orange-200' :
                            'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {grade.score}/{grade.maxScore}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEditDialog(grade)}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleDelete(grade.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {grade.comment && (
                          <p className="mt-2 text-xs text-muted-foreground">{grade.comment}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Individual Grade Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-lg">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-500" />
              {editingGrade ? 'Modifier la note' : 'Ajouter une note'}
            </DialogTitle>
            <DialogDescription>
              {editingGrade ? 'Modifiez les informations de la note' : 'Enregistrez une nouvelle note pour un élève'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cours *</Label>
              <select
                value={formCourseId}
                onChange={(e) => { setFormCourseId(e.target.value); setFormStudentId(''); }}
                className="w-full h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="">Sélectionner un cours</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.class?.name}</option>
                ))}
              </select>
            </div>
            {!editingGrade && !dialogIsSecondary && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                Trimestre déterminé automatiquement par la date : <strong>{gradePeriodLabel(autoPrimaryTrimester)}</strong>.
              </p>
            )}
            <div className="space-y-2">
              <Label>Élève *</Label>
              <select
                value={formStudentId}
                onChange={(e) => setFormStudentId(e.target.value)}
                disabled={!formCourseId}
                className="w-full h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                <option value="">{formCourseId ? 'Sélectionner un élève' : 'Sélectionnez d\'abord un cours'}</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.fullName}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Note *</Label>
                <Input type="number" inputMode="decimal" placeholder="0" min="0" max={formMaxScore} step="0.25" value={formScore} onChange={(e) => setFormScore(e.target.value)} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-2">
                <Label>Note max</Label>
                <Input type="number" placeholder="20" min="1" value={formMaxScore} onChange={(e) => setFormMaxScore(e.target.value)} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
            </div>
            {!editingGrade && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Évaluation</Label>
                  <Input
                    placeholder="Ex. Interrogation 1"
                    value={formEvaluationTitle}
                    onChange={(e) => setFormEvaluationTitle(e.target.value)}
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date de l'évaluation</Label>
                  <Input
                    type="date"
                    value={formEvaluationDate}
                    onChange={(e) => setFormEvaluationDate(e.target.value)}
                    className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>
            )}
            {(!editingGrade || dialogIsSecondary) && (
              <div className="space-y-2">
              <Label>{dialogIsSecondary ? 'Période *' : 'Trimestre *'}</Label>
              <select
                value={formTrimester}
                onChange={(e) => setFormTrimester(e.target.value)}
                className="w-full h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
              >
                {dialogPeriodOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              </div>
            )}
            {!editingGrade && !dialogIsSecondary && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
                Trimestre déterminé automatiquement par la date : <strong>{gradePeriodLabel(autoPrimaryTrimester)}</strong>.
              </p>
            )}
             <div className="space-y-2">
              <Label>Commentaire</Label>
              <Textarea placeholder="Commentaire sur la performance..." value={formComment} onChange={(e) => setFormComment(e.target.value)} rows={2} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-xs" />
            </div>

            {editingGrade && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-red-500">Motif de la modification *</Label>
                <Textarea
                  placeholder="Raison du changement de note (obligatoire)..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  rows={2}
                  className="focus:ring-2 focus:ring-red-500/20 focus:border-red-500 border-red-200 transition-all text-xs"
                />
              </div>
            )}

            {editingGrade && gradeHistoryList.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Historique des modifications</Label>
                <div className="max-h-32 overflow-y-auto space-y-2 pr-1 text-xs">
                  {gradeHistoryList.map((h: any) => (
                    <div key={h.id} className="p-2 rounded bg-muted/50 border text-[11px] leading-relaxed">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Par: {h.modifier?.fullName || 'Enseignant'} ({h.modifier?.role})</span>
                        <span>{new Date(h.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                      <div className="mt-1">
                        Valeur : <strong className="text-red-600">{h.oldScore}</strong> → <strong className="text-emerald-600">{h.newScore}</strong>
                      </div>
                      {h.reason && (
                        <div className="mt-0.5 text-muted-foreground italic">
                          Motif : "{h.reason}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="hover:scale-[1.02] active:scale-[0.98] transition-all">Annuler</Button>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform" onClick={handleSubmit} disabled={submitting || !formCourseId || !formStudentId || !formScore || !formTrimester}>
              {submitting ? 'Enregistrement...' : editingGrade ? 'Confirmer la modification' : 'Enregistrer la note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
