
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2,
  Chrome,
  UploadCloud,
  DownloadCloud,
  Clock,
  CheckCircle2,
  CalendarDays,
  Info,
  X,
  Users,
  User as UserIcon
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
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid, addMinutes, setHours, setMinutes, eachHourOfInterval, startOfDay, endOfDay, differenceInMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { getSyncTimeRange, fetchGoogleEvents, mapGoogleEvent, syncEventToFirestore, pushEventToGoogle } from '@/services/calendar-sync';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(isCompact ? '3day' : defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isSyncing, setIsSyncing] = React.useState<'idle' | 'importing' | 'exporting'>('idle');
  const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
  const [isDayViewOpen, setIsDayViewOpen] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [dragXOffset, setDragXOffset] = React.useState(0);
  const isDraggingRef = React.useRef(false);

  const [openSelect, setOpenSelect] = React.useState<'duration' | 'hour' | 'minute' | null>(null);

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

  const startHour = 8;
  const endHour = 20;
  const hourHeight = isCompact ? 40 : 60;

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

  const getCreatorName = (userId: string) => {
    if (!teamMembers) return "Utilisateur inconnu";
    const creator = teamMembers.find(m => m.uid === userId);
    return creator?.name || "Ancien collaborateur";
  };

  const calculatedTimes = React.useMemo(() => {
    if (!formDate || !formHour || !formMinute || !selectedDuration) return null;
    try {
      const [year, month, day] = formDate.split('-').map(Number);
      const start = new Date(year, month - 1, day, parseInt(formHour), parseInt(formMinute));
      const end = addMinutes(start, parseInt(selectedDuration));
      return { start, end };
    } catch (e) {
      return null;
    }
  }, [formDate, formHour, formMinute, selectedDuration]);

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

  const handleMouseDown = (e: React.MouseEvent, event: CalendarEvent) => {
    if (e.button !== 0) return;
    
    const startY = e.clientY;
    const startX = e.clientX;
    const snapPixels = (10 / 60) * hourHeight;
    const columnElement = e.currentTarget.parentElement;
    const colWidth = columnElement?.clientWidth || 0;
    
    isDraggingRef.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaX = moveEvent.clientX - startX;
      
      if (Math.abs(deltaY) > 5 || Math.abs(deltaX) > 10) {
        isDraggingRef.current = true;
        setDraggedEventId(event.id);
        const snappedDeltaY = Math.round(deltaY / snapPixels) * snapPixels;
        setDragOffset(snappedDeltaY);
        setDragXOffset(deltaX);
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDraggingRef.current) {
        const deltaY = upEvent.clientY - startY;
        const deltaX = upEvent.clientX - startX;
        
        const snappedDeltaY = Math.round(deltaY / snapPixels) * snapPixels;
        const minutesDelta = (snappedDeltaY / hourHeight) * 60;
        const daysDelta = Math.round(deltaX / (colWidth + 8)); // 8 is the grid gap-2

        if ((minutesDelta !== 0 || daysDelta !== 0) && db && companyId) {
          const oldStart = parseISO(event.debut);
          const oldEnd = parseISO(event.fin);
          
          let newStart = roundToNearest10(addMinutes(oldStart, minutesDelta));
          if (daysDelta !== 0) {
            newStart = addDays(newStart, daysDelta);
          }
          
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
      toast({ title: "Importation terminée !", description: `${externalEvents.length} événements synchronisés.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Échec d'importation", description: error.message });
    } finally {
      setIsSyncing('idle');
    }
  };

  const handleExportToGoogle = async () => {
    if (!db || !companyId || !user || !auth || !events) return;
    const localEvents = events.filter(e => e.source === 'local');
    if (localEvents.length === 0) {
      toast({ title: "Rien à exporter", description: "Tous vos événements sont déjà synchronisés." });
      return;
    }

    setIsSyncing('exporting');
    try {
      const result = await signInWithGoogleCalendar(auth);
      if (!result.token) throw new Error("Accès refusé.");
      
      let count = 0;
      for (const event of localEvents) {
        const googleResult = await pushEventToGoogle(result.token!, event);
        if (googleResult.id) {
          const eventRef = doc(db, 'companies', companyId, 'events', event.id);
          setDocumentNonBlocking(eventRef, { source: 'google', id_externe: googleResult.id }, { merge: true });
          count++;
        }
      }
      toast({ title: "Exportation réussie !", description: `${count} événements ajoutés à Google Calendar.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Échec d'exportation", description: error.message });
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
    const startDate = roundToNearest10(parseISO(event.debut));
    const endDate = roundToNearest10(parseISO(event.fin));
    
    setFormTitre(event.titre);
    setFormDate(format(startDate, 'yyyy-MM-dd'));
    setFormHour(format(startDate, 'HH'));
    setFormMinute(format(startDate, 'mm'));
    setFormDescription(event.description || '');
    
    const diff = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    setSelectedDuration(diff.toString());
    
    setIsEventDialogOpen(true);
  };

  const handleSaveEvent = () => {
    if (!db || !companyId || !user) return;
    if (!formTitre || !formDate || !formHour || !formMinute) {
      toast({ variant: "destructive", title: "Champs manquants", description: "Veuillez remplir le titre et l'horaire." });
      return;
    }

    const [year, month, day] = formDate.split('-').map(Number);
    const startDate = roundToNearest10(new Date(year, month - 1, day, parseInt(formHour), parseInt(formMinute)));
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
      setDocumentNonBlocking(eventRef, eventData, { merge: true });
      toast({ title: "Événement mis à jour" });
    } else {
      const eventsRef = collection(db, 'companies', companyId, 'events');
      addDocumentNonBlocking(eventsRef, {
        ...eventData,
        id_externe: Math.random().toString(36).substring(7)
      });
      toast({ title: "Événement créé pour l'équipe" });
    }
    setIsEventDialogOpen(false);
  };

  const handleDeleteEvent = () => {
    if (!db || !companyId || !editingEvent) return;
    const eventRef = doc(db, 'companies', companyId, 'events', editingEvent.id);
    deleteDocumentNonBlocking(eventRef);
    toast({ title: "Événement supprimé" });
    setIsEventDialogOpen(false);
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutesList = ['00', '10', '20', '30', '40', '50'];
  const durations = [
    { label: '15 min', value: '15' },
    { label: '30 min', value: '30' },
    { label: '45 min', value: '45' },
    { label: '1 heure', value: '60' },
    { label: '1h 30min', value: '90' },
    { label: '2 heures', value: '120' },
  ];

  const render3DayView = () => {
    const days = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
    const totalHeight = (endHour - startHour + 1) * hourHeight;
    const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
      <div className={cn("flex flex-col h-full bg-card overflow-hidden", !isCompact && "p-8")}>
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/5 mb-2 rounded-t-2xl">
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
                Sync Google
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
                <p className="text-[10px] font-black uppercase tracking-wider text-primary/40">{isToday(day) ? "Auj." : format(day, "EEE", { locale: fr })}</p>
                <h3 className={cn("font-black text-primary leading-none", isCompact ? "text-xs" : "text-base")}>{format(day, "d MMM", { locale: fr })}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="flex relative h-full" style={{ height: `${totalHeight}px` }}>
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
                const isTday = isToday(day);
                
                return (
                  <div key={idx} className={cn("relative h-full border-r last:border-r-0", isTday && "bg-primary/[0.03]")}>
                    {hours.map((h) => (
                      <div key={h} className="border-b last:border-0 w-full" style={{ height: `${hourHeight}px` }} />
                    ))}

                    {dayEvents.map(event => {
                      const start = parseISO(event.debut);
                      const end = parseISO(event.fin);
                      const eventStartHour = start.getHours();
                      const eventStartMin = start.getMinutes();
                      const duration = differenceInMinutes(end, start);

                      if (eventStartHour < startHour && (eventStartHour + duration/60) <= startHour) return null;
                      if (eventStartHour > endHour) return null;

                      const isCurrentDragged = draggedEventId === event.id;
                      const topPos = Math.max(0, (eventStartHour - startHour) * hourHeight + (eventStartMin / 60 * hourHeight));
                      const eventHeight = Math.min(totalHeight - topPos, (duration / 60) * hourHeight);

                      return (
                        <div 
                          key={event.id} 
                          onMouseDown={(e) => handleMouseDown(e, event)}
                          className={cn(
                            "absolute left-0 right-0 mx-1 z-10 rounded-xl border-l-4 shadow-md hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer p-2 overflow-hidden flex flex-col select-none",
                            event.source === 'google' ? "bg-white border-primary" : "bg-amber-50 border-amber-500",
                            isCurrentDragged && "z-30 opacity-90 scale-[1.02] shadow-2xl ring-2 ring-primary border-dashed"
                          )}
                          style={{ 
                            top: `${topPos + (isCurrentDragged ? dragOffset : 0)}px`, 
                            left: `${isCurrentDragged ? dragXOffset : 0}px`,
                            height: `${eventHeight}px`, 
                            minHeight: '20px' 
                          }}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <p className={cn("font-black text-primary/60 shrink-0", isCompact ? "text-[8px]" : "text-[9px]")}>
                              {format(isCurrentDragged ? addMinutes(start, (dragOffset/hourHeight)*60) : start, "HH:mm")}
                            </p>
                            {event.source === 'google' && <Chrome className="w-2.5 h-2.5 opacity-20" />}
                          </div>
                          <h4 className={cn("font-bold leading-tight line-clamp-2 text-foreground", isCompact ? "text-[9px]" : "text-xs")}>
                            {event.titre}
                          </h4>
                          {!isCompact && (
                            <div className="mt-auto flex items-center gap-1 opacity-40">
                              <UserIcon className="w-2.5 h-2.5" />
                              <span className="text-[8px] font-black uppercase truncate">{getCreatorName(event.userId)}</span>
                            </div>
                          )}
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
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="bg-card flex flex-col h-full animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <div className="space-y-1">
              <h2 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">
                {format(currentDate, "MMMM", { locale: fr })}
              </h2>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground opacity-50">{format(currentDate, "yyyy")}</p>
            </div>
            <div className="flex bg-white border rounded-full p-1.5 shadow-sm">
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-muted" onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}><ChevronLeft className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 hover:bg-muted" onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}><ChevronRight className="w-5 h-5" /></Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" className="rounded-full font-bold gap-2 h-12 shadow-sm" onClick={handleImportFromGoogle} disabled={isSyncing !== 'idle'}>
                {isSyncing === 'importing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
                Importer Google
              </Button>
              <Button size="lg" className="rounded-full font-bold gap-2 bg-primary h-12 px-8 shadow-xl" onClick={() => openAddEvent()}>
                <Plus className="w-5 h-5" /> Ajouter un RDV
              </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/20">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-primary/40">{d}</div>)}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-[500px]">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isTday = isToday(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentDate));
            return (
              <div key={idx} className={cn("border-r border-b p-3 flex flex-col gap-2 transition-colors min-h-[120px] group", !isCurrentMonth && "bg-muted/10 opacity-30", isTday && "bg-primary/[0.04]")}>
                <div className="flex justify-between items-center">
                  <span 
                    className={cn(
                      "text-[10px] font-black w-7 h-7 flex items-center justify-center rounded-xl cursor-pointer transition-all", 
                      isTday ? "bg-primary text-white shadow-lg scale-110" : "text-muted-foreground hover:bg-muted"
                    )} 
                    onClick={() => {
                      setSelectedDay(day);
                      setIsDayViewOpen(true);
                    }}
                  >
                    {format(day, "d")}
                  </span>
                  {dayEvents.length > 0 && <span className="text-[9px] font-black uppercase opacity-20">{dayEvents.length} RDV</span>}
                </div>
                <div className="space-y-1.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map(event => (
                    <div key={event.id} onClick={() => openEditEvent(event)} className={cn("text-[9px] font-bold p-1.5 border-l-2 rounded-lg truncate cursor-pointer transition-all hover:translate-x-1", event.source === 'google' ? "bg-white border-primary shadow-sm" : "bg-amber-50 border-amber-500")}>
                      {event.titre}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[8px] font-black uppercase text-center opacity-30">+ {dayEvents.length - 3} autres</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-full w-full flex flex-col items-center justify-center gap-4 py-20"><Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Chargement de l'agenda collaboratif...</p></div>;

  return (
    <div className="h-full w-full bg-card overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden">{viewMode === '3day' ? render3DayView() : renderMonthView()}</div>
      
      <Dialog open={isEventDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEventDialogOpen(false);
          setOpenSelect(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl bg-card rounded-[2rem]">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl shadow-inner">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <DialogTitle className="text-xl font-black uppercase tracking-tighter">
                    {editingEvent ? "Modifier le RDV" : "Nouveau RDV Équipe"}
                  </DialogTitle>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Agenda Partagé</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-5">
            {editingEvent && (
              <div className="flex items-center gap-2 mb-4 bg-muted/50 p-3 rounded-xl border">
                <UserIcon className="w-4 h-4 text-primary/60" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Créé par</span>
                  <span className="text-sm font-bold text-primary">{getCreatorName(editingEvent.userId)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="titre" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Objet du rendez-vous</Label>
              <Input 
                id="titre" 
                value={formTitre} 
                onChange={(e) => setFormTitre(e.target.value)} 
                placeholder="Ex: Briefing design Grow&Go..." 
                className="border-primary/10 h-12 rounded-xl font-bold shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  className="border-primary/10 h-12 rounded-xl font-bold"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Durée</Label>
                <Select 
                  open={openSelect === 'duration'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'duration' : null)}
                  value={selectedDuration} 
                  onValueChange={setSelectedDuration}
                >
                  <SelectTrigger className="border-primary/10 h-12 rounded-xl font-bold">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-none shadow-2xl rounded-xl">
                    {durations.map(d => (
                      <SelectItem key={d.value} value={d.value} className="font-bold">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Heure de début</Label>
              <div className="flex gap-3">
                <Select 
                  open={openSelect === 'hour'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'hour' : null)}
                  value={formHour} 
                  onValueChange={setFormHour}
                >
                  <SelectTrigger className="w-full border-primary/10 h-12 rounded-xl font-bold">
                    <SelectValue placeholder="Heure" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] bg-card border-none shadow-2xl rounded-xl">
                    {hoursList.map(h => (
                      <SelectItem key={h} value={h} className="font-mono font-bold">{h} h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  open={openSelect === 'minute'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'minute' : null)}
                  value={formMinute} 
                  onValueChange={setFormMinute}
                >
                  <SelectTrigger className="w-full border-primary/10 h-12 rounded-xl font-bold">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-none shadow-2xl rounded-xl">
                    {minutesList.map(m => (
                      <SelectItem key={m} value={m} className="font-mono font-bold">{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {calculatedTimes && (
              <div className="bg-primary/5 p-4 rounded-[1.5rem] border-2 border-dashed border-primary/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Début</p>
                    <p className="text-sm font-black text-primary">{format(calculatedTimes.start, "d MMM HH:mm", { locale: fr })}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary/20" />
                  <div className="space-y-0.5 text-right">
                    <p className="text-[9px] font-black text-primary/40 uppercase tracking-widest">Fin</p>
                    <p className="text-sm font-black text-primary">{format(calculatedTimes.end, "HH:mm", { locale: fr })}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Notes collaboratives</Label>
              <Textarea 
                id="description" 
                value={formDescription} 
                onChange={(e) => setFormDescription(e.target.value)} 
                placeholder="Précisions pour vos collaborateurs..." 
                className="min-h-[60px] rounded-xl border-primary/10 resize-none font-bold text-sm p-4 shadow-inner" 
              />
            </div>
          </div>

          <div className="p-6 bg-muted/20 border-t flex items-center justify-between rounded-b-[2rem]">
            {editingEvent ? (
              <Button variant="ghost" size="sm" onClick={handleDeleteEvent} className="text-rose-900 hover:bg-rose-100 font-black text-[10px] gap-2 rounded-full uppercase tracking-widest">
                <Trash2 className="w-4 h-4" /> Supprimer
              </Button>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsEventDialogOpen(false)} className="rounded-full font-bold uppercase text-[10px] tracking-widest">
                Annuler
              </Button>
              <Button onClick={handleSaveEvent} className="bg-primary hover:bg-primary/90 rounded-full font-bold uppercase text-[10px] tracking-widest px-8 h-10 shadow-lg">
                Valider
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDayViewOpen} onOpenChange={setIsDayViewOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-background rounded-[2rem]">
          <div className="p-8 bg-primary text-primary-foreground flex justify-between items-center">
            <div className="flex flex-col gap-1">
               <DialogTitle className="text-3xl font-black uppercase tracking-tighter">
                {selectedDay ? format(selectedDay, "d MMMM", { locale: fr }) : "Détails"}
               </DialogTitle>
               <p className="text-[10px] font-black opacity-60 uppercase tracking-widest flex items-center gap-2">
                <Users className="w-3 h-3" /> Agenda de Studio
               </p>
            </div>
          </div>
          
          <ScrollArea className="h-[55vh] p-0">
             <div className="relative p-6 space-y-1">
                {Array.from({ length: 24 }).map((_, hour) => {
                   const hourDate = selectedDay ? setHours(startOfDay(selectedDay), hour) : null;
                   const hourEvents = hourDate ? getEventsForDay(selectedDay!).filter(e => {
                      const start = parseISO(e.debut);
                      return start.getHours() === hour;
                   }) : [];

                   return (
                      <div key={hour} className="flex border-b border-muted/30 last:border-0 min-h-[70px] relative group hover:bg-primary/[0.02] transition-colors rounded-xl overflow-hidden">
                         <div className="w-20 flex-shrink-0 py-6 text-[10px] font-black text-primary/30 border-r bg-muted/5 flex flex-col items-center justify-center">
                            {hour.toString().padStart(2, '0')}:00
                         </div>
                         <div className="flex-1 p-3 flex flex-col gap-2">
                            {hourEvents.length > 0 ? hourEvents.map(event => (
                               <div 
                                  key={event.id} 
                                  onClick={() => {
                                     setIsDayViewOpen(false);
                                     openEditEvent(event);
                                  }}
                                  className={cn(
                                     "p-3 rounded-xl border-l-4 shadow-md cursor-pointer transition-all hover:translate-x-1",
                                     event.source === 'google' ? "bg-white border-primary" : "bg-amber-50 border-amber-500"
                                  )}
                               >
                                  <div className="flex items-center justify-between mb-1.5">
                                     <p className="text-[9px] font-black uppercase text-primary/40">
                                        {format(parseISO(event.debut), "HH:mm")} - {format(parseISO(event.fin), "HH:mm")}
                                     </p>
                                     <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-[7px] h-4 border-primary/10 font-black uppercase">
                                            {event.source}
                                        </Badge>
                                        <span className="text-[8px] font-black uppercase text-muted-foreground">{getCreatorName(event.userId)}</span>
                                     </div>
                                  </div>
                                  <h4 className="text-sm font-bold text-foreground leading-tight">{event.titre}</h4>
                               </div>
                            )) : (
                               <div 
                                  className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  onClick={() => {
                                     setIsDayViewOpen(false);
                                     const target = selectedDay ? setHours(startOfDay(selectedDay), hour) : new Date();
                                     openAddEvent(target);
                                  }}
                               >
                                  <Plus className="w-5 h-5 text-primary/10" />
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>
          </ScrollArea>
          
          <div className="p-6 border-t bg-muted/10 flex justify-end rounded-b-[2rem]">
             <Button className="rounded-full font-black uppercase text-[10px] tracking-widest gap-2 h-11 px-8 shadow-xl" onClick={() => {
                setIsDayViewOpen(false);
                openAddEvent(selectedDay || new Date());
             }}>
                <Plus className="w-4 h-4" /> Créer un rendez-vous
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
