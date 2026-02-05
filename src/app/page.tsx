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
  { id: 'finance', label: 'Finance', aiInstructions: 'Analyse des factures et trésorerie.' },
  { id: 'admin', label: 'Administration', aiInstructions: 'Gestion des documents administratifs.' },
  { id: 'rh', label: 'RH', aiInstructions: 'Gestion des contrats et documents employés.' },
  { id: 'agenda', label: 'Agenda', aiInstructions: 'Organisation du planning.' },
  { id: 'signatures', label: 'Signatures', aiInstructions: 'Suivi des signatures.' }
];

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Sign-in anonyme si non connecté
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

  // Initialisation des données de démo
  useEffect(() => {
    if (user && !isProfileLoading && !profile && db) {
      const companyId = 'default-company';
      
      // 1. Créer le profil utilisateur d'abord
      const userRef = doc(db, 'users', user.uid);
      setDocumentNonBlocking(userRef, {
        uid: user.uid,
        companyId: companyId,
        role: 'admin',
        adminMode: true,
        name: user.displayName || 'Utilisateur Démo',
        email: user.email || 'demo@businesspilot.ai'
      }, { merge: true });

      // 2. Créer l'entreprise
      const companyRef = doc(db, 'companies', companyId);
      setDocumentNonBlocking(companyRef, {
        id: companyId,
        name: 'Ma Super Entreprise',
        subscriptionStatus: 'active',
        primaryColor: '231 48% 48%',
        modulesConfig: {
          showRh: true,
          showFinance: true,
          customLabels: {}
        }
      }, { merge: true });

      // 3. Créer les catégories par défaut
      DEFAULT_CATEGORIES.forEach(cat => {
        const catRef = doc(db, 'companies', companyId, 'categories', cat.id);
        setDocumentNonBlocking(catRef, {
          id: cat.id,
          label: cat.label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'standard',
          aiInstructions: cat.aiInstructions,
          companyId: companyId
        }, { merge: true });
      });
    }
    
    // Une fois qu'on a un profil, on arrête le chargement d'initialisation
    if (user && profile) {
      setIsInitializing(false);
    }
  }, [user, isProfileLoading, profile, db]);

  if (isUserLoading || (user && isInitializing)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Initialisation de votre espace BusinessPilot...</p>
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
              Bienvenue sur BusinessPilot. Votre Architecte IA peut changer la couleur du site si vous lui demandez.
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
            <AlertTitle className="text-primary font-bold">Mode Architecte Visuel</AlertTitle>
            <AlertDescription className="text-primary/80">
              Demandez au chatbot : "Change la couleur en vert" ou "Passe le site en rouge" pour personnaliser l'aspect visuel instantanément.
            </AlertDescription>
          </Alert>
        )}

        <CategoryTiles isAdminMode={adminMode} />
      </div>
    </DashboardLayout>
  );
}