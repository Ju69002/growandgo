
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
  ListFilter
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
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(defaultView);
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
        "grid gap-6 h-full",
        isCompact ? "grid-cols-3 gap-2 p-2" : "grid-cols-1 md:grid-cols-3 p-8 min-h-[600px]"
      )}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isTday = isToday(day);

          return (
            <div key={idx} className={cn(
              "flex flex-col gap-2 rounded-[24px] border transition-all overflow-hidden",
              isTday ? "bg-primary/5 border-primary/20" : "bg-card shadow-sm",
              isCompact ? "p-3 border-none" : "p-6"
            )}>
              <div className={cn("flex flex-col border-b pb-2 mb-2", isCompact && "items-center text-center")}>
                <p className="text-[9px] font-black uppercase tracking-wider text-primary/60">
                  {isTday ? "Auj." : format(day, "EEE", { locale: fr })}
                </p>
                <h3 className={cn("font-black", isCompact ? "text-sm" : "text-xl")}>
                  {format(day, "d MMM", { locale: fr })}
                </h3>
              </div>
              
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {dayEvents.length > 0 ? (
                  dayEvents.slice(0, isCompact ? 2 : 10).map(event => (
                    <div key={event.id} className={cn(
                      "bg-background rounded-xl border group hover:border-primary/50 transition-colors",
                      isCompact ? "p-1.5" : "p-3"
                    )}>
                      <p className="text-[8px] font-black text-primary truncate">
                        {event.debut ? format(parseISO(event.debut), "HH:mm") : "--:--"}
                      </p>
                      <h4 className={cn("font-bold leading-tight line-clamp-1", isCompact ? "text-[9px]" : "text-xs")}>
                        {event.titre}
                      </h4>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                    <p className="text-[8px] font-bold uppercase tracking-widest">Libre</p>
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
      <div className="bg-card border rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-full animate-in zoom-in-95 duration-300">
        {!isCompact && (
          <div className="p-8 border-b bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h2 className="text-4xl font-black tracking-tighter text-primary">
                {format(currentDate, "MMMM", { locale: fr }).toUpperCase()}
                <span className="ml-3 text-muted-foreground/40">{format(currentDate, "yyyy")}</span>
              </h2>
              <div className="flex bg-background border rounded-full p-1 shadow-sm">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={prevMonth}><ChevronLeft /></Button>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={nextMonth}><ChevronRight /></Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-7 border-b bg-muted/5">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => (
            <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 grid-rows-6 min-h-[500px]">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isTday = isToday(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentDate));

            return (
              <div key={idx} className={cn(
                "border-r border-b p-3 flex flex-col gap-2 transition-colors",
                !isCurrentMonth && "bg-muted/20 opacity-40",
                isTday && "bg-primary/[0.03]"
              )}>
                <div className="flex justify-between items-center">
                  <span className={cn(
                    "text-xs font-black w-6 h-6 flex items-center justify-center rounded-full",
                    isTday ? "bg-primary text-white" : "text-muted-foreground"
                  )}>
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id} className="text-[9px] font-bold p-1 bg-primary/10 border-l-2 border-primary rounded-sm truncate">
                      {event.titre}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isCompact) {
    return isLoading ? (
      <div className="h-full flex items-center justify-center opacity-30">
        <Loader2 className="animate-spin" />
      </div>
    ) : render3DayView();
  }

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto h-full flex flex-col">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary/60">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Planification Équipe</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-primary">Agenda Grow&Go</h1>
        </div>
        
        <div className="flex gap-4">
          <div className="flex bg-muted p-1 rounded-full border shadow-inner">
            <Button 
              variant={viewMode === '3day' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="rounded-full font-bold px-6"
              onClick={() => setViewMode('3day')}
            >
              <ListFilter className="w-4 h-4 mr-2" /> 3 Jours
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'secondary' : 'ghost'} 
              size="sm" 
              className="rounded-full font-bold px-6"
              onClick={() => setViewMode('month')}
            >
              <Maximize2 className="w-4 h-4 mr-2" /> Plein Écran
            </Button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="font-bold tracking-widest text-xs uppercase animate-pulse">Chargement...</p>
        </div>
      ) : (
        <div className="flex-1">
          {viewMode === '3day' ? render3DayView() : renderMonthView()}
        </div>
      )}
    </div>
  );
}
