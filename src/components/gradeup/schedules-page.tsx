'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import WeeklyScheduleView from './weekly-schedule-view';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, School } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  level: string;
}

export default function SchedulesPage() {
  const user = useAppStore((state) => state.user);

  // For STUDENT: use classEnrollments (existing behavior)
  // For TEACHER: dynamically fetch classes from teacher's courses
  const [teacherClasses, setTeacherClasses] = useState<ClassItem[]>([]);
  const [loadingTeacherClasses, setLoadingTeacherClasses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const fetchTeacherClasses = useCallback(async () => {
    if (!user || user.role !== 'TEACHER') return;
    setLoadingTeacherClasses(true);
    try {
      const res = await fetch(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`);
      if (!res.ok) return;
      const data = await res.json();
      const courses = Array.isArray(data.courses) ? data.courses : [];
      // Deduplicate by classId
      const classMap = new Map<string, ClassItem>();
      for (const c of courses) {
        if (c.classId && !classMap.has(c.classId)) {
          classMap.set(c.classId, {
            id: c.classId,
            name: c.class?.name || 'Classe inconnue',
            level: c.class?.level || '',
          });
        }
      }
      const list = Array.from(classMap.values());
      setTeacherClasses(list);
      if (list.length > 0 && !selectedClassId) {
        setSelectedClassId(list[0].id);
      }
    } catch {
      // silent
    } finally {
      setLoadingTeacherClasses(false);
    }
  }, [user, selectedClassId]);

  useEffect(() => {
    fetchTeacherClasses();
  }, [fetchTeacherClasses]);

  if (!user) return null;

  // ── TEACHER view ──────────────────────────────────────────────────────
  if (user.role === 'TEACHER') {
    const activeClass = teacherClasses.find((c) => c.id === selectedClassId);

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Emploi du temps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Consultez les horaires de cours publiés par l'administration pour vos classes.
            </p>
          </div>
          {teacherClasses.length > 1 && (
            <div className="w-full max-w-xs">
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-11 gap-2">
                  <School className="w-4 h-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} — {cls.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {loadingTeacherClasses ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : teacherClasses.length === 0 ? (
          <Card className="border-dashed border-2 border-muted/50">
            <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <div>
                <h2 className="text-lg font-semibold">Aucun cours assigné</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Vous n'avez aucun cours assigné. Contactez l'administrateur pour que vos cours et
                  l'emploi du temps soient configurés.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : activeClass ? (
          <WeeklyScheduleView
            schoolId={user.schoolId}
            classId={activeClass.id}
            classNameLabel={activeClass.name}
          />
        ) : null}
      </div>
    );
  }

  // ── STUDENT / other roles: use classEnrollments (original behavior) ───
  const classes = user.classEnrollments?.map((e) => e.class) || [];
  const activeClassId = selectedClassId || classes[0]?.id || '';
  const selectedClass = classes.find((cls) => cls.id === activeClassId);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Emploi du temps</h1>
          <p className="text-sm text-muted-foreground">
            Consultez les horaires de cours publiés pour votre classe.
          </p>
        </div>
        {classes.length > 1 && (
          <div className="w-full max-w-sm">
            <Select value={activeClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choisir une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <Card className="border-dashed border-2 border-muted/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <AlertTriangle className="w-10 h-10 text-blue-500" />
            <div>
              <h2 className="text-lg font-semibold">Aucune classe assignée</h2>
              <p className="text-sm text-muted-foreground">
                Aucun emploi du temps n&apos;a encore été attribué à votre profil. Contactez votre
                administrateur pour que vos cours et votre classe soient bien configurés.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : selectedClass ? (
        <WeeklyScheduleView
          schoolId={user.schoolId}
          classId={selectedClass.id}
          classNameLabel={selectedClass.name}
        />
      ) : null}
    </div>
  );
}
