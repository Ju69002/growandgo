
'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { ShieldCheck, Info, Loader2, ListTodo, Calendar as CalendarIcon, Maximize2, ArrowRight, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking, initiateAnonymousSignIn, useAuth, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, Company, BusinessDocument, DocumentStatus } from '@/lib/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const DEFAULT_CATEGORIES = [
  { 
    id: 'finance', 
    label: 'Finance', 
    aiInstructions: 'Analyse des factures et trésorerie pour Grow&Go.',
    subCategories: ['Factures Pournisseurs', 'Factures Clients', 'Bilans', 'Relevés Bancaires']
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCalendarFull, setIsCalendarFull] = useState(false);

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

  // Fetch pending tasks for the summary
  const pendingTasksQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('status', 'in', ['waiting_verification', 'waiting_validation']),
      limit(3)
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
  const userRole = profile?.role || 'employee';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenue sur Grow&Go. Votre Architecte IA a organisé vos dossiers.
            </p>
          </div>
          {userRole !== 'employee' && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300",
              adminMode ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'bg-muted text-muted-foreground border-border'
            )}>
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-semibold">Mode Architecte {adminMode ? 'Activé' : 'Désactivé'}</span>
            </div>
          )}
        </header>

        {adminMode && (
          <Alert className="bg-primary/5 border-primary/20 animate-in fade-in slide-in-from-top-4 duration-500">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary font-bold">Mode Architecte de Marque</AlertTitle>
            <AlertDescription className="text-primary/80">
              Transformez votre interface en demandant simplement au chatbot.
            </AlertDescription>
          </Alert>
        )}

        {/* RECAP SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* TASKS SUMMARY */}
          <Card className="border-none shadow-md overflow-hidden bg-card h-full">
            <CardHeader className="pb-4 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-primary" />
                  À faire aujourd'hui
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-primary hover:text-primary/80 font-bold">
                  <Link href="/notifications">Voir tout <ArrowRight className="ml-1 w-4 h-4" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {tasks && tasks.length > 0 ? (
                tasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-bold truncate max-w-[180px]">{task.name}</span>
                    </div>
                    <Badge className={cn("text-[10px] uppercase font-black", statusConfig[task.status]?.color)}>
                      {statusConfig[task.status]?.label}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Tout est à jour</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CALENDAR MINI PREVIEW */}
          <Card className="border-none shadow-md overflow-hidden bg-card h-full relative group">
            <div className="absolute top-4 right-4 z-10">
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-full shadow-lg font-bold gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsCalendarFull(true)}
              >
                <Maximize2 className="w-4 h-4" />
                Agrandir
              </Button>
            </div>
            <div className="h-[280px] overflow-hidden pointer-events-none grayscale-[0.5] group-hover:grayscale-0 transition-all">
              {companyId && <SharedCalendar companyId={companyId} isCompact />}
            </div>
          </Card>
        </div>

        <CategoryTiles isAdminMode={adminMode} />
      </div>

      {/* FULL CALENDAR DIALOG */}
      <Dialog open={isCalendarFull} onOpenChange={setIsCalendarFull}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-background border-none">
          <div className="sr-only">
            <DialogTitle>Agenda Grow&Go</DialogTitle>
          </div>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-card">
              <h2 className="font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Agenda de l'équipe
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setIsCalendarFull(false)} className="rounded-full">
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
