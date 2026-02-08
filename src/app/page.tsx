
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { Loader2, ShieldCheck, FileText, LogOut, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';

export default function Home() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  // Déclaration systématique des Hooks au sommet (Rules of Hooks)
  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Gestion des redirections pour briser les boucles
  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [mounted, user, isUserLoading, router]);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  // 1. État de chargement initial (Spinner léger)
  if (!mounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
          Initialisation du Studio...
        </p>
      </div>
    );
  }

  // 2. Si non connecté, on attend la redirection du useEffect
  if (!user) return null;

  // 3. Gestion de l'erreur "Profil Introuvable" (Pas de redirection vers login pour éviter la boucle)
  if (!profile && !isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] p-8 text-center space-y-6">
        <div className="p-4 bg-rose-100 rounded-full">
           <AlertTriangle className="w-12 h-12 text-rose-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">Profil Inaccessible</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Votre compte est authentifié mais vos données de profil sont introuvables. 
            Veuillez contacter le Super Admin ou essayer de vous reconnecter.
          </p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="rounded-full px-8 h-12 font-bold gap-2">
          <LogOut className="w-4 h-4" />
          Se déconnecter (Reset)
        </Button>
      </div>
    );
  }

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <header>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Tableau de bord</h1>
            {profile && (
              <Badge className={cn(
                "font-black uppercase text-[10px] h-5 px-2",
                isSuperAdmin ? "bg-rose-950 text-white" : "bg-primary text-primary-foreground"
              )}>
                {isSuperAdmin ? 'Super Admin' : profile.role === 'admin' ? 'Patron' : 'Employé'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 font-medium italic">
            Bienvenue dans le Studio {profile?.companyId}, {profile?.name}.
          </p>
        </header>

        {isSuperAdmin ? (
          <div className="pt-12">
            <div className="bg-primary/5 p-12 rounded-[3rem] border-2 border-dashed border-primary/20 flex flex-col items-center text-center gap-6">
              <ShieldCheck className="w-16 h-16 text-primary/30" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Console Super Administrateur</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
                  Gestion globale des identifiants et monitoring multi-entreprise (Paul / Oreal).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
               <FileText className="w-6 h-6 text-primary" />
               Dossiers Studio
            </h2>
            {profile && <CategoryTiles profile={profile} />}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
