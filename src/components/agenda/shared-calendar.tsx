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
  X
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
import { collection, query, doc } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid, addMinutes, setHours, setMinutes, eachHourOfInterval, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
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

interface SharedCalendarProps {
  companyId: string;
  isCompact?: boolean;
  defaultView?: '3day' | 'month';
}

export function SharedCalendar({ companyId, isCompact = false, defaultView = '3day' }: SharedCalendarProps) {
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(isCompact ? '3day' : defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isSyncing, setIsSyncing] = React.useState<'idle' | 'importing' | 'exporting'>('idle');
  const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
  const [isDayViewOpen, setIsDayViewOpen] = React.useState(false);
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
  // Drag and Drop State
  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const isDraggingRef = React.useRef(false);

  const [openSelect, setOpenSelect] = React.useState<'duration' | 'hour' | 'minute' | null>(null);

  // Form State
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

  const startHour = 6;
  const endHour = 20;
  const hourHeight = isCompact ? 50 : 60;

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

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
    if (e.button !== 0) return; // Only left click
    
    const startY = e.clientY;
    const snapPixels = (10 / 60) * hourHeight;
    isDraggingRef.current = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaY) > 5) {
        isDraggingRef.current = true;
        setDraggedEventId(event.id);
        const snappedDelta = Math.round(deltaY / snapPixels) * snapPixels;
        setDragOffset(snappedDelta);
      }
    };

    const onMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (isDraggingRef.current) {
        const deltaY = upEvent.clientY - startY;
        const snappedDelta = Math.round(deltaY / snapPixels) * snapPixels;
        const minutesDelta = (snappedDelta / hourHeight) * 60;

        if (minutesDelta !== 0 && db && companyId) {
          const oldStart = parseISO(event.debut);
          const oldEnd = parseISO(event.fin);
          const newStart = addMinutes(oldStart, minutesDelta);
          const newEnd = addMinutes(oldEnd, minutesDelta);

          const eventRef = doc(db, 'companies', companyId, 'events', event.id);
          updateDocumentNonBlocking(eventRef, {
            debut: newStart.toISOString(),
            fin: newEnd.toISOString(),
            derniere_maj: new Date().toISOString()
          });
          toast({ title: "Horaire mis à jour" });
        }
      } else {
        openEditEvent(event);
      }

      setDraggedEventId(null);
      setDragOffset(0);
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
      toast({ title: "Exportation réussie !", description: `${count} événements ajoutés à votre Google Calendar.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Échec d'exportation", description: error.message });
    } finally {
      setIsSyncing('idle');
    }
  };

  const openAddEvent = (date?: Date) => {
    setEditingEvent(null);
    const targetDate = date || new Date();
    const minutesVal = targetDate.getMinutes();
    const roundedMinutes = Math.round(minutesVal / 10) * 10;
    if (roundedMinutes >= 60) {
      targetDate.setHours(targetDate.getHours() + 1);
      targetDate.setMinutes(0);
    } else {
      targetDate.setMinutes(roundedMinutes);
    }
    
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
    const startDate = parseISO(event.debut);
    const endDate = parseISO(event.fin);
    
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
    const startDate = new Date(year, month - 1, day, parseInt(formHour), parseInt(formMinute));
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
      toast({ title: "Événement créé" });
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
        <div className="flex mb-2 flex-shrink-0">
          <div className={cn("flex-shrink-0", isCompact ? "w-10" : "w-16")} />
          <div className="flex-1 grid grid-cols-3 gap-2">
            {days.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-primary/60">{isToday(day) ? "Auj." : format(day, "EEE", { locale: fr })}</p>
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
                  <span className={cn("font-black text-muted-foreground/40 mt-1", isCompact ? "text-[8px]" : "text-[10px]")}>{h}:00</span>
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
                            "absolute left-0 right-0 mx-1 z-20 rounded-lg border-l-4 shadow-md hover:ring-2 hover:ring-primary/20 transition-all cursor-pointer p-1.5 overflow-hidden flex flex-col select-none",
                            event.source === 'google' ? "bg-white border-primary" : "bg-amber-50 border-amber-500",
                            isCurrentDragged && "z-50 opacity-90 scale-[1.02] shadow-2xl ring-2 ring-primary border-dashed"
                          )}
                          style={{ 
                            top: `${topPos + (isCurrentDragged ? dragOffset : 0)}px`, 
                            height: `${eventHeight}px`, 
                            minHeight: '24px' 
                          }}
                        >
                          <p className={cn("font-black text-primary/80 shrink-0", isCompact ? "text-[8px]" : "text-[10px]")}>
                            {format(isCurrentDragged ? addMinutes(start, (dragOffset/hourHeight)*60) : start, "HH:mm")}
                          </p>
                          <h4 className={cn("font-bold leading-tight line-clamp-2 text-foreground", isCompact ? "text-[10px]" : "text-sm")}>
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
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { locale: fr });
    const calendarEnd = endOfWeek(monthEnd, { locale: fr });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="bg-card flex flex-col h-full animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b bg-muted/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h2 className="text-3xl font-black tracking-tighter text-primary uppercase">{format(currentDate, "MMMM yyyy", { locale: fr })}</h2>
            <div className="flex bg-background border rounded-full p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setCurrentDate(addDays(startOfMonth(currentDate), -1))}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={() => setCurrentDate(addDays(endOfMonth(currentDate), 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full font-bold gap-2" onClick={handleImportFromGoogle} disabled={isSyncing !== 'idle'}>
                {isSyncing === 'importing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
                Importer de Google
              </Button>
              <Button variant="outline" size="sm" className="rounded-full font-bold gap-2 border-primary/30 text-primary" onClick={handleExportToGoogle} disabled={isSyncing !== 'idle'}>
                {isSyncing === 'exporting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                Exporter vers Google
              </Button>
              <Button size="sm" className="rounded-full font-bold gap-2 bg-primary" onClick={() => openAddEvent()}>
                <Plus className="w-4 h-4" /> Ajouter
              </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b bg-muted/10">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">{d}</div>)}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-fr min-h-[500px]">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isTday = isToday(day);
            const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentDate));
            return (
              <div key={idx} className={cn("border-r border-b p-2 flex flex-col gap-1.5 transition-colors min-h-[100px] group", !isCurrentMonth && "bg-muted/10 opacity-30", isTday && "bg-primary/[0.04]")}>
                <div className="flex justify-between items-center">
                  <span 
                    className={cn("text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full cursor-pointer hover:bg-primary/20", isTday ? "bg-primary text-white" : "text-muted-foreground")} 
                    onClick={() => {
                      setSelectedDay(day);
                      setIsDayViewOpen(true);
                    }}
                  >
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1 overflow-hidden">
                  {dayEvents.slice(0, 4).map(event => (
                    <div key={event.id} onClick={() => openEditEvent(event)} className={cn("text-[8px] font-bold p-1 border-l-2 rounded-sm truncate cursor-pointer transition-colors", event.source === 'google' ? "bg-primary/5 border-primary hover:bg-primary/10" : "bg-amber-50 border-amber-500 hover:bg-amber-100")}>
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

  if (isLoading) return <div className="h-full w-full flex flex-col items-center justify-center gap-4 py-12"><Loader2 className="w-8 h-8 animate-spin text-primary opacity-30" /><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Chargement...</p></div>;

  return (
    <div className="h-full w-full bg-card overflow-hidden flex flex-col">
      <div className="flex-1 overflow-hidden">{viewMode === '3day' ? render3DayView() : renderMonthView()}</div>
      
      <Dialog open={isEventDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEventDialogOpen(false);
          setOpenSelect(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <div className="p-5 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <DialogTitle className="text-lg font-bold">
                  {editingEvent ? "Éditer l'événement" : "Nouvel événement"}
                </DialogTitle>
              </div>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="titre" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Objet de l'événement</Label>
              <Input 
                id="titre" 
                value={formTitre} 
                onChange={(e) => setFormTitre(e.target.value)} 
                placeholder="Ex: Réunion d'équipe..." 
                className="border-primary/10 focus:ring-primary font-semibold h-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="date" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  className="border-primary/10 h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Durée</Label>
                <Select 
                  open={openSelect === 'duration'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'duration' : null)}
                  value={selectedDuration} 
                  onValueChange={setSelectedDuration}
                >
                  <SelectTrigger className="border-primary/10 h-10">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border shadow-xl">
                    {durations.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Début (Heure & Min)</Label>
              <div className="flex gap-2">
                <Select 
                  open={openSelect === 'hour'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'hour' : null)}
                  value={formHour} 
                  onValueChange={setFormHour}
                >
                  <SelectTrigger className="w-full border-primary/10 h-10">
                    <SelectValue placeholder="Heure" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[160px] bg-card border shadow-xl">
                    {hoursList.map(h => (
                      <SelectItem key={h} value={h}>{h} h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  open={openSelect === 'minute'} 
                  onOpenChange={(open) => setOpenSelect(open ? 'minute' : null)}
                  value={formMinute} 
                  onValueChange={setFormMinute}
                >
                  <SelectTrigger className="w-full border-primary/10 h-10">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border shadow-xl">
                    {minutesList.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {calculatedTimes && (
              <div className="bg-primary/5 p-3 rounded-xl border border-dashed border-primary/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Du</p>
                    <p className="text-xs font-bold text-foreground">{format(calculatedTimes.start, "d MMM HH:mm", { locale: fr })}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary/30" />
                  <div className="space-y-0.5 text-right">
                    <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Au</p>
                    <p className="text-xs font-bold text-foreground">{format(calculatedTimes.end, "HH:mm", { locale: fr })}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Notes</Label>
              <Textarea 
                id="description" 
                value={formDescription} 
                onChange={(e) => setFormDescription(e.target.value)} 
                placeholder="Précisions sur le rendez-vous..." 
                className="min-h-[40px] focus:min-h-[100px] transition-all duration-300 border-primary/10 resize-none font-medium text-sm p-3" 
              />
            </div>
          </div>

          <div className="p-4 bg-muted/20 border-t flex items-center justify-between">
            {editingEvent ? (
              <Button variant="ghost" size="sm" onClick={handleDeleteEvent} className="text-destructive hover:bg-destructive/10 font-black text-[10px] gap-2 rounded-full uppercase">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsEventDialogOpen(false)} className="rounded-full font-bold text-xs">
                Annuler
              </Button>
              <Button onClick={handleSaveEvent} className="bg-primary hover:bg-primary/90 rounded-full font-bold text-xs px-6 shadow-md">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDayViewOpen} onOpenChange={setIsDayViewOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-background">
          <div className="p-6 bg-primary text-primary-foreground flex justify-between items-center">
            <div className="flex flex-col">
               <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
                {selectedDay ? format(selectedDay, "EEEE d MMMM", { locale: fr }) : "Détails de la journée"}
               </DialogTitle>
               <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Planning heure par heure</p>
            </div>
          </div>
          
          <ScrollArea className="h-[60vh] p-0">
             <div className="relative p-6">
                {Array.from({ length: 24 }).map((_, hour) => {
                   const hourDate = selectedDay ? setHours(startOfDay(selectedDay), hour) : null;
                   const hourEvents = hourDate ? getEventsForDay(selectedDay!).filter(e => {
                      const start = parseISO(e.debut);
                      return start.getHours() === hour;
                   }) : [];

                   return (
                      <div key={hour} className="flex border-b last:border-0 min-h-[60px] relative group hover:bg-muted/5 transition-colors">
                         <div className="w-16 flex-shrink-0 py-4 text-[10px] font-black text-muted-foreground border-r bg-muted/5 flex flex-col items-center justify-center">
                            {hour.toString().padStart(2, '0')}:00
                         </div>
                         <div className="flex-1 p-2 flex flex-col gap-2">
                            {hourEvents.length > 0 ? hourEvents.map(event => (
                               <div 
                                  key={event.id} 
                                  onClick={() => {
                                     setIsDayViewOpen(false);
                                     openEditEvent(event);
                                  }}
                                  className={cn(
                                     "p-2 rounded-lg border-l-4 shadow-sm cursor-pointer transition-transform hover:scale-[1.02]",
                                     event.source === 'google' ? "bg-primary/5 border-primary" : "bg-amber-50 border-amber-500"
                                  )}
                               >
                                  <div className="flex items-center justify-between mb-1">
                                     <p className="text-[8px] font-black uppercase text-primary/60">
                                        {format(parseISO(event.debut), "HH:mm")} - {format(parseISO(event.fin), "HH:mm")}
                                     </p>
                                     {event.source === 'google' && <Chrome className="w-3 h-3 text-primary opacity-30" />}
                                  </div>
                                  <h4 className="text-xs font-bold text-foreground leading-tight">{event.titre}</h4>
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
                                  <Plus className="w-4 h-4 text-primary/20" />
                               </div>
                            )}
                         </div>
                      </div>
                   );
                })}
             </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-muted/10 flex justify-end">
             <Button className="rounded-full font-bold gap-2" onClick={() => {
                setIsDayViewOpen(false);
                openAddEvent(selectedDay || new Date());
             }}>
                <Plus className="w-4 h-4" /> Ajouter un événement
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
