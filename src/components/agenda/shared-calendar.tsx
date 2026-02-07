'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Calendar as CalendarIcon, Plus, Users, Chrome, Layout, Loader2, Link2, LogIn, AlertTriangle, RefreshCw } from 'lucide-react';
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
    }).sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  }, [events, date]);

  const handleConnect = async (service: 'google' | 'outlook') => {
    if (!db || !companyId || !user || !auth) return;
    
    setIsSyncing(true);
    try {
      toast({
        title: "Connexion en cours...",
        description: `Ouverture de la fenêtre ${service === 'google' ? 'Google' : 'Microsoft'}...`,
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

      if (!token) throw new Error("Impossible de récupérer le jeton d'accès. Vérifiez vos identifiants.");

      toast({
        title: "Synchronisation...",
        description: `Importation de ${externalEvents.length} événements trouvés.`,
      });

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
      console.error("Auth/Sync Error:", error);
      
      let errorMsg = error.message || "Une erreur est survenue lors de la synchronisation.";
      
      // Aide au diagnostic spécifique
      if (error.code === 'auth/operation-not-allowed') {
        errorMsg = `Le fournisseur ${service} n'est pas activé dans votre console Firebase (Authentication > Sign-in method).`;
      } else if (errorMsg.includes('API has not been used') || errorMsg.includes('not enabled')) {
        errorMsg = `L'API ${service === 'google' ? 'Google Calendar' : 'Microsoft Graph'} doit être activée dans votre console Cloud.`;
      }

      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: errorMsg,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar de l'agenda */}
      <div className="w-full lg:w-80 border-r bg-muted/10 p-6 space-y-6 flex flex-col">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Comptes Connectés
          </h3>
          
          <div className="grid gap-3">
            <Button 
              variant={connectedServices.includes('google') ? "outline" : "default"} 
              className={cn(
                "w-full justify-start h-12 gap-3 transition-all font-semibold", 
                connectedServices.includes('google') && "border-emerald-500 text-emerald-600 bg-emerald-50/50"
              )}
              onClick={() => handleConnect('google')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Chrome className="w-5 h-5" />}
              {connectedServices.includes('google') ? "Google Sync Actif" : "Connecter Google"}
            </Button>

            <Button 
              variant={connectedServices.includes('outlook') ? "outline" : "default"}
              className={cn(
                "w-full justify-start h-12 gap-3 transition-all font-semibold", 
                connectedServices.includes('outlook') && "border-blue-500 text-blue-600 bg-blue-50/50"
              )}
              onClick={() => handleConnect('outlook')}
              disabled={isSyncing}
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-5 h-5" />}
              {connectedServices.includes('outlook') ? "Outlook Sync Actif" : "Connecter Outlook"}
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

      {/* Vue principale de l'agenda */}
      <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-background/50">
        <div className="flex items-center justify-between bg-card p-6 rounded-3xl border shadow-sm">
          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight text-primary">
              {date ? format(date, "EEEE d MMMM", { locale: fr }) : "Planning"}
            </h2>
            <p className="text-muted-foreground font-medium">Calendrier partagé de l'équipe Grow&Go.</p>
          </div>
          <div className="flex gap-3">
             {connectedServices.length > 0 && (
               <Button variant="outline" size="lg" className="rounded-full gap-2" onClick={() => handleConnect(connectedServices[0] as any)}>
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
              <p className="text-muted-foreground font-medium animate-pulse">Synchronisation avec vos serveurs...</p>
            </div>
          ) : selectedDateEvents.length > 0 ? (
            selectedDateEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-xl transition-all border-none overflow-hidden bg-card shadow-sm">
                <CardContent className="p-0 flex">
                  <div className={cn(
                    "w-2 bg-primary",
                    event.source === 'google' ? "bg-emerald-500" : "bg-blue-500"
                  )} />
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
                          <Badge variant="secondary" className={cn(
                            "px-2 py-0 text-[10px] font-black uppercase rounded-md border",
                            event.source === 'google' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100"
                          )}>
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
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                      <Layout className="w-4 h-4" />
                    </Button>
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
                Connectez vos comptes Google ou Outlook dans la barre latérale pour importer automatiquement vos rendez-vous dans l'écosystème Grow&Go.
              </p>
              <div className="mt-8 flex gap-4">
                 <Button variant="outline" className="rounded-full h-12 px-6" onClick={() => handleConnect('google')}>Connecter Google</Button>
                 <Button variant="outline" className="rounded-full h-12 px-6" onClick={() => handleConnect('outlook')}>Connecter Outlook</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
