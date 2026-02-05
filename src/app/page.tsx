
'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { ShieldCheck, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking, initiateAnonymousSignIn, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';

const DEFAULT_CATEGORIES = [
  { id: 'finance', label: 'Finance', icon: 'finance', aiInstructions: 'Analyse des factures et trésorerie.' },
  { id: 'admin', label: 'Administration', icon: 'admin', aiInstructions: 'Gestion des documents administratifs et courriers.' },
  { id: 'rh', label: 'RH', icon: 'rh', aiInstructions: 'Gestion des contrats et documents employés.' },
  { id: 'agenda', label: 'Agenda', icon: 'agenda', aiInstructions: 'Organisation du planning et rappels.' },
  { id: 'signatures', label: 'Signatures', icon: 'signatures', aiInstructions: 'Suivi des documents à signer.' }
];

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const [isInitializing, setIsInitializing] = useState(true);

  // Auto-login for prototype
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

  // Initialize user profile and default categories
  useEffect(() => {
    if (user && !isProfileLoading && !profile && db) {
      const companyId = 'default-company';
      
      // 1. Create User Profile
      const newUser: User = {
        uid: user.uid,
        companyId: companyId,
        role: 'admin',
        adminMode: true,
        name: user.displayName || 'Utilisateur Démo',
        email: user.email || 'demo@businesspilot.ai'
      };
      const userRef = doc(db, 'users', user.uid);
      setDocumentNonBlocking(userRef, newUser, { merge: true });

      // 2. Seed Default Categories
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
    
    if (user && profile) {
      setIsInitializing(false);
    }
  }, [user, isProfileLoading, profile, db]);

  if (isUserLoading || isInitializing || (user && isProfileLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              Bienvenue sur BusinessPilot. Voici vos modules de gestion.
            </p>
          </div>
          {userRole !== 'employee' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-colors ${adminMode ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-semibold">Mode Architecte {adminMode ? 'Activé' : 'Désactivé'}</span>
            </div>
          )}
        </header>

        {adminMode && (
          <Alert className="bg-teal-50 border-teal-200 animate-in slide-in-from-top-2">
            <Info className="h-4 w-4 text-teal-600" />
            <AlertTitle className="text-teal-800 font-bold">Mode Architecte</AlertTitle>
            <AlertDescription className="text-teal-700">
              Vous pouvez personnaliser les tuiles (nom, visibilité) ou en créer de nouvelles via l'assistant.
            </AlertDescription>
          </Alert>
        )}

        <CategoryTiles isAdminMode={adminMode} />
      </div>
    </DashboardLayout>
  );
}
