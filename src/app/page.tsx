
'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { ShieldCheck, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking, initiateAnonymousSignIn, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';

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

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const [isInitializing, setIsInitializing] = useState(true);

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
    
    if (user && profile) {
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
              Bienvenue sur Grow&Go. Votre Architecte IA a organisé vos dossiers avec efficacité.
            </p>
          </div>
          {userRole !== 'employee' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${adminMode ? 'bg-primary/10 text-primary border-primary/20 shadow-sm' : 'bg-muted text-muted-foreground border-border'}`}>
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
              Demandez au chatbot : "Change la couleur du site en noir" ou "Renomme Finance en Trésorerie".
            </AlertDescription>
          </Alert>
        )}

        <CategoryTiles isAdminMode={adminMode} />
      </div>
    </DashboardLayout>
  );
}
