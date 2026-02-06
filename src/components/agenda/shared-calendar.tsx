'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar as CalendarIcon, Plus, Users, Chrome, Layout, Loader2, Link2 } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, addHours, startOfToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function SharedCalendar({ companyId }: { companyId: string }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [connectedServices, setConnectedServices] = React.useState<string[]>([]);
  const db = useFirestore();
  const { toast } = useToast();

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const selectedDateEvents = React.useMemo(() => {
    if (!events || !date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }, [events, date]);

  const handleConnect = async (service: 'google' | 'outlook') => {
    setIsSyncing(true);
    toast({
      title: `Connexion à ${service === 'google' ? 'Google Calendar' : 'Outlook'}...`,
      description: "Authentification sécurisée en cours avec Grow&Go.",
    });

    // Simulation d'authentification OAuth
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (!db || !companyId) return;

    // Ajouter des événements de démo pour montrer la réussite de la sync
    const eventsRef = collection(db, 'companies', companyId, 'events');
    const today = startOfToday();
    
    const demoEvent: Partial<CalendarEvent> = {
      companyId,
      title: service === 'google' ? "Réunion Design Studio" : "Point Budget Hebdo",
      description: `Importé automatiquement de votre compte ${service}.`,
      startTime: addHours(today, 14).toISOString(),
      endTime: addHours(today, 15).toISOString(),
      attendees: ["team@growandgo.ai"],
      source: service,
      type: 'meeting'
    };

    addDocumentNonBlocking(eventsRef, demoEvent);

    setConnectedServices(prev => [...prev, service]);
    setIsSyncing(false);
    toast({
      title: "Synchronisation réussie !",
      description: `Votre calendrier ${service} est maintenant lié à Grow&Go.`,
    });
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar de contrôle */}
      <div className="w-full lg:w-80 border-r bg-muted/10 p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Synchronisation
          </h3>
          
          <div className="grid gap-3">
            <Button 
              variant={connectedServices.includes('google') ? "outline" : "default"} 
              className={cn("w-full justify-start h-12 gap-3", connectedServices.includes('google') && "border-emerald-500 text-emerald-600 bg-emerald-50/50")}
              onClick={() => handleConnect('google')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {connectedServices.includes('google') ? "Google Connecté" : "Sync Google Calendar"}
            </Button>

            <Button 
              variant={connectedServices.includes('outlook') ? "outline" : "default"}
              className={cn("w-full justify-start h-12 gap-3", connectedServices.includes('outlook') && "border-blue-500 text-blue-600 bg-blue-50/50")}
              onClick={() => handleConnect('outlook')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-5 h-5" />}
              {connectedServices.includes('outlook') ? "Outlook Connecté" : "Sync Outlook Calendar"}
            </Button>
          </div>
        </div>

        <div className="pt-6 border-t">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-xl border bg-card shadow-sm"
            locale={fr}
          />
        </div>
      </div>

      {/* Vue Planning principale */}
      <div className="flex-1 p-8 space-y-8 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-3xl font-extrabold tracking-tight">
              {date ? format(date, "EEEE d MMMM", { locale: fr }) : "Planning"}
            </h2>
            <p className="text-muted-foreground">Calendrier partagé de l'équipe Grow&Go.</p>
          </div>
          <Button size="lg" className="bg-primary shadow-xl hover:scale-105 transition-transform">
            <Plus className="w-5 h-5 mr-2" /> Ajouter un événement
          </Button>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Récupération des agendas...</p>
            </div>
          ) : selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-lg transition-all border-l-4 border-l-primary overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-6">
                      <div className="w-20 text-center border-r pr-6">
                        <span className="text-2xl font-black block text-primary">
                          {format(new Date(event.startTime), "HH:mm")}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Début</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={cn(
                            "px-2 py-0 text-[10px] font-bold uppercase",
                            event.source === 'google' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                          )}>
                            {event.source}
                          </Badge>
                          <h4 className="text-xl font-bold">{event.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-2xl">{event.description}</p>
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center text-xs font-semibold text-muted-foreground">
                            <Users className="w-4 h-4 mr-1.5" />
                            {event.attendees?.length || 0} participants
                          </div>
                          <div className="flex items-center text-xs font-semibold text-muted-foreground">
                            <CalendarIcon className="w-4 h-4 mr-1.5" />
                            Fin à {format(new Date(event.endTime), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
                      <Mail className="w-5 h-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-24 border-2 border-dashed rounded-3xl bg-muted/5">
              <div className="bg-muted p-6 rounded-full mb-6">
                <CalendarIcon className="w-12 h-12 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-bold mb-2">Aucun événement prévu</h3>
              <p className="text-muted-foreground text-center max-w-xs">
                Synchronisez vos comptes professionnels pour voir apparaître le planning de vos collaborateurs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
