'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  School,
  Users,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Save,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { AttendanceStatus } from '@/lib/types';

interface ClassSummary {
  id: string;
  name: string;
  level: string;
  courseName: string;
  courseId: string;
  studentCount: number;
}

interface StudentRecord {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  reason: string;
  existingId?: string;
}

export default function TeacherClasses() {
  const { user } = useAppStore();

  // Step 1: List classes
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Step 2: Selected class view
  const [selectedClass, setSelectedClass] = useState<ClassSummary | null>(null);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Load teacher's classes from their courses
  const fetchClasses = useCallback(async () => {
    if (!user) return;
    setLoadingClasses(true);
    try {
      const res = await fetch(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`);
      const data = await res.json();
      const courses = Array.isArray(data.courses) ? data.courses : [];

      // Deduplicate classes
      const classMap = new Map<string, ClassSummary>();
      for (const course of courses) {
        if (course.classId && !classMap.has(course.classId)) {
          classMap.set(course.classId, {
            id: course.classId,
            name: course.class?.name || 'Classe inconnue',
            level: course.class?.level || '',
            courseName: course.name,
            courseId: course.id,
            studentCount: course.class?._count?.enrollments || 0,
          });
        }
      }
      setClasses(Array.from(classMap.values()));
    } catch {
      toast.error('Erreur lors du chargement des classes');
    } finally {
      setLoadingClasses(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // Load students + today's attendance for selected class
  const openClass = useCallback(async (cls: ClassSummary) => {
    if (!user) return;
    setSelectedClass(cls);
    setLoadingStudents(true);
    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        fetch(`/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${cls.id}`),
        fetch(`/api/attendance?schoolId=${user.schoolId}&date=${today}&courseId=${cls.courseId}`),
      ]);

      const studentsData = await studentsRes.json();
      const attendanceData = await attendanceRes.json();

      const studentsList = Array.isArray(studentsData.users)
        ? studentsData.users
        : Array.isArray(studentsData)
        ? studentsData
        : [];

      const attendanceList = Array.isArray(attendanceData.attendance)
        ? attendanceData.attendance
        : Array.isArray(attendanceData)
        ? attendanceData
        : [];

      const merged: StudentRecord[] = studentsList.map((s: any) => {
        const existing = attendanceList.find((a: any) => a.studentId === s.id);
        return {
          studentId: s.id,
          studentName: s.fullName || s.name || 'Élève',
          status: existing?.status || 'present',
          reason: existing?.reason || '',
          existingId: existing?.id,
        };
      });

      setStudents(merged);
    } catch {
      toast.error('Erreur lors du chargement des élèves');
    } finally {
      setLoadingStudents(false);
    }
  }, [user, today]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, status } : s))
    );
  };

  const updateReason = (studentId: string, reason: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, reason } : s))
    );
  };

  const markAllPresent = () => {
    setStudents((prev) => prev.map((s) => ({ ...s, status: 'present', reason: '' })));
  };

  const handleSaveAttendance = async () => {
    if (!user || !selectedClass) return;
    setSaving(true);
    try {
      const records = students.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        reason: r.reason,
      }));
      const res = await fetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          courseId: selectedClass.courseId,
          teacherId: user.id,
          date: today,
          records,
        }),
      });
      if (!res.ok) {
        toast.error("Erreur lors de l'enregistrement de l'appel");
        return;
      }
      toast.success('Appel enregistré avec succès ✅');
      // Reload to reflect saved statuses
      openClass(selectedClass);
    } catch {
      toast.error("Erreur réseau lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Présent</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'late':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><Clock className="h-3 w-3 mr-1" />En retard</Badge>;
      case 'justified':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Justifié</Badge>;
    }
  };

  const stats = {
    present: students.filter((s) => s.status === 'present').length,
    absent: students.filter((s) => s.status === 'absent').length,
    late: students.filter((s) => s.status === 'late').length,
    justified: students.filter((s) => s.status === 'justified').length,
  };

  if (!user) return null;

  // ── View: Selected Class ──────────────────────────────────────────────
  if (selectedClass) {
    return (
      <div className="space-y-5 animate-fade-in pb-28">
        {/* Back + Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-500 to-teal-500 p-5 lg:p-7 text-white shadow-xl shadow-blue-500/20">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_50%,white_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="relative z-10">
            <button
              onClick={() => { setSelectedClass(null); setStudents([]); }}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm mb-3 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Retour aux classes
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
                <School className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{selectedClass.name}</h1>
                <p className="text-blue-100 text-xs">{selectedClass.level} · Cours : {selectedClass.courseName}</p>
              </div>
              <Badge className="ml-auto bg-white/20 text-white border-white/30 backdrop-blur-sm">
                {students.length} élève{students.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        {students.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Présents', count: stats.present, color: 'emerald' },
              { label: 'Absents', count: stats.absent, color: 'red' },
              { label: 'En retard', count: stats.late, color: 'amber' },
              { label: 'Justifiés', count: stats.justified, color: 'purple' },
            ].map(({ label, count, color }) => (
              <div key={label} className={`p-4 rounded-xl bg-${color}-50 dark:bg-${color}-950/20 text-center border border-${color}-100`}>
                <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
                <p className={`text-xs text-${color}-600/80 font-medium`}>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Student List */}
        {loadingStudents ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : students.length === 0 ? (
          <Card className="border-dashed border-2 border-muted/50">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <div className="w-20 h-20 rounded-full bg-muted/40 flex items-center justify-center">
                <UserCheck className="w-10 h-10 text-muted-foreground/40" />
              </div>
              <h3 className="font-semibold text-lg">Aucun élève inscrit</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Aucun élève n'est encore inscrit dans cette classe. L'administrateur doit enregistrer les élèves depuis l'interface Utilisateurs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-sm border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-500" />
                Élèves — Appel du {new Date(today).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {students.map((record) => (
                  <div
                    key={record.studentId}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors ${
                      record.status === 'absent'
                        ? 'bg-red-50/30 dark:bg-red-950/10'
                        : record.status === 'late'
                        ? 'bg-amber-50/30 dark:bg-amber-950/10'
                        : record.status === 'justified'
                        ? 'bg-purple-50/30 dark:bg-purple-950/10'
                        : 'hover:bg-muted/10'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm shrink-0 ${
                            record.status === 'present'
                              ? 'bg-emerald-500'
                              : record.status === 'absent'
                              ? 'bg-red-500'
                              : record.status === 'justified'
                              ? 'bg-purple-500'
                              : 'bg-amber-500'
                          }`}
                        >
                          {record.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{record.studentName}</p>
                          <div className="mt-0.5">{getStatusBadge(record.status)}</div>
                        </div>
                      </div>
                      {record.status !== 'present' && (
                        <Input
                          placeholder="Raison (optionnel)..."
                          className="mt-2 h-8 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all rounded-lg bg-background"
                          value={record.reason}
                          onChange={(e) => updateReason(record.studentId, e.target.value)}
                        />
                      )}
                    </div>

                    {/* Status buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button
                        type="button"
                        size="icon"
                        variant={record.status === 'present' ? 'default' : 'outline'}
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'present'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                        onClick={() => updateStatus(record.studentId, 'present')}
                        title="Présent"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={record.status === 'absent' ? 'default' : 'outline'}
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'absent'
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/25'
                            : 'border-red-200 text-red-700 hover:bg-red-50'
                        }`}
                        onClick={() => updateStatus(record.studentId, 'absent')}
                        title="Absent"
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={record.status === 'late' ? 'default' : 'outline'}
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'late'
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25'
                            : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        }`}
                        onClick={() => updateStatus(record.studentId, 'late')}
                        title="En retard"
                      >
                        <Clock className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant={record.status === 'justified' ? 'default' : 'outline'}
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'justified'
                            ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/25'
                            : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                        }`}
                        onClick={() => updateStatus(record.studentId, 'justified')}
                        title="Justifié"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sticky Save Footer */}
        {students.length > 0 && (
          <div className="fixed bottom-16 lg:bottom-4 left-0 lg:left-auto right-0 lg:right-4 z-30 p-4 lg:p-0 bg-background/95 backdrop-blur-md lg:bg-transparent border-t lg:border-none flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={markAllPresent}
              className="flex-1 lg:flex-none border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-12 lg:h-10 rounded-xl font-medium"
            >
              Tous présents
            </Button>
            <Button
              className="flex-1 lg:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 lg:h-10 rounded-xl text-white font-bold shadow-lg"
              onClick={handleSaveAttendance}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-1.5 inline-block" />
              {saving ? 'Enregistrement...' : 'Enregistrer l\'appel'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── View: Class List ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-500 to-teal-500 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_50%,white_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <School className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes Classes</h1>
            <p className="text-blue-100 text-sm">Gérez la présence et consultez vos élèves par classe</p>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      {loadingClasses ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : classes.length === 0 ? (
        <Card className="border-dashed border-2 border-muted/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <div className="w-24 h-24 rounded-full bg-muted/40 flex items-center justify-center">
              <AlertTriangle className="w-12 w-12 text-muted-foreground/40" />
            </div>
            <h3 className="font-semibold text-xl">Aucune classe assignée</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Vous n'avez aucun cours assigné pour le moment. Veuillez contacter l'administrateur pour que des cours vous soient attribués.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card
              key={cls.id}
              className="group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-l-4 border-l-indigo-500 hover:border-l-indigo-600 cursor-pointer"
              onClick={() => openClass(cls)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-blue-200 text-indigo-600 shadow-sm">
                    <School className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                    {cls.level}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-3">{cls.name}</CardTitle>
                <CardDescription>{cls.courseName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{cls.studentCount} élève{cls.studentCount !== 1 ? 's' : ''}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-indigo-600 hover:bg-indigo-50 group-hover:translate-x-0.5 transition-transform"
                    onClick={(e) => { e.stopPropagation(); openClass(cls); }}
                  >
                    Voir <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
