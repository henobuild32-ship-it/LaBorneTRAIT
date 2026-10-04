'use client';

import { publishToLibrary } from '@/lib/publishToLibrary';
import type { TeacherDocumentInfo } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  History,
  Library,
  Pencil,
  Printer,
  Plus,
  Search,
  Trash2,
  UploadCloud,
  Loader2,
} from 'lucide-react';

interface TeacherDocumentFormState {
  title: string;
  description: string;
  category: string;
  subject: string;
  level: string;
  period: string;
  content: string;
  fileName: string;
  fileUrl: string;
}

const emptyForm = (): TeacherDocumentFormState => ({
  title: '',
  description: '',
  category: 'Général',
  subject: '',
  level: '',
  period: '',
  content: '',
  fileName: '',
  fileUrl: '',
});

export default function TeacherDocuments() {
  const { user } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedFileRef = useRef<File | null>(null);

  const [documents, setDocuments] = useState<TeacherDocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<TeacherDocumentInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [form, setForm] = useState<TeacherDocumentFormState>(emptyForm());
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.schoolId || !user?.id) {
      setLoading(false);
      return;
    }
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`/api/documents?schoolId=${user.schoolId}&teacherId=${user.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setDocuments(Array.isArray(data.documents) ? data.documents : []);
      } catch {
        toast.error('Impossible de charger les documents pédagogiques.');
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, [user?.schoolId, user?.id]);

  const persistDocuments = async (next: TeacherDocumentInfo[]) => {
    setDocuments(next);
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingDoc(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (doc: TeacherDocumentInfo) => {
    setEditingDoc(doc);
    setForm({
      title: doc.title,
      description: doc.description,
      category: doc.category,
      subject: doc.subject,
      level: doc.level,
      period: doc.period,
      content: doc.content,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
    });
    selectedFileRef.current = null;
    setDialogOpen(true);
  };

  const uploadFile = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/resources/upload', { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Échec du téléversement');
    const data = await res.json();
    return data.url as string;
  };

  const handleSubmit = async () => {
    if (!user || !form.title.trim()) {
      toast.error('Le titre du document est requis.');
      return;
    }

    setSubmitting(true);
    try {
      let fileUrl = form.fileUrl;
      let fileName = form.fileName;

      if (selectedFileRef.current) {
        fileName = selectedFileRef.current.name;
        fileUrl = await uploadFile(selectedFileRef.current);
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim() || 'Général',
        subject: form.subject.trim(),
        level: form.level.trim(),
        period: form.period.trim(),
        content: form.content.trim(),
        fileName,
        fileUrl,
      };

      const res = editingDoc
        ? await fetch(`/api/documents?id=${editingDoc.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ schoolId: user.schoolId, ...payload }),
          });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Impossible d'enregistrer ce document.");

      setDocuments((prev) => {
        if (editingDoc) {
          return prev.map((doc) => (doc.id === editingDoc.id ? data.document : doc));
        }
        return [data.document, ...prev];
      });
      setDialogOpen(false);
      resetForm();
      toast.success(editingDoc ? 'Document mis à jour avec une nouvelle version.' : 'Document créé.');
    } catch (err: any) {
      toast.error(err?.message || "Impossible d'enregistrer ce document.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Supprimer ce document pédagogique ?')) return;
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents?id=${docId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Échec de la suppression');
      setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
      toast.success('Document supprimé.');
    } catch (err: any) {
      toast.error(err?.message || 'Échec de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  const handlePublish = async (doc: TeacherDocumentInfo) => {
    if (!user) return;
    setPublishingId(doc.id);
    try {
      const result = await publishToLibrary({
        schoolId: user.schoolId,
        createdById: user.id,
        title: doc.title,
        description: doc.description || 'Document pédagogique publié depuis l\'espace enseignant.',
        matiere: doc.subject,
        niveau: doc.level,
        author: user.fullName,
        url: doc.fileUrl || '',
        fileUrl: doc.fileUrl || '',
        type: doc.fileUrl?.toLowerCase().endsWith('.pdf') ? 'PDF' : doc.fileUrl ? 'FICHIER' : 'LIEN',
        category: doc.category || 'Documents pédagogiques',
        targetClassId: '',
      });

      if (!result.ok) {
        throw new Error(result.error || 'Publication échouée');
      }

      // Persiste l'état publié en base
      await fetch(`/api/documents?id=${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });

      setDocuments((prev) => prev.map((item) => (item.id === doc.id ? { ...item, published: true } : item)));
      toast.success('Document publié dans la bibliothèque avec succès !');
    } catch (err: any) {
      toast.error(err?.message || 'La publication dans la bibliothèque a échoué.');
    } finally {
      setPublishingId(null);
    }
  };

  const handlePrint = (doc: TeacherDocumentInfo) => {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error('Veuillez autoriser les popups pour l\'impression.');
      return;
    }

    const html = `<!doctype html>
      <html>
        <head><title>${doc.title}</title><style>body{font-family:Arial,sans-serif;padding:24px;line-height:1.5;}h1{margin-bottom:8px;} .meta{color:#555;font-size:13px;margin-bottom:16px;} .content{white-space:pre-wrap;}</style></head>
        <body>
          <h1>${doc.title}</h1>
          <div class="meta">Matière: ${doc.subject || '—'} · Niveau: ${doc.level || '—'} · Période: ${doc.period || '—'}</div>
          <div class="meta">Catégorie: ${doc.category || '—'} · Dernière mise à jour: ${new Date(doc.updatedAt).toLocaleDateString('fr-FR')}</div>
          <div class="content">${(doc.content || 'Aucun contenu').replace(/\n/g, '<br/>')}</div>
        </body>
      </html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
    toast.success('Fenêtre d\'impression ouverte.');
  };

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.subject.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q);
      const matchesSubject = !filterSubject || filterSubject === '__all__' || doc.subject === filterSubject;
      const matchesLevel = !filterLevel || filterLevel === '__all__' || doc.level === filterLevel;
      const matchesPeriod = !filterPeriod || filterPeriod === '__all__' || doc.period === filterPeriod;
      return matchesSearch && matchesSubject && matchesLevel && matchesPeriod;
    });
  }, [documents, filterLevel, filterPeriod, filterSubject, search]);

  const uniqueFields = useMemo(() => {
    const subjects = [...new Set(documents.map((doc) => doc.subject).filter(Boolean))].sort();
    const levels = [...new Set(documents.map((doc) => doc.level).filter(Boolean))].sort();
    const periods = [...new Set(documents.map((doc) => doc.period).filter(Boolean))].sort();
    return { subjects, levels, periods };
  }, [documents]);

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm dark:border-blue-950/60 dark:from-blue-950/30 dark:to-indigo-950/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Espace documents pédagogiques</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralisez vos préparations, suivi pédagogique et fiches d&apos;évaluation avec historique et publication.
            </p>
          </div>
          <Button onClick={openCreate} className="gap-2 rounded-full bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nouveau document
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <CardDescription>Nombre total de supports</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{documents.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Versionnées</CardTitle>
            <CardDescription>Documents avec historique</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{documents.filter((doc) => doc.versions?.length > 1).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Publiés</CardTitle>
            <CardDescription>Disponibles dans la bibliothèque</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{documents.filter((doc) => doc.published).length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-background/70 p-4 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document…" className="pl-9" />
        </div>
        <Select value={filterSubject} onValueChange={setFilterSubject}>
          <SelectTrigger className="lg:w-40">
            <SelectValue placeholder="Matière" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes les matières</SelectItem>
            {uniqueFields.subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="lg:w-32">
            <SelectValue placeholder="Niveau" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous niveaux</SelectItem>
            {uniqueFields.levels.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="lg:w-36">
            <SelectValue placeholder="Période" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes périodes</SelectItem>
            {uniqueFields.periods.map((period) => (
              <SelectItem key={period} value={period}>
                {period}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="mb-3 h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">Aucun document à afficher</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Créez votre premier support pédagogique, ajoutez une pièce jointe et gardez un historique des modifications.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="flex flex-col transition-shadow hover:shadow-md">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                  {doc.published ? <Badge className="bg-emerald-100 text-emerald-700">Publié</Badge> : <Badge variant="secondary">Brouillon</Badge>}
                </div>
                <CardDescription className="line-clamp-3">{doc.description || 'Aucune description ajoutée.'}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap gap-1">
                  {doc.subject && <Badge variant="outline">{doc.subject}</Badge>}
                  {doc.level && <Badge variant="outline">{doc.level}</Badge>}
                  {doc.period && <Badge variant="outline">{doc.period}</Badge>}
                  {doc.category && <Badge variant="outline">{doc.category}</Badge>}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  <span>Modifié le {new Date(doc.updatedAt).toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span>{doc.versions?.length || 1} version{(doc.versions?.length || 1) > 1 ? 's' : ''}</span>
                </div>
                {doc.fileName ? (
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{doc.fileName}</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Aucune pièce jointe</div>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(doc)}>
                    <Pencil className="h-3.5 w-3.5" /> Éditer
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => handlePrint(doc)}>
                    <Printer className="h-3.5 w-3.5" /> Imprimer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handlePublish(doc)}
                    disabled={doc.published || publishingId === doc.id}
                  >
                    {publishingId === doc.id ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Publication…</>
                    ) : (
                      <><Library className="h-3.5 w-3.5" /> Publier</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}{' '}
                    Supprimer
                  </Button>
                </div>
                {doc.fileUrl ? (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
                    <UploadCloud className="h-3.5 w-3.5" /> Ouvrir la pièce jointe
                  </a>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) {
          resetForm();
          setDialogOpen(false);
        } else {
          setDialogOpen(true);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Modifier le document' : 'Créer un document pédagogique'}</DialogTitle>
            <DialogDescription>
              Saisissez les informations du document, ajoutez une pièce jointe et gardez une trace des versions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Titre</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Journal de classe, fiche de préparation…" />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Préparation, suivi, évaluation…" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Objectif, contexte, points clés…" rows={3} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Matière</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathématiques" />
              </div>
              <div className="space-y-2">
                <Label>Niveau</Label>
                <Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="6e A" />
              </div>
              <div className="space-y-2">
                <Label>Période</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="Trimestre 1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contenu / texte</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Saisie de texte, notes ou préparation détaillée…" rows={8} />
            </div>
            <div className="space-y-2">
              <Label>Pièce jointe</Label>
              <Input
                ref={fileInputRef}
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  selectedFileRef.current = file;
                  if (file) {
                    setForm((prev) => ({ ...prev, fileName: file.name }));
                  }
                }}
              />
              {form.fileName ? <p className="text-sm text-muted-foreground">Fichier actuel : {form.fileName}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement…</> : editingDoc ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
