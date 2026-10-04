'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { subscribeToTable, isRealtimeEnabled } from '@/lib/realtime';
import { Separator } from '@/components/ui/separator';
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Clock,
  BookOpen,
  User,
  School,
  AlertTriangle,
  RefreshCw,
  Coffee,
  PlusCircle,
  Send,
  CheckCircle,
  Upload,
  Megaphone,
  Users,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import type { CsvObject } from '@/lib/csv';

interface ClassInfo {
  id: string;
  name: string;
  level: string;
}

interface CourseInfo {
  id: string;
  name: string;
  teacherId: string;
  teacher: {
    id: string;
    fullName: string;
  };
}

interface ScheduleSlot {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  exceptions: string;
  course: {
    id: string;
    name: string;
    teacher: {
      id: string;
      fullName: string;
    };
  };
}

interface TimeSlot {
  id: string;
  start: string;
  end: string;
  isBreak: boolean;
}

const DAYS = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
];

const DEFAULT_TIME_SLOTS: TimeSlot[] = [
  { id: 'ts-1', start: '07:30', end: '08:20', isBreak: false },
  { id: 'ts-2', start: '08:20', end: '09:10', isBreak: false },
  { id: 'ts-3', start: '09:10', end: '10:00', isBreak: false },
  { id: 'ts-4', start: '10:00', end: '10:20', isBreak: true },
  { id: 'ts-5', start: '10:20', end: '11:10', isBreak: false },
  { id: 'ts-6', start: '11:10', end: '12:00', isBreak: false },
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function getLastSlotEnd(slots: TimeSlot[]): string {
  if (slots.length === 0) return '07:30';
  return slots[slots.length - 1].end;
}

export default function AdminSchedules() {
  const { user } = useAppStore();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Dynamic time slots (stored in localStorage per school)
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(DEFAULT_TIME_SLOTS);

  // Dialog Add/Edit Course Slot
  const [showAddEdit, setShowAddEdit] = useState(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null);
  const [slotDay, setSlotDay] = useState<number>(1);
  const [slotStart, setSlotStart] = useState<string>('07:30');
  const [slotEnd, setSlotEnd] = useState<string>('08:20');
  const [slotCourseId, setSlotCourseId] = useState<string>('');
  const [slotRoom, setSlotRoom] = useState<string>('');
  const [slotPeriodStart, setSlotPeriodStart] = useState<string>('');
  const [slotPeriodEnd, setSlotPeriodEnd] = useState<string>('');
  const [slotExceptions, setSlotExceptions] = useState<string>('');
  const [savingSlot, setSavingSlot] = useState(false);
  const [resolvedTeacherName, setResolvedTeacherName] = useState<string>('');

  // Dialog Manage Time Slots
  const [showTimeSlotManager, setShowTimeSlotManager] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [tsStart, setTsStart] = useState('');
  const [tsEnd, setTsEnd] = useState('');
  const [tsIsBreak, setTsIsBreak] = useState(false);

  // Dialog Duplicate
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [duplicating, setDuplicating] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // ── Import de document & partage de l'emploi du temps ────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareScope, setShareScope] = useState<'ALL' | 'CLASS' | 'USER'>('ALL');
  const [shareClassId, setShareClassId] = useState('');
  const [shareRole, setShareRole] = useState('STUDENT');
  const [shareUserId, setShareUserId] = useState('');
  const [shareUsers, setShareUsers] = useState<{ id: string; fullName: string }[]>([]);
  const [shareMessage, setShareMessage] = useState('');
  const [sharing, setSharing] = useState(false);

  // ── Publish schedule to teachers ─────────────────────────────────────
  const handlePublishSchedule = async () => {
    if (!selectedClassId || !user?.schoolId) {
      toast.error('Sélectionnez une classe avant de publier');
      return;
    }
    if (schedules.length === 0) {
      toast.error('L\'emploi du temps est vide. Ajoutez des cours d\'abord.');
      return;
    }
    setPublishing(true);
    try {
      const selectedClass = classes.find((c) => c.id === selectedClassId);
      const className = selectedClass?.name || 'votre classe';

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          title: `📅 Emploi du temps publié — ${className}`,
          message: `L'administrateur a publié l'emploi du temps de la classe ${className}. Consultez-le dans votre onglet "Emploi du temps"`,
          type: 'SYSTEM',
          targetRole: 'TEACHER',
        }),
      });

      if (res.ok) {
        toast.success(`Emploi du temps de ${className} publié ! Une notification a été envoyée aux professeurs.`);
      } else {
        toast.error('Erreur lors de la publication');
      }
    } catch {
      toast.error('Erreur réseau lors de la publication');
    } finally {
      setPublishing(false);
    }
  };

  // ── Load time slots from backend ───────────────────────────────────────────
  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchTimeSlots = async () => {
      try {
        const res = await fetch(`/api/schedules/timeslots?schoolId=${user.schoolId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.timeSlots) && data.timeSlots.length > 0) {
          setTimeSlots(data.timeSlots);
        }
      } catch {
        // ignore
      }
    };
    fetchTimeSlots();
  }, [user?.schoolId]);

  const saveTimeSlots = useCallback(async (slots: TimeSlot[]): Promise<boolean> => {
    if (!user?.schoolId) return false;
    try {
      const res = await fetch(`/api/schedules/timeslots?schoolId=${user.schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSlots: slots }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }, [user?.schoolId]);

  // ── Fetch Data ──────────────────────────────────────────────────────────────
  const fetchClassesAndCourses = useCallback(async () => {
    if (!user?.schoolId) return;
    try {
      const classesRes = await fetch(`/api/classes?schoolId=${user.schoolId}`);
      const classesData = await classesRes.json();
      const loadedClasses = Array.isArray(classesData)
        ? classesData
        : Array.isArray(classesData.classes)
        ? classesData.classes
        : [];
      setClasses(loadedClasses);
      if (loadedClasses.length > 0) setSelectedClassId(loadedClasses[0].id);
    } catch {
      toast.error('Erreur lors du chargement des classes');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  const fetchSchedulesAndCoursesOfClass = useCallback(async () => {
    if (!selectedClassId || !user?.schoolId) return;
    setLoadingGrid(true);
    try {
      const [schedRes, coursesRes] = await Promise.all([
        fetch(`/api/schedules?schoolId=${user.schoolId}&classId=${selectedClassId}`),
        fetch(`/api/courses?schoolId=${user.schoolId}&classId=${selectedClassId}`),
      ]);
      if (schedRes.ok) setSchedules(await schedRes.json());
      if (coursesRes.ok) {
        const cData = await coursesRes.json();
        setCourses(Array.isArray(cData.courses) ? cData.courses : Array.isArray(cData) ? cData : []);
      }
    } catch {
      toast.error('Erreur lors de la récupération de la grille');
    } finally {
      setLoadingGrid(false);
    }
  }, [selectedClassId, user?.schoolId]);

  useEffect(() => { fetchClassesAndCourses(); }, [fetchClassesAndCourses]);
  useEffect(() => { fetchSchedulesAndCoursesOfClass(); }, [selectedClassId, fetchSchedulesAndCoursesOfClass]);

  // ── Import de l'emploi du temps ────────────────────────────────────────
  const handleImportSchedules = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    const res = await fetch('/api/schedules/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: user.schoolId, rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "L'import a échoué");
    if (data.errors?.length) data.errors.forEach((message: string) => toast.warning(message));
    toast.success(
      `${data.created} créneau${data.created > 1 ? 'x' : ''} importé${data.created > 1 ? 's' : ''}` +
        (data.coursesCreated ? ` · ${data.coursesCreated} cours créé${data.coursesCreated > 1 ? 's' : ''}` : '') +
        (data.skipped ? ` · ${data.skipped} déjà existant${data.skipped > 1 ? 's' : ''}` : '')
    );
    if (data.created > 0) fetchSchedulesAndCoursesOfClass();
  };

  // ── Partage de l'emploi du temps (tous ou individuellement) ───────────────
  useEffect(() => {
    if (!showShare || shareScope !== 'USER' || !user?.schoolId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/users?schoolId=${user.schoolId}&role=${shareRole}`);
        const data = await res.json();
        if (!cancelled) setShareUsers(Array.isArray(data.users) ? data.users : []);
      } catch {
        if (!cancelled) setShareUsers([]);
      }
    })();
    return () => { cancelled = true; };
  }, [showShare, shareScope, shareRole, user?.schoolId]);

  const handleOpenShare = () => {
    setShareScope(selectedClassId ? 'CLASS' : 'ALL');
    setShareClassId(selectedClassId);
    setShareUserId('');
    setShareMessage('');
    setShowShare(true);
  };

  const handleShare = async () => {
    if (!user?.schoolId) return;
    if (shareScope === 'CLASS' && !shareClassId) { toast.error('Sélectionnez une classe'); return; }
    if (shareScope === 'USER' && !shareUserId) { toast.error('Sélectionnez un destinataire'); return; }
    setSharing(true);
    try {
      const res = await fetch('/api/schedules/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          ...(shareScope === 'CLASS' ? { classId: shareClassId } : {}),
          ...(shareScope === 'USER' ? { userId: shareUserId } : {}),
          ...(shareScope === 'ALL' ? { targetRole: 'ALL' } : {}),
          message: shareMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Le partage a échoué');
      toast.success('Emploi du temps partagé avec succès');
      setShowShare(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Le partage a échoué');
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (!user?.schoolId) return;
    const unsub = subscribeToTable({
      table: 'CourseSchedule',
      channelName: `realtime-schedules-admin-${user.schoolId}`,
      onEvent: fetchSchedulesAndCoursesOfClass,
    });
    const poll = setInterval(fetchSchedulesAndCoursesOfClass, isRealtimeEnabled() ? 15000 : 5000);
    return () => { unsub(); clearInterval(poll); };
  }, [user?.schoolId, fetchSchedulesAndCoursesOfClass]);

  useEffect(() => {
    if (!slotCourseId) { setResolvedTeacherName(''); return; }
    const match = courses.find((c) => c.id === slotCourseId);
    setResolvedTeacherName(match?.teacher?.fullName || '');
  }, [slotCourseId, courses]);

  // ── Time Slot Management ───────────────────────────────────────────────────
  const handleAddTimeSlot = async () => {
    const lastEnd = getLastSlotEnd(timeSlots);
    const newEnd = addMinutes(lastEnd, 50);
    const newSlot: TimeSlot = {
      id: `ts-${Date.now()}`,
      start: lastEnd,
      end: newEnd,
      isBreak: false,
    };
    const updated = [...timeSlots, newSlot];
    setTimeSlots(updated);
    const ok = await saveTimeSlots(updated);
    if (ok) toast.success(`Plage horaire ajoutée : ${lastEnd} → ${newEnd}`);
    else toast.error('Impossible d\'enregistrer la plage horaire.');
  };

  const handleOpenEditTimeSlot = (ts: TimeSlot) => {
    setEditingTimeSlot(ts);
    setTsStart(ts.start);
    setTsEnd(ts.end);
    setTsIsBreak(ts.isBreak);
    setShowTimeSlotManager(true);
  };

  const handleOpenNewTimeSlot = () => {
    const lastEnd = getLastSlotEnd(timeSlots);
    const newEnd = addMinutes(lastEnd, 50);
    setEditingTimeSlot(null);
    setTsStart(lastEnd);
    setTsEnd(newEnd);
    setTsIsBreak(false);
    setShowTimeSlotManager(true);
  };

  const handleSaveTimeSlot = async () => {
    if (!tsStart || !tsEnd) { toast.error('Heure de début et fin obligatoires'); return; }
    if (tsStart >= tsEnd) { toast.error('L\'heure de fin doit être après l\'heure de début'); return; }

    let updated: TimeSlot[];
    if (editingTimeSlot) {
      updated = timeSlots.map((ts) =>
        ts.id === editingTimeSlot.id ? { ...ts, start: tsStart, end: tsEnd, isBreak: tsIsBreak } : ts
      );
    } else {
      const newTs: TimeSlot = { id: `ts-${Date.now()}`, start: tsStart, end: tsEnd, isBreak: tsIsBreak };
      updated = [...timeSlots, newTs].sort((a, b) => a.start.localeCompare(b.start));
    }
    setTimeSlots(updated);
    const ok = await saveTimeSlots(updated);
    if (!ok) {
      toast.error(editingTimeSlot ? 'Impossible de modifier la plage horaire.' : 'Impossible d\'ajouter la plage horaire.');
      return;
    }
    setShowTimeSlotManager(false);
    toast.success(editingTimeSlot ? 'Plage horaire modifiée' : 'Plage horaire ajoutée');
  };

  const handleDeleteTimeSlot = async (tsId: string) => {
    if (!confirm('Supprimer cette plage horaire ?')) return;
    const updated = timeSlots.filter((ts) => ts.id !== tsId);
    setTimeSlots(updated);
    const ok = await saveTimeSlots(updated);
    if (ok) toast.success('Plage horaire supprimée');
    else toast.error('Impossible de supprimer la plage horaire.');
  };

  const handleToggleBreak = async (tsId: string) => {
    const updated = timeSlots.map((ts) =>
      ts.id === tsId ? { ...ts, isBreak: !ts.isBreak } : ts
    );
    setTimeSlots(updated);
    const ok = await saveTimeSlots(updated);
    if (!ok) toast.error('Impossible d\'enregistrer la pause.');
  };

  // ── Course Slot Management ─────────────────────────────────────────────────
  const handleOpenAdd = (day: number, start: string, end: string) => {
    setEditingSlot(null);
    setSlotDay(day);
    setSlotStart(start);
    setSlotEnd(end);
    setSlotCourseId('');
    setSlotRoom('');
    setSlotPeriodStart('');
    setSlotPeriodEnd('');
    setSlotExceptions('');
    setShowAddEdit(true);
  };

  const handleOpenEdit = (slot: ScheduleSlot) => {
    setEditingSlot(slot);
    setSlotDay(slot.dayOfWeek);
    setSlotStart(slot.startTime);
    setSlotEnd(slot.endTime);
    setSlotCourseId(slot.courseId);
    setSlotRoom(slot.room);
    setSlotPeriodStart(slot.periodStart ? slot.periodStart.split('T')[0] : '');
    setSlotPeriodEnd(slot.periodEnd ? slot.periodEnd.split('T')[0] : '');
    try {
      const arr = JSON.parse(slot.exceptions || '[]');
      setSlotExceptions(Array.isArray(arr) ? arr.join(', ') : '');
    } catch { setSlotExceptions(''); }
    setShowAddEdit(true);
  };

  const handleSaveSlot = async () => {
    if (!slotCourseId || !user?.schoolId) { toast.error('Veuillez sélectionner un cours'); return; }
    setSavingSlot(true);
    const parsedExceptions = slotExceptions.split(',').map((d) => d.trim()).filter((d) => d.length > 0);
    const payload = {
      id: editingSlot?.id,
      schoolId: user.schoolId,
      courseId: slotCourseId,
      dayOfWeek: slotDay,
      startTime: slotStart,
      endTime: slotEnd,
      room: slotRoom.trim(),
      periodStart: slotPeriodStart || null,
      periodEnd: slotPeriodEnd || null,
      exceptions: JSON.stringify(parsedExceptions),
    };
    try {
      const res = await fetch('/api/schedules', {
        method: editingSlot ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingSlot ? 'Créneau modifié' : 'Cours ajouté à l\'emploi du temps');
        setShowAddEdit(false);
        fetchSchedulesAndCoursesOfClass();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de l\'enregistrement');
      }
    } catch { toast.error('Erreur réseau'); }
    finally { setSavingSlot(false); }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Retirer ce cours de la grille ?')) return;
    try {
      const res = await fetch(`/api/schedules?id=${slotId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Cours retiré de l\'emploi du temps');
        fetchSchedulesAndCoursesOfClass();
      } else { toast.error('Erreur lors de la suppression'); }
    } catch { toast.error('Erreur réseau'); }
  };

  const handleDuplicate = async () => {
    if (!selectedClassId || !targetClassId || !user?.schoolId) return;
    setDuplicating(true);
    try {
      const res = await fetch('/api/schedules/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId, sourceClassId: selectedClassId, targetClassId }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(data.message || 'Emploi du temps dupliqué !'); setShowDuplicate(false); }
      else { toast.error(data.error || 'Erreur lors de la duplication'); }
    } catch { toast.error('Erreur réseau'); }
    finally { setDuplicating(false); }
  };

  const getSlot = (dayValue: number, start: string, end: string) => {
    return schedules.find(
      (s) =>
        s.dayOfWeek === dayValue &&
        ((s.startTime <= start && s.endTime > start) || (s.startTime >= start && s.startTime < end))
    );
  };

  // ── Sorted time slots ──────────────────────────────────────────────────────
  const sortedTimeSlots = [...timeSlots].sort((a, b) => a.start.localeCompare(b.start));

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-6 gap-3 h-80">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ── Header Banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-5 lg:p-7 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm shrink-0">
              <CalendarDays className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Emploi du Temps</h1>
              <p className="text-blue-100 text-xs">Construction libre des horaires hebdomadaires</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setShowImport(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              Importer
            </Button>
            <Button
              onClick={handleOpenShare}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs"
            >
              <Megaphone className="w-3.5 h-3.5 mr-1.5" />
              Partager
            </Button>
            <Button
              onClick={handlePublishSchedule}
              variant="outline"
              size="sm"
              disabled={publishing || schedules.length === 0}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-300/40 text-white text-xs font-semibold"
            >
              {publishing ? (
                <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Publication...</>
              ) : (
                <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Publier & Notifier</>               
              )}
            </Button>
            <Button
              onClick={handleAddTimeSlot}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              + Ajouter une heure
            </Button>
            <Button
              onClick={() => setShowDuplicate(true)}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" />
              Dupliquer
            </Button>
            <Button
              onClick={fetchSchedulesAndCoursesOfClass}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Class Selector + Time Slot Manager ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <School className="w-4 h-4 text-muted-foreground shrink-0" />
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="w-full h-10 rounded-xl bg-card">
              <SelectValue placeholder="Sélectionnez une classe..." />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenNewTimeSlot}
          className="shrink-0 text-xs gap-1.5 border-dashed"
        >
          <Clock className="w-3.5 h-3.5" />
          Gérer les plages horaires ({sortedTimeSlots.length})
        </Button>
      </div>

      {/* ── Time Slot Pills ────────────────────────────────────────────────── */}
      {sortedTimeSlots.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sortedTimeSlots.map((ts) => (
            <div
              key={ts.id}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                ts.isBreak
                  ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400'
                  : 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400'
              }`}
            >
              {ts.isBreak ? <Coffee className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              <span>{ts.start} → {ts.end}</span>
              {ts.isBreak && <span className="text-amber-500 font-semibold">Récréation</span>}
              <button
                onClick={() => handleOpenEditTimeSlot(ts)}
                className="opacity-0 group-hover:opacity-100 text-current hover:opacity-70 transition-opacity ml-0.5"
                title="Modifier"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => handleDeleteTimeSlot(ts.id)}
                className="opacity-0 group-hover:opacity-100 text-red-500 hover:opacity-70 transition-opacity"
                title="Supprimer"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
          <button
            onClick={handleAddTimeSlot}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            <Plus className="w-3 h-3" />
            Ajouter
          </button>
        </div>
      )}

      {/* ── Schedule Grid ─────────────────────────────────────────────────── */}
      <Card className="shadow-lg border-2 border-blue-50/50">
        <CardContent className="p-2 sm:p-4 overflow-x-auto">
          {loadingGrid ? (
            <div className="space-y-4 py-12">
              <div className="flex justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <p className="text-center text-sm text-muted-foreground">Mise à jour de la grille...</p>
            </div>
          ) : sortedTimeSlots.length === 0 ? (
            <div className="py-20 text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-4">
                <CalendarDays className="w-8 h-8 text-blue-500" />
              </div>
              <p className="text-base font-semibold text-foreground mb-2">Aucune plage horaire</p>
              <p className="text-sm text-muted-foreground mb-4">
                Commencez par ajouter des plages horaires pour construire votre emploi du temps.
              </p>
              <Button onClick={handleOpenNewTimeSlot} className="bg-blue-600 hover:bg-blue-700 text-white">
                <PlusCircle className="w-4 h-4 mr-2" />
                Ajouter une plage horaire
              </Button>
            </div>
          ) : (
            <div className="min-w-[700px]">
              {/* Header: Jour + Day columns */}
              <div
                className="grid border-b bg-muted/40 text-center font-semibold text-sm"
                style={{ gridTemplateColumns: `140px repeat(6, 1fr)` }}
              >
                <div className="p-3 border-r text-left text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  Jour
                </div>
                {DAYS.map((d) => (
                  <div key={d.value} className="p-3 border-r last:border-0 text-foreground">
                    <span className="hidden sm:inline">{d.label}</span>
                    <span className="sm:hidden">{d.short}</span>
                  </div>
                ))}
              </div>

              {/* Grid Rows */}
              <div className="divide-y">
                {sortedTimeSlots.map((ts) => (
                  <div
                    key={ts.id}
                    className="grid"
                    style={{ gridTemplateColumns: `140px repeat(6, 1fr)` }}
                  >
                    {/* Time column */}
                    <div
                      className={`p-2.5 border-r flex flex-col justify-center ${
                        ts.isBreak ? 'bg-amber-50/50 dark:bg-amber-950/10' : 'bg-muted/20'
                      }`}
                    >
                      {ts.isBreak ? (
                        <div className="flex items-center gap-1.5">
                          <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-500">Récréation</span>
                        </div>
                      ) : null}
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                        {ts.start} – {ts.end}
                      </span>
                      <div className="flex gap-1 mt-1.5">
                        <button
                          onClick={() => handleOpenEditTimeSlot(ts)}
                          className="text-muted-foreground hover:text-blue-600 transition-colors"
                          title="Modifier plage"
                        >
                          <Edit2 className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleToggleBreak(ts.id)}
                          className={`text-xs transition-colors ${ts.isBreak ? 'text-amber-600' : 'text-muted-foreground hover:text-amber-600'}`}
                          title={ts.isBreak ? 'Retirer récréation' : 'Marquer comme récréation'}
                        >
                          <Coffee className="w-2.5 h-2.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTimeSlot(ts.id)}
                          className="text-muted-foreground hover:text-red-600 transition-colors"
                          title="Supprimer plage"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Break: full row */}
                    {ts.isBreak ? (
                      <div className="col-span-6 bg-amber-50/30 dark:bg-amber-950/10 flex items-center justify-center text-xs font-bold tracking-widest text-amber-600 dark:text-amber-500 uppercase py-3">
                        ☕️ Récréation · {ts.start} – {ts.end}
                      </div>
                    ) : (
                      DAYS.map((day) => {
                        const cell = getSlot(day.value, ts.start, ts.end);
                        return (
                          <div
                            key={day.value}
                            className="p-1.5 border-r last:border-0 flex flex-col justify-center group relative min-h-[80px] hover:bg-blue-50/10 transition-colors"
                          >
                            {cell ? (
                              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-200 dark:border-blue-900 rounded-xl p-2 shadow-sm h-full flex flex-col justify-between">
                                <div>
                                  <p className="text-xs font-bold text-blue-800 dark:text-blue-400 line-clamp-2 leading-tight">
                                    {cell.course.name}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                                    <User className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                    <span className="truncate">{cell.course.teacher.fullName}</span>
                                  </p>
                                </div>
                                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-blue-100 dark:border-blue-900/50">
                                  {cell.room && (
                                    <Badge className="bg-blue-600 text-white hover:bg-blue-600 text-[9px] px-1 py-0 h-3.5">
                                      {cell.room}
                                    </Badge>
                                  )}
                                  <div className="flex gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleOpenEdit(cell)}
                                      className="p-0.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSlot(cell.id)}
                                      className="p-0.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenAdd(day.value, ts.start, ts.end)}
                                className="absolute inset-1 flex items-center justify-center bg-blue-600/5 hover:bg-blue-600/15 text-blue-500 transition-all rounded-lg opacity-0 group-hover:opacity-100"
                                title={`Ajouter un cours — ${day.label} ${ts.start}`}
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Dialog: Manage Time Slot ──────────────────────────────────────── */}
      <Dialog open={showTimeSlotManager} onOpenChange={setShowTimeSlotManager}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {editingTimeSlot ? 'Modifier la plage horaire' : 'Nouvelle plage horaire'}
            </DialogTitle>
            <DialogDescription>
              Définissez l'heure de début, de fin, et si c'est une récréation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Heure début</Label>
                <Input
                  type="time"
                  value={tsStart}
                  onChange={(e) => setTsStart(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Heure fin</Label>
                <Input
                  type="time"
                  value={tsEnd}
                  onChange={(e) => setTsEnd(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Récréation</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Cette plage est une pause</p>
                </div>
              </div>
              <Switch
                checked={tsIsBreak}
                onCheckedChange={setTsIsBreak}
              />
            </div>

            {tsStart && tsEnd && tsStart < tsEnd && (
              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 p-3 text-center">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                  {tsStart} → {tsEnd}
                  {tsIsBreak && ' · Récréation ☕️'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeSlotManager(false)}>Annuler</Button>
            <Button
              onClick={handleSaveTimeSlot}
              disabled={!tsStart || !tsEnd || tsStart >= tsEnd}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {editingTimeSlot ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Add/Edit Course Slot ──────────────────────────────────── */}
      <Dialog open={showAddEdit} onOpenChange={setShowAddEdit}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              {editingSlot ? 'Modifier le cours' : 'Attribuer un cours'}
            </DialogTitle>
            <DialogDescription>
              Définissez la matière, l'enseignant et la salle pour ce créneau.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jour</Label>
                <Select value={String(slotDay)} onValueChange={(v) => setSlotDay(parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Salle de classe</Label>
                <Input
                  placeholder="Ex: Salle A"
                  value={slotRoom}
                  onChange={(e) => setSlotRoom(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Heure début</Label>
                <Input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Heure fin</Label>
                <Input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <Label className="font-semibold text-blue-900 dark:text-blue-300">Cours *</Label>
              <Select value={slotCourseId} onValueChange={setSlotCourseId}>
                <SelectTrigger className="bg-background h-10 mt-1">
                  <SelectValue placeholder="Choisir un cours..." />
                </SelectTrigger>
                <SelectContent>
                  {courses.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Aucun cours disponible pour cette classe
                    </div>
                  ) : (
                    courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {resolvedTeacherName && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>Enseignant : {resolvedTeacherName}</span>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Validité & Exceptions (Optionnel)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date début</Label>
                  <Input type="date" value={slotPeriodStart} onChange={(e) => setSlotPeriodStart(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date fin</Label>
                  <Input type="date" value={slotPeriodEnd} onChange={(e) => setSlotPeriodEnd(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jours exceptés (séparés par virgule)</Label>
                <Input
                  placeholder="2026-05-01, 2026-12-25"
                  value={slotExceptions}
                  onChange={(e) => setSlotExceptions(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEdit(false)}>Annuler</Button>
            <Button
              onClick={handleSaveSlot}
              disabled={savingSlot || !slotCourseId}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {savingSlot ? 'Enregistrement...' : editingSlot ? 'Modifier' : 'Attribuer le cours'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Duplicate ─────────────────────────────────────────────── */}
      <Dialog open={showDuplicate} onOpenChange={setShowDuplicate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-blue-600" />
              Dupliquer l'emploi du temps
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="flex items-start gap-3 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-900 dark:text-blue-300 leading-relaxed font-medium">
                Cette action va copier l'intégralité de la grille horaire vers la classe cible.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Classe cible *</Label>
              <Select value={targetClassId} onValueChange={setTargetClassId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Sélectionnez la classe cible..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.filter((c) => c.id !== selectedClassId).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicate(false)}>Annuler</Button>
            <Button
              onClick={handleDuplicate}
              disabled={duplicating || !targetClassId}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {duplicating ? 'Duplication...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import ─────────────────────────────────────────────── */}
      <DocumentImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Importer l'emploi du temps"
        description="Préparez un document Word ou PDF avec un tableau (ou photographiez-le), puis importez la grille horaire : les cours manquants sont créés automatiquement si un professeur est indiqué."
                expectedColumns={['Classe', 'Cours', 'Jour', 'Heure début', 'Heure fin', 'Salle', 'Professeur']}
        sampleRows={[
          ['6ème A', 'Mathématiques', 'Lundi', '07:30', '08:20', 'Salle 1', 'Jean KABILA'],
          ['6ème A', 'Français', 'Lundi', '08:20', '09:10', 'Salle 1', 'Marie MBALA'],
          ['6ème A', 'Mathématiques', 'Mardi', '10:20', '11:10', 'Salle 1', 'Jean KABILA'],
        ]}
        columnHints={[
          { header: 'Classe', hint: 'nom exact de la classe' },
          { header: 'Cours', hint: 'nom de la matière (créé si absent, avec le professeur indiqué)' },
          { header: 'Jour', hint: 'Lundi à Samedi' },
          { header: 'Heure début', hint: 'format HH:MM' },
          { header: 'Heure fin', hint: 'format HH:MM' },
          { header: 'Salle', hint: 'facultatif' },
          { header: 'Professeur', hint: 'facultatif, requis pour créer un cours manquant' },
        ]}
        onImport={handleImportSchedules}
      />

      {/* ── Partage ────────────────────────────────────────────────── */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Megaphone className="w-5 h-5 text-amber-600" />
              Partager l'emploi du temps
            </DialogTitle>
            <DialogDescription>
              Envoyez l'emploi du temps à tout le monde ou à un destinataire précis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Destinataires</Label>
              <Select value={shareScope} onValueChange={(value) => setShareScope(value as 'ALL' | 'CLASS' | 'USER')}>
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL"><span className="flex items-center gap-2"><Users className="w-4 h-4" /> Tout le monde</span></SelectItem>
                  <SelectItem value="CLASS"><span className="flex items-center gap-2"><School className="w-4 h-4" /> Une classe</span></SelectItem>
                  <SelectItem value="USER"><span className="flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Un destinataire</span></SelectItem>
                </SelectContent>
              </Select>
            </div>

            {shareScope === 'CLASS' && (
              <div className="space-y-1.5">
                <Label>Classe</Label>
                <Select value={shareClassId} onValueChange={setShareClassId}>
                  <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Sélectionnez une classe" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {shareScope === 'USER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <Select value={shareRole} onValueChange={setShareRole}>
                    <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STUDENT">Élève</SelectItem>
                      <SelectItem value="TEACHER">Professeur</SelectItem>
                      <SelectItem value="PARENT">Parent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Destinataire</Label>
                  <Select value={shareUserId} onValueChange={setShareUserId}>
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      {shareUsers.map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.fullName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="share-message">Message (facultatif)</Label>
              <Textarea
                id="share-message"
                rows={3}
                placeholder="L'emploi du temps est à jour. Consultez-le dans votre onglet Emploi du temps."
                value={shareMessage}
                onChange={(e) => setShareMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShare(false)}>Annuler</Button>
            <Button
              onClick={handleShare}
              disabled={sharing || (shareScope === 'CLASS' && !shareClassId) || (shareScope === 'USER' && !shareUserId)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold"
            >
              {sharing ? 'Envoi...' : 'Partager'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
