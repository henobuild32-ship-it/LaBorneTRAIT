'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, AlertTriangle, Upload, Download, ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import type { HomeworkInfo } from '@/lib/types';

export default function StudentHomework() {
  const { user } = useAppStore();
  const [homeworkList, setHomeworkList] = useState<HomeworkInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHw, setSelectedHw] = useState<HomeworkInfo | null>(null);
  const [submitContent, setSubmitContent] = useState('');
  const [submitFileName, setSubmitFileName] = useState('');
  const submitFileRef = useRef<File | null>(null);
  const submitFileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchHomework();
  }, [user]);

  const fetchHomework = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/homework?schoolId=' + user.schoolId);
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setHomeworkList(Array.isArray(data.homework) ? data.homework : []);
    } catch {
      toast.error('Erreur lors du chargement des devoirs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedHw) return;
    setSubmitting(true);
    try {
      let fileUrl = '';
      if (submitFileRef.current) {
        const fd = new FormData();
        fd.append('file', submitFileRef.current);
        const uploadRes = await fetch('/api/resources/upload', { method: 'POST', body: fd });
        if (!uploadRes.ok) throw new Error('Erreur upload fichier');
        const uploadData = await uploadRes.json();
        fileUrl = uploadData.url;
      }
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeworkId: selectedHw.id,
          studentId: user.id,
          schoolId: user.schoolId,
          fileUrl,
          fileName: submitFileName,
          content: submitContent.trim(),
        }),
      });
      if (!res.ok) throw new Error('Erreur soumission');
      toast.success('Devoir soumis avec succès !');
      setSelectedHw(null);
      setSubmitContent('');
      setSubmitFileName('');
      submitFileRef.current = null;
    } catch {
      toast.error('Erreur lors de la soumission');
    } finally {
      setSubmitting(false);
    }
  };

  const getDaysRemaining = (dueDate: string): number => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Mes devoirs</h1>
        <p className="text-sm text-muted-foreground mt-1">Consultez et soumettez vos devoirs</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : homeworkList.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucun devoir</h3>
          <p className="text-muted-foreground">Vous n&apos;avez aucun devoir pour le moment</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {homeworkList.map((hw) => {
            const daysRemaining = getDaysRemaining(hw.dueDate);
            const isOverdue = daysRemaining < 0;
            const isClose = daysRemaining >= 0 && daysRemaining <= 3;
            return (
              <Card key={hw.id} className={'hover:shadow-lg transition-all ' + (isOverdue ? 'border-l-4 border-l-red-500' : isClose ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500')}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700">{hw.course?.name || 'Cours'}</Badge>
                      </div>
                      <CardTitle className="text-base">{hw.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {hw.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{hw.description}</p>}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="h-4 w-4" /><span>&Agrave; rendre le {new Date(hw.dueDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    {isOverdue ? (
                      <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Expir&eacute;</Badge>
                    ) : isClose ? (
                      <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-300"><Clock className="h-3 w-3 mr-1" />{daysRemaining === 0 ? "Aujourd'hui" : daysRemaining + ' jour(s)'}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">{daysRemaining} jour(s)</Badge>
                    )}
                    <Button size="sm" variant="outline" className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 gap-1" onClick={() => setSelectedHw(hw)} disabled={isOverdue}>
                      <Upload className="h-3 w-3" /> Soumettre
                    </Button>
                  </div>
                  {hw.fileUrl && (
                    <div className="mt-3 text-xs">
                      <a href={hw.fileUrl} download={hw.fileName || true} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-blue-600 hover:underline">
                        <Download className="h-3 w-3" />{hw.fileName || 'Fichier joint'}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedHw} onOpenChange={(open) => !open && setSelectedHw(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Soumettre — {selectedHw?.title}</DialogTitle>
            <DialogDescription>Rendez votre travail pour ce devoir</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Commentaire (optionnel)</Label>
              <Textarea placeholder="Ajoutez un message à votre professeur..." value={submitContent} onChange={(e) => setSubmitContent(e.target.value)} rows={4} />
            </div>
            <div className="space-y-2">
              <Label>Fichier (optionnel)</Label>
              <input ref={submitFileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md,.json,.zip,.jpg,.jpeg,.png,.webp,.gif,.svg" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setSubmitFileName(file.name); submitFileRef.current = file; }
              }} />
              <div className="flex gap-2">
                <Input placeholder="Aucun fichier sélectionné" value={submitFileName} readOnly className="cursor-pointer" onClick={() => submitFileInputRef.current?.click()} />
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => submitFileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                </Button>
                {submitFileName && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-red-500"
                    onClick={() => { setSubmitFileName(''); submitFileRef.current = null; if (submitFileInputRef.current) submitFileInputRef.current.value = ''; }}>
                    &#10005;
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedHw(null)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={submitting || (!submitContent.trim() && !submitFileName)}>
              {submitting ? 'Envoi...' : 'Soumettre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
