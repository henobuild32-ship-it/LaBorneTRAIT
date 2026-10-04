'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { UserInfo, GradeInfo, PaymentInfo, AttendanceInfo, NotificationInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import WeeklyScheduleView from './weekly-schedule-view';
import ParentPresence from './parent-presence';
import SectionPanel from './section-panel';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp,
  BookOpen,
  CalendarX,
  CreditCard,
  Bell,
  GraduationCap,
  Users,
  Clock,
  MessageSquare,
  Send,
  Shield,
  Heart,
  Link2,
  Loader2,
  Plus,
  XCircle,
  Check,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ParentDashboard() {
  const { user, setCurrentPage } = useAppStore();
  const [children, setChildren] = useState<UserInfo[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState(0);
  const [grades, setGrades] = useState<GradeInfo[]>([]);
  const [attendance, setAttendance] = useState<AttendanceInfo[]>([]);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [notifications, setNotifications] = useState<NotificationInfo[]>([]);
  const [childPresence, setChildPresence] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [childHomework, setChildHomework] = useState<any[]>([]);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [parentCodeInput, setParentCodeInput] = useState('');
  const [linking, setLinking] = useState(false);

  // Live code validation states
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validatedStudentName, setValidatedStudentName] = useState('');

  const [childTouchStart, setChildTouchStart] = useState<number | null>(null);

  const safeChildren = Array.isArray(children) ? children : [];
  const selectedChild = safeChildren[selectedChildIndex] || null;
  const schoolId = user?.schoolId || '';

  useEffect(() => {
    fetchChildren();
    const interval = setInterval(fetchChildren, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (selectedChild) {
      fetchChildData(selectedChild.id);
    }
  }, [selectedChild]);

  useEffect(() => {
    if (schoolId) {
      fetchNotifications();
    }
  }, [schoolId]);

  const fetchChildren = async () => {
    if (!user?.id || !schoolId) return;
    try {
      const res = await fetch('/api/parent/children');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.children) ? data.children : [];
        setChildren(list);
        // Fetch presence for all children
        fetchAllPresence(list);
      }
    } catch {
      toast.error('Erreur lors du chargement des enfants');
    }
  };

  const fetchAllPresence = async (childrenList: Array<{ id: string; school?: { id: string } }>) => {
    const results: Record<string, boolean> = {};
    for (const child of childrenList) {
      try {
        const childSchoolId = child.school?.id || schoolId;
        const res = await fetch(`/api/presence/aujourdhui?schoolId=${childSchoolId}&userId=${child.id}`);
        if (res.ok) {
          const data = await res.json();
          results[child.id] = data.presence?.statut === 'PRESENT';
        }
      } catch { /* silent */ }
    }
    setChildPresence(results);
  };

  const fetchChildData = async (childId: string) => {
    setLoading(true);
    try {
      const child = safeChildren.find(c => c.id === childId);
      const childSchoolId = (child as UserInfo & { school?: { id: string } })?.school?.id || schoolId;
      const classId = child?.classEnrollments?.[0]?.classId;

      const [gradesRes, attendanceRes, paymentsRes] = await Promise.all([
        fetch(`/api/grades?schoolId=${childSchoolId}&studentId=${childId}`),
        fetch(`/api/attendance?schoolId=${childSchoolId}&studentId=${childId}`),
        fetch(`/api/payments?schoolId=${childSchoolId}&studentId=${childId}`),
      ]);

      if (gradesRes.ok) {
        const d = await gradesRes.json();
        setGrades(Array.isArray(d) ? d : (Array.isArray(d?.grades) ? d.grades : []));
      }
      if (attendanceRes.ok) {
        const d = await attendanceRes.json();
        setAttendance(Array.isArray(d) ? d : (Array.isArray(d?.attendance) ? d.attendance : []));
      }
      if (paymentsRes.ok) {
        const d = await paymentsRes.json();
        setPayments(Array.isArray(d) ? d : (Array.isArray(d?.payments) ? d.payments : []));
      }

      if (classId) {
        const hwRes = await fetch(`/api/homework?schoolId=${childSchoolId}&classId=${classId}`);
        if (hwRes.ok) {
          const hwData = await hwRes.json();
          setChildHomework(Array.isArray(hwData.homework) ? hwData.homework : []);
        }
      }
    } catch {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?schoolId=${schoolId}&targetRole=PARENT`);
      if (res.ok) {
        const d = await res.json();
        setNotifications(Array.isArray(d) ? d : (Array.isArray(d?.notifications) ? d.notifications : []));
      }
    } catch { /* silent */ }
  };

  const handleLinkChild = async () => {
    const code = parentCodeInput.trim().toUpperCase();
    if (!code) {
      toast.error('Veuillez entrer un code parent');
      return;
    }
    setLinking(true);
    try {
      const res = await fetch('/api/parent-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentCode: code, parentUserId: user!.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${data.student.fullName} a été ajouté à votre suivi`);
        setParentCodeInput('');
        setValidationState('idle');
        setLinkDialogOpen(false);
        await fetchChildren();
      } else {
        toast.error(data.error || 'Erreur lors de l\'ajout');
      }
    } catch {
      toast.error('Erreur lors de la liaison');
    } finally {
      setLinking(false);
    }
  };

  // Real-time parent code formatter & validation hook
  const handleCodeChange = async (val: string) => {
    let formatted = val.toUpperCase();
    
    // Auto convert user input: if user types a letter, try to format P-XXXXXX
    if (formatted.length > 0 && !formatted.startsWith('P-')) {
      if (formatted.startsWith('P')) {
        formatted = 'P-' + formatted.substring(1);
      } else {
        formatted = 'P-' + formatted;
      }
    }

    if (formatted.length > 8) {
      formatted = formatted.substring(0, 8);
    }

    setParentCodeInput(formatted);

    // If fully formed P-XXXXXX (8 chars), validate live
    if (formatted.match(/^P-[A-Z0-9]{6}$/)) {
      setValidationState('validating');
      try {
        const res = await fetch(`/api/parent-link/validate?parentCode=${formatted}`);
        const data = await res.json();
        if (data.valid) {
          setValidationState('valid');
          setValidatedStudentName(data.studentName);
        } else {
          setValidationState('invalid');
        }
      } catch {
        setValidationState('invalid');
      }
    } else {
      setValidationState('idle');
      setValidatedStudentName('');
    }
  };

  // Swipe gesture handlers for Stories switcher
  const handleTouchStart = (e: React.TouchEvent) => {
    setChildTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (childTouchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = childTouchStart - touchEnd;
    if (diff > 50) {
      // swipe left -> next child
      setSelectedChildIndex(prev => Math.min(prev + 1, safeChildren.length - 1));
    } else if (diff < -50) {
      // swipe right -> prev child
      setSelectedChildIndex(prev => Math.max(prev - 1, 0));
    }
    setChildTouchStart(null);
  };

  const safeGrades = Array.isArray(grades) ? grades : [];
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  // Moyenne générale pondérée par cours avec coefficients effectifs (cohérente avec le bulletin)
  const courseMap = new Map<string, { coeff: number; sum: number; count: number }>();
  for (const g of safeGrades) {
    const coeff = g.effectiveCoefficient ?? g.course?.coefficient ?? 1;
    const entry = courseMap.get(g.courseId) || { coeff, sum: 0, count: 0 };
    entry.sum += g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0;
    entry.count += 1;
    entry.coeff = coeff;
    courseMap.set(g.courseId, entry);
  }
  const courseEntries = [...courseMap.values()].map((e) => ({ avg: e.sum / e.count, coeff: e.coeff }));
  const totalWeight = courseEntries.reduce((s, e) => s + e.coeff, 0);

  const average = safeGrades.length > 0 && totalWeight > 0
    ? courseEntries.reduce((s, e) => s + e.avg * e.coeff, 0) / totalWeight
    : 0;

  const absences = safeAttendance.filter(a => a.status === 'absent').length;
  const pendingPayments = safePayments.filter(p => p.status === 'pending' || p.status === 'overdue').length;

  const childClass = selectedChild?.classEnrollments?.[0]?.class?.name || 'Non assigné';
  const courseCount = [...new Set(safeGrades.map(g => g.courseId))].length;
  const recentGrades = [...safeGrades].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const recentNotifications = [...safeNotifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getGradeColor = (score: number, max: number) => {
    const pct = (score / max) * 100;
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getAverageProgressColor = (avg: number) => {
    if (avg >= 14) return 'from-emerald-400 to-emerald-500';
    if (avg >= 10) return 'from-amber-400 to-amber-500';
    return 'from-red-400 to-red-500';
  };

  const getAverageBgColor = (avg: number) => {
    if (avg >= 14) return 'bg-emerald-50';
    if (avg >= 10) return 'bg-amber-50';
    return 'bg-red-50';
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/15 backdrop-blur-sm">
            <Heart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl lg:text-3xl font-bold">
              Bienvenue, {user.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-blue-100 text-xs lg:text-sm mt-0.5">
              Suivez la scolarité de vos enfants en toute simplicité
            </p>
          </div>
        </div>
      </div>

      {safeChildren.length === 0 ? (
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="p-4 rounded-full bg-blue-50">
              <Users className="h-12 w-12 text-blue-300" />
            </div>
            <p className="text-muted-foreground text-center max-w-sm text-sm">
              Aucun enfant lié à votre compte pour le moment.
            </p>
            <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 mt-2 rounded-xl h-11 px-6 text-white font-bold">
                  <Plus className="h-4 w-4 mr-2" />
                  Lier mon enfant
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-blue-600" />
                    Lier un enfant
                  </DialogTitle>
                  <DialogDescription>
                    Entrez le code de parrainage unique de votre enfant (ex: P-ABCDEF) pour le lier.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code Parent</Label>
                    <Input
                      placeholder="P-XXXXXX"
                      value={parentCodeInput}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className="uppercase tracking-wider font-mono h-11 rounded-xl bg-muted/30 focus:ring-2 focus:ring-blue-500/20"
                      onKeyDown={(e) => { if (e.key === 'Enter' && validationState === 'valid') handleLinkChild(); }}
                    />
                  </div>

                  {/* Validation State Helpers */}
                  {validationState === 'validating' && (
                    <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Vérification du code...
                    </div>
                  )}
                  {validationState === 'valid' && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <Check className="w-4 h-4" />
                      Élève trouvé : {validatedStudentName}
                    </div>
                  )}
                  {validationState === 'invalid' && (
                    <div className="flex items-center gap-2 text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
                      <XCircle className="w-4 h-4" />
                      Code incorrect ou élève introuvable.
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => { setLinkDialogOpen(false); setParentCodeInput(''); setValidationState('idle'); }}
                      className="rounded-xl h-10"
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleLinkChild}
                      disabled={linking || validationState !== 'valid'}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-10"
                    >
                      {linking ? 'Ajout...' : 'Confirmer la liaison'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stories style circular child selector */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="flex items-center gap-5 overflow-x-auto py-2 px-1 scrollbar-none no-swipe"
          >
            {safeChildren.map((child, idx) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildIndex(idx)}
                className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0"
              >
                <div className={`rounded-full p-[2.5px] transition-all duration-300 relative ${
                  selectedChildIndex === idx 
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 ring-2 ring-blue-500/20' 
                    : 'bg-transparent'
                }`}>
                  {childPresence[child.id] && (
                    <span className="absolute -top-0.5 -right-0.5 size-4 bg-emerald-500 border-2 border-background rounded-full flex items-center justify-center z-10">
                      <CheckCircle2 className="size-2.5 text-white" />
                    </span>
                  )}
                  <Avatar className="size-14 ring-2 ring-background shadow-md">
                    <AvatarImage src={child.photoUrl} alt={child.fullName} />
                    <AvatarFallback className="text-sm bg-muted text-foreground font-bold">
                      {child.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span className={`text-xs font-bold ${
                  selectedChildIndex === idx ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                }`}>
                  {child.fullName.split(' ')[0]}
                </span>
              </button>
            ))}

            {/* Add Child Stories Icon */}
            <button
              onClick={() => { setParentCodeInput(''); setValidationState('idle'); setLinkDialogOpen(true); }}
              className="flex flex-col items-center gap-1.5 focus:outline-none shrink-0"
            >
              <div className="size-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/10 hover:bg-muted/30 transition-colors">
                <Plus className="w-5 h-5 text-muted-foreground" />
              </div>
              <span className="text-xs font-bold text-muted-foreground">Ajouter</span>
            </button>
          </div>

          {/* Child Link Dialog for story block */}
          <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-blue-600" />
                  Lier un enfant
                </DialogTitle>
                <DialogDescription>
                  Entrez le code de parrainage unique de votre enfant (ex: P-ABCDEF) pour le lier.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Code Parent</Label>
                  <Input
                    placeholder="P-XXXXXX"
                    value={parentCodeInput}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    className="uppercase tracking-wider font-mono h-11 rounded-xl bg-muted/30 focus:ring-2 focus:ring-blue-500/20"
                    onKeyDown={(e) => { if (e.key === 'Enter' && validationState === 'valid') handleLinkChild(); }}
                  />
                </div>

                {/* Validation State Helpers */}
                {validationState === 'validating' && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 animate-pulse font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Vérification du code...
                  </div>
                )}
                {validationState === 'valid' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <Check className="w-4 h-4" />
                    Élève trouvé : {validatedStudentName}
                  </div>
                )}
                {validationState === 'invalid' && (
                  <div className="flex items-center gap-2 text-xs text-red-500 font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
                    <XCircle className="w-4 h-4" />
                    Code incorrect ou élève introuvable.
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => { setLinkDialogOpen(false); setParentCodeInput(''); setValidationState('idle'); }}
                    className="rounded-xl h-10"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleLinkChild}
                    disabled={linking || validationState !== 'valid'}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-10"
                  >
                    {linking ? 'Ajout...' : 'Confirmer la liaison'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Sleek iOS Segmented Control Tabs */}
          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid grid-cols-6 bg-muted/50 p-1 rounded-xl h-11 mb-6">
              <TabsTrigger value="today" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Aujourd'hui</TabsTrigger>
              <TabsTrigger value="notes" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Notes</TabsTrigger>
              <TabsTrigger value="homework" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Devoirs</TabsTrigger>
              <TabsTrigger value="absences" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Absences</TabsTrigger>
              <TabsTrigger value="presence" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Présence</TabsTrigger>
              <TabsTrigger value="finances" className="rounded-lg text-xs font-bold py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">Finances</TabsTrigger>
            </TabsList>

            {/* TAB 1: Aujourd'hui */}
            <TabsContent value="today" className="space-y-6 focus:outline-none">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="p-4 shadow-sm border border-border bg-card">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-muted-foreground truncate">Moyenne</span>
                    <TrendingUp className="size-4 text-blue-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{average.toFixed(1)}/20</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">Moyenne générale</p>
                </Card>

                <Card className="p-4 shadow-sm border border-border bg-card">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-muted-foreground truncate">Cours</span>
                    <BookOpen className="size-4 text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold mt-2">{courseCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">Matières suivies</p>
                </Card>

                <Card className="p-4 shadow-sm border border-border bg-card">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-muted-foreground truncate">Absences</span>
                    <CalendarX className="size-4 text-red-500 shrink-0" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 mt-2">{absences}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">Jours d'absence</p>
                </Card>

                <Card className="p-4 shadow-sm border border-border bg-card">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold text-muted-foreground truncate">Paiements</span>
                    <CreditCard className="size-4 text-amber-500 shrink-0" />
                  </div>
                  <p className={`text-xl font-bold mt-2.5 ${pendingPayments > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {pendingPayments > 0 ? `${pendingPayments} en attente` : 'À jour'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">Statut financier</p>
                </Card>
              </div>

              {/* Section repliable : détails du jour */}
              <SectionPanel
                title="Détails du jour"
                description="Notes, notifications, emploi du temps et contacts"
                icon={<Clock className="h-4 w-4" />}
                defaultOpen={false}
              >
              {/* Recent lists */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle className="text-sm font-bold">Notes récentes</CardTitle></CardHeader>
                  <CardContent>
                    {recentGrades.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">Aucune note récente.</p>
                    ) : (
                      <div className="space-y-2">
                        {recentGrades.map(g => (
                          <div key={g.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-xl text-xs">
                            <span className="font-semibold">{g.course?.name}</span>
                            <span className="font-bold text-blue-600">{g.score}/{g.maxScore}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle className="text-sm font-bold">Notifications</CardTitle></CardHeader>
                  <CardContent>
                    {recentNotifications.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-6 text-center">Aucune notification.</p>
                    ) : (
                      <div className="space-y-2">
                        {recentNotifications.map(n => (
                          <div key={n.id} className="p-3 bg-muted/20 rounded-xl text-xs flex gap-2">
                            <div className="size-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                            <p className="text-muted-foreground">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Emploi du temps de l'enfant */}
              {user?.schoolId && selectedChild?.classEnrollments?.[0]?.classId && (
                <WeeklyScheduleView
                  schoolId={user.schoolId}
                  classId={selectedChild.classEnrollments[0].classId}
                  classNameLabel={childClass}
                />
              )}

              {/* Communication Cards */}
              <Card>

                <CardHeader>
                  <CardTitle className="text-base font-bold">Contacter l'établissement</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-12 rounded-xl flex items-center justify-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => setCurrentPage('messages')}>
                    <GraduationCap className="w-4 h-4" /> Professeurs
                  </Button>
                  <Button variant="outline" className="h-12 rounded-xl flex items-center justify-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setCurrentPage('messages')}>
                    <Shield className="w-4 h-4" /> Administration
                  </Button>
                </CardContent>
              </Card>
              </SectionPanel>
            </TabsContent>

            {/* TAB 2: Notes */}
            <TabsContent value="notes" className="space-y-4 focus:outline-none">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold">Détail des notes de {selectedChild?.fullName}</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {safeGrades.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-12 text-center">Aucune note enregistrée.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table className="text-xs min-w-[500px]">
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead className="pl-4">Cours</TableHead>
                            <TableHead className="text-center">Note</TableHead>
                            <TableHead className="text-center">Note max</TableHead>
                            <TableHead>Commentaire</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {safeGrades.map((grade) => (
                            <TableRow key={grade.id} className="hover:bg-muted/10">
                              <TableCell className="pl-4 font-bold">{grade.course?.name}</TableCell>
                              <TableCell className="text-center font-bold text-blue-600">{grade.score}</TableCell>
                              <TableCell className="text-center text-muted-foreground">{grade.maxScore}</TableCell>
                              <TableCell className="italic text-muted-foreground">{grade.comment || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: Devoirs */}
            <TabsContent value="homework" className="space-y-4 focus:outline-none">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold">Devoirs de {selectedChild?.fullName}</CardTitle></CardHeader>
                <CardContent>
                  {childHomework.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-12 text-center">Aucun devoir pour le moment.</p>
                  ) : (
                    <div className="space-y-3">
                      {childHomework.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map((hw: any) => {
                        const daysLeft = Math.ceil((new Date(hw.dueDate).getTime() - Date.now()) / 86400000);
                        return (
                          <div key={hw.id} className={'p-4 rounded-xl border text-sm ' + (daysLeft < 0 ? 'bg-red-50 border-red-200' : daysLeft <= 3 ? 'bg-amber-50 border-amber-200' : 'bg-muted/10 border-border')}>
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-bold">{hw.title}</p>
                              <Badge className={'text-[10px] ' + (daysLeft < 0 ? 'bg-red-100 text-red-700 border-red-200' : daysLeft <= 3 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200')}>
                                {daysLeft < 0 ? 'Expiré' : daysLeft === 0 ? "Aujourd'hui" : daysLeft + ' jour(s)'}
                              </Badge>
                            </div>
                            {hw.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{hw.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">Matière : {hw.course?.name || '—'}</p>
                            <p className="text-xs text-muted-foreground">À rendre le : {new Date(hw.dueDate).toLocaleDateString('fr-FR')}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: Absences */}
            <TabsContent value="absences" className="space-y-4 focus:outline-none">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold">Suivi des absences & retards</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {safeAttendance.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-12 text-center">Aucun événement de présence enregistré.</p>
                  ) : (
                    <div className="divide-y">
                      {safeAttendance.map((record) => (
                        <div key={record.id} className="flex justify-between items-center p-4">
                          <div>
                            <p className="font-semibold text-xs text-foreground">{formatDate(record.date)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Motif : {record.reason || 'Non justifié'}</p>
                          </div>
                          <div>
                            {record.status === 'present' && <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-100">Présent</Badge>}
                            {record.status === 'absent' && <Badge className="bg-red-50 text-red-700 border border-red-100">Absent</Badge>}
                            {record.status === 'late' && <Badge className="bg-amber-50 text-amber-700 border border-amber-100">En retard</Badge>}
                            {record.status === 'justified' && <Badge className="bg-purple-50 text-purple-700 border border-purple-100">Justifié</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: Présence */}
            <TabsContent value="presence" className="space-y-4 focus:outline-none">
              <ParentPresence />
            </TabsContent>

            {/* TAB 5: Finances */}
            <TabsContent value="finances" className="space-y-4 focus:outline-none">
              <Card>
                <CardHeader><CardTitle className="text-sm font-bold">Suivi des paiements & frais</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {safePayments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-12 text-center">Aucun paiement enregistré.</p>
                  ) : (
                    <div className="divide-y">
                      {safePayments.map((pay) => (
                        <div key={pay.id} className="flex justify-between items-center p-4">
                          <div>
                            <p className="font-bold text-xs text-foreground">{pay.month}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Montant : {pay.amount.toFixed(2)} FCFA</p>
                          </div>
                          <div>
                            {/* Color codes: Paid = green, Pending = orange, Overdue = red */}
                            {pay.status === 'paid' && (
                              <Badge className="bg-green-50 text-green-700 border border-green-200">🟢 Payé</Badge>
                            )}
                            {pay.status === 'pending' && (
                              <Badge className="bg-orange-50 text-orange-700 border border-orange-200">🟠 En attente</Badge>
                            )}
                            {pay.status === 'overdue' && (
                              <Badge className="bg-red-50 text-red-700 border border-red-200">🔴 En retard</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
