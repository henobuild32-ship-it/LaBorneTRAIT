'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BookOpen,
  Users,
  FileText,
  BarChart3,
  Eye,
  Plus,
  Trash2,
  Clock,
  Video,
  FileDown,
  ExternalLink,
  Loader2,
  Upload,
  Library,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CourseInfo, UserInfo, GradeInfo } from '@/lib/types';
import { publishToLibrary, lessonResourceType } from '@/lib/publishToLibrary';

interface LessonInfo {
  id: string;
  title: string;
  content: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
}

export default function TeacherCourses() {
  const { user } = useAppStore();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected course details
  const [selectedCourse, setSelectedCourse] = useState<CourseInfo | null>(null);
  const [students, setStudents] = useState<UserInfo[]>([]);
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Lesson form state
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonType, setLessonType] = useState<'text' | 'pdf' | 'video' | 'link'>('text');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [lessonUrl, setLessonUrl] = useState(''); // for external link or video embed
  const [publishing, setPublishing] = useState(false);
  const [addToLibrary, setAddToLibrary] = useState(true);

  // Preview PDF state
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`);
      const data = await res.json();
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch {
      toast.error('Erreur lors du chargement des cours');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openCourseDetail = async (course: CourseInfo) => {
    setSelectedCourse(course);
    setDetailLoading(true);
    try {
      const [studentsRes, gradesRes, schedRes, lessonsRes] = await Promise.all([
        fetch(`/api/users?schoolId=${user?.schoolId}&role=STUDENT&classId=${course.classId}`),
        fetch(`/api/grades?schoolId=${user?.schoolId}&courseId=${course.id}`),
        fetch(`/api/schedules?schoolId=${user?.schoolId}&courseId=${course.id}`),
        fetch(`/api/lessons?schoolId=${user?.schoolId}&courseId=${course.id}`),
      ]);
      
      const studentsData = await studentsRes.json();
      const gradesData = await gradesRes.json();
      const schedData = await schedRes.json();
      const lessonsData = await lessonsRes.json();

      setStudents(Array.isArray(studentsData.users) ? studentsData.users : Array.isArray(studentsData) ? studentsData : []);
      setGrades(Array.isArray(gradesData.grades) ? gradesData.grades : Array.isArray(gradesData) ? gradesData : []);
      setSchedules(Array.isArray(schedData) ? schedData : []);
      setLessons(Array.isArray(lessonsData.lessons) ? lessonsData.lessons : []);
    } catch {
      toast.error('Erreur lors du chargement des détails');
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePublishLesson = async () => {
    if (!selectedCourse || !user) return;
    if (!lessonTitle.trim()) {
      toast.error('Titre requis');
      return;
    }

    setPublishing(true);
    let finalFileUrl = '';
    let finalFileName = '';

    try {
      // 1. Handle file upload if PDF selected
      if (lessonType === 'pdf' && lessonFile) {
        const formData = new FormData();
        formData.append('file', lessonFile);
        
        const uploadRes = await fetch('/api/resources/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Erreur lors du téléversement du fichier');
        }
        
        const uploadData = await uploadRes.json();
        finalFileUrl = uploadData.url;
        finalFileName = lessonFile.name;
      } else if (lessonType === 'link' || lessonType === 'video') {
        finalFileUrl = lessonUrl.trim();
        finalFileName = lessonType === 'link' ? 'Lien externe' : 'Vidéo intégrée';
      }

      // 2. Create the lesson entry
      const payload = {
        schoolId: user.schoolId,
        courseId: selectedCourse.id,
        teacherId: user.id,
        title: lessonTitle.trim(),
        content: lessonContent.trim(),
        fileUrl: finalFileUrl,
        fileName: finalFileName,
      };

      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success('Ressource pédagogique publiée avec succès !');

        // Also publish to the digital library (optional)
        if (addToLibrary) {
          const libResult = await publishToLibrary({
            schoolId: user.schoolId,
            createdById: user.id,
            title: lessonTitle.trim(),
            description: lessonContent.trim() || `Leçon du cours ${selectedCourse.name}`,
            matiere: selectedCourse.name,
            niveau: selectedCourse.class?.level || '',
            author: user.fullName,
            url: lessonType === 'link' || lessonType === 'video' ? finalFileUrl : '',
            fileUrl: lessonType === 'pdf' ? finalFileUrl : '',
            type: lessonResourceType(finalFileUrl, finalFileName),
            category: 'Cours',
            targetClassId: selectedCourse.classId,
          });
          if (!libResult.ok) toast.warning(`La leçon est publiée mais la bibliothèque : ${libResult.error || 'échoué'}`);
        }

        setLessonTitle('');
        setLessonContent('');
        setLessonFile(null);
        setLessonUrl('');
        setShowAddLesson(false);
        
        // Refresh lessons
        const reloadRes = await fetch(`/api/lessons?schoolId=${user.schoolId}&courseId=${selectedCourse.id}`);
        if (reloadRes.ok) {
          const lData = await reloadRes.json();
          setLessons(Array.isArray(lData.lessons) ? lData.lessons : []);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la publication');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erreur de publication');
    } finally {
      setPublishing(false);
    }
  };

  // Publish an existing lesson to the digital library
  const publishExistingLesson = async (lesson: LessonInfo) => {
    if (!selectedCourse || !user) return;
    try {
      const libResult = await publishToLibrary({
        schoolId: user.schoolId,
        createdById: user.id,
        title: lesson.title,
        description: lesson.content || `Leçon du cours ${selectedCourse.name}`,
        matiere: selectedCourse.name,
        niveau: selectedCourse.class?.level || '',
        author: user.fullName,
        url: /^https?:\/\//.test(lesson.fileUrl || '') && !lesson.fileUrl?.endsWith('.pdf') ? lesson.fileUrl : '',
        fileUrl: lesson.fileUrl?.endsWith('.pdf') ? lesson.fileUrl : '',
        type: lessonResourceType(lesson.fileUrl || '', lesson.fileName || ''),
        category: 'Cours',
        targetClassId: selectedCourse.classId,
      });
      if (libResult.ok) toast.success('Leçon ajoutée à la bibliothèque numérique.');
      else toast.error(libResult.error || 'Échec de l\'ajout à la bibliothèque.');
    } catch {
      toast.error('Erreur lors de l\'ajout à la bibliothèque.');
    }
  };

  const getAverageForStudent = (studentId: string) => {    const studentGrades = grades.filter((g) => g.studentId === studentId);
    if (studentGrades.length === 0) return null;
    const total = studentGrades.reduce((sum, g) => {
      return sum + (g.score / g.maxScore) * 20;
    }, 0);
    return (total / studentGrades.length).toFixed(1);
  };

  const getClassAverage = () => {
    if (grades.length === 0) return null;
    const total = grades.reduce((sum, g) => {
      return sum + (g.score / g.maxScore) * 20;
    }, 0);
    return (total / grades.length).toFixed(1);
  };

  const getDayName = (dayNum: number) => {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
    return days[dayNum - 1] || "Jour inconnu";
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <BookOpen className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes Cours</h1>
            <p className="text-blue-100 text-sm">Gérez et consultez vos cours assignés en temps réel</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucun cours assigné</h3>
          <p className="text-muted-foreground">Veuillez contacter l&apos;administrateur pour l&apos;attribution de cours</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 border-l-4 border-l-blue-500 hover:border-l-blue-600"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 shadow-sm">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700">{course.class?.name}</Badge>
                    <Badge className={course.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-red-100 text-red-700 border-0'}>
                      {course.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg mt-3">{course.name}</CardTitle>
                {course.description && (
                  <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{course.class?._count?.enrollments || 0} élèves</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4" />
                    <span>{course._count?.lessons || 0} leçons</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => openCourseDetail(course)}
                >
                  <Eye className="h-4 w-4" />
                  Gérer le cours
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Course Detail Dialog (with Tabs) */}
      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="text-xl flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                {selectedCourse?.name}
              </span>
              <Badge className="bg-blue-100 text-blue-700">{selectedCourse?.class?.name}</Badge>
            </DialogTitle>
            <DialogDescription>
              {selectedCourse?.description || 'Aucune description'}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="lessons" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 shrink-0">
              <TabsTrigger value="lessons">Cours & Ressources</TabsTrigger>
              <TabsTrigger value="students">Élèves & Notes</TabsTrigger>
              <TabsTrigger value="schedule">Horaires</TabsTrigger>
            </TabsList>

            {/* TAB 1: Lessons & Resources */}
            <TabsContent value="lessons" className="flex-1 overflow-hidden flex flex-col space-y-4 pt-2">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm">Contenus Pédagogiques</h3>
                <Button
                  size="sm"
                  onClick={() => setShowAddLesson(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Publier
                </Button>
              </div>

              {detailLoading ? (
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : lessons.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl flex-1 flex flex-col justify-center items-center">
                  <FileText className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Aucun contenu pédagogique disponible</p>
                  <p className="text-xs text-muted-foreground mt-1">Publiez votre première leçon ou fichier PDF</p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2.5">
                    {lessons.map((lesson) => {
                      const isPDF = lesson.fileUrl?.endsWith('.pdf');
                      const isVideo = lesson.fileName === 'Vidéo intégrée' || lesson.fileUrl?.includes('youtube') || lesson.fileUrl?.includes('vimeo');
                      const isLink = lesson.fileName === 'Lien externe' && !isVideo;

                      return (
                        <div
                          key={lesson.id}
                          className="p-4 rounded-xl border bg-card hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-1.5 min-w-0">
                            <h4 className="font-bold text-sm text-foreground truncate">{lesson.title}</h4>
                            {lesson.content && (
                              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">{lesson.content}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-semibold">
                                {isPDF ? '📄 PDF' : isVideo ? '🎥 Vidéo' : isLink ? '🔗 Lien' : '📝 Leçon'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                Publié le {new Date(lesson.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishExistingLesson(lesson)}
                              className="h-8 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              title="Ajouter à la bibliothèque numérique"
                            >
                              <Library className="w-3.5 h-3.5 mr-1" />
                              Bibliothèque
                            </Button>
                            {isPDF && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewPdfUrl(lesson.fileUrl)}
                                className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                Prévisualiser
                              </Button>
                            )}
                            {lesson.fileUrl && (
                              <a
                                href={lesson.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline px-3 py-1.5 rounded-lg hover:bg-blue-50"
                              >
                                {isLink ? 'Ouvrir' : 'Télécharger'}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* TAB 2: Students & Grades */}
            <TabsContent value="students" className="flex-1 overflow-hidden flex flex-col space-y-4 pt-2">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="font-semibold text-sm">Élèves inscrits</h3>
                <Badge className="bg-indigo-100 text-indigo-700">Moyenne classe : {getClassAverage() || '—'}/20</Badge>
              </div>

              {detailLoading ? (
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun élève dans cette classe</p>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-1.5">
                    {students.map((student) => {
                      const avg = getAverageForStudent(student.id);
                      return (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-accent/20 hover:bg-accent/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-blue-100 text-xs font-bold shadow-sm">
                              {student.fullName.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium">{student.fullName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {avg !== null ? (
                              <Badge
                                className={
                                  parseFloat(avg) >= 10
                                    ? 'bg-emerald-100 text-emerald-700 border-0'
                                    : parseFloat(avg) >= 7
                                    ? 'bg-amber-100 text-amber-700 border-0'
                                    : 'bg-red-100 text-red-700 border-0'
                                }
                              >
                                {avg}/20
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Pas de note</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* TAB 3: Course Schedule */}
            <TabsContent value="schedule" className="flex-1 overflow-hidden flex flex-col space-y-4 pt-2">
              <h3 className="font-semibold text-sm shrink-0">Horaires programmés</h3>

              {detailLoading ? (
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground flex-1 flex flex-col justify-center items-center">
                  <Clock className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Aucun horaire planifié pour le moment</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Veuillez contacter l&apos;administrateur pour ajouter des créneaux
                  </p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {schedules.map((sched) => (
                      <div
                        key={sched.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200">
                            {getDayName(sched.dayOfWeek)}
                          </Badge>
                          <span className="text-sm font-semibold flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            {sched.startTime} – {sched.endTime}
                          </span>
                        </div>
                        {sched.room && (
                          <Badge className="bg-muted text-muted-foreground border-0">
                            Salle : {sched.room}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Publish Lesson/Resource Dialog */}
      <Dialog open={showAddLesson} onOpenChange={setShowAddLesson}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-blue-600" />
              Publier un contenu pédagogique
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label>Type de ressource *</Label>
              <Select value={lessonType} onValueChange={(v: any) => setLessonType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Leçon textuelle</SelectItem>
                  <SelectItem value="pdf">Document PDF</SelectItem>
                  <SelectItem value="video">Vidéo intégrée</SelectItem>
                  <SelectItem value="link">Lien externe (Web)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Titre *</Label>
              <Input
                placeholder="Ex: Chapitre 1: Introduction"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description / Contenu textuel</Label>
              <Textarea
                placeholder="Écrivez le contenu ou une courte description ici..."
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                className="h-20 text-sm resize-none"
              />
            </div>

            {/* Conditional inputs */}
            {lessonType === 'pdf' && (
              <div className="space-y-1.5 p-3.5 rounded-xl border-2 border-dashed flex flex-col items-center justify-center hover:bg-muted/10 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <Label htmlFor="pdf-file-upload" className="cursor-pointer text-xs font-semibold text-blue-600 hover:underline">
                  {lessonFile ? lessonFile.name : 'Choisir un document PDF (max 20Mo)'}
                </Label>
                <input
                  id="pdf-file-upload"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>
            )}

            {(lessonType === 'link' || lessonType === 'video') && (
              <div className="space-y-1.5">
                <Label>{lessonType === 'video' ? 'Lien de la vidéo (YouTube/Vimeo)' : 'Adresse URL du lien'}</Label>
                <Input
                  placeholder="https://..."
                  value={lessonUrl}
                  onChange={(e) => setLessonUrl(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-blue-100 bg-blue-50/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addToLibrary}
                onChange={(e) => setAddToLibrary(e.target.checked)}
                className="w-4 h-4 accent-blue-600"
              />
              <div>
                <span className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                  <Library className="w-4 h-4" />
                  Publier aussi dans la bibliothèque numérique
                </span>
                <span className="text-xs text-blue-600/70">
                  Les élèves pourront retrouver ce contenu dans la Bibliothèque.
                </span>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLesson(false)}>
              Annuler
            </Button>
            <Button
              onClick={handlePublishLesson}
              disabled={
                publishing ||
                !lessonTitle.trim() ||
                (lessonType === 'pdf' && !lessonFile) ||
                ((lessonType === 'link' || lessonType === 'video') && !lessonUrl.trim())
              }
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publication...
                </>
              ) : (
                'Publier maintenant'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Integrated Preview Dialog (Responsive IFrame) */}
      <Dialog open={!!previewPdfUrl} onOpenChange={(open) => !open && setPreviewPdfUrl(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] overflow-hidden flex flex-col p-4 bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader className="pb-2 border-b border-zinc-800">
            <DialogTitle className="text-lg text-white">Visualiseur de Document PDF</DialogTitle>
          </DialogHeader>

          <div className="flex-1 bg-white rounded-lg overflow-hidden relative mt-2">
            {previewPdfUrl ? (
              <iframe
                src={previewPdfUrl}
                title="Prévisualisation du cours PDF"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
                Chargement du document...
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-800">
            <Button variant="outline" onClick={() => setPreviewPdfUrl(null)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Fermer la prévisualisation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
