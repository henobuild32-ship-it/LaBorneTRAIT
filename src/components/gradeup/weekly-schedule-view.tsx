'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { subscribeToTable, isRealtimeEnabled } from '@/lib/realtime';
import { Clock, BookOpen, User, MapPin, CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface WeeklyScheduleViewProps {
  schoolId: string;
  classId: string;
  classNameLabel?: string;
}

interface ScheduleSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  course: {
    name: string;
    teacher: {
      fullName: string;
    };
  };
}

const DAYS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export default function WeeklyScheduleView({ schoolId, classId, classNameLabel }: WeeklyScheduleViewProps) {
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay() || 1); // 1-6, fallback to Monday if Sunday

  const fetchSchedules = useCallback(async () => {
    if (!schoolId || !classId) return;
    try {
      const res = await fetch(`/api/schedules?schoolId=${schoolId}&classId=${classId}`);
      if (res.ok) {
        setSchedules(await res.json());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [schoolId, classId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // Real-time synchronization
  useEffect(() => {
    if (!schoolId || !classId) return;

    const handleRealtime = () => {
      fetchSchedules();
    };

    const unsubscribe = subscribeToTable({
      table: 'CourseSchedule',
      channelName: `realtime-schedules-view-${schoolId}-${classId}`,
      onEvent: handleRealtime,
    });

    const pollInterval = setInterval(() => {
      fetchSchedules();
    }, isRealtimeEnabled() ? 20000 : 8000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [schoolId, classId, fetchSchedules]);

  const getDaySchedules = (dayNum: number) => {
    return schedules
      .filter((s) => s.dayOfWeek === dayNum)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-md overflow-hidden bg-card/60 backdrop-blur-xl">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Emploi du temps hebdomadaire
            </CardTitle>
            <CardDescription className="text-xs">
              Consultez le planning des cours de la classe {classNameLabel ? `(${classNameLabel})` : ''}
            </CardDescription>
          </div>
          <button
            onClick={fetchSchedules}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Days tabs strip (responsive/scrollable) */}
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none scroll-smooth">
          {DAYS.map((d) => {
            const isActive = activeDay === d.value;
            const count = getDaySchedules(d.value).length;
            return (
              <button
                key={d.value}
                onClick={() => setActiveDay(d.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-background hover:bg-muted text-muted-foreground border hover:border-muted-foreground/30'
                }`}
              >
                {d.label}
                {count > 0 && (
                  <span
                    className={`h-4 min-w-[16px] px-1 rounded-full text-[9px] flex items-center justify-center font-bold ${
                      isActive ? 'bg-white text-blue-700' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {getDaySchedules(activeDay).length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-2.5 opacity-30" />
            <p className="text-sm font-medium">Aucun cours planifié pour ce jour</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {getDaySchedules(activeDay).map((slot) => (
              <div
                key={slot.id}
                className="flex items-center gap-3 p-3.5 rounded-2xl border bg-background hover:bg-muted/10 transition-colors shadow-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/20 text-blue-600 border border-blue-100 dark:border-blue-900/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate text-foreground">{slot.course.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                    <User className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="truncate">{slot.course.teacher.fullName}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                  <Badge variant="outline" className="bg-blue-50/50 text-blue-700 border-blue-200 text-[10px] font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {slot.startTime} – {slot.endTime}
                  </Badge>
                  {slot.room && (
                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                      {slot.room}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
