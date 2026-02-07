'use client';

import * as React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Plus, Users, Chrome, Link2, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { CalendarEvent } from '@/lib/types';
import { format, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  getSyncTimeRange, 
  fetchGoogleEvents,
  mapGoogleEvent, 
  syncEventToFirestore
} from '@/services/calendar-sync';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';

export function SharedCalendar({ companyId }: { companyId: string }) {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<'idle' | 'authenticating' | 'fetching' | 'saving' | 'success' | 'error'>('idle');
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
      try {
        const eventDate = parseISO(event.debut);
        return isSameDay(eventDate, date);
      } catch (e) {
        return false;
      }
    }).sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
  }, [events, date]);

  const handleSync = async () => {
    if (!db || !companyId || !user || !auth) {
      toast({ variant: "destructive", title: "Erreur", description: "Services non disponibles." });
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('authenticating');
    
    try {
      // 1. Authentification
      toast({ title: "Connexion Google...", description: "Veuillez valider la fenêtre de connexion." });
      const result = await signInWithGoogleCalendar(auth);
      const token = result.token;
      
      if (!token) {
        throw new Error("Aucun jeton d'accès reçu de Google. Vérifiez vos permissions.");
      }

      // 2. Récupération
      setSyncStatus('fetching');
      toast({ title: "Connexion réussie", description: "Récupération de vos événements..." });
      
      const { timeMin, timeMax } = getSyncTimeRange();
      const externalEvents = await fetchGoogleEvents(token, timeMin, timeMax);

      if (externalEvents.length === 0) {
        toast({ title: "Aucun événement", description: "Google n'a renvoyé aucun événement pour cette période." });
        setSyncStatus('success');
        return;
      }

      // 3. Sauvegarde
      setSyncStatus('saving');
      toast({ title: "Synchronisation...", description: `Enregistrement de ${externalEvents.length} événements...` });
      
      let importedCount = 0;
      for (const extEvent of externalEvents) {
        const mapped = mapGoogleEvent(extEvent, companyId, user.uid);
        await syncEventToFirestore(db, mapped);
        importedCount++;
      }

      setSyncStatus('success');
      toast({
        title: "Terminé !",
        description: `${importedCount} événements synchronisés.`,
      });
      
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Sync Error:", error);
      setSyncStatus('error');
      
      let errorMsg = error.message || "Une erreur inconnue est survenue.";
      if (errorMsg.includes('403')) {
        errorMsg = "L'API Google Calendar n'est pas activée pour ce projet. Vérifiez la console Google Cloud.";
      }

      toast({
        variant: "destructive",
        title: "Échec de synchronisation",
        description: errorMsg,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const isConnected = syncStatus === 'success' || (events && events.length > 0);

  return (
    <div className="flex flex-col lg:flex-row h-full">
      <div className="w-full lg:w-80 border-r bg-muted/10 p-6 space-y-6 flex flex-col">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Service Google
          </h3>
          
          <div className="grid gap-3">
            <Button 
              variant={isConnected ? "outline" : "default"} 
              className={cn(
                "w-full justify-start h-12 gap-3 transition-all font-semibold", 
                isConnected && "border-emerald-500 text-emerald-600 bg-emerald-50/50"
              )}
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Chrome className="w-5 h-5" />
              )}
              {isSyncing ? "Sync en cours..." : isConnected ? "Google Connecté" : "Connecter Google"}
            </Button>
            
            {isSyncing && (
              <p className="text-[10px] text-muted-foreground animate-pulse text-center">
                Étape : {syncStatus === 'authenticating' ? 'Authentification' : syncStatus === 'fetching' ? 'Lecture API' : 'Enregistrement'}
              </p>
            )}
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
            <p className="text-muted-foreground font-medium">Vos événements Google synchronisés.</p>
          </div>
          <div className="flex gap-3">
             <Button variant="outline" size="lg" className="rounded-full gap-2 border-primary/20 hover:bg-primary/5" onClick={handleSync} disabled={isSyncing}>
                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                Mettre à jour
             </Button>
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
                  <div className="w-2 bg-primary" />
                  <div className="p-6 flex-1 flex items-start justify-between gap-6">
                    <div className="flex gap-8">
                      <div className="w-24 text-center border-r pr-8 flex flex-col justify-center">
                        <span className="text-3xl font-black block text-primary leading-none">
                          {format(parseISO(event.debut), "HH:mm")}
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
                            Fin à {format(parseISO(event.fin), "HH:mm")}
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
                <CalendarIcon className="w-16 h-16 text-muted-foreground opacity-30" />
              </div>
              <h3 className="text-2xl font-black mb-3 text-center">Aucun événement trouvé</h3>
              <p className="text-muted-foreground text-center max-w-md font-medium">
                Cliquez sur "Mettre à jour" pour lancer la synchronisation avec votre compte Google.
              </p>
              <div className="mt-8 flex gap-4">
                 <Button variant="outline" className="rounded-full h-12 px-8" onClick={handleSync}>
                    {isConnected ? "Forcer la synchronisation" : "Connecter Google Calendar"}
                 </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
