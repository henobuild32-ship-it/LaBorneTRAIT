'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { GradeInfo } from '@/lib/types';

export default function AdminGradeValidation() {
  const user = useAppStore((state) => state.user);
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.schoolId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/grades?schoolId=${user.schoolId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur de chargement');
      setGrades((data.grades || []).filter((grade: GradeInfo) => grade.status === 'SUBMITTED'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId]);

  useEffect(() => { load(); }, [load]);

  const validate = async (id: string) => {
    const response = await fetch(`/api/grades/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VALIDATED' }),
    });
    const data = await response.json();
    if (!response.ok) {
      toast.error(data.error || 'Validation impossible');
      return;
    }
    toast.success('Note validée et enregistrée.');
    setGrades((current) => current.filter((grade) => grade.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Validation des notes</h1>
          <p className="text-sm text-muted-foreground">Les notes soumises par les professeurs restent visibles jusqu’à validation.</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{grades.length} note(s) à valider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-muted-foreground">Chargement…</p> : grades.length === 0 ? <p className="text-muted-foreground">Aucune note soumise.</p> : grades.map((grade) => (
            <div key={grade.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="font-semibold truncate">{grade.student?.fullName || grade.studentId}</p>
                <p className="text-sm text-muted-foreground">{grade.course?.name || grade.courseId} · {grade.score}/{grade.maxScore} · {grade.evaluationDate ? new Date(grade.evaluationDate).toLocaleDateString('fr-FR') : 'date inconnue'}</p>
              </div>
              <div className="flex items-center gap-2"><Badge variant="outline">SUBMITTED</Badge><Button onClick={() => validate(grade.id)}><CheckCircle2 className="mr-2 h-4 w-4" />Valider</Button></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
