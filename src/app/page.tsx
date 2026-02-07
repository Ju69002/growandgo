
'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { 
  ShieldCheck, 
  Info, 
  Loader2, 
  ListTodo, 
  Calendar as CalendarIcon, 
  Maximize2, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  setDocumentNonBlocking, 
  initiateAnonymousSignIn, 
  useAuth, 
  useCollection 
} from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument, DocumentStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { signInWithGoogleCalendar } from '@/firebase/non-blocking-login';
import { getSyncTimeRange, fetchGoogleEvents, mapGoogleEvent, syncEventToFirestore } from '@/services/calendar-sync';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = [
  { 
    id: 'finance', 
    label: 'Finance', 
    aiInstructions: 'Analyse des factures et trésorerie pour Grow&Go.',
    subCategories: ['Factures Fournisseurs', 'Factures Clients', 'Bilans', 'Relevés Bancaires']
  },
  { 
    id: 'admin', 
    label: 'Administration', 
    aiInstructions: 'Gestion des documents administratifs et juridiques.',
    subCategories: ['Juridique & Statuts', 'Assurances', 'Contrats', 'Kbis']
  },
  { 
    id: 'rh', 
    label: 'RH', 
    aiInstructions: 'Gestion des contrats et documents employés.',
    subCategories: ['Contrats Travail', 'Fiches de Paie', 'Mutuelle & Prévoyance', 'Candidatures']
  },
  { 
    id: 'agenda', 
    label: 'Agenda', 
    aiInstructions: 'Organisation du planning équipe.',
    subCategories: ['Réunions', 'Planning Équipe', 'Déplacements']
  },
  { 
    id: 'signatures', 
    label: 'Signatures', 
    aiInstructions: 'Suivi des signatures de contrats.',
    subCategories: ['Devis', 'Contrats Client', 'PV de Réception']
  }
];

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  waiting_verification: { label: 'À vérifier', icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
  waiting_validation: { label: 'À valider', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  pending_analysis: { label: 'Analyse...', icon: Loader2, color: 'text-muted-foreground bg-muted' },
};

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCalendarFull, setIsCalendarFull] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  // Fetch pending tasks for the summary (weekly view metaphor)
  const pendingTasksQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('status', 'in', ['waiting_verification', 'waiting_validation']),
      limit(5)
    );
  }, [db, companyId]);

  const { data: tasks } = useCollection<BusinessDocument>(pendingTasksQuery);

  useEffect(() => {
    if (user && !isProfileLoading && !profile && db) {
      const companyId = 'default-company';
      
      const userRef = doc(db, 'users', user.uid);
      setDocumentNonBlocking(userRef, {
        uid: user.uid,
        companyId: companyId,
        role: 'admin',
        adminMode: true,
        name: user.displayName || 'Utilisateur Grow&Go',
        email: user.email || 'demo@growandgo.ai'
      }, { merge: true });

      const companyRef = doc(db, 'companies', companyId);
      setDocumentNonBlocking(companyRef, {
        id: companyId,
        name: 'Grow&Go Design Studio',
        subscriptionStatus: 'active',
        primaryColor: '157 44% 21%',
        backgroundColor: '43 38% 96%',
        modulesConfig: {
          showRh: true,
          showFinance: true,
          customLabels: {}
        }
      }, { merge: true });

      DEFAULT_CATEGORIES.forEach(cat => {
        const catRef = doc(db, 'companies', companyId, 'categories', cat.id);
        setDocumentNonBlocking(catRef, {
          id: cat.id,
          label: cat.label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'standard',
          aiInstructions: cat.aiInstructions,
          companyId: companyId,
          subCategories: cat.subCategories
        }, { merge: true });
      });
    }
    
    if (user && (profile || isProfileLoading === false)) {
      setIsInitializing(false);
    }
  }, [user, isProfileLoading, profile, db]);

  const handleManualSync = async () => {
    if (!db || !companyId || !user || !auth) {
      toast({ variant: "destructive", title: "Erreur", description: "Services non disponibles." });
      return;
    }
    
    setIsSyncing(true);
    try {
      toast({ title: "Synchronisation...", description: "Connexion à Google Calendar en cours." });
      const result = await signInWithGoogleCalendar(auth);
      if (!result.token) throw new Error("Accès refusé.");

      const { timeMin, timeMax } = getSyncTimeRange();
      const externalEvents = await fetchGoogleEvents(result.token, timeMin, timeMax);

      for (const extEvent of externalEvents) {
        const mapped = mapGoogleEvent(extEvent, companyId, user.uid);
        await syncEventToFirestore(db, mapped);
      }

      toast({ title: "Synchronisation terminée !", description: `${externalEvents.length} événements mis à jour.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Échec de synchronisation", description: error.message });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isUserLoading || (user && isInitializing)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Initialisation de votre espace Grow&Go...</p>
        </div>
      </div>
    );
  }

  const adminMode = profile?.adminMode || false;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Résumé de la semaine et gestion de l'agenda.
            </p>
          </div>
        </header>

        {/* RECAP SECTION: TWO CARDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* WEEKLY TASKS TILE WITH SYNC BUTTON */}
          <Card className="border-none shadow-md overflow-hidden bg-card h-full flex flex-col">
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" />
                Tâches de la semaine
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full font-bold gap-2"
                onClick={handleManualSync}
                disabled={isSyncing}
              >
                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Synchroniser
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex-1">
              {tasks && tasks.length > 0 ? (
                tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate max-w-[150px]">{task.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{task.subCategory || 'Général'}</span>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] uppercase font-black", statusConfig[task.status]?.color)}>
                      {statusConfig[task.status]?.label}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Aucune tâche en attente</p>
                </div>
              )}
              <div className="pt-4 mt-auto">
                <Button variant="ghost" size="sm" asChild className="w-full text-primary hover:text-primary/80 font-bold border-t pt-4 rounded-none">
                  <Link href="/notifications" className="flex items-center justify-center">
                    Voir toutes les notifications <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* AGENDA 3-DAYS TILE WITH MAXIMIZE BUTTON */}
          <Card className="border-none shadow-md overflow-hidden bg-card h-full relative group flex flex-col">
            <CardHeader className="pb-2 border-b flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Agenda (3 prochains jours)
              </CardTitle>
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-full font-bold gap-2 shadow-sm"
                onClick={() => setIsCalendarFull(true)}
              >
                <Maximize2 className="w-4 h-4" />
                Agrandir
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="h-full min-h-[300px]">
                {companyId && <SharedCalendar companyId={companyId} isCompact />}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CATEGORY TILES SECTION */}
        <div className="pt-4">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Vos Dossiers Grow&Go
          </h2>
          <CategoryTiles isAdminMode={adminMode} />
        </div>
      </div>

      {/* FULL CALENDAR DIALOG */}
      <Dialog open={isCalendarFull} onOpenChange={setIsCalendarFull}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-background border-none shadow-2xl">
          <div className="sr-only">
            <DialogTitle>Agenda Mensuel Grow&Go</DialogTitle>
          </div>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-card">
              <h2 className="font-black text-xl flex items-center gap-3">
                <CalendarIcon className="w-6 h-6 text-primary" />
                AGENDA COMPLET
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsCalendarFull(false)} className="rounded-full font-bold">
                Fermer
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {companyId && <SharedCalendar companyId={companyId} defaultView="month" />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
