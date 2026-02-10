'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2,
  CalendarDays,
  UserCheck,
  Search,
  AlertCircle
} from 'lucide-react';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  useUser, 
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, query, doc, where, getDocs } from 'firebase/firestore';
import { CalendarEvent, User } from '@/lib/types';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isToday, 
  startOfWeek, 
  endOfWeek, 
  addMinutes, 
  differenceInMinutes,
  addMonths,
  isWithinInterval
} from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';

interface SharedCalendarProps {
  companyId: string;
  isCompact?: boolean;
  defaultView?: '3day' | 'month';
  hideViewSwitcher?: boolean;
}

export function SharedCalendar({ companyId, isCompact = false, defaultView = '3day', hideViewSwitcher = false }: SharedCalendarProps) {
  const [viewMode, setViewMode] = React.useState<'3day' | 'month'>(defaultView);
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isEventDialogOpen, setIsEventDialogOpen] = React.useState(false);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(null);
  
  // Supervision State
  const [viewingUserId, setViewingUserId] = React.useState<string | null>(null);
  
  const [formTitre, setFormTitre] = React.useState('');
  const [formDate, setFormDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [formHour, setFormHour] = React.useState('09');
  const [formMinute, setFormMinute] = React.useState('00');
  const [formDescription, setFormDescription] = React.useState('');
  const [selectedDuration, setSelectedDuration] = React.useState('30');
  const [assignedTo, setAssignedTo] = React.useState<string>('me');

  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const startHour = 8;
  const endHour = 20;
  const hourHeight = 70; 

  // Profil & Équipe
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc<User>(userProfileRef);

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'users'), where('companyId', '==', companyId), where('isProfile', '==', true));
  }, [db, companyId]);
  const { data: teamMembers } = useCollection<User>(teamQuery);

  const isPatron = profile?.role === 'admin';
  const currentTargetId = viewingUserId || user?.uid;

  // Re-init target user when profile loads
  React.useEffect(() => {
    if (user && !viewingUserId) setViewingUserId(user.uid);
  }, [user]);

  // Query Events with Filtering logic
  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId || !currentTargetId) return null;
    const normId = companyId.toLowerCase();
    
    // Filtrage strict : on ne charge que les événements du membre sélectionné
    // (où il est créateur OU assigné)
    return query(
      collection(db, 'companies', normId, 'events'),
      where('companyId', '==', normId)
    );
  }, [db, companyId, currentTargetId]);

  const { data: rawEvents, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  // Filtrage local supplémentaire pour la visibilité stricte
  const events = React.useMemo(() => {
    if (!rawEvents || !currentTargetId) return [];
    return rawEvents.filter(e => e.userId === currentTargetId || e.assignedTo === currentTargetId);
  }, [rawEvents, currentTargetId]);

  const getEventsForDay = (day: Date) => {
    return events.filter(e => e.debut && isSameDay(parseISO(e.debut), day));
  };

  const checkConflict = async (start: Date, end: Date, targetId: string) => {
    if (!db || !companyId) return false;
    const normId = companyId.toLowerCase();
    const q = query(collection(db, 'companies', normId, 'events'), where('companyId', '==', normId));
    const snap = await getDocs(q);
    
    return snap.docs.some(doc => {
      const data = doc.data() as CalendarEvent;
      if (doc.id === editingEvent?.id) return false;
      if (data.userId !== targetId && data.assignedTo !== targetId) return false;
      
      const eStart = parseISO(data.debut);
      const eEnd = parseISO(data.fin);
      
      return (
        isWithinInterval(start, { start: eStart, end: eEnd }) ||
        isWithinInterval(end, { start: eStart, end: eEnd }) ||
        (start <= eStart && end >= eEnd)
      );
    });
  };

  const handleSaveEvent = async () => {
    if (!db || !companyId || companyId === 'pending' || !user || !formTitre) {
      toast({ variant: "destructive", title: "Erreur de sécurité", description: "Identité de l'entreprise non chargée." });
      return;
    }

    const [y, m, d] = formDate.split('-').map(Number);
    const start = new Date(y, m - 1, d, parseInt(formHour), parseInt(formMinute));
    const end = addMinutes(start, parseInt(selectedDuration));
    const targetId = assignedTo === 'me' ? user.uid : assignedTo;

    // Conflit detection
    const hasConflict = await checkConflict(start, end, targetId);
    if (hasConflict) {
      const targetName = assignedTo === 'me' ? "Vous êtes" : `${teamMembers?.find(t => t.uid === assignedTo)?.name} est`;
      toast({ variant: "destructive", title: "Conflit d'agenda", description: `${targetName} déjà occupé sur ce créneau.` });
      return;
    }

    const eventData = {
      companyId: companyId.toLowerCase(),
      userId: user.uid,
      assignedTo: targetId,
      assignedToName: teamMembers?.find(t => t.uid === targetId)?.name || profile?.name,
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

  const handleDeleteEvent = () => {
    if (!db || !companyId || !editingEvent) return;
    deleteDocumentNonBlocking(doc(db, 'companies', companyId.toLowerCase(), 'events', editingEvent.id));
    setIsEventDialogOpen(false);
    toast({ title: "Événement supprimé" });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { locale: fr, weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { locale: fr, weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex flex-col h-full bg-card p-4">
        <div className="flex items-center justify-between mb-4 px-4 py-2 border-b bg-muted/5 rounded-3xl">
           <div className="flex bg-white border rounded-full p-1 shadow-sm items-center">
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addMonths(currentDate, -1))}><ChevronLeft className="w-5 h-5" /></Button>
             <div className="px-6 font-black uppercase text-[10px] tracking-widest text-primary min-w-[150px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: fr })}
             </div>
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="w-5 h-5" /></Button>
           </div>
           
           <div className="flex gap-4 items-center">
             {isPatron && (
               <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-1 shadow-sm">
                 <Search className="w-3.5 h-3.5 text-muted-foreground" />
                 <Select value={viewingUserId || ''} onValueChange={setViewingUserId}>
                   <SelectTrigger className="h-8 border-none bg-transparent shadow-none font-bold text-xs p-0 min-w-[120px]">
                     <SelectValue placeholder="Planning de..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value={user?.uid || 'me'}>Moi-même</SelectItem>
                     {teamMembers?.filter(t => t.uid !== user?.uid).map(member => (
                       <SelectItem key={member.uid} value={member.uid}>{member.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             )}

             {!hideViewSwitcher && (
               <div className="flex bg-muted/50 p-1 rounded-xl border">
                 <Button size="sm" variant={viewMode === '3day' ? 'default' : 'ghost'} onClick={() => setViewMode('3day')} className={cn("h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter", viewMode === '3day' && "bg-primary shadow-md")}>3 Jours</Button>
                 <Button size="sm" variant={viewMode === 'month' ? 'default' : 'ghost'} onClick={() => setViewMode('month')} className={cn("h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter", viewMode === 'month' && "bg-primary shadow-md")}>Mois</Button>
               </div>
             )}
             <Button size="sm" className="h-10 px-8 bg-primary rounded-xl font-bold shadow-lg" onClick={() => { setEditingEvent(null); setFormTitre(''); setAssignedTo('me'); setIsEventDialogOpen(true); }}>
               <Plus className="w-4 h-4 mr-2" /> Nouveau
             </Button>
           </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-7 gap-px bg-muted/20 border rounded-3xl overflow-hidden h-full shadow-inner">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} className="bg-muted/10 p-2 text-center text-[10px] font-black uppercase text-primary/30 border-b">{day}</div>
            ))}
            {calendarDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameDay(startOfMonth(day), startOfMonth(currentDate));
              return (
                <div key={idx} className={cn(
                  "bg-white p-2 min-h-[100px] flex flex-col gap-1 transition-colors hover:bg-muted/5 border-r border-b",
                  !isCurrentMonth && "bg-muted/5 opacity-30 grayscale",
                  isToday(day) && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                )}>
                  <span className={cn("text-[11px] font-black", isToday(day) ? "bg-primary text-white w-5 h-5 flex items-center justify-center rounded-full" : "text-primary/40")}>{format(day, 'd')}</span>
                  <div className="flex-1 overflow-y-auto space-y-1 scrollbar-hide max-h-[120px]">
                    {dayEvents.map(event => (
                      <div 
                        key={event.id}
                        onClick={() => { setEditingEvent(event); setFormTitre(event.titre); setAssignedTo(event.assignedTo || 'me'); setIsEventDialogOpen(true); }}
                        className={cn("text-[9px] font-bold p-1 rounded-lg border-l-4 truncate cursor-pointer transition-all hover:translate-x-1", event.isBillingEvent ? "bg-amber-50 border-amber-500 text-amber-700" : "bg-primary/5 border-primary/40 text-primary")}
                      >
                        {format(parseISO(event.debut), 'HH:mm')} {event.titre}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const render3DayView = () => {
    const days = [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
    const hoursLabels = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

    return (
      <div className="flex flex-col h-full bg-card p-6">
        <div className="flex items-center justify-between mb-6 px-4 py-2 border-b bg-muted/5 rounded-3xl">
           <div className="flex bg-white border rounded-full p-1 shadow-sm items-center">
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, -1))}><ChevronLeft className="w-5 h-5" /></Button>
             <div className="px-4 font-black uppercase text-[10px] tracking-widest text-primary min-w-[120px] text-center">{format(currentDate, 'd MMM', { locale: fr })}</div>
             <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCurrentDate(addDays(currentDate, 1))}><ChevronRight className="w-5 h-5" /></Button>
           </div>
           
           <div className="flex gap-4 items-center">
             {isPatron && (
               <div className="flex items-center gap-2 bg-white border rounded-xl px-3 py-1 shadow-sm">
                 <Search className="w-3.5 h-3.5 text-muted-foreground" />
                 <Select value={viewingUserId || ''} onValueChange={setViewingUserId}>
                   <SelectTrigger className="h-8 border-none bg-transparent shadow-none font-bold text-xs p-0 min-w-[120px]">
                     <SelectValue placeholder="Planning de..." />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value={user?.uid || 'me'}>Moi-même</SelectItem>
                     {teamMembers?.filter(t => t.uid !== user?.uid).map(member => (
                       <SelectItem key={member.uid} value={member.uid}>{member.name}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             )}

             {!hideViewSwitcher && (
               <div className="flex bg-muted/50 p-1 rounded-xl border">
                 <Button size="sm" variant={viewMode === '3day' ? 'default' : 'ghost'} onClick={() => setViewMode('3day')} className={cn("h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter", viewMode === '3day' && "bg-primary shadow-md")}>3 Jours</Button>
                 <Button size="sm" variant={viewMode === 'month' ? 'default' : 'ghost'} onClick={() => setViewMode('month')} className={cn("h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter", viewMode === 'month' && "bg-primary shadow-md")}>Mois</Button>
               </div>
             )}
             <Button size="sm" className="h-10 px-8 bg-primary rounded-xl font-bold shadow-lg" onClick={() => { setEditingEvent(null); setFormTitre(''); setAssignedTo('me'); setIsEventDialogOpen(true); }}>
               <Plus className="w-4 h-4 mr-2" /> Nouveau RDV
             </Button>
           </div>
        </div>

        <div className="flex mb-4"><div className="w-16" /><div className="flex-1 grid grid-cols-3 gap-6">{days.map((day, idx) => (<div key={idx} className="text-center"><p className="text-[10px] font-black uppercase text-primary/30 mb-1">{format(day, "EEEE", { locale: fr })}</p><h3 className="font-black text-primary text-xl">{format(day, "d MMM", { locale: fr })}</h3></div>))}</div></div>

        <div className="relative flex-1 pt-6 overflow-y-auto scrollbar-hide">
          <div className="flex relative" style={{ height: `${(hoursLabels.length - 1) * hourHeight}px` }}>
            <div className="w-16 border-r relative bg-muted/[0.03]">{hoursLabels.map((h, i) => (<div key={h} className="absolute left-0 right-0 text-center" style={{ top: `${i * hourHeight}px`, height: '0px' }}><span className="font-black text-primary/40 text-[10px] bg-background px-1 z-10">{h}:00</span></div>))}</div>
            <div className="flex-1 grid grid-cols-3 gap-6 relative">
              {days.map((day, idx) => (
                <div key={idx} className="relative h-full border-r last:border-r-0">
                  {hoursLabels.slice(0, -1).map((h) => <div key={h} style={{ height: `${hourHeight}px` }} className="border-b border-primary/5" />)}
                  {getEventsForDay(day).map(event => {
                    const start = parseISO(event.debut);
                    const duration = differenceInMinutes(parseISO(event.fin), start);
                    const topPos = (start.getHours() - startHour) * hourHeight + (start.getMinutes() / 60 * hourHeight);
                    const height = Math.max(32, (duration / 60) * hourHeight);
                    return (
                      <div key={event.id} onClick={() => { setEditingEvent(event); setFormTitre(event.titre); setAssignedTo(event.assignedTo || 'me'); setIsEventDialogOpen(true); }} className={cn("absolute left-0 right-0 mx-1 z-10 rounded-2xl border-l-4 shadow-md cursor-pointer p-3 overflow-hidden flex flex-col select-none transition-all hover:scale-[1.02] hover:z-20", event.isBillingEvent ? "bg-amber-50 border-amber-500" : "bg-primary/5 border-primary/40")} style={{ top: `${topPos}px`, height: `${height}px` }}>
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
    <div className="h-full w-full bg-card overflow-hidden rounded-[3rem] border border-primary/5 shadow-2xl">
      {viewMode === '3day' ? render3DayView() : renderMonthView()}
      
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl bg-card rounded-[2.5rem]">
          <div className="p-6 bg-primary text-primary-foreground">
            <DialogHeader><div className="flex items-center gap-4"><div className="p-3 bg-white/20 rounded-xl"><CalendarDays className="w-6 h-6" /></div><DialogTitle className="text-xl font-black uppercase tracking-tighter">{editingEvent ? "Modifier RDV" : "Nouveau RDV"}</DialogTitle></div></DialogHeader>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-50 ml-1">Objet du rendez-vous</Label>
              <Input value={formTitre} onChange={(e) => setFormTitre(e.target.value)} className="h-12 rounded-xl font-bold border-primary/10" placeholder="Ex: Réunion d'équipe..." />
            </div>

            {isPatron && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-50 ml-1 flex items-center gap-2"><UserCheck className="w-3 h-3" /> Assigner ce rendez-vous à</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo}>
                  <SelectTrigger className="h-12 rounded-xl font-bold border-primary/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">Moi-même</SelectItem>
                    {teamMembers?.filter(t => t.uid !== user?.uid).map(member => (
                      <SelectItem key={member.uid} value={member.uid}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50 ml-1">Date</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-12 rounded-xl font-bold" /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50 ml-1">Heure</Label><div className="flex gap-2"><Input type="number" value={formHour} onChange={(e) => setFormHour(e.target.value)} className="h-12 rounded-xl font-bold" min="0" max="23" /><Input type="number" value={formMinute} onChange={(e) => setFormMinute(e.target.value)} className="h-12 rounded-xl font-bold" min="0" max="59" /></div></div>
            </div>
            <div className="space-y-2"><Label className="text-[10px] font-black uppercase opacity-50 ml-1">Durée prévue</Label><Select value={selectedDuration} onValueChange={setSelectedDuration}><SelectTrigger className="h-12 rounded-xl font-bold border-primary/10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="15">15 minutes</SelectItem><SelectItem value="30">30 minutes</SelectItem><SelectItem value="60">1 heure</SelectItem><SelectItem value="120">2 heures</SelectItem></SelectContent></Select></div>
            <div className="flex gap-3 pt-4">{editingEvent && (<Button variant="outline" onClick={handleDeleteEvent} className="h-12 w-12 rounded-xl text-destructive border-destructive/20 hover:bg-destructive/5"><Trash2 className="w-5 h-5" /></Button>)}<Button onClick={handleSaveEvent} className="flex-1 bg-primary h-12 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg">{editingEvent ? "Mettre à jour" : "Confirmer le RDV"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
