'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { CourseInfo, LessonInfo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BookOpen, User, Clock, FileText, ChevronDown, ChevronUp, Download, Filter } from 'lucide-react';

export default function StudentLessons() {
  const user = useAppStore((s) => s.user);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const classId = user?.classEnrollments?.[0]?.classId;

  useEffect(() => {
    // Pas de classe attribuée (ou session incomplète) : on n'affiche pas
    // des squelettes indéfiniment, on montre l'état vide explicite.
    if (!user?.schoolId || !classId) {
      setCourses([]);
      setLoading(false);
      return;
    }
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/courses?schoolId=${user.schoolId}&classId=${classId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCourses(Array.isArray(data.courses) ? data.courses : []);
      } catch { setCourses([]); } finally { setLoading(false); }
    };
    fetchCourses();
  }, [user?.schoolId, classId]);

  useEffect(() => {
    if (!user?.schoolId) return;
    const fetchLessons = async () => {
      setLoadingLessons(true);
      try {
        const params = new URLSearchParams({ schoolId: user.schoolId });
        if (selectedCourseId !== 'all') { params.set('courseId', selectedCourseId); }
        const res = await fetch(`/api/lessons?${params}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const sorted = (Array.isArray(data.lessons) ? data.lessons : []).sort((a: LessonInfo, b: LessonInfo) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setLessons(sorted);
      } catch { setLessons([]); } finally { setLoadingLessons(false); }
    };
    fetchLessons();
  }, [user?.schoolId, selectedCourseId]);

  const toggleExpand = (id: string) => { setExpandedId(expandedId === id ? null : id); };
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" />
        <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mes leçons</h1>
            <p className="text-sm text-muted-foreground mt-1">{lessons.length} leçon(s) disponible(s)</p>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-52 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"><SelectValue placeholder="Tous les cours" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les cours</SelectItem>
                {courses.map((course) => <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loadingLessons ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4"><BookOpen className="h-12 w-12 text-muted-foreground/50" /></div>
          <h3 className="text-xl font-semibold mb-2">Aucune leçon disponible</h3>
          <p className="text-muted-foreground">
            {!classId
              ? 'Votre école n\u2019a pas encore inscrit votre classe. Contactez l\u2019administration pour être affecté à une classe.'
              : selectedCourseId !== 'all'
                ? 'Aucune leçon pour ce cours.'
                : 'Vos enseignants n\u2019ont pas encore publié de leçons.'}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[600px]">
          <div className="space-y-4">
            {lessons.map((lesson) => {
              const isExpanded = expandedId === lesson.id;
              return (
                <Card key={lesson.id} className="overflow-hidden hover:shadow-md transition-all border hover:border-blue-200">
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className="flex flex-col items-center py-4 px-4 border-r bg-blue-50/50">
                        <div className="h-3 w-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                        <div className="flex-1 w-px bg-blue-200/50 mt-1" />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs shrink-0 bg-blue-50 text-blue-700">{lesson.course?.name || 'Cours'}</Badge>
                            </div>
                            <h3 className="font-semibold text-base">{lesson.title}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1"><User className="h-3.5 w-3.5" /><span>{lesson.teacher?.fullName || '—'}</span></div>
                              <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{formatDate(lesson.createdAt)}</span></div>
                            </div>
                          </div>
                        </div>
                        {lesson.fileUrl && (
                          <div className="mt-3">
                            <a
                              href={lesson.fileUrl}
                              download={lesson.fileName || true}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              <Download className="h-4 w-4" />{lesson.fileName || 'Télécharger le fichier'}
                            </a>
                          </div>
                        )}
                        <div className="mt-3">
                          <Button variant="ghost" size="sm" onClick={() => toggleExpand(lesson.id)} className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-all">
                            {isExpanded ? (<><ChevronUp className="h-4 w-4 mr-1" />Masquer la leçon</>) : (<><ChevronDown className="h-4 w-4 mr-1" />Lire la leçon</>)}
                          </Button>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 p-4 rounded-lg bg-muted/50 border border-muted/50 text-sm whitespace-pre-wrap leading-relaxed">
                            {lesson.content || 'Aucun contenu disponible.'}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
