
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chrome, ShieldCheck, KeyRound, Loader2, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';
import { getSyncTimeRange, fetchGoogleEvents, mapGoogleEvent, syncEventToFirestore } from '@/services/calendar-sync';
import { cn, normalizeId } from '@/lib/utils';
import { User } from '@/lib/types';
import { useDoc } from '@/firebase';

export default function SecuritySettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'authenticating' | 'fetching' | 'saving' | 'success' | 'error'>('idle');

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const handleGoogleSync = async () => {
    if (!db || !companyId || !user || !auth) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez vérifier votre connexion." });
      return;
    }
    
    setIsSyncing(true);
    setSyncStatus('authenticating');
    
    try {
      // 1. Connexion Google manuelle par Popup
      toast({ title: "Connexion Google...", description: "Sélectionnez votre compte dans la fenêtre." });
      const result = await signInWithGoogleCalendar(auth);
      const token = result.token;
      
      if (!token) throw new Error("Aucun jeton d'accès reçu de Google.");

      // 2. Récupération sécurisée des événements
      setSyncStatus('fetching');
      const { timeMin, timeMax } = getSyncTimeRange();
      const externalEvents = await fetchGoogleEvents(token, timeMin, timeMax);

      // 3. Sauvegarde Firestore avec protection merge:true
      setSyncStatus('saving');
      const normalizedCompanyId = normalizeId(companyId);
      
      for (const extEvent of externalEvents) {
        const mapped = mapGoogleEvent(extEvent, normalizedCompanyId, user.uid);
        await syncEventToFirestore(db, mapped);
      }

      // Mise à jour du profil (Email Google) avec merge pour ne pas perdre les catégories
      await setDoc(userRef!, { googleEmail: result.user.email }, { merge: true });

      setSyncStatus('success');
      toast({ title: "Synchronisation réussie !", description: `${externalEvents.length} événements importés.` });
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (error: any) {
      setSyncStatus('error');
      console.error("Sync Error:", error);
      toast({ variant: "destructive", title: "Échec", description: error.message });
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
            <h1 className="text-3xl font-bold tracking-tight">Connexion et Sécurité</h1>
            <p className="text-muted-foreground font-medium">Gérez vos intégrations et la synchronisation de vos données.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <Chrome className="w-5 h-5 text-primary" />
                    Intégration Google Calendar
                  </CardTitle>
                  <CardDescription>Connectez votre compte pour synchroniser votre agenda équipe.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/30 p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    syncStatus === 'success' || profile?.googleEmail ? "bg-emerald-100 text-emerald-600" : "bg-primary/10 text-primary"
                  )}>
                    {syncStatus === 'success' || profile?.googleEmail ? <CheckCircle2 className="w-6 h-6" /> : <Chrome className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-bold">Statut de la connexion</p>
                    <p className="text-sm text-muted-foreground">
                      {profile?.googleEmail ? `Connecté (${profile.googleEmail})` : "Non synchronisé"}
                    </p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  className={cn("px-8 rounded-full font-bold h-12 gap-2", syncStatus === 'success' ? "bg-emerald-600 hover:bg-emerald-700" : "")}
                  onClick={handleGoogleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                  {profile?.googleEmail ? "Re-synchroniser" : "Connecter mon compte Google"}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary/60 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold">Confidentialité</p>
                    <p className="text-xs text-muted-foreground">Nous ne lisons que vos calendriers sélectionnés sans rien supprimer.</p>
                  </div>
                </div>
                <div className="p-4 border rounded-xl flex items-start gap-3">
                  <RefreshCw className="w-5 h-5 text-primary/60 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold">Mise à jour manuelle</p>
                    <p className="text-xs text-muted-foreground">La synchronisation s'effectue uniquement quand vous le décidez.</p>
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
