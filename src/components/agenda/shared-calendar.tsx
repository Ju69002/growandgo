'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar as CalendarIcon, Plus, Users, Chrome, Layout, Loader2, Link2, LogIn } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  getSyncTimeRange, 
  mapGoogleEvent, 
  mapOutlookEvent, 
  syncEventToFirestore,
  fetchGoogleEvents,
  fetchOutlookEvents
} from '@/services/calendar-sync';
import { signInWithGoogleCalendar, signInWithOutlookCalendar } from '@/firebase/non-blocking-login';

export function SharedCalendar({ companyId }: { companyId: string }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [connectedServices, setConnectedServices] = React.useState<string[]>([]);
  const db = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'));
  }, [db, companyId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  const selectedDateEvents = React.useMemo(() => {
    if (!events || !date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.debut);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  }, [events, date]);

  const handleConnect = async (service: 'google' | 'outlook') => {
    if (!db || !companyId || !user || !auth) return;
    
    setIsSyncing(true);
    try {
      toast({
        title: "Connexion en cours...",
        description: `Veuillez vous authentifier auprès de ${service === 'google' ? 'Google' : 'Microsoft'}.`,
      });

      let token: string | undefined;
      let externalEvents: any[] = [];
      const { timeMin, timeMax } = getSyncTimeRange();

      if (service === 'google') {
        const result = await signInWithGoogleCalendar(auth);
        token = result.token;
        if (token) {
          externalEvents = await fetchGoogleEvents(token, timeMin, timeMax);
        }
      } else {
        const result = await signInWithOutlookCalendar(auth);
        token = result.token;
        if (token) {
          externalEvents = await fetchOutlookEvents(token, timeMin);
        }
      }

      if (!token) throw new Error("Impossible de récupérer le jeton d'accès.");

      toast({
        title: "Synchronisation...",
        description: `Importation de ${externalEvents.length} événements trouvés.`,
      });

      // Traitement et Upsert dans Firestore
      for (const extEvent of externalEvents) {
        const mapped = service === 'google' 
          ? mapGoogleEvent(extEvent, companyId, user.uid)
          : mapOutlookEvent(extEvent, companyId, user.uid);
        
        await syncEventToFirestore(db, mapped);
      }

      setConnectedServices(prev => [...new Set([...prev, service])]);
      toast({
        title: "Synchronisation terminée !",
        description: `Votre agenda Grow&Go est à jour avec ${service}.`,
      });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur de synchronisation",
        description: error.message || "Une erreur est survenue lors de la connexion.",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar de contrôle */}
      <div className="w-full lg:w-80 border-r bg-muted/10 p-6 space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Comptes Connectés
          </h3>
          
          <div className="grid gap-3">
            <Button 
              variant={connectedServices.includes('google') ? "outline" : "default"} 
              className={cn("w-full justify-start h-12 gap-3 transition-all", connectedServices.includes('google') && "border-emerald-500 text-emerald-600 bg-emerald-50/50")}
              onClick={() => handleConnect('google')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {connectedServices.includes('google') ? "Google Sync Actif" : "Connecter Google"}
            </Button>

            <Button 
              variant={connectedServices.includes('outlook') ? "outline" : "default"}
              className={cn("w-full justify-start h-12 gap-3 transition-all", connectedServices.includes('outlook') && "border-blue-500 text-blue-600 bg-blue-50/50")}
              onClick={() => handleConnect('outlook')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-5 h-5" />}
              {connectedServices.includes('outlook') ? "Outlook Sync Actif" : "Connecter Outlook"}
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
            <Plus className="w-5 h-5 mr-2" /> Nouvel événement
          </Button>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Récupération des données en temps réel...</p>
            </div>
          ) : selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-lg transition-all border-l-4 border-l-primary overflow-hidden bg-card">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-6">
                      <div className="w-20 text-center border-r pr-6">
                        <span className="text-2xl font-black block text-primary">
                          {format(new Date(event.debut), "HH:mm")}
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
                          <h4 className="text-xl font-bold">{event.titre}</h4>
                        </div>
                        {event.description && <p className="text-sm text-muted-foreground max-w-2xl">{event.description}</p>}
                        <div className="flex items-center gap-4 pt-2">
                          <div className="flex items-center text-xs font-semibold text-muted-foreground">
                            <Users className="w-4 h-4 mr-1.5" />
                            {event.attendees?.length || 0} participants
                          </div>
                          <div className="flex items-center text-xs font-semibold text-muted-foreground">
                            <CalendarIcon className="w-4 h-4 mr-1.5" />
                            Fin à {format(new Date(event.fin), "HH:mm")}
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
                <LogIn className="w-12 h-12 text-muted-foreground opacity-40" />
              </div>
              <h3 className="text-xl font-bold mb-2">Connectez vos calendriers</h3>
              <p className="text-muted-foreground text-center max-w-xs">
                Cliquez sur les boutons à gauche pour synchroniser vos comptes Google ou Outlook et voir vos rendez-vous ici.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
