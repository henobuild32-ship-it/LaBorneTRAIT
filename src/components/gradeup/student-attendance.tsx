'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import type { AttendanceInfo } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CalendarCheck, CalendarX, Clock, Calendar, Filter, UserCheck, UserX, AlertTriangle,
} from 'lucide-react';

export default function StudentAttendance() {
  const user = useAppStore((s) => s.user);
  const [attendance, setAttendance] = useState<AttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  useEffect(() => {
    if (!user?.schoolId || !user?.id) return;
    const fetchAttendance = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/attendance?schoolId=${user.schoolId}&studentId=${user.id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const sorted = (Array.isArray(data.attendance) ? data.attendance : []).sort((a: AttendanceInfo, b: AttendanceInfo) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setAttendance(sorted);
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchAttendance();
  }, [user?.schoolId, user?.id]);

  const months = useMemo(() => {
    const monthSet = new Set<string>();
    attendance.forEach((a) => { const d = new Date(a.date); monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); });
    return Array.from(monthSet).sort().reverse();
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    if (selectedMonth === 'all') return attendance;
    return attendance.filter((a) => { const d = new Date(a.date); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return key === selectedMonth; });
  }, [attendance, selectedMonth]);

  const totalPresent = attendance.filter((a) => a.status === 'present').length;
  const totalAbsent = attendance.filter((a) => a.status === 'absent').length;
  const totalLate = attendance.filter((a) => a.status === 'late').length;
  const total = attendance.length;
  const presenceRate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

  // Generate last 30 days
  const last30Days = useMemo<Date[]>(() => {
    const days: Date[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present': return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Présent</Badge>;
      case 'absent': return <Badge className="bg-red-50 text-red-700 border-red-200">Absent</Badge>;
      case 'late': return <Badge className="bg-amber-50 text-amber-700 border-amber-200">En retard</Badge>;
      case 'justified': return <Badge className="bg-purple-50 text-purple-700 border-purple-200">Justifié</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  const getMonthLabel = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Ma présence</h1>
        <p className="text-sm text-muted-foreground mt-1">Historique de vos présences et absences</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50"><CalendarCheck className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xl font-bold text-blue-600">{presenceRate}%</p>
              <CardDescription className="text-[10px]">Présence</CardDescription>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{totalPresent}</p>
              <CardDescription className="text-[10px]">Présent(s)</CardDescription>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"><UserX className="h-5 w-5 text-red-600" /></div>
            <div>
              <p className="text-xl font-bold text-red-600">{totalAbsent}</p>
              <CardDescription className="text-[10px]">Absent(s)</CardDescription>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xl font-bold text-amber-600">{totalLate}</p>
              <CardDescription className="text-[10px]">Retard(s)</CardDescription>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* iOS style scrollable calendar strip */}
      <div>
        <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">📅 Aperçu 30 derniers jours</h3>
        <div className="flex gap-2 overflow-x-auto pb-4 no-swipe scrollbar-none px-1">
          {last30Days.map((day, idx) => {
            const dateStr = day.toISOString().split('T')[0];
            const record = attendance.find(a => a.date.startsWith(dateStr));
            const isToday = new Date().toDateString() === day.toDateString();
            
            let statusDot = <div className="h-1.5 w-1.5 rounded-full bg-transparent mt-1" />;
            if (record) {
              if (record.status === 'present') statusDot = <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1" />;
              else if (record.status === 'late') statusDot = <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1" />;
              else if (record.status === 'absent') statusDot = <div className="h-1.5 w-1.5 rounded-full bg-red-500 mt-1" />;
              else if (record.status === 'justified') statusDot = <div className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1" />;
            }
            
            const dayName = day.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3);
            const dayNum = day.getDate();
            
            return (
              <div 
                key={idx} 
                className={`flex flex-col items-center justify-center p-3 rounded-2xl min-w-[55px] border transition-all duration-200 ${
                  isToday 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' 
                    : 'bg-card border-border'
                }`}
              >
                <span className={`text-[10px] uppercase font-bold ${isToday ? 'text-blue-100' : 'text-muted-foreground'}`}>{dayName}</span>
                <span className="text-base font-bold mt-1">{dayNum}</span>
                {statusDot}
              </div>
            );
          })}
        </div>
      </div>

      {/* Month filter */}
      {months.length > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-52 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"><SelectValue placeholder="Tous les mois" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les mois</SelectItem>
              {months.map((m) => <SelectItem key={m} value={m}>{getMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Attendance details list */}
      {filteredAttendance.length === 0 ? (
        <div className="text-center py-20">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4"><Calendar className="h-12 w-12 text-muted-foreground/50" /></div>
          <h3 className="text-xl font-semibold mb-2">Aucun enregistrement</h3>
          <p className="text-muted-foreground">Aucune donnée de présence disponible.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredAttendance.map((record) => (
            <div 
              key={record.id} 
              className="flex items-center justify-between p-4 rounded-xl bg-card border shadow-sm transition-all duration-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  record.status === 'present' ? 'bg-emerald-50 text-emerald-600' :
                  record.status === 'late' ? 'bg-amber-50 text-amber-600' :
                  record.status === 'justified' ? 'bg-purple-50 text-purple-600' : 'bg-red-50 text-red-600'
                }`}>
                  {record.status === 'present' ? <UserCheck className="w-5 h-5" /> :
                   record.status === 'late' ? <Clock className="w-5 h-5" /> :
                   record.status === 'justified' ? <CalendarCheck className="w-5 h-5" /> : <UserX className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{formatDate(record.date)}</p>
                  {record.reason ? (
                    <p className="text-xs text-muted-foreground mt-0.5">Motif : {record.reason}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/50 mt-0.5">Aucun motif spécifié</p>
                  )}
                </div>
              </div>
              <div>
                {getStatusBadge(record.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
