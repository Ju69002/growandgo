'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar as CalendarIcon, Plus, Users, Chrome, Layout, Loader2, Link2, LogIn, RefreshCw } from 'lucide-react';
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
  syncEventToFirestore,
  fetchGoogleEvents
} from '@/services/calendar-sync';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';

export function SharedCalendar({ companyId }: { companyId: string }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isConnected, setIsConnected] = React.useState(false);
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
    }).sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  }, [events, date]);

  const handleConnect = async () => {
    if (!db || !companyId || !user || !auth) return;
    
    setIsSyncing(true);
    try {
      toast({
        title: "Connexion Google en cours...",
        description: "Ouverture de la fenêtre Google...",
      });

      const result = await signInWithGoogleCalendar(auth);
      const token = result.token;
      
      if (!token) throw new Error("Impossible de récupérer le jeton d'accès Google.");

      const { timeMin, timeMax } = getSyncTimeRange();
      const externalEvents = await fetchGoogleEvents(token, timeMin, timeMax);

      toast({
        title: "Synchronisation...",
        description: `Importation de ${externalEvents.length} événements trouvés.`,
      });

      for (const extEvent of externalEvents) {
        const mapped = mapGoogleEvent(extEvent, companyId, user.uid);
        await syncEventToFirestore(db, mapped);
      }

      setIsConnected(true);
      toast({
        title: "Synchronisation terminée !",
        description: "Votre agenda Grow&Go est à jour avec Google Calendar.",
      });
    } catch (error: any) {
      console.error("Google Sync Error:", error);
      
      let errorMsg = error.message || "Une erreur est survenue lors de la synchronisation.";
      
      if (errorMsg.includes('API has not been used') || errorMsg.includes('disabled')) {
        errorMsg = "L'API Google Calendar n'est pas activée sur votre projet Google Cloud (Projet ID: 500181405818). Veuillez l'activer pour autoriser la synchronisation.";
      }

      toast({
        variant: "destructive",
        title: "Erreur Google Calendar",
        description: errorMsg,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="w-full lg:w-80 border-r bg-muted/10 p-6 space-y-6 flex flex-col">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Comptes Connectés
          </h3>
          
          <div className="grid gap-3">
            <Button 
              variant={isConnected ? "outline" : "default"} 
              className={cn(
                "w-full justify-start h-12 gap-3 transition-all font-semibold", 
                isConnected && "border-emerald-500 text-emerald-600 bg-emerald-50/50"
              )}
              onClick={handleConnect}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {isConnected ? "Google Sync Actif" : "Connecter Google"}
            </Button>
          </div>
        </div>

        <div className="pt-6 border-t flex-1">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-2xl border bg-card shadow-lg p-3"
            locale={fr}
          />
        </div>
      </div>

      <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-background/50">
        <div className="flex items-center justify-between bg-card p-6 rounded-3xl border shadow-sm">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-primary">
              {date ? format(date, "EEEE d MMMM", { locale: fr }) : "Planning"}
            </h2>
            <p className="text-muted-foreground font-medium">Calendrier partagé de l'équipe Grow&Go.</p>
          </div>
          <div className="flex gap-3">
             {isConnected && (
               <Button variant="outline" size="lg" className="rounded-full gap-2" onClick={handleConnect}>
                  <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                  Mettre à jour
               </Button>
             )}
            <Button size="lg" className="bg-primary shadow-xl hover:scale-105 transition-all rounded-full px-8">
              <Plus className="w-5 h-5 mr-2" /> Nouvel événement
            </Button>
          </div>
        </div>

        <div className="grid gap-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
              <p className="text-muted-foreground font-medium animate-pulse">Chargement de l'agenda...</p>
            </div>
          ) : selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-xl transition-all border-none overflow-hidden bg-card shadow-sm">
                <CardContent className="p-0 flex">
                  <div className="w-2 bg-emerald-500" />
                  <div className="p-6 flex-1 flex items-start justify-between gap-6">
                    <div className="flex gap-8">
                      <div className="w-24 text-center border-r pr-8 flex flex-col justify-center">
                        <span className="text-3xl font-black block text-primary leading-none">
                          {format(new Date(event.debut), "HH:mm")}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-2">Début</span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="px-2 py-0 text-[10px] font-black uppercase rounded-md border bg-emerald-50 text-emerald-700 border-emerald-100">
                            {event.source}
                          </Badge>
                          <h4 className="text-2xl font-bold tracking-tight">{event.titre}</h4>
                        </div>
                        {event.description && <p className="text-sm text-muted-foreground max-w-2xl line-clamp-2">{event.description}</p>}
                        <div className="flex items-center gap-6 pt-3">
                          <div className="flex items-center text-xs font-bold text-muted-foreground/80">
                            <Users className="w-4 h-4 mr-2 text-primary/40" />
                            {event.attendees?.length || 0} participants
                          </div>
                          <div className="flex items-center text-xs font-bold text-muted-foreground/80">
                            <CalendarIcon className="w-4 h-4 mr-2 text-primary/40" />
                            Fin à {format(new Date(event.fin), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-32 border-4 border-dashed rounded-[40px] bg-muted/5">
              <div className="bg-muted p-8 rounded-full mb-8 shadow-inner">
                <LogIn className="w-16 h-16 text-muted-foreground opacity-30" />
              </div>
              <h3 className="text-2xl font-black mb-3">Votre agenda est prêt</h3>
              <p className="text-muted-foreground text-center max-w-md font-medium">
                Connectez votre compte Google Calendar dans la barre latérale pour importer automatiquement vos rendez-vous dans l'écosystème Grow&Go.
              </p>
              <div className="mt-8">
                 <Button variant="outline" className="rounded-full h-12 px-8" onClick={handleConnect}>Connecter Google Calendar</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}