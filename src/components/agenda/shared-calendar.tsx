
'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Users, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2,
  ListFilter,
  Chrome
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SharedCalendarProps {
  companyId: string;
  isCompact?: boolean;
  defaultView?: '3day' | 'month';
}

export function SharedCalendar({ companyId, isCompact = false, defaultView = '3day' }: SharedCalendarProps) {
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(isCompact ? '3day' : defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const db = useFirestore();

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const getEventsForDay = (day: Date) => {
    if (!events) return [];
    return events
      .filter(e => {
        if (!e.debut) return false;
        try {
          const eventDate = parseISO(e.debut);
          return isValid(eventDate) && isSameDay(eventDate, day);
        } catch (err) {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = a.debut ? new Date(a.debut).getTime() : 0;
        const dateB = b.debut ? new Date(b.debut).getTime() : 0;
        return dateA - dateB;
      });
  };

  const nextMonth = () => setCurrentDate(addDays(endOfMonth(currentDate), 1));
  const prevMonth = () => setCurrentDate(addDays(startOfMonth(currentDate), -1));

  // --- RENDU VUE 3 JOURS ---
  const render3DayView = () => {
    const days = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];

    return (
      <div className={cn(
        "grid gap-4 h-full",
        isCompact ? "grid-cols-3 gap-2 p-3" : "grid-cols-1 md:grid-cols-3 p-8 min-h-[600px]"
      )}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isTday = isToday(day);

          return (
            <div key={idx} className={cn(
              "flex flex-col gap-2 rounded-2xl border transition-all overflow-hidden",
              isTday ? "bg-primary/[0.03] border-primary/20" : "bg-card shadow-sm",
              isCompact ? "p-2 border-none" : "p-6"
            )}>
              <div className={cn("flex flex-col border-b pb-1 mb-1", isCompact && "items-center text-center")}>
                <p className="text-[8px] font-black uppercase tracking-wider text-primary/60">
                  {isTday ? "Auj." : format(day, "EEE", { locale: fr })}
                </p>
                <h3 className={cn("font-black text-primary", isCompact ? "text-xs" : "text-xl")}>
                  {format(day, "d MMM", { locale: fr })}
                </h3>
              </div>
              
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5 custom-scrollbar">
                {dayEvents.length > 0 ? (
                  dayEvents.slice(0, isCompact ? 3 : 10).map(event => (
                    <div key={event.id} className={cn(
                      "bg-white rounded-lg border-l-4 border-primary shadow-sm hover:border-l-primary/50 transition-colors",
                      isCompact ? "p-1.5" : "p-3"
                    )}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-[7px] font-black text-primary/70">
                          {event.debut ? format(parseISO(event.debut), "HH:mm") : "--:--"}
                        </p>
                        {event.source === 'google' && <Chrome className="w-2 h-2 text-primary opacity-30" />}
                      </div>
                      <h4 className={cn("font-bold leading-tight text-foreground line-clamp-2", isCompact ? "text-[8px]" : "text-xs")}>
                        {event.titre}
                      </h4>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-4">
                    <p className="text-[7px] font-black uppercase tracking-widest">Aucun RDV</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- RENDU VUE MENSUELLE ---
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="bg-card flex flex-col h-full animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b bg-muted/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black tracking-tighter text-primary uppercase">
              {format(currentDate, "MMMM yyyy", { locale: fr })}
            </h2>
            <div className="flex bg-background border rounded-full p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setViewMode('3day')} className="rounded-full font-bold">
            Retour vue 3 jours
          </Button>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/10">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-[500px]">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isTday = isToday(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentDate));

            return (
              <div key={idx} className={cn(
                "border-r border-b p-2 flex flex-col gap-1.5 transition-colors min-h-[100px]",
                !isCurrentMonth && "bg-muted/10 opacity-30",
                isTday && "bg-primary/[0.04]"
              )}>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full",
                    isTday ? "bg-primary text-white" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && <span className="w-1 h-1 bg-primary rounded-full" />}
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id} className="text-[8px] font-bold p-1 bg-primary/5 border-l-2 border-primary rounded-sm truncate">
                      {event.titre}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[7px] text-muted-foreground font-bold pl-1">+{dayEvents.length - 3} autres</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-30" />
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Chargement de l'agenda...</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-card overflow-hidden">
      {viewMode === '3day' ? render3DayView() : renderMonthView()}
    </div>
  );
}
