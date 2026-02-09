
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
  CalendarDays
} from 'lucide-react';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  useUser, 
  useAuth,
  deleteDocumentNonBlocking,
  addDocumentNonBlocking,
  updateDocumentNonBlocking
} from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, isSameDay, parseISO, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, startOfWeek, endOfWeek, isValid, addMinutes, differenceInMinutes } from 'date-fns';
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

interface SharedCalendarProps {
  companyId: string;
  isCompact?: boolean;
  defaultView?: '3day' | 'month';
  hideViewSwitcher?: boolean;
}

export function SharedCalendar({ companyId, isCompact = false, defaultView = '3day', hideViewSwitcher = false }: SharedCalendarProps) {
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
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
  const hourHeight = 70; // Hauteur généreuse pour éviter le scroll

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId.toLowerCase(), 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const getEventsForDay = (day: Date) => {
    if (!events) return [];
    return events.filter(e => e.debut && isSameDay(parseISO(e.debut), day));
  };

  const handleSaveEvent = () => {
    if (!db || !companyId || !user || !formTitre) return;
    const [y, m, d] = formDate.split('-').map(Number);
    const start = new Date(y, m - 1, d, parseInt(formHour), parseInt(formMinute));
    const end = addMinutes(start, parseInt(selectedDuration));

    const eventData = {
      companyId: companyId.toLowerCase(),
      userId: user.uid,
      titre: formTitre,
      debut: start.toISOString(),
      fin: end.toISOString(),
      description: formDescription,
      source: editingEvent?.source || 'local',
      type: 'event',
      derniere_maj: new Date().toISOString(),
    };

    if (editingEvent) {
      updateDocumentNonBlocking(doc(db, 'companies', companyId.toLowerCase(), 'events', editingEvent.id), eventData);
    } else {
      addDocumentNonBlocking(collection(db, 'companies', companyId.toLowerCase(), 'events'), { ...eventData, id_externe: Math.random().toString(36).substring(7) });
    }
    setIsEventDialogOpen(false);
    toast({ title: "Agenda mis à jour" });
  };

  const render3DayView = () => {
    const days = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
    const hoursLabels = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
      <div className="flex flex-col h-full bg-card p-6">
        <div className="flex items-center justify-between mb-6 px-4 py-2 border-b bg-muted/5 rounded-3xl">
           <div className="flex bg-white border rounded-full p-1 shadow-sm">
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft className="w-5 h-5" /></Button>
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-5 h-5" /></Button>
           </div>
           <Button size="sm" className="h-10 px-8 bg-primary rounded-xl font-bold" onClick={() => { setEditingEvent(null); setIsEventDialogOpen(true); }}>
             <Plus className="w-4 h-4 mr-2" /> Nouveau RDV
           </Button>
        </div>

        <div className="flex mb-4">
          <div className="w-16" />
          <div className="flex-1 grid grid-cols-3 gap-6">
            {days.map((day, idx) => (
              <div key={idx} className="text-center">
                <p className="text-[10px] font-black uppercase text-primary/30 mb-1">{format(day, "EEEE", { locale: fr })}</p>
                <h3 className="font-black text-primary text-xl">{format(day, "d MMM", { locale: fr })}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex-1 pt-6"> {/* pt-6 pour assurer que 8h00 n'est pas coupé */}
          <div className="flex relative" style={{ height: `${(hoursLabels.length - 1) * hourHeight}px` }}>
            <div className="w-16 border-r relative bg-muted/[0.03]">
              {hoursLabels.map((h, i) => (
                <div key={h} className="absolute left-0 right-0 text-center" style={{ top: `${i * hourHeight}px`, height: '0px' }}>
                  <span className="font-black text-primary/40 text-[10px] bg-background px-1 z-10">{h}:00</span>
                </div>
              ))}
            </div>

            <div className="flex-1 grid grid-cols-3 gap-6 relative">
              {days.map((day, idx) => (
                <div key={idx} className="relative h-full border-r last:border-r-0">
                  {hoursLabels.slice(0, -1).map((h) => <div key={h} style={{ height: `${hourHeight}px` }} className="border-b border-primary/5" />)}
                  {getEventsForDay(day).map(event => {
                    const start = parseISO(event.debut);
                    const end = parseISO(event.fin);
                    const duration = differenceInMinutes(end, start);
                    const topPos = (start.getHours() - startHour) * hourHeight + (start.getMinutes() / 60 * hourHeight);
                    const height = Math.max(28, (duration / 60) * hourHeight);

                    return (
                      <div 
                        key={event.id} 
                        onClick={() => { setEditingEvent(event); setIsEventDialogOpen(true); }}
                        className={cn(
                          "absolute left-0 right-0 mx-1 z-10 rounded-2xl border-l-4 shadow-sm cursor-pointer p-2.5 overflow-hidden flex select-none transition-all hover:scale-[1.02]",
                          event.isBillingEvent ? "bg-amber-50 border-amber-500" : "bg-primary/5 border-primary/40",
                          duration <= 20 ? "flex-row items-center gap-2" : "flex-col"
                        )}
                        style={{ top: `${topPos}px`, height: `${height}px` }}
                      >
                        <span className="font-black text-primary/40 text-[10px] shrink-0">{format(start, "HH:mm")}</span>
                        <span className="font-bold text-[11px] text-primary truncate leading-none">{event.titre}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin opacity-20" /></div>;

  return (
    <div className="h-full w-full bg-card overflow-hidden">
      {viewMode === '3day' ? render3DayView() : <div className="p-20 text-center">Vue Mensuelle non disponible dans ce mode</div>}
      
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl bg-card rounded-[2.5rem]">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl"><CalendarDays className="w-6 h-6" /></div>
                <DialogTitle className="text-xl font-black uppercase tracking-tighter">{editingEvent ? "Modifier RDV" : "Nouveau RDV"}</DialogTitle>
              </div>
            </DialogHeader>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-50 ml-1">Objet</Label>
              <Input value={formTitre} onChange={(e) => setFormTitre(e.target.value)} className="h-12 rounded-xl font-bold" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-12 rounded-xl font-bold" />
              <div className="flex gap-2">
                <Input type="number" value={formHour} onChange={(e) => setFormHour(e.target.value)} className="h-12 rounded-xl font-bold" />
                <Input type="number" value={formMinute} onChange={(e) => setFormMinute(e.target.value)} className="h-12 rounded-xl font-bold" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-50 ml-1">Durée (minutes)</Label>
              <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="15">15 min</SelectItem><SelectItem value="30">30 min</SelectItem><SelectItem value="60">1h</SelectItem></SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveEvent} className="w-full bg-primary h-12 rounded-xl font-black uppercase tracking-widest text-xs">Confirmer</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
