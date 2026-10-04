'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, Clock, Save, Users, Calendar, History, UserCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { fetchJsonWithCache, queueOrFetch } from '@/lib/offline-sync';
import type { UserInfo, AttendanceInfo, CourseInfo, AttendanceStatus } from '@/lib/types';

interface StudentAttendance {
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  reason: string;
  existingId?: string;
}

export default function TeacherAttendance() {
  const { user } = useAppStore();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [students, setStudents] = useState<UserInfo[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendance[]>([]);
  const [history, setHistory] = useState<AttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { if (!user) return; fetchCourses(); }, [user]);

  const fetchCourses = async () => {
    if (!user) return;
    try {
      const data = await fetchJsonWithCache(`/api/courses?schoolId=${user.schoolId}&teacherId=${user.id}`, { courses: [] });
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch { /* silent */ }
  };

  useEffect(() => { if (!user || !selectedCourseId) return; fetchStudentsAndAttendance(); }, [user, selectedCourseId, selectedDate]);

  const fetchStudentsAndAttendance = async () => {
    if (!user || !selectedCourseId) return;
    setLoading(true);
    try {
      const course = courses.find((c) => c.id === selectedCourseId);
      if (!course) return;
      const studentsData = await fetchJsonWithCache(`/api/users?schoolId=${user.schoolId}&role=STUDENT&classId=${course.classId}`, { users: [] });
      const attendanceData = await fetchJsonWithCache(`/api/attendance?schoolId=${user.schoolId}&date=${selectedDate}&courseId=${selectedCourseId}`, { attendance: [] });
      const studentsList = Array.isArray(studentsData.users) ? studentsData.users : (Array.isArray(studentsData) ? studentsData : []);
      const attendanceList = Array.isArray(attendanceData.attendance) ? attendanceData.attendance : (Array.isArray(attendanceData) ? attendanceData : []);
      const mergedAttendance: StudentAttendance[] = studentsList.map((student: UserInfo) => {
        const existing = attendanceList.find((a: AttendanceInfo) => a.studentId === student.id);
        return { studentId: student.id, studentName: student.fullName, status: existing?.status || 'present', reason: existing?.reason || '', existingId: existing?.id };
      });
      setStudents(studentsList);
      setAttendance(mergedAttendance);
    } catch { toast.error('Erreur lors du chargement'); } finally { setLoading(false); }
  };

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setAttendance((prev) => prev.map((a) => a.studentId === studentId ? { ...a, status } : a));
  };

  const updateReason = (studentId: string, reason: string) => {
    setAttendance((prev) => prev.map((a) => a.studentId === studentId ? { ...a, reason } : a));
  };

  const handleSave = async () => {
    if (!user || !selectedCourseId) return;
    setSaving(true);
    try {
      const records = attendance.map((r) => ({ studentId: r.studentId, status: r.status, reason: r.reason }));
      const res = await queueOrFetch('/api/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolId: user.schoolId, courseId: selectedCourseId, teacherId: user.id, date: selectedDate, records }),
      });
      if (!res) {
        toast.info('Présences enregistrées hors ligne. Synchronisation au retour du réseau.');
        return;
      }
      if (!res.ok) { toast.error("Erreur lors de l'enregistrement"); return; }
      toast.success('Appel enregistré avec succès');
      fetchStudentsAndAttendance();
    } catch { toast.error("Erreur lors de l'enregistrement"); } finally { setSaving(false); }
  };

  const markAllPresent = () => {
    setAttendance((prev) => prev.map((a) => ({ ...a, status: 'present', reason: '' })));
  };

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams({ schoolId: user.schoolId });
      if (selectedCourseId) params.set('courseId', selectedCourseId);
      const res = await fetch(`/api/attendance?${params}`);
      const data = await res.json();
      setHistory((Array.isArray(data.attendance) ? data.attendance : []).filter((a: AttendanceInfo) => a.teacherId === user.id).sort((a: AttendanceInfo, b: AttendanceInfo) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50));
    } catch { /* silent */ }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present': return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Présent</Badge>;
      case 'absent': return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>;
      case 'late': return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><Clock className="h-3 w-3 mr-1" />En retard</Badge>;
      case 'justified': return <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs"><ShieldCheck className="h-3 w-3 mr-1" />Justifié</Badge>;
    }
  };

  const getStats = () => {
    const present = attendance.filter((a) => a.status === 'present').length;
    const absent = attendance.filter((a) => a.status === 'absent').length;
    const late = attendance.filter((a) => a.status === 'late').length;
    const justified = attendance.filter((a) => a.status === 'justified').length;
    return { present, absent, late, justified, total: attendance.length };
  };

  const stats = getStats();

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      {/* Page Header */}
      <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6">
        <h1 className="text-2xl font-bold">Appel</h1>
        <p className="text-sm text-muted-foreground mt-1">Enregistrez la présence de vos élèves</p>
      </div>

      <Tabs defaultValue="register">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 gap-6">
          <TabsTrigger value="register" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-sm font-semibold gap-1.5"><Users className="h-4 w-4" />Appel du jour</TabsTrigger>
          <TabsTrigger value="history" className="data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-1 py-3 text-sm font-semibold gap-1.5" onClick={fetchHistory}><History className="h-4 w-4" />Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="register" className="mt-4">
          {/* Controls */}
          <Card className="mb-6 shadow-sm border border-border bg-card">
            <CardContent className="flex items-center gap-4 flex-wrap py-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all rounded-lg" />
              </div>
              
              {/* Native iOS class select spinner */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-56 h-10 border border-input rounded-lg px-3 bg-background text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer font-medium"
                >
                  <option value="">Sélectionner une classe</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.class?.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Stats Row */}
          {selectedCourseId && attendance.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <div className="p-4 rounded-xl bg-blue-50 text-center border border-blue-100 dark:bg-blue-950/20">
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
                <p className="text-xs text-blue-600/80 font-medium">Total</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 text-center border border-emerald-100 dark:bg-emerald-950/20">
                <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
                <p className="text-xs text-emerald-600/80 font-medium">Présents</p>
              </div>
              <div className="p-4 rounded-xl bg-red-50 text-center border border-red-100 dark:bg-red-950/20">
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
                <p className="text-xs text-red-600/80 font-medium">Absents</p>
              </div>
              <div className="p-4 rounded-xl bg-purple-50 text-center border border-purple-100 dark:bg-purple-950/20">
                <p className="text-2xl font-bold text-purple-600">{stats.justified}</p>
                <p className="text-xs text-purple-600/80 font-medium">Justifiés</p>
              </div>
              <div className="p-4 rounded-xl bg-amber-50 text-center border border-amber-100 dark:bg-amber-950/20">
                <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
                <p className="text-xs text-amber-600/80 font-medium">En retard</p>
              </div>
            </div>
          )}

          {/* Student List */}
          {!selectedCourseId ? (
            <Card className="shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"><Users className="h-10 w-10 text-muted-foreground/50" /></div>
              <p className="text-muted-foreground">Sélectionnez une classe pour commencer l&apos;appel</p>
            </CardContent></Card>
          ) : loading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}</div>
          ) : attendance.length === 0 ? (
            <Card className="shadow-sm"><CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"><UserCheck className="h-10 w-10 text-muted-foreground/50" /></div>
              <p className="text-muted-foreground">Aucun élève dans cette classe</p>
            </CardContent></Card>
          ) : (
            <Card className="shadow-sm border border-border">
              <div className="divide-y">
                {attendance.map((record) => (
                  <div key={record.studentId} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors ${record.status === 'absent' ? 'bg-red-50/30' : record.status === 'late' ? 'bg-amber-50/30' : record.status === 'justified' ? 'bg-purple-50/30' : 'hover:bg-muted/10'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${record.status === 'present' ? 'bg-emerald-500' : record.status === 'absent' ? 'bg-red-500' : record.status === 'justified' ? 'bg-purple-500' : 'bg-amber-500'}`}>
                          {record.studentName.charAt(0)}
                        </div>
                        <p className="font-semibold text-sm text-foreground">{record.studentName}</p>
                      </div>
                      {record.status !== 'present' && (
                        <Input placeholder="Raison de l'absence ou du retard..." className="mt-2 h-9 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all rounded-lg bg-background" value={record.reason} onChange={(e) => updateReason(record.studentId, e.target.value)} />
                      )}
                    </div>
                    
                    {/* Big Touch-Friendly Buttons (>= 44px height & width) */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <Button 
                        type="button" 
                        size="icon" 
                        variant={record.status === 'present' ? 'default' : 'outline'} 
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'present' 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/25' 
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`} 
                        onClick={() => updateStatus(record.studentId, 'present')}
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </Button>
                      <Button 
                        type="button" 
                        size="icon" 
                        variant={record.status === 'absent' ? 'default' : 'outline'} 
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'absent' 
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/25' 
                            : 'border-red-200 text-red-700 hover:bg-red-50'
                        }`} 
                        onClick={() => updateStatus(record.studentId, 'absent')}
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                      <Button 
                        type="button" 
                        size="icon" 
                        variant={record.status === 'late' ? 'default' : 'outline'} 
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'late' 
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/25' 
                            : 'border-amber-200 text-amber-700 hover:bg-amber-50'
                        }`} 
                        onClick={() => updateStatus(record.studentId, 'late')}
                      >
                        <Clock className="h-5 w-5" />
                      </Button>
                      <Button 
                        type="button" 
                        size="icon" 
                        variant={record.status === 'justified' ? 'default' : 'outline'} 
                        className={`h-11 w-11 rounded-xl transition-all hover:scale-[1.05] active:scale-[0.95] ${
                          record.status === 'justified' 
                            ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-md shadow-purple-500/25' 
                            : 'border-purple-200 text-purple-700 hover:bg-purple-50'
                        }`} 
                        onClick={() => updateStatus(record.studentId, 'justified')}
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Sticky iOS-style Batch Save Footer */}
          {selectedCourseId && attendance.length > 0 && (
            <div className="fixed bottom-16 lg:bottom-4 left-0 lg:left-auto right-0 lg:right-4 z-30 p-4 lg:p-0 bg-background/95 backdrop-blur-md lg:bg-transparent border-t lg:border-none flex justify-center gap-3">
              <Button 
                variant="outline" 
                onClick={markAllPresent} 
                className="flex-1 lg:flex-none border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-12 lg:h-10 rounded-xl font-medium"
              >
                Tous présents
              </Button>
              <Button 
                className="flex-1 lg:flex-none bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 h-12 lg:h-10 rounded-xl text-white font-bold shadow-lg" 
                onClick={handleSave} 
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-1.5 inline-block" />
                {saving ? 'Enregistrement...' : 'Enregistrer appel'}
              </Button>
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card className="shadow-sm border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-500" />Historique de l&apos;appel</CardTitle>
              <CardDescription>Les 50 derniers enregistrements</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4"><History className="h-10 w-10 text-muted-foreground/50" /></div>
                  <p className="text-muted-foreground">Aucun historique disponible</p>
                  <p className="text-xs mt-1 text-muted-foreground/60">Cliquez sur l&apos;onglet pour charger l&apos;historique</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="text-sm min-w-[500px]">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30"><TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Statut</TableHead><TableHead className="hidden sm:table-cell">Raison</TableHead></TableRow>
                    </TableHeader>
                    <TableBody className="[&>tr:nth-child(even)]:bg-muted/30">
                      {history.map((record) => (
                        <TableRow key={record.id} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors">
                          <TableCell>{new Date(record.date).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell className="font-medium">{record.student?.fullName || 'Inconnu'}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{record.reason || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
