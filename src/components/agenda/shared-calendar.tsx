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

  // Plage horaire de 8h à 20h
  const startHour = 8;
  const endHour = 20;
  // Hauteur calculée pour éviter le scroll dans un conteneur de 800px (approx)
  const hourHeight = 62; 

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

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
      <div className={cn("flex flex-col h-full bg-card overflow-hidden animate-in fade-in duration-300", !isCompact && "p-10")}>
        <div className={cn("flex items-center justify-between px-6 py-4 border-b bg-muted/5 mb-6 rounded-2xl", isCompact && "py-2")}>
           <div className="flex items-center gap-6">
             <div className="flex bg-white border rounded-full p-1 shadow-sm">
               <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft className="w-5 h-5" /></Button>
               <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-5 h-5" /></Button>
             </div>
             {!isCompact && (
               <Badge className="bg-primary/5 text-primary border-primary/20 h-9 px-4 font-black uppercase text-[11px] tracking-widest gap-2">
                  <Users className="w-4 h-4" /> Agenda d'Équipe
               </Badge>
             )}
           </div>
           <div className="flex gap-3">
              <Button variant="outline" size="sm" className="h-10 text-[11px] font-black uppercase px-4 gap-2 rounded-xl" onClick={handleImportFromGoogle} disabled={isSyncing !== 'idle'}>
                {isSyncing === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                Sync Google
              </Button>
              <Button size="sm" className="h-10 text-[11px] font-black uppercase px-6 bg-primary rounded-xl shadow-lg" onClick={() => openAddEvent()}>
                <Plus className="w-4 h-4 mr-2" /> Nouveau RDV
              </Button>
           </div>
        </div>

        <div className="flex mb-4 flex-shrink-0">
          <div className="w-20" />
          <div className="flex-1 grid grid-cols-3 gap-6">
            {days.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary/30 leading-none mb-2">{isToday(day) ? "Aujourd'hui" : format(day, "EEEE", { locale: fr })}</p>
                <h3 className={cn("font-black text-primary leading-none", isCompact ? "text-lg" : "text-2xl")}>{format(day, "d MMMM", { locale: fr })}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="flex relative" style={{ height: `${totalHeight}px` }}>
            <div className="w-20 flex-shrink-0 flex flex-col border-r bg-muted/5">
              {hours.map((h) => (
                <div key={h} className="relative flex items-center justify-center border-b border-primary/5 last:border-0" style={{ height: `${hourHeight}px` }}>
                  <span className="font-black text-primary/20 text-[11px]">{h}:00</span>
                </div>
              ))}
            </div>

            <div className="flex-1 grid grid-cols-3 gap-6 relative bg-muted/[0.02]">
              {days.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                return (
                  <div key={idx} className={cn("relative h-full border-r border-primary/5 last:border-r-0", isToday(day) && "bg-primary/[0.03]")}>
                    {hours.map((h) => <div key={h} className="border-b border-primary/5 last:border-0 w-full" style={{ height: `${hourHeight}px` }} />)}
                    {dayEvents.map(event => {
                      const start = parseISO(event.debut);
                      const end = parseISO(event.fin);
                      const eventStartHour = start.getHours();
                      const duration = differenceInMinutes(end, start);
                      if (eventStartHour < startHour || eventStartHour > endHour) return null;

                      const isCurrentDragged = draggedEventId === event.id;
                      const topPos = (eventStartHour - startHour) * hourHeight + (start.getMinutes() / 60 * hourHeight);
                      const height = Math.max(35, (duration / 60) * hourHeight);

                      return (
                        <div 
                          key={event.id} 
                          onMouseDown={(e) => handleMouseDown(e, event)}
                          className={cn(
                            "absolute left-0 right-0 mx-1 z-10 rounded-2xl border-l-4 shadow-sm cursor-pointer p-3 overflow-hidden flex flex-col select-none transition-all",
                            event.source === 'google' ? "bg-white border-primary" : "bg-amber-50/80 border-amber-500",
                            isCurrentDragged && "z-30 opacity-90 scale-[1.02] shadow-2xl ring-2 ring-primary"
                          )}
                          style={{ 
                            top: `${topPos + (isCurrentDragged ? dragOffset : 0)}px`, 
                            left: `${isCurrentDragged ? dragXOffset : 0}px`,
                            height: `${height}px`
                          }}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                             <span className="font-black text-primary/40 text-[10px] tracking-tight">
                               {format(isCurrentDragged ? addMinutes(start, (dragOffset/hourHeight)*60) : start, "HH:mm")}
                             </span>
                          </div>
                          <h4 className="font-bold text-sm leading-tight text-primary break-words line-clamp-2">
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
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const days = eachDayOfInterval({ start: startOfWeek(monthStart, { locale: fr }), end: endOfWeek(endOfMonth(currentDate), { locale: fr }) });

    return (
      <div className="bg-card flex flex-col h-full">
        <div className="p-10 border-b bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-10">
            <h2 className="text-5xl font-black tracking-tighter text-primary uppercase leading-none">{format(currentDate, "MMMM yyyy", { locale: fr })}</h2>
            <div className="flex bg-white border rounded-full p-1.5 shadow-sm">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}><ChevronLeft className="w-6 h-6" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}><ChevronRight className="w-6 h-6" /></Button>
            </div>
          </div>
          <Button size="lg" className="rounded-full font-bold bg-primary h-14 px-10 shadow-2xl text-lg" onClick={() => openAddEvent()}><Plus className="w-6 h-6 mr-3" /> Nouveau rendez-vous</Button>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => <div key={d} className="py-5 text-center text-[11px] font-black uppercase tracking-widest text-primary/30">{d}</div>)}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), monthStart);
            return (
              <div key={idx} className={cn("border-r border-b p-3 flex flex-col gap-1.5 min-h-[120px]", !isCurrentMonth && "bg-muted/10 opacity-30", isToday(day) && "bg-primary/[0.04]")}>
                <span className={cn("text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer", isToday(day) ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => { setSelectedDay(day); setIsDayViewOpen(true); }}>{format(day, "d")}</span>
                {dayEvents.slice(0, 4).map(e => <div key={e.id} onClick={() => openEditEvent(e)} className="text-[9px] font-bold p-1.5 rounded-lg bg-amber-50 border-l-3 border-amber-500 truncate cursor-pointer shadow-sm">{e.titre}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-full w-full flex flex-col items-center justify-center gap-6"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /><p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Accès à l'agenda...</p></div>;

  return (
    <div className="h-full w-full bg-card overflow-hidden">
      {viewMode === '3day' ? render3DayView() : renderMonthView()}
      
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl bg-card rounded-[3rem]">
          <div className="p-8 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-5">
                <div className="p-4 bg-white/20 rounded-2xl shadow-inner"><CalendarDays className="w-7 h-7" /></div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">{editingEvent ? "Modifier le RDV" : "Planifier un RDV"}</DialogTitle>
              </div>
            </DialogHeader>
          </div>
          <div className="p-10 space-y-6">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Objet de l'événement</Label>
              <Input value={formTitre} onChange={(e) => setFormTitre(e.target.value)} placeholder="Ex: Revue de projet..." className="h-14 rounded-2xl font-bold text-lg border-primary/10 shadow-sm" />
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Date</Label>
                <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-14 rounded-2xl font-bold border-primary/10" />
              </div>
              <div className="space-y-2">
                <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Heure</Label>
                <div className="flex gap-2">
                   <Input type="number" min="0" max="23" value={formHour} onChange={(e) => setFormHour(e.target.value)} className="h-14 rounded-2xl font-bold border-primary/10 w-full" />
                   <Input type="number" min="0" max="59" step="10" value={formMinute} onChange={(e) => setFormMinute(e.target.value)} className="h-14 rounded-2xl font-bold border-primary/10 w-full" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Durée prévue</Label>
              <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                <SelectTrigger className="h-14 rounded-2xl font-bold border-primary/10 shadow-sm"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card rounded-2xl">
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 heure</SelectItem>
                  <SelectItem value="90">1h 30min</SelectItem>
                  <SelectItem value="120">2 heures</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase text-muted-foreground ml-1">Notes & Instructions</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="rounded-2xl font-medium text-sm border-primary/10 min-h-[100px]" placeholder="Précisez les détails du rendez-vous..." />
            </div>
            <div className="flex gap-4 pt-4">
              {editingEvent && (
                <Button variant="outline" className="flex-1 rounded-2xl h-14 font-black uppercase text-[11px] tracking-widest text-rose-600 border-rose-100 hover:bg-rose-50" onClick={() => {
                   if (!db || !companyId) return;
                   const eventRef = doc(db, 'companies', companyId, 'events', editingEvent.id);
                   deleteDocumentNonBlocking(eventRef);
                   setIsEventDialogOpen(false);
                   toast({ title: "RDV annulé" });
                }}>
                  <Trash2 className="w-4 h-4 mr-2" /> Supprimer
                </Button>
              )}
              <Button onClick={handleSaveEvent} className="flex-1 bg-primary h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                {editingEvent ? "Mettre à jour" : "Confirmer le RDV"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
