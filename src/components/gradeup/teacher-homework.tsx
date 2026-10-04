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
import { Plus, Edit, Trash2, BookOpen, Calendar, Clock, AlertTriangle, ClipboardList, Upload, Download, Eye, Library } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { CourseInfo, HomeworkInfo, SubmissionInfo } from '@/lib/types';
import { publishToLibrary } from '@/lib/publishToLibrary';
import { fetchJsonWithCache, queueOrFetch } from '@/lib/offline-sync';
import { DocumentImportDialog } from '@/components/gradeup/document-import-dialog';
import type { CsvObject } from '@/lib/csv';

export default function TeacherHomework() {
  const { user } = useAppStore();
  const [homeworkList, setHomeworkList] = useState<HomeworkInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formCourseId, setFormCourseId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formGradingType, setFormGradingType] = useState('manual');
  const [formFileName, setFormFileName] = useState('');
  const [formFileUrl, setFormFileUrl] = useState('');
  const formFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addToLibrary, setAddToLibrary] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const [submissions, setSubmissions] = useState<SubmissionInfo[]>([]);
  const [submissionsOpen, setSubmissionsOpen] = useState(false);
  const [submissionsHomework, setSubmissionsHomework] = useState<HomeworkInfo | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [gradingScore, setGradingScore] = useState('');

  const viewSubmissions = async (hw: HomeworkInfo) => {
    setSubmissionsHomework(hw);
    setSubmissionsOpen(true);
    setLoadingSubmissions(true);
    try {
      const data = await fetchJsonWithCache(`/api/submissions?homeworkId=${hw.id}&schoolId=${user?.schoolId}`, { submissions: [] });
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch { toast.error('Erreur chargement soumissions'); setSubmissions([]); } finally { setLoadingSubmissions(false); }
  };

  const handleGradeSubmission = async (subId: string) => {
    if (!gradingScore.trim()) { toast.error('Veuillez entrer une note'); return; }
    try {
      const res = await fetch(`/api/submissions/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: gradingScore, maxScore: 20 }),
      });
      if (!res.ok) { toast.error('Erreur lors de la notation'); return; }
      toast.success('Note enregistrée');
      setGradingSubId(null); setGradingScore('');
      if (submissionsHomework) viewSubmissions(submissionsHomework);
    } catch { toast.error('Erreur lors de la notation'); }
  };

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [homeworkData, coursesData] = await Promise.all([
        fetchJsonWithCache(`/api/homework?schoolId=${user.schoolId}&teacherId=${user.id}`, { homework: [] }),
        fetchJsonWithCache(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`, { courses: [] }),
      ]);
      setHomeworkList(Array.isArray(homeworkData) ? homeworkData : (Array.isArray(homeworkData.homework) ? homeworkData.homework : []));
      setCourses(Array.isArray(coursesData.courses) ? coursesData.courses : []);
    } catch {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };


  const handleImportHomework = async (rows: CsvObject[]) => {
    if (!user?.schoolId) return;
    const res = await fetch('/api/homework/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schoolId: user.schoolId, rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "L'import a échoué");
    if (data.errors?.length) {
      data.errors.forEach((message: string) => toast.warning(message));
    }
    toast.success(`${data.created} devoir${data.created > 1 ? 's' : ''} importé${data.created > 1 ? 's' : ''}`);
    if (data.created > 0) fetchData();
  };

  const getDaysRemaining = (dueDate: string): number => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const resetForm = () => {
    setFormCourseId('');
    setFormTitle('');
    setFormDescription('');
    setFormDueDate('');
    setFormGradingType('manual');
    setFormFileName('');
    setFormFileUrl('');
    formFileRef.current = null;
    setEditingHomework(null);
  };

  const openCreateDialog = () => { resetForm(); setDialogOpen(true); };
  const openEditDialog = (hw: any) => {
    setEditingHomework(hw);
    setFormCourseId(hw.courseId);
    setFormTitle(hw.title);
    setFormDescription(hw.description);
    setFormDueDate(hw.dueDate.split('T')[0]);
    setFormGradingType(hw.gradingType || 'manual');
    setFormFileName(hw.fileName || '');
    setFormFileUrl(hw.fileUrl || '');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formCourseId || !formTitle.trim() || !formDueDate) {
      toast.error('Veuillez remplir le titre, le cours et la date limite');
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
          toast.error("Erreur lors de l'upload du fichier");
          setSubmitting(false);
          return;
        }
      }

      const body = {
        schoolId: user.schoolId,
        courseId: formCourseId,
        teacherId: user.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        dueDate: formDueDate,
        gradingType: formGradingType,
        fileUrl,
        fileName: formFileName,
      };
      const url = editingHomework ? `/api/homework/${editingHomework.id}` : '/api/homework';
      const method = editingHomework ? 'PUT' : 'POST';
      const res = !editingHomework && !fileUrl
        ? await queueOrFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res) {
        toast.info('Devoir enregistré hors ligne. Il sera synchronisé au retour du réseau.');
        resetForm();
        return;
      }
      if (!res.ok) { const err = await res.json(); toast.error(err.error || "Erreur lors de l'enregistrement"); return; }
      toast.success(editingHomework ? 'Devoir modifié avec succès' : 'Devoir créé avec succès');

      // Publish to the digital library on creation
      if (!editingHomework && addToLibrary) {
        const course = courses.find((c) => c.id === formCourseId);
        const libResult = await publishToLibrary({
          schoolId: user.schoolId,
          createdById: user.id,
          title: formTitle.trim(),
          description: formDescription.trim() || `Devoir du cours ${course?.name || ''}`,
          matiere: course?.name || '',
          niveau: course?.class?.level || '',
          author: user.fullName,
          url: '',
          fileUrl: fileUrl || '',
          type: fileUrl?.toLowerCase().endsWith('.pdf') ? 'PDF' : fileUrl ? 'FICHIER' : 'LIEN',
          category: 'Devoirs',
          targetClassId: course?.classId || '',
        });
        if (!libResult.ok) toast.warning(`Devoir créé mais bibliothèque : ${libResult.error || 'échoué'}`);
      }

      setDialogOpen(false); resetForm(); fetchData();
    } catch { toast.error("Erreur lors de l'enregistrement"); } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/homework/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Erreur lors de la suppression'); return; }
      toast.success('Devoir supprimé'); fetchData();
    } catch { toast.error('Erreur lors de la suppression'); }
  };

  const sortedHomework = [...homeworkList].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const getCourseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name || 'Cours inconnu';

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Devoirs</h1>
            <p className="text-sm text-muted-foreground mt-1">Créez et gérez les devoirs de vos élèves</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setShowImport(true)} disabled={courses.length === 0}>
              <Upload className="h-4 w-4" /> Importer
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20 gap-2" onClick={openCreateDialog} disabled={courses.length === 0}>
              <Plus className="h-4 w-4" /> Créer un devoir
            </Button>
          </div>
        </div>
      </div>

      {/* No courses assigned */}
      {!loading && courses.length === 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            Aucun cours ne vous est assigné. Veuillez contacter l&apos;administrateur pour qu&apos;il vous attribue des cours avant de pouvoir créer des devoirs.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
        </div>
      ) : sortedHomework.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucun devoir créé</h3>
          <p className="text-muted-foreground mb-4">Attribuez votre premier devoir à vos élèves</p>
          <Button onClick={openCreateDialog} variant="outline" className="hover:scale-[1.02] active:scale-[0.98] transition-all gap-2 border-blue-200 text-blue-700 hover:bg-blue-50">
            <Plus className="h-4 w-4" /> Créer votre premier devoir
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedHomework.map((hw: any) => {
            const daysRemaining = getDaysRemaining(hw.dueDate);
            const isOverdue = daysRemaining < 0;
            const isClose = daysRemaining >= 0 && daysRemaining <= 3;
            return (
              <Card key={hw.id} className={`hover:shadow-lg transition-all ${isOverdue ? 'border-l-4 border-l-red-500' : isClose ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500'}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">{getCourseName(hw.courseId)}</Badge>
                        <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-indigo-50/50">
                          {hw.gradingType === 'automatic' ? 'Correction Auto' : 'Correction Manuelle'}
                        </Badge>
                      </div>
                      <CardTitle className="text-base">{hw.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600 transition-colors" title="Ajouter à la bibliothèque numérique"
                        onClick={() => {
                          const course = courses.find((c) => c.id === hw.courseId);
                          publishToLibrary({
                            schoolId: user.schoolId,
                            createdById: user.id,
                            title: hw.title,
                            description: hw.description || `Devoir du cours ${course?.name || ''}`,
                            matiere: course?.name || '',
                            niveau: course?.class?.level || '',
                            author: user.fullName,
                            url: '',
                            fileUrl: hw.fileUrl || '',
                            type: hw.fileUrl?.toLowerCase().endsWith('.pdf') ? 'PDF' : hw.fileUrl ? 'FICHIER' : 'LIEN',
                            category: 'Devoirs',
                            targetClassId: course?.classId || '',
                          }).then((r) => r.ok ? toast.success('Devoir ajouté à la bibliothèque numérique.') : toast.error(r.error || 'Échec de l\'ajout à la bibliothèque.'));
                        }}>
                        <Library className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-purple-50 hover:text-purple-600 transition-colors" onClick={() => viewSubmissions(hw)} title="Voir les soumissions"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => openEditDialog(hw)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => handleDelete(hw.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {hw.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{hw.description}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" /><span>{new Date(hw.dueDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {isOverdue ? (
                      <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Expiré</Badge>
                    ) : isClose ? (
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300"><Clock className="h-3 w-3 mr-1" />{daysRemaining === 0 ? "C'est aujourd'hui" : `${daysRemaining} jour(s)`}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">{daysRemaining} jour(s)</Badge>
                    )}
                  </div>
                  {hw.fileName && (
                    <div className="mt-3 text-xs">
                      {hw.fileUrl ? (
                        <a href={hw.fileUrl} download={hw.fileName || true} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 hover:underline">
                          <Download className="h-3 w-3" />
                          {hw.fileName}
                        </a>
                      ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Upload className="h-3 w-3" />
                          {hw.fileName}
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Homework Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-lg">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-t-lg -mx-6 -mt-6 mb-0" />
          <DialogHeader className="pt-2">
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              {editingHomework ? 'Modifier le devoir' : 'Créer un devoir'}
            </DialogTitle>
            <DialogDescription>{editingHomework ? 'Modifiez les informations du devoir' : 'Attribuez un nouveau devoir à vos élèves'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cours *</Label>
              <Select value={formCourseId} onValueChange={setFormCourseId}>
                <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                  <SelectValue placeholder="Sélectionner un cours" />
                </SelectTrigger>
                <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {c.class?.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Titre *</Label>
              <Input placeholder="Titre du devoir" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Décrivez le devoir à réaliser..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={3} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date limite *</Label>
                <Input type="date" min={new Date().toISOString().split('T')[0]} value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              </div>
              <div className="space-y-2">
                <Label>Type de correction *</Label>
                <Select value={formGradingType} onValueChange={setFormGradingType}>
                  <SelectTrigger className="w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Correction Manuelle</SelectItem>
                    <SelectItem value="automatic">Correction Automatique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fichier joint (optionnel)</Label>
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setFormFileName(file.name); formFileRef.current = file; }
              }} />
              <div className="flex gap-2">
                <Input placeholder="Aucun fichier sélectionné" value={formFileName} readOnly
                  className="focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:border-blue-500 transition-all cursor-pointer"
                  onClick={() => fileInputRef.current?.click()} />
                <Button type="button" variant="outline" size="icon" className="shrink-0 border-blue-200 text-blue-600 hover:bg-blue-50"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
                {formFileName && (
                  <Button type="button" variant="ghost" size="icon"
                    className="shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => { setFormFileName(''); setFormFileUrl(''); formFileRef.current = null; if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                    ✕
                  </Button>
                )}
              </div>
            </div>
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
                  Les élèves pourront retrouver ce devoir dans la Bibliothèque.
                </span>
              </div>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }} className="hover:scale-[1.02] active:scale-[0.98] transition-all">Annuler</Button>
            <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-[1.02] active:scale-[0.98] transition-transform" onClick={handleSubmit} disabled={submitting || !formCourseId || !formTitle.trim() || !formDueDate}>
              {submitting ? 'Enregistrement...' : editingHomework ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submissions Dialog */}
      <Dialog open={submissionsOpen} onOpenChange={setSubmissionsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-purple-500" />
              Soumissions — {submissionsHomework?.title}
            </DialogTitle>
            <DialogDescription>Consultez et notez les travaux rendus par les élèves</DialogDescription>
          </DialogHeader>
          {loadingSubmissions ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">Aucune soumission pour ce devoir</div>
          ) : (
            <div className="divide-y">
              {submissions.map((sub) => (
                <div key={sub.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sub.student?.fullName || 'Élève'}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>Rendu le {new Date(sub.submittedAt).toLocaleDateString('fr-FR')}</span>
                      {sub.fileUrl && (
                        <a href={sub.fileUrl} download={sub.fileName || true} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                          <Download className="h-3 w-3" />{sub.fileName || 'Fichier'}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.status === 'graded' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs">{sub.score}/{sub.maxScore || 20}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">Non noté</Badge>
                    )}
                    {gradingSubId === sub.id ? (
                      <div className="flex items-center gap-1">
                        <Input type="number" className="w-16 h-8 text-xs" min="0" max="20" step="0.5" value={gradingScore} onChange={(e) => setGradingScore(e.target.value)} placeholder="Note" />
                        <Button size="sm" className="h-8 text-xs" onClick={() => handleGradeSubmission(sub.id)}>OK</Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setGradingSubId(null); setGradingScore(''); }}>Annuler</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setGradingSubId(sub.id); setGradingScore(''); }}>
                        Noter
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DocumentImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        title="Importer des devoirs"
        description="Préparez un document Word ou PDF avec un tableau (ou photographiez-le) : vos devoirs sont importés par cours."
                expectedColumns={['Cours', 'Titre', 'Date', 'Description']}
        sampleRows={[
          ['Mathématiques', 'Exercices page 42', '2026-10-10', 'Résoudre les exercices 1 à 10'],
          ['Français', 'Dictée', '2026-10-12', ''],
        ]}
        columnHints={[
          { header: 'Cours', hint: 'nom exact de votre cours' },
          { header: 'Classe', hint: 'facultatif, si plusieurs cours homonymes' },
          { header: 'Titre', hint: 'obligatoire' },
          { header: 'Date', hint: 'date limite au format JJ/MM/AAAA ou AAAA-MM-JJ' },
          { header: 'Description', hint: 'facultatif' },
        ]}
        onImport={handleImportHomework}
      />
    </div>
  );
}
