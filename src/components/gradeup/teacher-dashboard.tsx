'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, Users, FileText, Plus, GraduationCap, Clock, Lightbulb, RefreshCw, CalendarDays, AlertTriangle } from 'lucide-react';
import type { CourseInfo, LessonInfo, UserInfo } from '@/lib/types';
import { toast } from 'sonner';
import PresenceWidget from './presence-widget';
import WeeklyScheduleView from './weekly-schedule-view';
import SectionPanel from './section-panel';

export default function TeacherDashboard() {
  const { user } = useAppStore();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalStudents, setTotalStudents] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (!user) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);
    try {
      const [coursesRes, lessonsRes] = await Promise.all([
        fetch(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`),
        fetch(`/api/lessons?schoolId=${user.schoolId}&teacherId=${user.id}`),
      ]);
      const coursesData = await coursesRes.json();
      const lessonsData = await lessonsRes.json();

      setCourses(Array.isArray(coursesData.courses) ? coursesData.courses : []);
      setLessons(Array.isArray(lessonsData.lessons) ? lessonsData.lessons : []);

      // Count unique students across all courses
      const classIds = [...new Set((Array.isArray(coursesData.courses) ? coursesData.courses : []).map((c: CourseInfo) => c.classId))];
      let total = 0;
      for (const classId of classIds) {
        const studentsRes = await fetch(`/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${classId}`);
        if (!studentsRes.ok) continue;
        const studentsData = await studentsRes.json();
        total += (Array.isArray(studentsData.users) ? studentsData.users.length : 0);
      }
      setTotalStudents(total);
    } catch {
      if (isManual) toast.error('Impossible d\'actualiser le tableau de bord.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
    // Actualisation automatique toutes les 60 secondes
    intervalRef.current = setInterval(() => fetchData(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchData]);

  const today = new Date().toISOString().split('T')[0];
  const todayLessons = Array.isArray(lessons) ? lessons.filter((l) => l.createdAt?.startsWith(today)) : [];
  const recentLessons = Array.isArray(lessons) ? [...lessons]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5) : [];

  const todayStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-8 w-8 animate-pulse-soft" />
            <h1 className="text-2xl lg:text-3xl font-bold">
              Bonjour, {user.fullName} 👋
            </h1>
            <button
              onClick={() => fetchData(true)}
              title="Actualiser"
              className="ml-auto p-2 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-blue-100 text-sm lg:text-base max-w-xl">
            Bienvenue sur votre tableau de bord — {todayStr}
          </p>
        </div>
        <div className="absolute top-4 right-6 hidden lg:block">
          <BookOpen className="h-24 w-24 text-white/10" />
        </div>
      </div>

      {/* Section repliable : Ma journée */}
      <SectionPanel
        title="Ma journée"
        description="Présence, alertes et indicateurs du jour"
        icon={<Clock className="h-4 w-4" />}
      >
      {/* Pointage de présence */}
      <PresenceWidget compact />

      {/* No courses warning */}
      {!loading && courses.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Aucun cours assigné</p>
            <p className="text-sm text-amber-700 mt-1">
              Veuillez contacter l&apos;administrateur pour qu&apos;il vous attribue des cours. Vous ne pourrez pas publier de leçons ou de devoirs tant que des cours ne vous sont pas assignés.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-blue-500 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 shrink-0">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Mes cours</p>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-8 inline-block" /> : courses.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Mes élèves</p>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-8 inline-block" /> : totalStudents}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Leçons aujourd&apos;hui</p>
              <div className="flex items-end gap-2">
                <div className="text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-8 inline-block" /> : todayLessons.length}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </SectionPanel>

      {/* Section repliable : Emploi du temps */}
      <SectionPanel
        title="Emploi du temps"
        description="Vos cours planifiés pour la semaine"
        icon={<CalendarDays className="h-4 w-4" />}
      >
      {/* Schedule View */}
      {courses.length > 0 && (
        <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50">
                <CalendarDays className="h-4 w-4 text-indigo-500" />
              </div>
              Mon Emploi du Temps
            </CardTitle>
            <CardDescription>Vos cours planifiés pour la semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <WeeklyScheduleView
              schoolId={user.schoolId}
              classId={courses[0]?.classId}
              classNameLabel={courses[0]?.class?.name || 'Ma classe'}
            />
          </CardContent>
        </Card>
      )}

      </SectionPanel>

      {/* Section repliable : Leçons & actions */}
      <SectionPanel
        title="Leçons du jour & actions"
        description="Timeline, activité récente et raccourcis"
        icon={<FileText className="h-4 w-4" />}
      >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leçons du jour - Timeline */}
        <Card className="lg:col-span-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Clock className="h-4 w-4 text-blue-500" />
              </div>
              Leçons du jour
            </CardTitle>
            <CardDescription>Vos leçons programmées pour aujourd&apos;hui</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : todayLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="p-4 rounded-full bg-blue-50">
                  <BookOpen className="h-10 w-10 text-blue-300" />
                </div>
                <p className="text-sm text-muted-foreground">Aucune leçon publiée aujourd&apos;hui</p>
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/20 hover:scale-[1.02] transition-all duration-300"
                  onClick={() => useAppStore.getState().setCurrentPage('teacher-lessons')}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Publier une leçon
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                <div className="relative pl-6 space-y-4">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-300 via-blue-200 to-transparent" />

                  {todayLessons.map((lesson, index) => (
                    <div key={lesson.id} className="relative animate-slide-in-left" style={{ animationDelay: `${index * 80}ms` }}>
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-3 w-[18px] h-[18px] rounded-full bg-blue-500 border-2 border-white shadow-md flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                      {/* Time label */}
                      <span className="text-[10px] font-semibold text-muted-foreground mb-1 block">
                        {new Date(lesson.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {/* Card */}
                      <div className="p-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/50 to-white hover:from-blue-50 hover:to-white hover:shadow-md transition-all duration-300">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {lesson.course?.name}
                            </p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 shrink-0 text-xs">
                            Aujourd&apos;hui
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Activity with colored left borders */}
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-purple-50">
                  <Clock className="h-4 w-4 text-purple-500" />
                </div>
                Activité récente
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentLessons.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucune activité récente</p>
                </div>
              ) : (
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {recentLessons.map((lesson) => (
                      <div
                        key={lesson.id}
                        className="flex items-start gap-3 p-3 rounded-lg border-l-3 border-l-blue-400 bg-accent/20 hover:bg-accent/40 transition-all duration-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{lesson.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{lesson.course?.name}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(lesson.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="p-1.5 rounded-lg bg-blue-50">
                  <Plus className="h-4 w-4 text-blue-500" />
                </div>
                Actions rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Button
                className="w-full justify-start gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/15 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.01] transition-all duration-300"
                onClick={() => useAppStore.getState().setCurrentPage('teacher-lessons')}
              >
                <Plus className="h-4 w-4" />
                Publier une leçon
              </Button>
              <Button
                className="w-full justify-start gap-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-md shadow-blue-500/15 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.01] transition-all duration-300"
                onClick={() => useAppStore.getState().setCurrentPage('teacher-grades')}
              >
                <GraduationCap className="h-4 w-4" />
                Ajouter des notes
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-blue-200 text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-300 hover:scale-[1.01] transition-all duration-300"
                onClick={() => useAppStore.getState().setCurrentPage('teacher-homework')}
              >
                <BookOpen className="h-4 w-4" />
                Créer un devoir
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-blue-200 text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-300 hover:scale-[1.01] transition-all duration-300"
                onClick={() => useAppStore.getState().setCurrentPage('teacher-attendance')}
              >
                <Users className="h-4 w-4" />
                Appel du jour
              </Button>
            </CardContent>
          </Card>

          {/* Tip section */}
          <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-4 transition-all duration-300 hover:shadow-md">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                <Lightbulb className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Conseil du jour</p>
                <p className="text-xs text-blue-700/70 mt-1 leading-relaxed">
                  N&apos;hésitez pas à varier vos méthodes d&apos;enseignement pour maintenir l&apos;attention de vos élèves.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </SectionPanel>
    </div>
  );
}
