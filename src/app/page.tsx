'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { ShieldCheck, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';

export default function Home() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);

  const adminMode = profile?.admin_mode || false;
  const userRole = profile?.role || 'employee';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenue sur BusinessPilot. Gérez vos documents et vos opérations en un seul endroit.
            </p>
          </div>
          {userRole !== 'employee' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${adminMode ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
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
              Vous pouvez maintenant modifier les étiquettes des tuiles, leur visibilité pour vos employés et créer de nouvelles catégories via l'IA.
            </AlertDescription>
          </Alert>
        )}

        <CategoryTiles isAdminMode={adminMode} />
      </div>
    </DashboardLayout>
  );
}
