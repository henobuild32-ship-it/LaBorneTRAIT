'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { UserInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Award, TrendingUp, FileText, Calendar, Users, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import BulletinPrint from '@/components/gradeup/bulletin-print';

interface ReportCardInfo {
  id: string;
  reportNumber: string;
  trimester: string;
  academicYear: string;
  studentName: string;
  totalPointsObtained: number;
  totalPointsPossible: number;
  overallPercentage: number;
  averageGrade: number;
  classRank: number;
  mention: string;
  status: string;
  createdAt: string;
  gradesData?: Record<string, unknown> | null;
  student?: { id: string; fullName: string; photoUrl: string };
  class?: { id: string; name: string; level: string };
}

export default function ParentBulletins() {
  const { user } = useAppStore();
  const [children, setChildren] = useState<UserInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [trimester, setTrimester] = useState('1');
  const [reportCards, setReportCards] = useState<ReportCardInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [viewBulletin, setViewBulletin] = useState<ReportCardInfo | null>(null);
  const schoolId = user?.schoolId || '';

  useEffect(() => { fetchChildren(); }, [user]);
  useEffect(() => { if (selectedChildId && schoolId) { fetchReportCards(); } }, [selectedChildId, trimester, schoolId]);

  const fetchChildren = async () => {
    if (!user?.id || !schoolId) {
      setLoadingChildren(false);
      return;
    }
    setLoadingChildren(true);
    try {
      const res = await fetch(`/api/users?schoolId=${schoolId}&role=STUDENT&parentId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        const childrenArray = Array.isArray(data.users) ? data.users : [];
        setChildren(childrenArray);
        if (childrenArray.length > 0 && !selectedChildId) {
          setSelectedChildId(childrenArray[0].id);
        }
      } else {
        setChildren([]);
      }
    } catch {
      toast.error('Erreur lors du chargement des enfants');
      setChildren([]);
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchReportCards = async () => {
    if (!selectedChildId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/report-cards?schoolId=${schoolId}&studentId=${selectedChildId}`);
      if (res.ok) {
        const data = await res.json();
        const allCards = Array.isArray(data.reportCards) ? data.reportCards : [];
        const filtered = allCards.filter(
          (rc: ReportCardInfo) =>
            rc.trimester === trimester &&
            (rc.status === 'published' || rc.status === 'validated')
        );
        setReportCards(filtered);
      } else {
        setReportCards([]);
      }
    } catch {
      toast.error('Erreur lors du chargement des bulletins');
      setReportCards([]);
    } finally {
      setLoading(false);
    }
  };

  const selectedChild = Array.isArray(children) ? children.find(c => c.id === selectedChildId) : undefined;

  const getMentionColor = (mention: string) => {
    const m = mention?.toLowerCase() || '';
    if (m.includes('excellent') || m.includes('hon')) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (m.includes('bien') || m.includes('très')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (m.includes('assez')) return 'bg-sky-100 text-sky-700 border-sky-200';
    if (m.includes('passable') || m.includes('moyen')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return { label: 'Publié', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'validated':
        return { label: 'Validé', className: 'bg-blue-100 text-blue-700 border-blue-200' };
      default:
        return { label: 'Brouillon', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    }
  };

  const getAverageBadge = (avg: number) => {
    if (avg >= 16) return { label: 'Excellent', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (avg >= 14) return { label: 'Très bien', className: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (avg >= 12) return { label: 'Bien', className: 'bg-sky-100 text-sky-700 border-sky-200' };
    if (avg >= 10) return { label: 'Assez bien', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Insuffisant', className: 'bg-red-100 text-red-700 border-red-200' };
  };

  const trimesterLabels: Record<string, string> = { '1': '1er Trimestre', '2': '2ème Trimestre', '3': '3ème Trimestre' };

  if (!user) return null;

  if (loadingChildren) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-6">
          <h1 className="text-2xl font-bold">Bulletins</h1>
          <p className="text-sm text-muted-foreground mt-1">Consultez les bulletins de vos enfants</p>
        </div>
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (Array.isArray(children) && children.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-6">
          <h1 className="text-2xl font-bold">Bulletins</h1>
          <p className="text-sm text-muted-foreground mt-1">Consultez les bulletins de vos enfants</p>
        </div>
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucun enfant trouvé</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 p-6">
        <h1 className="text-2xl font-bold">Bulletins</h1>
        <p className="text-sm text-muted-foreground mt-1">Consultez les bulletins de vos enfants</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {Array.isArray(children) && children.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Enfant :</span>
            <Select value={selectedChildId} onValueChange={setSelectedChildId}>
              <SelectTrigger className="w-[200px] focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all">
                <SelectValue placeholder="Sélectionner un enfant" />
              </SelectTrigger>
              <SelectContent>
                {children.map(child => <SelectItem key={child.id} value={child.id}>{child.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Trimestre :</span>
          <Select value={trimester} onValueChange={setTrimester}>
            <SelectTrigger className="w-[180px] focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1er Trimestre</SelectItem>
              <SelectItem value="2">2ème Trimestre</SelectItem>
              <SelectItem value="3">3ème Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : reportCards.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-center">Aucun bulletin disponible pour {trimesterLabels[trimester]?.toLowerCase()}</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Les bulletins publiés ou validés apparaîtront ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reportCards.map((rc) => {
            const avgBadge = getAverageBadge(rc.averageGrade);
            const statusBadge = getStatusBadge(rc.status);
            return (
              <Card key={rc.id} className="shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="size-5 text-violet-600" />
                        Bulletin {rc.reportNumber}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {rc.student?.fullName || rc.studentName} — {trimesterLabels[rc.trimester] || `Trimestre ${rc.trimester}`} — {rc.academicYear}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className={`w-fit ${statusBadge.className}`}>{statusBadge.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {/* Average Grade */}
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Award className="size-3" />
                        Moyenne
                      </div>
                      <span className="text-2xl font-bold">{rc.averageGrade.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">/20</span>
                      <Badge variant="outline" className={`mt-1 text-[10px] ${avgBadge.className}`}>{avgBadge.label}</Badge>
                    </div>

                    {/* Total Points */}
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <TrendingUp className="size-3" />
                        Points
                      </div>
                      <span className="text-lg font-bold">
                        {rc.totalPointsObtained.toFixed(1)}
                        <span className="text-muted-foreground font-normal"> / {rc.totalPointsPossible.toFixed(1)}</span>
                      </span>
                    </div>

                    {/* Overall Percentage */}
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Calendar className="size-3" />
                        Pourcentage
                      </div>
                      <span className="text-2xl font-bold">{rc.overallPercentage.toFixed(1)}%</span>
                    </div>

                    {/* Class Rank */}
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="size-3" />
                        Rang
                      </div>
                      <span className="text-2xl font-bold">{rc.classRank}</span>
                      <span className="text-xs text-muted-foreground">e</span>
                    </div>

                    {/* Mention */}
                    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Award className="size-3" />
                        Mention
                      </div>
                      <Badge variant="outline" className={`text-xs ${getMentionColor(rc.mention)}`}>
                        {rc.mention || '—'}
                      </Badge>
                    </div>
                  </div>

                  {rc.class && (
                    <div className="mt-3 text-xs text-muted-foreground text-center">
                      Classe : {rc.class.name} ({rc.class.level})
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full mt-4 gap-1.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    onClick={() => setViewBulletin(rc)}
                  >
                    <Eye className="h-4 w-4" />
                    Voir le bulletin
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bulletin detail + print */}
      <Dialog open={!!viewBulletin} onOpenChange={(o) => !o && setViewBulletin(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              Bulletin — {viewBulletin?.reportNumber}
            </DialogTitle>
            <DialogDescription>
              Consultez et imprimez le bulletin officiel de votre enfant.
            </DialogDescription>
          </DialogHeader>
          {viewBulletin && (
            <BulletinPrint
              report={{
                reportNumber: viewBulletin.reportNumber,
                trimester: viewBulletin.trimester,
                academicYear: viewBulletin.academicYear,
                studentName: viewBulletin.studentName || viewBulletin.student?.fullName || '',
                studentGender: (viewBulletin.gradesData as any)?.metadata?.studentGender,
                studentBirthDate: (viewBulletin.gradesData as any)?.metadata?.studentBirthDate,
                permanentNumber: (viewBulletin.gradesData as any)?.metadata?.permanentNumber,
                class: viewBulletin.class,
                averageGrade: viewBulletin.averageGrade,
                mention: viewBulletin.mention,
                classRank: viewBulletin.classRank,
                totalPointsObtained: viewBulletin.totalPointsObtained,
                totalPointsPossible: viewBulletin.totalPointsPossible,
                overallPercentage: viewBulletin.overallPercentage,
                gradesData: viewBulletin.gradesData,
              }}
              schoolName={user?.school?.name}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
