
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2,
  DownloadCloud,
  CalendarDays,
  User as UserIcon,
  Users
} from 'lucide-react';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  useUser, 
  useAuth,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, query, doc, where } from 'firebase/firestore';
import { CalendarEvent, User } from '@/lib/types';
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid, addMinutes, setHours, startOfDay, differenceInMinutes, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';
import { getSyncTimeRange, fetchGoogleEvents, mapGoogleEvent, syncEventToFirestore } from '@/services/calendar-sync';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useSearchParams } from 'next/navigation';

interface SharedCalendarProps {
  companyId: string;
  isCompact?: boolean;
  defaultView?: '3day' | 'month';
}

function roundToNearest10(date: Date): Date {
  const roundedDate = new Date(date);
  const minutes = roundedDate.getMinutes();
  const roundedMinutes = Math.round(minutes / 10) * 10;
  
  if (roundedMinutes === 60) {
    roundedDate.setHours(roundedDate.getHours() + 1);
    roundedDate.setMinutes(0);
  } else {
    roundedDate.setMinutes(roundedMinutes);
  }
  
  roundedDate.setSeconds(0);
  roundedDate.setMilliseconds(0);
  return roundedDate;
}

export function SharedCalendar({ companyId, isCompact = false, defaultView = '3day' }: SharedCalendarProps) {
  const searchParams = useSearchParams();
  const [viewMode] = React.useState<'3day' | 'month'>(isCompact ? '3day' : defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isSyncing, setIsSyncing] = React.useState<'idle' | 'importing'>('idle');
  const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
  const [isDayViewOpen, setIsDayViewOpen] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragXOffset, setDragXOffset] = React.useState(0);
  const isDraggingRef = React.useRef(false);

  const [formTitre, setFormTitre] = React.useState('');
  const [formDate, setFormDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [formHour, setFormHour] = React.useState('09');
  const [formMinute, setFormMinute] = React.useState('00');
  const [formDescription, setFormDescription] = React.useState('');
  const [selectedDuration, setSelectedDuration] = React.useState('30');

  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();

  React.useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      try {
        const targetDate = parse(dateParam, 'yyyy-MM-dd', new Date());
        if (isValid(targetDate)) setCurrentDate(targetDate);
      } catch (e) {}
    }
  }, [searchParams]);

  const startHour = 8;
  const endHour = 18;
  const hourHeight = isCompact ? 36 : 60;

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'users'), where('companyId', '==', companyId));
  }, [db, companyId]);

  const { data: teamMembers } = useCollection<User>(teamQuery);

  const getEventsForDay = React.useCallback((day: Date) => {
    if (!events) return [];
    return events
      .filter(e => {
        if (!e.debut) return false;
        if (e.isBillingEvent && !e.id.startsWith('event_v4')) return false;
        try {
          const eventDate = parseISO(e.debut);
          return isValid(eventDate) && isSameDay(eventDate, day);
        } catch (err) { return false; }
      })
      .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  }, [events]);

  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return;
    const startY = e.clientY;
    const startX = e.clientX;
    const snapPixels = (10 / 60) * hourHeight;
    const colWidth = e.currentTarget.parentElement?.clientWidth || 0;
    
    isDraggingRef.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 10) {
        isDraggingRef.current = true;
        setDraggedEventId(event.id);
        setDragOffset(Math.round(deltaY / snapPixels) * snapPixels);
        setDragXOffset(deltaX);
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDraggingRef.current) {
        const deltaY = upEvent.clientY - startY;
        const deltaX = upEvent.clientX - startX;
        const minutesDelta = (Math.round(deltaY / snapPixels) * snapPixels / hourHeight) * 60;
        const daysDelta = Math.round(deltaX / (colWidth + 8));

        if ((minutesDelta !== 0 || daysDelta !== 0) && db && companyId) {
          const oldStart = parseISO(event.debut);
          const oldEnd = parseISO(event.fin);
          let newStart = roundToNearest10(addMinutes(oldStart, minutesDelta));
          if (daysDelta !== 0) newStart = addDays(newStart, daysDelta);
          const duration = differenceInMinutes(oldEnd, oldStart);
          const newEnd = addMinutes(newStart, duration);

          const eventRef = doc(db, 'companies', companyId, 'events', event.id);
          updateDocumentNonBlocking(eventRef, {
            debut: newStart.toISOString(),
            fin: newEnd.toISOString(),
            derniere_maj: new Date().toISOString()
          });
          toast({ title: "Agenda mis à jour" });
        }
      } else {
        openEditEvent(event);
      }
      setDraggedEventId(null);
      setDragOffset(0);
      setDragXOffset(0);
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleImportFromGoogle = async () => {
    if (!db || !companyId || !user || !auth) return;
    setIsSyncing('importing');
    try {
      const result = await signInWithGoogleCalendar(auth);
      if (!result.token) throw new Error("Accès refusé.");
      const { timeMin, timeMax } = getSyncTimeRange();
      const externalEvents = await fetchGoogleEvents(result.token, timeMin, timeMax);
      for (const extEvent of externalEvents) {
        const mapped = mapGoogleEvent(extEvent, companyId, user.uid);
        await syncEventToFirestore(db, mapped);
      }
      toast({ title: "Importation terminée !" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur Google", description: error.message });
    } finally {
      setIsSyncing('idle');
    }
  };

  const openAddEvent = (date?: Date) => {
    setEditingEvent(null);
    const targetDate = roundToNearest10(date || new Date());
    setFormTitre('');
    setFormDate(format(targetDate, 'yyyy-MM-dd'));
    setFormHour(format(targetDate, 'HH'));
    setFormMinute(format(targetDate, 'mm'));
    setFormDescription('');
    setSelectedDuration('30');
    setIsEventDialogOpen(true);
  };

  const openEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    const start = roundToNearest10(parseISO(event.debut));
    const end = roundToNearest10(parseISO(event.fin));
    setFormTitre(event.titre);
    setFormDate(format(start, 'yyyy-MM-dd'));
    setFormHour(format(start, 'HH'));
    setFormMinute(format(start, 'mm'));
    setFormDescription(event.description || '');
    setSelectedDuration(differenceInMinutes(end, start).toString());
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = () => {
    if (!db || !companyId || !user || !formTitre) return;
    const [y, m, d] = formDate.split('-').map(Number);
    const startDate = roundToNearest10(new Date(y, m - 1, d, parseInt(formHour), parseInt(formMinute)));
    const endDate = addMinutes(startDate, parseInt(selectedDuration));

    const eventData: Partial<CalendarEvent> = {
      companyId,
      userId: user.uid,
      titre: formTitre,
      debut: startDate.toISOString(),
      fin: endDate.toISOString(),
      description: formDescription,
      source: editingEvent?.source || 'local',
      type: 'event',
      derniere_maj: new Date().toISOString(),
    };

    if (editingEvent) {
      const eventRef = doc(db, 'companies', companyId, 'events', editingEvent.id);
      updateDocumentNonBlocking(eventRef, eventData);
    } else {
      const eventsRef = collection(db, 'companies', companyId, 'events');
      addDocumentNonBlocking(eventsRef, { ...eventData, id_externe: Math.random().toString(36).substring(7) });
    }
    setIsEventDialogOpen(false);
    toast({ title: "Agenda synchronisé" });
  };

  const render3DayView = () => {
    const days = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);
    const totalHeight = hours.length * hourHeight;

    return (
      <div className={cn("flex flex-col h-full bg-card overflow-hidden animate-in fade-in duration-300", !isCompact && "p-8")}>
        <div className={cn("flex items-center justify-between px-4 py-2 border-b bg-muted/5 mb-2 rounded-t-2xl", isCompact && "py-1")}>
           <div className="flex items-center gap-4">
             <div className="flex gap-1">
               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft className="w-3 h-3" /></Button>
               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-3 h-3" /></Button>
             </div>
             {!isCompact && (
               <Badge variant="outline" className="h-6 border-primary/20 text-primary font-bold gap-1.5 uppercase text-[9px]">
                  <Users className="w-3 h-3" /> Agenda d'Équipe
               </Badge>
             )}
           </div>
           <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-6 text-[9px] font-black uppercase px-2 gap-1" onClick={handleImportFromGoogle} disabled={isSyncing !== 'idle'}>
                {isSyncing === 'importing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
                Sync
              </Button>
              <Button size="sm" className="h-6 text-[9px] font-black uppercase px-2 bg-primary rounded-lg" onClick={() => openAddEvent()}>
                <Plus className="w-3 h-3" />
              </Button>
           </div>
        </div>

        <div className="flex mb-1 flex-shrink-0">
          <div className={cn("flex-shrink-0", isCompact ? "w-10" : "w-16")} />
          <div className="flex-1 grid grid-cols-3 gap-2">
            {days.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary/40 leading-none mb-0.5">{isToday(day) ? "Auj." : format(day, "EEE", { locale: fr })}</p>
                <h3 className={cn("font-black text-primary leading-none", isCompact ? "text-[10px]" : "text-base")}>{format(day, "d MMM", { locale: fr })}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex relative" style={{ height: `${totalHeight}px` }}>
              <div className={cn("flex-shrink-0 flex flex-col border-r bg-muted/5", isCompact ? "w-10" : "w-16")}>
                {hours.map((h) => (
                  <div key={h} className="relative flex items-start justify-center border-b last:border-0" style={{ height: `${hourHeight}px` }}>
                    <span className={cn("font-black text-muted-foreground/30 mt-1", isCompact ? "text-[8px]" : "text-[10px]")}>{h}:00</span>
                  </div>
                ))}
              </div>

              <div className="flex-1 grid grid-cols-3 gap-2 relative bg-muted/[0.02]">
                {days.map((day, idx) => {
                  const dayEvents = getEventsForDay(day);
                  return (
                    <div key={idx} className={cn("relative h-full border-r last:border-r-0", isToday(day) && "bg-primary/[0.03]")}>
                      {hours.map((h) => <div key={h} className="border-b last:border-0 w-full" style={{ height: `${hourHeight}px` }} />)}
                      {dayEvents.map(event => {
                        const start = parseISO(event.debut);
                        const end = parseISO(event.fin);
                        const eventStartHour = start.getHours();
                        const duration = differenceInMinutes(end, start);
                        if (eventStartHour < startHour || eventStartHour > endHour) return null;

                        const isCurrentDragged = draggedEventId === event.id;
                        const topPos = (eventStartHour - startHour) * hourHeight + (start.getMinutes() / 60 * hourHeight);
                        const height = Math.max(20, (duration / 60) * hourHeight);

                        return (
                          <div 
                            key={event.id} 
                            onMouseDown={(e) => handleMouseDown(e, event)}
                            className={cn(
                              "absolute left-0 right-0 mx-0.5 z-10 rounded-lg border-l-4 shadow-sm cursor-pointer p-1 overflow-hidden flex flex-col select-none",
                              event.source === 'google' ? "bg-white border-primary" : "bg-amber-50 border-amber-500",
                              isCurrentDragged && "z-30 opacity-90 scale-[1.02] shadow-2xl ring-2 ring-primary"
                            )}
                            style={{ 
                              top: `${topPos + (isCurrentDragged ? dragOffset : 0)}px`, 
                              left: `${isCurrentDragged ? dragXOffset : 0}px`,
                              height: `${height}px`
                            }}
                          >
                            <div className="flex items-center gap-1.5 shrink-0 overflow-hidden mb-0.5">
                               <span className={cn("font-black text-primary/60 leading-none", isCompact ? "text-[7px]" : "text-[9px]")}>
                                 {format(isCurrentDragged ? addMinutes(start, (dragOffset/hourHeight)*60) : start, "HH:mm")}
                               </span>
                            </div>
                            <h4 className={cn("font-bold leading-tight line-clamp-2 text-foreground break-words", isCompact ? "text-[9px]" : "text-sm")}>
                              {event.titre}
                            </h4>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const days = eachDayOfInterval({ start: startOfWeek(monthStart, { locale: fr }), end: endOfWeek(endOfMonth(currentDate), { locale: fr }) });

    return (
      <div className="bg-card flex flex-col h-full">
        <div className="p-8 border-b bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <h2 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">{format(currentDate, "MMMM yyyy", { locale: fr })}</h2>
            <div className="flex bg-white border rounded-full p-1 shadow-sm">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}><ChevronLeft className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}><ChevronRight className="w-5 h-5" /></Button>
            </div>
          </div>
          <Button size="lg" className="rounded-full font-bold bg-primary h-12 px-8 shadow-xl" onClick={() => openAddEvent()}><Plus className="w-5 h-5 mr-2" /> Ajouter</Button>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-primary/40">{d}</div>)}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
            return (
              <div key={idx} className={cn("border-r border-b p-2 flex flex-col gap-1 min-h-[100px]", !isCurrentMonth && "bg-muted/10 opacity-30", isToday(day) && "bg-primary/[0.04]")}>
                <span className={cn("text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg cursor-pointer", isToday(day) ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => { setSelectedDay(day); setIsDayViewOpen(true); }}>{format(day, "d")}</span>
                {dayEvents.slice(0, 3).map(e => <div key={e.id} onClick={() => openEditEvent(e)} className="text-[8px] font-bold p-1 rounded bg-amber-50 border-l-2 border-amber-500 truncate cursor-pointer">{e.titre}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-full w-full flex flex-col items-center justify-center gap-4"><Loader2 className="w-10 h-10 animate-spin text-primary/30" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chargement...</p></div>;

  return (
    <div className="h-full w-full bg-card overflow-hidden">
      {viewMode === '3day' ? render3DayView() : renderMonthView()}
      
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl bg-card rounded-[2rem]">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl shadow-inner"><CalendarDays className="w-6 h-6" /></div>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">{editingEvent ? "Modifier le RDV" : "Nouveau RDV"}</DialogTitle>
              </div>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Objet</Label>
              <Input value={formTitre} onChange={(e) => setFormTitre(e.target.value)} placeholder="Ex: Briefing design..." className="h-12 rounded-xl font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Date</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-12 rounded-xl font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Durée</Label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card rounded-xl">{[
                    { label: '15 min', value: '15' }, { label: '30 min', value: '30' },
                    { label: '45 min', value: '45' }, { label: '1 heure', value: '60' },
                    { label: '1h 30min', value: '90' }, { label: '2 heures', value: '120' },
                  ].map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Notes</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="rounded-xl font-bold text-sm" />
            </div>
            <Button onClick={handleSaveEvent} className="w-full bg-primary h-12 rounded-xl font-bold uppercase tracking-widest text-xs">Enregistrer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
