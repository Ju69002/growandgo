
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chrome, ShieldCheck, KeyRound, Loader2, CheckCircle2, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { useAuth, useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { doc, setDoc, collection, query, where } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';
import { getSyncTimeRange, fetchGoogleEvents, mapGoogleEvent, syncEventToFirestore, pushEventToGoogle } from '@/services/calendar-sync';
import { cn } from '@/lib/utils';
import { User, CalendarEvent } from '@/lib/types';
import { useDoc } from '@/firebase';

export default function SecuritySettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'authenticating' | 'importing' | 'exporting' | 'saving' | 'success' | 'error'>('idle');

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  // Récupération des événements locaux pour l'export
  const localEventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId.toLowerCase(), 'events'),
      where('source', '==', 'local')
    );
  }, [db, companyId]);

  const { data: localEvents } = useCollection<CalendarEvent>(localEventsQuery);

  const handleBidirectionalSync = async () => {
    if (!db || !companyId || !user || !auth) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez vérifier votre connexion." });
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('authenticating');
    
    try {
      // 1. Connexion Google par Popup
      toast({ title: "Connexion Google...", description: "Validation des permissions d'écriture/lecture." });
      const result = await signInWithGoogleCalendar(auth);
      const token = result.token;
      
      if (!token) throw new Error("Aucun jeton d'accès reçu de Google.");

      // 2. EXPORT (App -> Google)
      setSyncStatus('exporting');
      const eventsToExport = localEvents?.filter(e => !e.googleEventId) || [];
      
      if (eventsToExport.length > 0) {
        toast({ title: "Exportation...", description: `Envoi de ${eventsToExport.length} événements vers Google.` });
        for (const localEv of eventsToExport) {
          const googleId = await pushEventToGoogle(token, localEv);
          // Marquer l'événement comme exporté localement pour éviter les doublons
          const localRef = doc(db, 'companies', companyId.toLowerCase(), 'events', localEv.id);
          await setDoc(localRef, { googleEventId: googleId }, { merge: true });
        }
      }

      // 3. IMPORT (Google -> App)
      setSyncStatus('importing');
      const { timeMin, timeMax } = getSyncTimeRange();
      const googleEvents = await fetchGoogleEvents(token, timeMin, timeMax);
      
      if (googleEvents.length > 0) {
        toast({ title: "Importation...", description: `Récupération de ${googleEvents.length} événements Google.` });
        for (const extEvent of googleEvents) {
          const mapped = mapGoogleEvent(extEvent, companyId, user.uid);
          await syncEventToFirestore(db, mapped);
        }
      }

      // 4. Mise à jour du profil Admin (merge: true pour ne rien écraser)
      const currentProfileRef = doc(db, 'users', user.uid);
      await setDoc(currentProfileRef, { 
        googleEmail: result.user.email,
        companyId: companyId,
        role: profile?.role || 'admin',
        name: profile?.name || result.user.displayName || 'Julien Secchi'
      }, { merge: true });

      setSyncStatus('success');
      toast({ 
        title: "Synchronisation Terminée !", 
        description: `${eventsToExport.length} exportés, ${googleEvents.length} importés.` 
      });
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error: any) {
      setSyncStatus('error');
      console.error("Sync Error:", error);
      toast({ variant: "destructive", title: "Échec de synchro", description: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <KeyRound className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Connexion & Sécurité</h1>
            <p className="text-muted-foreground font-medium">Gérez vos intégrations bidirectionnelles et la protection de vos données.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                    <Chrome className="w-5 h-5" />
                    Google Calendar Sync
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/70">Synchronisez votre agenda dans les deux sens.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="bg-muted/30 p-8 rounded-[2rem] border flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-4">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-inner",
                    syncStatus === 'success' || profile?.googleEmail ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
                  )}>
                    {syncStatus === 'success' || profile?.googleEmail ? <CheckCircle2 className="w-8 h-8" /> : <Chrome className="w-8 h-8" />}
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="font-black uppercase text-xs tracking-widest text-muted-foreground mb-1">État de l'intégration</p>
                    <p className="font-bold text-lg">
                      {profile?.googleEmail ? profile.googleEmail : "Non synchronisé"}
                    </p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className={cn(
                    "px-10 rounded-full font-black uppercase tracking-widest text-xs h-14 gap-3 shadow-xl transition-all active:scale-95", 
                    syncStatus === 'success' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary"
                  )}
                  onClick={handleBidirectionalSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowLeftRight className="w-5 h-5" />}
                  {profile?.googleEmail ? "Synchro Bidirectionnelle" : "Connecter Google Calendar"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 border rounded-2xl bg-primary/5 border-primary/10 flex items-start gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm"><RefreshCw className="w-5 h-5 text-primary" /></div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-primary">Double Flux</p>
                    <p className="text-sm font-medium text-muted-foreground leading-snug">Vos rendez-vous sont importés ET vos créations sont exportées.</p>
                  </div>
                </div>
                <div className="p-6 border rounded-2xl bg-primary/5 border-primary/10 flex items-start gap-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm"><ShieldCheck className="w-5 h-5 text-primary" /></div>
                  <div className="space-y-1">
                    <p className="text-xs font-black uppercase text-primary">Confidentialité</p>
                    <p className="text-sm font-medium text-muted-foreground leading-snug">Seul votre calendrier principal est synchronisé sans suppression.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
