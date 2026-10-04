'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Award, TrendingUp, FileText, Calendar, RefreshCw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BulletinPrint from '@/components/gradeup/bulletin-print';

interface Bulletin {
  id: string;
  reportNumber: string;
  studentId: string;
  trimester: string;
  academicYear: string;
  studentName: string;
  overallPercentage: number;
  averageGrade: number;
  mention: string;
  status: string;
  createdAt: string;
  totalPointsObtained: number;
  totalPointsPossible: number;
  classRank: number | null;
  gradesData: Record<string, unknown>;
  student?: { id: string; fullName: string; photoUrl: string };
  class?: { id: string; name: string; level: string };
}

export default function StudentBulletins() {
  const user = useAppStore((s) => s.user);
  const [bulletins, setBulletins] = useState<Bulletin[]>([]);
  const [loading, setLoading] = useState(true);
  const [trimester, setTrimester] = useState('1');
  const [refreshing, setRefreshing] = useState(false);
  const [viewBulletin, setViewBulletin] = useState<Bulletin | null>(null);

  const fetchBulletins = async (showLoading = true) => {
    if (!user?.schoolId || !user?.id) return;
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`/api/report-cards?schoolId=${user.schoolId}&studentId=${user.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBulletins(Array.isArray(data.reportCards) ? data.reportCards : []);
    } catch {
      toast.error('Impossible de charger les bulletins');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBulletins();
  }, [user?.schoolId, user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBulletins(false);
    setRefreshing(false);
  };

  const filteredBulletins = bulletins.filter(
    (b) => b.trimester === trimester && (b.status === 'published' || b.status === 'validated')
  );

  const getMentionBadge = (mention: string) => {
    const m = mention?.toLowerCase() || '';
    if (m.includes('excellent') || m.includes('très bien')) {
      return { className: 'bg-green-50 text-green-700 border border-green-200' };
    }
    if (m.includes('bien')) {
      return { className: 'bg-blue-50 text-blue-700 border border-blue-200' };
    }
    if (m.includes('assez bien') || m.includes('honorable')) {
      return { className: 'bg-yellow-50 text-yellow-700 border border-yellow-200' };
    }
    if (m.includes('passable') || m.includes('satisfaisant')) {
      return { className: 'bg-orange-50 text-orange-700 border border-orange-200' };
    }
    return { className: 'bg-red-50 text-red-700 border border-red-200' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return { label: 'Publié', className: 'bg-green-100 text-green-700 border-green-200' };
      case 'validated':
        return { label: 'Validé', className: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'draft':
        return { label: 'Brouillon', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      default:
        return { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 16) return 'text-green-600 dark:text-green-400';
    if (grade >= 14) return 'text-blue-600 dark:text-blue-400';
    if (grade >= 12) return 'text-yellow-600 dark:text-yellow-400';
    if (grade >= 10) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getGradeBg = (grade: number) => {
    if (grade >= 16) return 'bg-green-50 text-green-700 border border-green-200';
    if (grade >= 14) return 'bg-blue-50 text-blue-700 border border-blue-200';
    if (grade >= 12) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
    if (grade >= 10) return 'bg-orange-50 text-orange-700 border border-orange-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-9 w-80 rounded-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Mes Bulletins</h1>
          <p className="text-sm text-muted-foreground mt-1">Consultez vos bulletins scolaires par trimestre</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="rounded-full shadow-sm"
          disabled={refreshing}
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Actualisation...' : 'Actualiser'}
        </Button>
      </div>

      {/* Trimester Tabs */}
      <Tabs value={trimester} onValueChange={setTrimester}>
        <TabsList>
          <TabsTrigger value="1" className="gap-1.5"><FileText className="h-4 w-4" />1er Trimestre</TabsTrigger>
          <TabsTrigger value="2" className="gap-1.5"><FileText className="h-4 w-4" />2e Trimestre</TabsTrigger>
          <TabsTrigger value="3" className="gap-1.5"><FileText className="h-4 w-4" />3e Trimestre</TabsTrigger>
        </TabsList>

        <TabsContent value={trimester} className="mt-4">
          {filteredBulletins.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Aucun bulletin disponible</h3>
              <p className="text-muted-foreground">
                Aucun bulletin publié pour le {trimester}er trimestre.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBulletins.map((bulletin) => (
                <Card key={bulletin.id} className="shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
                          <FileText className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{bulletin.reportNumber}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Calendar className="h-3 w-3" />
                            {bulletin.academicYear}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusBadge(bulletin.status).className}>
                        {getStatusBadge(bulletin.status).label}
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Moyenne</span>
                        <span className={`text-2xl font-bold ${getGradeColor(bulletin.averageGrade)}`}>
                          {bulletin.averageGrade?.toFixed(1) ?? '—'}
                          <span className="text-sm text-muted-foreground font-normal">/20</span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Mention</span>
                        <Badge variant="outline" className={getMentionBadge(bulletin.mention).className}>
                          <Award className="h-3 w-3 mr-1" />
                          {bulletin.mention || '—'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Points</span>
                        <span className="text-sm font-medium">
                          {bulletin.totalPointsObtained ?? '—'} / {bulletin.totalPointsPossible ?? '—'}
                        </span>
                      </div>

                      {bulletin.classRank != null && bulletin.classRank > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Rang</span>
                          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {bulletin.classRank}e
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pourcentage</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                (bulletin.overallPercentage ?? 0) >= 80
                                  ? 'bg-green-500'
                                  : (bulletin.overallPercentage ?? 0) >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${bulletin.overallPercentage ?? 0}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {bulletin.overallPercentage != null ? `${bulletin.overallPercentage.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      className="w-full mt-4 gap-1.5 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700"
                      onClick={() => setViewBulletin(bulletin)}
                    >
                      <Eye className="h-4 w-4" />
                      Voir le bulletin
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulletin detail + print */}
      <Dialog open={!!viewBulletin} onOpenChange={(o) => !o && setViewBulletin(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Bulletin — {viewBulletin?.reportNumber}
            </DialogTitle>
            <DialogDescription>
              Consultez et imprimez votre bulletin officiel.
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
