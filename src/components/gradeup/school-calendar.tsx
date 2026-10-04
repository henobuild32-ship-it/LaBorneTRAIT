'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import type { HomeworkInfo, PaymentInfo } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CreditCard,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { fetchJsonWithCache } from '@/lib/offline-sync';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'homework' | 'payment';
  color: string;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday-based (Mon=0, Sun=6)
  return day === 0 ? 6 : day - 1;
}

export default function SchoolCalendar() {
  const { user } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const navigatePrev = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDate(null);
  };

  const navigateNext = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  useEffect(() => {
    if (!user?.schoolId) return;

    const fetchEvents = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ schoolId: user.schoolId });
        const [hwRes, payRes] = await Promise.all([
          fetchJsonWithCache(`/api/homework?${params}`, { homework: [] }),
          fetchJsonWithCache(`/api/payments?${params}`, { payments: [] }),
        ]);

        const homeworks: HomeworkInfo[] = Array.isArray(hwRes) ? hwRes : Array.isArray((hwRes as any)?.homework) ? (hwRes as any).homework : [];
        const payments: { id: string; month: string; status: string; amount: number; student?: { fullName: string } }[] = Array.isArray(payRes) ? payRes : Array.isArray((payRes as any)?.payments) ? (payRes as any).payments : [];

        const calendarEvents: CalendarEvent[] = [];

        homeworks.forEach((hw) => {
          if (hw.dueDate) {
            calendarEvents.push({
              id: `hw-${hw.id}`,
              title: hw.title,
              date: hw.dueDate.split('T')[0],
              type: 'homework',
              color: 'bg-blue-500',
            });
          }
        });

        payments.forEach((p) => {
          if (p.month) {
            const dt = new Date(p.month);
            if (!isNaN(dt.getTime())) {
              const dateStr = dt.toISOString().split('T')[0];
              const statusLabel = p.status === 'paid' ? '✅ Payé' : p.status === 'pending' ? '⏳ En attente' : '🔴 En retard';
              calendarEvents.push({
                id: `pay-${p.id}`,
                title: `Paiement ${p.student?.fullName || ''} — ${statusLabel}`,
                date: dateStr,
                type: 'payment',
                color: p.status === 'paid' ? 'bg-emerald-500' : p.status === 'pending' ? 'bg-amber-500' : 'bg-red-500',
              });
            }
          }
        });

        setEvents(calendarEvents);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [user?.schoolId, year, month]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const getEventsForDay = (day: number): CalendarEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const selectedEvents = selectedDate
    ? events.filter((e) => e.date === selectedDate)
    : [];

  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 p-6 lg:p-8 text-white shadow-xl shadow-blue-500/20">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wOCkiLz48L3N2Zz4=')] opacity-50" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-white/15 backdrop-blur-sm">
            <CalendarDays className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Calendrier scolaire</h1>
            <p className="text-blue-100 text-sm">
              {events.length} événement{events.length !== 1 ? 's' : ''} ce mois-ci
            </p>
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <CalendarIcon className="h-4 w-4 text-blue-600" />
              </div>
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-blue-200 hover:bg-blue-50"
                onClick={goToToday}
              >
                <CalendarDays className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-blue-200 hover:bg-blue-50"
                onClick={navigatePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-blue-200 hover:bg-blue-50"
                onClick={navigateNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-muted-foreground">Devoirs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-muted-foreground">Payé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-xs text-muted-foreground">En attente</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-muted-foreground">En retard</span>
            </div>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 rounded-lg bg-muted/30" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dayEvents = getEventsForDay(day);

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`
                    h-20 rounded-lg border text-left p-1.5 transition-all duration-200 overflow-hidden
                    ${isSelected
                      ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-200'
                      : isToday
                        ? 'border-blue-300 bg-blue-50/50'
                        : 'border-transparent hover:bg-accent/50 hover:border-border'
                    }
                  `}
                >
                  <span className={`
                    text-sm font-medium inline-flex items-center justify-center
                    h-6 w-6 rounded-full
                    ${isToday ? 'bg-blue-600 text-white' : 'text-foreground'}
                  `}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id}
                        className={`h-1.5 w-full rounded-full ${evt.color}`}
                        title={evt.title}
                      />
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-muted-foreground leading-none">
                        +{dayEvents.length - 2}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Events */}
      {selectedDate && (
        <Card className="transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <CalendarDays className="h-4 w-4 text-blue-600" />
              </div>
              Événements du jour
            </CardTitle>
            <CardDescription className="capitalize">
              {formatEventDate(selectedDate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="p-4 rounded-full bg-blue-50">
                  <CalendarDays className="h-10 w-10 text-blue-300" />
                </div>
                <p className="text-sm text-muted-foreground">Aucun événement ce jour.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="space-y-3">
                  {selectedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-accent/30 border border-border hover:shadow-sm transition-all duration-200"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        evt.type === 'homework' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {evt.type === 'homework' ? (
                          <BookOpen className="h-4 w-4" />
                        ) : (
                          <CreditCard className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{evt.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {evt.type === 'homework' ? 'Devoir' : 'Paiement'}
                          </Badge>
                          <div className={`h-2 w-2 rounded-full ${evt.color}`} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
