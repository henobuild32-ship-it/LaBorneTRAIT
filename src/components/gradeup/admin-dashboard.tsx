'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Users,
  GraduationCap,
  DollarSign,
  UsersRound,
  AlertTriangle,
  Clock,
  Plus,
  BookOpen,
  Bell,
  TrendingUp,
  School,
  CheckCircle2,
  Inbox,
  Search,
  Key,
  Copy,
  Check,
  RefreshCw,
  TrendingDown,
  Sparkles,
  Download,
  AlertOctagon,
  CheckCircle,
  Loader2,
  Video
} from 'lucide-react';
import WelcomeBanner from './welcome-banner';
import ActivityFeed from './activity-feed';
import { MonthlyRevenueChart, GradeDistributionChart } from './charts-widget';
import SectionPanel from './section-panel';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface Stats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  totalClasses: number;
  totalCourses: number;
  totalPayments: number;
  totalRevenue: number;
  pendingRevenue: number;
  attendanceToday: {
    present: number;
    absent: number;
    total: number;
  };
}

interface StudentResult {
  id: string;
  fullName: string;
  email: string;
  photoUrl: string;
  classEnrollments?: { class: { id: string; name: string } }[];
}

export default function AdminDashboard() {
  const { user, setCurrentPage } = useAppStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [progression, setProgression] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [overduePayments, setOverduePayments] = useState<any[]>([]);

  // Student search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Invite code
  const [inviteCode, setInviteCode] = useState(user?.school?.inviteCode || '');
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // N+1 Transition Wizard states
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionStep, setTransitionStep] = useState(1);
  const [understandRisk, setUnderstandRisk] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [transitionStatusMsg, setTransitionStatusMsg] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Financial report states
  const [exportingReport, setExportingReport] = useState(false);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users?schoolId=${user?.schoolId}&role=STUDENT&search=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data.users) ? data.users : []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [user?.schoolId]);

  useEffect(() => {
    if (user?.schoolId) {
      fetchStats();
      fetchAlerts();
      fetchProgression();
    }
  }, [user?.schoolId]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`/api/stats?schoolId=${user?.schoolId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.stats) {
        setStats(data.stats);
      }
    } catch {
      // silencieux
    } finally {
      setLoading(false);
    }
  };

  const fetchProgression = async () => {
    try {
      const res = await fetch(`/api/stats/progression?schoolId=${user?.schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setProgression(data);
      }
    } catch {
      // silencieux
    }
  };

  const fetchAlerts = async () => {
    try {
      const [pendingRes, overdueRes] = await Promise.all([
        fetch(`/api/payments?schoolId=${user?.schoolId}&status=pending`),
        fetch(`/api/payments?schoolId=${user?.schoolId}&status=overdue`),
      ]);
      const pendingData = await pendingRes.json();
      const overdueData = await overdueRes.json();
      setPendingPayments(pendingData.payments?.slice(0, 5) || []);
      setOverduePayments(overdueData.payments?.slice(0, 5) || []);
    } catch {
      // silencieux
    }
  };

  // Launch annual transition (N+1)
  const runTransitionProcess = async () => {
    setIsTransitioning(true);
    setTransitionStep(3);
    setTransitionProgress(10);
    setTransitionStatusMsg('Préparation de la clôture annuelle...');

    try {
      // Appel backend réel — la progression reflète l'état réel de l'opération
      const res = await fetch('/api/end-of-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user?.schoolId }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTransitionProgress(100);
        setTransitionStatusMsg('Transition annuelle terminée avec succès.');
        toast.success(data.message || "La transition annuelle a été effectuée avec succès !");
        setTransitionStep(4);
        fetchStats();
      } else {
        const err = await res.json().catch(() => ({}));
        setTransitionProgress(0);
        setTransitionStatusMsg('');
        toast.error(err.error || "La transition a rencontré une erreur.");
        setTransitionOpen(false);
      }
    } catch {
      setTransitionProgress(0);
      setTransitionStatusMsg('');
      toast.error("Échec lors de la transition.");
      setTransitionOpen(false);
    } finally {
      setIsTransitioning(false);
    }
  };

  // Export Financial Reports
  const handleExportFinances = async () => {
    setExportingReport(true);
    try {
      const rows = [
        ['Indicateur', 'Valeur'],
        ['Total élèves', String(stats?.totalStudents ?? 0)],
        ['Total professeurs', String(stats?.totalTeachers ?? 0)],
        ['Total parents', String(stats?.totalParents ?? 0)],
        ['Total classes', String(stats?.totalClasses ?? 0)],
        ['Total cours', String(stats?.totalCourses ?? 0)],
        ['Total paiements', String(stats?.totalPayments ?? 0)],
        ['Revenus totaux', String(stats?.totalRevenue ?? 0)],
        ['Revenus en attente', String(stats?.pendingRevenue ?? 0)],
      ];

      if (pendingPayments.length > 0) {
        rows.push(['', '']);
        rows.push(['Paiements en attente', '']);
        pendingPayments.forEach((payment) => {
          rows.push([
            payment.student?.fullName || 'Inconnu',
            `${payment.amount ?? 0} USD - ${payment.month || 'Mois non précisé'}`,
          ]);
        });
      }

      if (overduePayments.length > 0) {
        rows.push(['', '']);
        rows.push(['Paiements en retard', '']);
        overduePayments.forEach((payment) => {
          rows.push([
            payment.student?.fullName || 'Inconnu',
            `${payment.amount ?? 0} USD - ${payment.month || 'Mois non précisé'}`,
          ]);
        });
      }

      const csv = rows
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
        .join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-financier-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Rapport financier exporté avec succès');
    } finally {
      setExportingReport(false);
    }
  };

  const statCards = [
    {
      title: 'Total Élèves',
      value: stats?.totalStudents ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      badge: `${stats?.totalClasses ?? 0} classes`,
      badgeClass: 'bg-blue-50 text-blue-600',
    },
    {
      title: 'Total Professeurs',
      value: stats?.totalTeachers ?? 0,
      icon: GraduationCap,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      badge: `${stats?.totalCourses ?? 0} cours`,
      badgeClass: 'bg-green-50 text-green-600',
    },
    {
      title: 'Revenus',
      value: `${(stats?.totalRevenue ?? 0).toLocaleString()} ${user?.school?.currency || 'USD'}`,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badge: `${(stats?.pendingRevenue ?? 0).toLocaleString()} en attente`,
      badgeClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: 'Total Parents',
      value: stats?.totalParents ?? 0,
      icon: UsersRound,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      badge: stats?.attendanceToday
        ? `${stats.attendanceToday.present} présents aujourd'hui`
        : 'Aucune présence aujourd\'hui',
      badgeClass: 'bg-purple-50 text-purple-600',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 p-6 lg:p-8 text-white shadow-xl shadow-[0_0_40px_-10px_rgba(59,130,246,0.15)]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <School className="h-8 w-8 animate-pulse-soft" />
            <h1 className="text-2xl lg:text-3xl font-bold">
              Bienvenue, {user?.fullName}
            </h1>
          </div>
          <p className="text-blue-100 text-sm lg:text-base max-w-xl">
            Vue d&apos;ensemble de votre école — <span className="font-semibold text-white">{user?.school?.name}</span>
          </p>
        </div>
        <div className="absolute top-4 right-6 hidden lg:block">
          <GraduationCap className="h-24 w-24 text-white/10" />
        </div>
      </div>

      {/* Onboarding Welcome Banner */}
      {!loading && (
        <WelcomeBanner totalStudents={stats?.totalStudents ?? 0} />
      )}

      {/* Section repliable : Établissement */}
      <SectionPanel
        title="Établissement"
        description="Code d'invitation, progression annuelle et actions de fin d'année"
        icon={<Key className="h-4 w-4" />}
      >
      {/* School invite code */}
      <Card className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 rounded-2xl">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30">
                <Key className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">Code école</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Partagez ce code pour inscrire les membres</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2.5">
                <Key className="w-4 h-4 text-blue-600" />
                <span className="text-lg font-bold font-mono tracking-wider text-blue-700">{inviteCode || '—'}</span>
                <button
                  onClick={() => {
                    if (inviteCode) {
                      navigator.clipboard.writeText(inviteCode);
                      setCodeCopied(true);
                      setTimeout(() => setCodeCopied(false), 2000);
                    }
                  }}
                  className="text-blue-600 hover:text-blue-800 transition-colors"
                  disabled={!inviteCode}
                >
                  {codeCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-300 text-blue-700 hover:bg-blue-50 hover:text-blue-800 transition-all duration-200"
                onClick={async () => {
                  if (!user?.schoolId) return;
                  setRegeneratingCode(true);
                  try {
                    const res = await fetch('/api/invite-code', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ schoolId: user.schoolId }),
                    });
                    const data = await res.json();
                    if (data.inviteCode) {
                      setInviteCode(data.inviteCode);
                    }
                  } catch { /* skip */ }
                  setRegeneratingCode(false);
                }}
                disabled={regeneratingCode}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regeneratingCode ? 'animate-spin' : ''}`} />
                Régénérer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Annual Progression Gauge (Moyenne & Complétion) */}
      <Card className="overflow-hidden shadow-md border rounded-2xl relative">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Progression annuelle globale
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Calculé sur la complétion des notations et la performance académique de l'école</p>
            </div>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Année en cours</Badge>
          </div>

          {progression === null ? (
            <div className="py-8 text-center text-muted-foreground">Calcul de la progression…</div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6 items-center">
            {/* Round Gauge */}
            <div className="flex flex-col items-center justify-center shrink-0">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-blue-100" />
                  <circle 
                    cx="50" cy="50" r="42" 
                    fill="none" strokeWidth="8" strokeLinecap="round" 
                    className="stroke-blue-600" 
                    strokeDasharray={263.8} 
                    strokeDashoffset={263.8 * (1 - progression.progression / 100)} 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-blue-600">{progression.progression}%</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Complété</span>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="sm:col-span-2 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Taux de saisie des notes</span>
                  <span className="font-bold">{progression.components.coverageNotes}%</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${progression.components.coverageNotes}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-semibold">Performance générale moyenne</span>
                  <span className="font-bold">{progression.raw.totalGrades > 0 ? 'En cours' : '—'}</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${progression.components.coverageCours}%` }} />
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground italic">
                {progression.raw.totalStudents > 0 
                  ? `Dernière mise à jour : ${progression.raw.totalStudents} élèves, ${progression.raw.totalCourses} cours`
                  : 'Aucune donnée — ajoutez des élèves et des cours pour voir la progression.'}
              </p>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Priority actions & transition button */}
      <Card className="overflow-hidden shadow-md border rounded-2xl relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoNTksMTMwLDI0NiwwLjA4KSIvPjwvc3ZnPg==')] opacity-40 pointer-events-none" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">⚡ Actions prioritaires de l'établissement</CardTitle>
          <CardDescription>Actions de fin d'année et exports analytiques</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {/* N+1 Transition Button */}
          <Button
            onClick={() => { setTransitionStep(1); setConfirmText(''); setUnderstandRisk(false); setTransitionOpen(true); }}
            className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-red-500/10 hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4 mr-2 animate-spin-slow" />
            Lancer la transition d'année (N+1)
          </Button>

          {/* Export Financial reports */}
          <Button
            variant="outline"
            onClick={handleExportFinances}
            disabled={exportingReport}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 font-bold rounded-xl hover:scale-[1.02] active:scale-[0.97] transition-all duration-200"
          >
            {exportingReport ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter rapports financiers
          </Button>
        </CardContent>
      </Card>
      </SectionPanel>

      {/* Section repliable : Indicateurs & recherche */}
      <SectionPanel
        title="Indicateurs & recherche"
        description="Chiffres clés de l'école et recherche d'élève"
        icon={<TrendingUp className="h-4 w-4" />}
      >
      {/* Quick search */}
      <div ref={searchRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher un élève par nom..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 transition-colors"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
        </div>

        {searchOpen && (searchResults.length > 0 || searchQuery.trim()) && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {searchResults.length === 0 && !searching ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Aucun résultat trouvé</div>
            ) : (
              searchResults.map((student) => (
                <button
                  key={student.id}
                  onClick={() => {
                    setSelectedStudent(student);
                    setSearchOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {student.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{student.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.classEnrollments && student.classEnrollments.length > 0
                        ? student.classEnrollments.map((e) => e.class.name).join(', ')
                        : 'Non assigné'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {selectedStudent && (
          <div className="mt-3 p-4 rounded-xl border bg-card animate-fade-in flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">
                  {selectedStudent.fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <div>
                <p className="font-semibold text-foreground">{selectedStudent.fullName}</p>
                <p className="text-xs text-muted-foreground">{selectedStudent.email}</p>
                {selectedStudent.classEnrollments && selectedStudent.classEnrollments.length > 0 && (
                  <p className="text-xs text-primary mt-0.5">
                    {selectedStudent.classEnrollments.map((e) => e.class.name).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setSelectedStudent(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))
          : statCards.map((card, index) => (
              <Card
                key={card.title}
                className={`group border ${card.border} overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 rounded-2xl relative`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <CardContent className="relative p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
                      <card.icon className={`h-6 w-6 ${card.color}`} />
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${card.badgeClass}`}>
                      {card.badge}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{card.title}</p>
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Secondary Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="transition-all duration-300 hover:shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-50">
                <BookOpen className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Classes</p>
                <p className="text-xl font-bold">{stats.totalClasses}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="transition-all duration-300 hover:shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-50">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Revenus en attente</p>
                <p className="text-xl font-bold">{stats.pendingRevenue.toLocaleString()} USD</p>
              </div>
            </CardContent>
          </Card>
          <Card className="transition-all duration-300 hover:shadow-lg rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-teal-50">
                <Clock className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Présence aujourd'hui</p>
                <p className="text-xl font-bold">
                  {stats.attendanceToday.total > 0
                    ? `${Math.round((stats.attendanceToday.present / stats.attendanceToday.total) * 100)}%`
                    : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </SectionPanel>

      {/* Section repliable : Actions de gestion */}
      <SectionPanel
        title="Actions de gestion"
        description="Raccourcis pour gérer votre établissement"
        icon={<Plus className="h-4 w-4" />}
      >
      {/* Quick Actions */}
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" /> Actions de gestion
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => setCurrentPage('admin-users')} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
            <Plus className="h-4 w-4 mr-2" /> Ajouter un élève
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage('admin-classes')} className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl">
            <BookOpen className="h-4 w-4 mr-2" /> Créer une classe
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage('admin-conferences')} className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl">
            <Video className="h-4 w-4 mr-2" /> Visioconférences
          </Button>
          <Button variant="outline" onClick={() => setCurrentPage('admin-notifications')} className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl">
            <Bell className="h-4 w-4 mr-2" /> Envoyer notification
          </Button>
        </CardContent>
      </Card>
      </SectionPanel>

      {/* Section repliable : Analyse & activité */}
      <SectionPanel
        title="Analyse & activité"
        description="Graphiques, revenus et dernières activités"
        icon={<TrendingDown className="h-4 w-4" />}
      >
      {/* Charts Section */}
      {user?.schoolId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MonthlyRevenueChart schoolId={user.schoolId} />
          <GradeDistributionChart schoolId={user.schoolId} />
        </div>
      )}

      {/* Activity Feed */}
      {user?.schoolId && <ActivityFeed schoolId={user.schoolId} />}
      </SectionPanel>

      {/* Section repliable : Alertes (fermée par défaut) */}
      <SectionPanel
        title="Alertes de paiement"
        description="Paiements en attente et en retard"
        icon={<AlertTriangle className="h-4 w-4" />}
        defaultOpen={false}
        badge={
          pendingPayments.length + overduePayments.length > 0 ? (
            <Badge className="bg-red-100 text-red-700 font-semibold mr-1">
              {pendingPayments.length + overduePayments.length}
            </Badge>
          ) : undefined
        }
      >
      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Payments */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Paiements en attente
              {pendingPayments.length > 0 && <Badge className="bg-yellow-100 text-yellow-700 font-semibold ml-2">{pendingPayments.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingPayments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun paiement en attente</p>
            ) : (
              <div className="space-y-2">
                {pendingPayments.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl text-xs">
                    <div>
                      <p className="font-semibold">{p.student?.fullName}</p>
                      <p className="text-muted-foreground mt-0.5">{p.month} · {parseFloat(p.amount).toLocaleString()} USD</p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-200">En attente</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Payments */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Paiements en retard
              {overduePayments.length > 0 && <Badge className="bg-red-100 text-red-700 font-semibold ml-2">{overduePayments.length}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overduePayments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun paiement en retard</p>
            ) : (
              <div className="space-y-2">
                {overduePayments.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl text-xs">
                    <div>
                      <p className="font-semibold">{p.student?.fullName}</p>
                      <p className="text-muted-foreground mt-0.5">{p.month} · {parseFloat(p.amount).toLocaleString()} USD</p>
                    </div>
                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">En retard</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </SectionPanel>

      {/* N+1 Transition Wizard Dialog */}
      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-red-500" />
              Transition de fin d'année (N+1)
            </DialogTitle>
          </DialogHeader>

          {/* Step 1: Warning risk confirmation */}
          {transitionStep === 1 && (
            <div className="space-y-4 py-2 animate-fade-in">
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700 leading-relaxed font-semibold">
                ⚠️ CAUTION / WARNING : Cette action est définitive et destructrice. Elle va clore l'année académique courante, archiver définitivement les bulletins, promouvoir les élèves aux classes supérieures (N+1) et réinitialiser les factures mensuelles.
              </div>
              <div className="flex items-start gap-2.5 pt-2">
                <input 
                  type="checkbox" 
                  id="risk_check" 
                  checked={understandRisk} 
                  onChange={(e) => setUnderstandRisk(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="risk_check" className="text-xs text-muted-foreground font-semibold cursor-pointer">
                  Je comprends que cette action est destructrice et définitive.
                </label>
              </div>

              <DialogFooter className="pt-4 border-t gap-2">
                <Button variant="outline" onClick={() => setTransitionOpen(false)} className="rounded-xl h-10">Annuler</Button>
                <Button 
                  disabled={!understandRisk} 
                  onClick={() => setTransitionStep(2)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl h-10"
                >
                  Continuer
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Double confirmation typing check */}
          {transitionStep === 2 && (
            <div className="space-y-4 py-2 animate-fade-in">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Veuillez saisir le mot <strong className="text-foreground">TRANSITION</strong> en majuscules pour confirmer le lancement du processus.
              </p>
              <Input 
                placeholder="Saisir TRANSITION..." 
                value={confirmText} 
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())} 
                className="h-11 rounded-xl text-center font-bold tracking-widest bg-muted/30 focus:ring-2 focus:ring-red-500/20 uppercase"
              />

              <DialogFooter className="pt-4 border-t gap-2">
                <Button variant="outline" onClick={() => setTransitionStep(1)} className="rounded-xl h-10">Retour</Button>
                <Button 
                  disabled={confirmText !== 'TRANSITION'} 
                  onClick={runTransitionProcess}
                  className="bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold rounded-xl h-10"
                >
                  Démarrer la transition
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 3: Progress indicators */}
          {transitionStep === 3 && (
            <div className="space-y-4 py-6 text-center animate-fade-in">
              <Loader2 className="w-10 h-10 animate-spin text-red-500 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold">{transitionProgress}% complété</p>
                <p className="text-xs text-muted-foreground">{transitionStatusMsg}</p>
              </div>
              <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-red-500 to-orange-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${transitionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Finished success message */}
          {transitionStep === 4 && (
            <div className="space-y-4 py-4 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-base text-foreground">Opération réussie !</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                L'année scolaire a été clôturée et tous les élèves ont été transitionnés vers leurs niveaux correspondants.
              </p>
              <DialogFooter className="pt-4 border-t">
                <Button onClick={() => setTransitionOpen(false)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10">Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
