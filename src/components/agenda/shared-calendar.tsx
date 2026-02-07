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
  Info
} from 'lucide-react';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  useUser, 
  useAuth,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking
} from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid, addMinutes, setHours, setMinutes } from 'date-fns';
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
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
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

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  // Helper for calculated times summary
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

  const nextMonth = () => setCurrentDate(addDays(endOfMonth(currentDate), 1));
  const prevMonth = () => setCurrentDate(addDays(startOfMonth(currentDate), -1));

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
    // Round to nearest 10 mins
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
    return (
      <div className={cn("grid gap-4 h-full", isCompact ? "grid-cols-3 gap-2 p-3" : "grid-cols-1 md:grid-cols-3 p-8 min-h-[600px]")}>
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const isTday = isToday(day);
          return (
            <div key={idx} className={cn("flex flex-col gap-2 rounded-2xl border transition-all overflow-hidden", isTday ? "bg-primary/[0.03] border-primary/20" : "bg-card shadow-sm", isCompact ? "p-2 border-none" : "p-6")}>
              <div className={cn("flex flex-col border-b pb-1 mb-1", isCompact && "items-center text-center")}>
                <div className="flex justify-between items-center">
                  <p className="text-[8px] font-black uppercase tracking-wider text-primary/60">{isTday ? "Auj." : format(day, "EEE", { locale: fr })}</p>
                  {!isCompact && <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAddEvent(day)}><Plus className="w-3 h-3" /></Button>}
                </div>
                <h3 className={cn("font-black text-primary", isCompact ? "text-xs" : "text-xl")}>{format(day, "d MMM", { locale: fr })}</h3>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto pr-0.5 custom-scrollbar">
                {dayEvents.length > 0 ? dayEvents.map(event => (
                  <div key={event.id} onClick={() => !isCompact && openEditEvent(event)} className={cn("bg-white rounded-lg border-l-4 border-primary shadow-sm hover:border-l-primary/50 transition-colors cursor-pointer", isCompact ? "p-1.5" : "p-3")}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[7px] font-black text-primary/70">{event.debut ? format(parseISO(event.debut), "HH:mm") : "--:--"}</p>
                      {event.source === 'google' && <Chrome className="w-2 h-2 text-primary opacity-30" />}
                    </div>
                    <h4 className={cn("font-bold leading-tight text-foreground line-clamp-2", isCompact ? "text-[8px]" : "text-xs")}>{event.titre}</h4>
                  </div>
                )) : <div className="h-full flex flex-col items-center justify-center opacity-20 text-center py-4"><p className="text-[7px] font-black uppercase tracking-widest">Aucun RDV</p></div>}
              </div>
            </div>
          );
        })}
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
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
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
              <Button variant="ghost" size="sm" onClick={() => setViewMode('3day')} className="rounded-full font-bold">Retour</Button>
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
                  <span className={cn("text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full cursor-pointer hover:bg-primary/10", isTday ? "bg-primary text-white" : "text-muted-foreground")} onClick={() => openAddEvent(day)}>{format(day, "d")}</span>
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
      
      <Dialog open={isEventDialogOpen} onOpenChange={(open) => !open && setIsEventDialogOpen(false)}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <DialogTitle className="text-xl font-bold">
                  {editingEvent ? "Modifier l'événement" : "Nouvel événement"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-primary-foreground/70">
                Planifiez vos rendez-vous Grow&Go.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-6 bg-card">
            <div className="grid gap-2">
              <Label htmlFor="titre" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Objet de l'événement</Label>
              <Input 
                id="titre" 
                value={formTitre} 
                onChange={(e) => setFormTitre(e.target.value)} 
                placeholder="Ex: Signature de contrat..." 
                className="border-primary/20 focus:ring-primary font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formDate} 
                  onChange={(e) => setFormDate(e.target.value)} 
                  className="border-primary/20"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Durée prévue</Label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger className="border-primary/20">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Heure de début</Label>
              <div className="flex gap-2">
                <Select value={formHour} onValueChange={setFormHour}>
                  <SelectTrigger className="w-full border-primary/20">
                    <SelectValue placeholder="Heure" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {hoursList.map(h => (
                      <SelectItem key={h} value={h}>{h} h</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formMinute} onValueChange={setFormMinute}>
                  <SelectTrigger className="w-full border-primary/20">
                    <SelectValue placeholder="Min" />
                  </SelectTrigger>
                  <SelectContent>
                    {minutesList.map(m => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {calculatedTimes && (
              <div className="bg-muted/30 p-4 rounded-xl border border-dashed border-primary/20 space-y-2 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60">
                  <Clock className="w-3 h-3" />
                  Résumé de l'horaire
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Début</p>
                    <p className="text-sm font-bold text-foreground">{format(calculatedTimes.start, "d MMMM 'à' HH:mm", { locale: fr })}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary/30" />
                  <div className="space-y-0.5 text-right">
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">Fin</p>
                    <p className="text-sm font-bold text-foreground">{format(calculatedTimes.end, "HH:mm", { locale: fr })}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</Label>
              <Textarea 
                id="description" 
                value={formDescription} 
                onChange={(e) => setFormDescription(e.target.value)} 
                placeholder="Détails optionnels..." 
                className="min-h-[60px] border-primary/20 resize-none" 
              />
            </div>
          </div>

          <div className="p-6 bg-muted/10 border-t flex items-center justify-between">
            {editingEvent ? (
              <Button variant="ghost" size="sm" onClick={handleDeleteEvent} className="text-destructive hover:bg-destructive/10 font-bold gap-2 rounded-full">
                <Trash2 className="w-4 h-4" /> Supprimer
              </Button>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setIsEventDialogOpen(false)} className="rounded-full font-bold px-6">
                Annuler
              </Button>
              <Button onClick={handleSaveEvent} className="bg-primary hover:bg-primary/90 rounded-full font-bold px-8 shadow-lg">
                Enregistrer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}