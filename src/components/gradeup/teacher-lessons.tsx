'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, FileText, Trash2, AlertTriangle, Upload, BookOpen, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { CourseInfo, LessonInfo } from '@/lib/types';

export default function TeacherLessons() {
  const { user } = useAppStore();
  const [lessons, setLessons] = useState<LessonInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formCourseId, setFormCourseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formFileName, setFormFileName] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const formFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [lessonsRes, coursesRes] = await Promise.all([
        fetch(`/api/lessons?schoolId=${user.schoolId}&teacherId=${user.id}`),
        fetch(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`),
      ]);
      const lessonsData = await lessonsRes.json();
      const coursesData = await coursesRes.json();
      setLessons(Array.isArray(lessonsData) ? lessonsData : (Array.isArray(lessonsData.lessons) ? lessonsData.lessons : []));
      setCourses(Array.isArray(coursesData.courses) ? coursesData.courses : []);

    } catch {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayLessons = Array.isArray(lessons) ? lessons.filter((l) => l.createdAt?.startsWith(today)) : [];

  const resetForm = () => {
    setFormCourseId('');
    setFormTitle('');
    setFormContent('');
    setFormFileName('');
    setFormFileUrl('');
    formFileRef.current = null;
  };

  const handleCreate = async () => {
    if (!user || !formCourseId || !formTitle.trim()) {
      toast.error('Veuillez remplir le titre et sélectionner un cours');
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = formFileUrl;
      if (formFileRef.current) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', formFileRef.current);
        const uploadRes = await fetch('/api/resources/upload', { method: 'POST', body: uploadFormData });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileUrl = uploadData.url;
        } else {
          toast.error('Erreur lors de l\'upload du fichier');
          setSubmitting(false);
          return;
        }
      }

      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: user.schoolId,
          courseId: formCourseId,
          teacherId: user.id,
          title: formTitle.trim(),
          content: formContent.trim(),
          fileUrl,
          fileName: formFileName.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Erreur lors de la création');
        return;
      }

      toast.success('Leçon publiée avec succès');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch {
      toast.error('Erreur lors de la création');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/lessons/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Erreur lors de la suppression');
        return;
      }
      toast.success('Leçon supprimée');
      fetchData();
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const sortedLessons = Array.isArray(lessons) ? [...lessons].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ) : [];

  const getCourseName = (courseId: string) => {
    return courses.find((c) => c.id === courseId)?.name || 'Cours inconnu';
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Mes Leçons</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Publiez et gérez vos leçons quotidiennes
            </p>
          </div>
          <Button
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform gap-2"
            onClick={() => setDialogOpen(true)}
            disabled={courses.length === 0}
          >
            <Plus className="h-4 w-4" />
            Publier une leçon
          </Button>
        </div>
      </div>

      {/* No courses assigned */}
      {!loading && courses.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Aucun cours ne vous est assigné. Veuillez contacter l&apos;administrateur pour qu&apos;il vous attribue des cours avant de pouvoir publier des leçons.
          </AlertDescription>
        </Alert>
      )}

      {/* Lessons List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : sortedLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium">Aucune leçon publiée</h3>
          <p className="text-sm text-muted-foreground mt-1">Commencez par publier votre première leçon</p>
          <Button
            variant="outline"
            className="mt-4 gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98] transition-transform"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Publier votre première leçon
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-blue-100" />
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-4 pl-10 relative">
              {sortedLessons.map((lesson, index) => (
                <div key={lesson.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-10 top-4 h-[18px] w-[18px] rounded-full border-4 border-blue-500 bg-white z-10" />
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {getCourseName(lesson.courseId)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(lesson.createdAt).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <CardTitle className="text-base">{lesson.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => handleDelete(lesson.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {lesson.content && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {lesson.content}
                        </p>
                      )}
                      {lesson.fileName && (
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          {lesson.fileUrl ? (
                            <a href={lesson.fileUrl} download={lesson.fileName || true} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
                              <Download className="h-3 w-3" />
                              {lesson.fileName}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1.5 text-muted-foreground">
                              <Upload className="h-3 w-3" />
                              {lesson.fileName}
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Create Lesson Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-[500px]">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-600" />
              Publier une leçon
            </DialogTitle>
            <DialogDescription>
              Partagez du contenu avec vos élèves
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cours *</Label>
              <Select value={formCourseId} onValueChange={setFormCourseId}>
                <SelectTrigger className="w-full focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all">
                  <SelectValue placeholder="Sélectionner un cours" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} — {course.class?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input
                placeholder="Titre de la leçon"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label>Contenu</Label>
              <Textarea
                placeholder="Rédigez le contenu de votre leçon..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={5}
                className="focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label>Fichier joint (optionnel)</Label>
              {/* Hidden native file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setFormFileName(file.name);
                    formFileRef.current = file;
                  }
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Aucun fichier sélectionné"
                  value={formFileName}
                  readOnly
                  className="focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                {formFileName && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => { setFormFileName(''); setFormFileUrl(''); formFileRef.current = null; if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    ✕
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Cliquez pour ouvrir le gestionnaire de fichiers
              </p>
            </div>

          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="hover:scale-[1.02] active:scale-[0.98] transition-transform">
              Annuler
            </Button>
            <Button
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              onClick={handleCreate}
              disabled={submitting || !formCourseId || !formTitle.trim()}
            >
              {submitting ? 'Publication...' : 'Publier'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
