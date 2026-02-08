
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { Loader2, ShieldCheck, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  // Déclaration des Hooks au sommet (Rules of Hooks)
  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [mounted, user, isUserLoading, router]);

  if (!mounted || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F2EA]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Si pas connecté, on ne rend rien (redirection en cours)
  if (!user) return null;

  if (isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F2EA]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Sécurité : Si le profil est introuvable après chargement
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold text-primary uppercase">Initialisation du profil...</h2>
        <p className="text-muted-foreground">Veuillez patienter ou vous reconnecter.</p>
        <button onClick={() => router.push('/login')} className="px-6 py-2 bg-primary text-white rounded-full font-bold">Retour Connexion</button>
      </div>
    );
  }

  const isSuperAdmin = profile.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <header>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Tableau de bord</h1>
            <Badge className={cn(
              "font-black uppercase text-[10px] h-5 px-2",
              isSuperAdmin ? "bg-rose-950 text-white" : "bg-primary text-primary-foreground"
            )}>
              {isSuperAdmin ? 'Super Admin' : profile.role === 'admin' ? 'Patron' : 'Employé'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-medium italic">
            Bienvenue dans le Studio {profile.companyId}, {profile.name}.
          </p>
        </header>

        {isSuperAdmin ? (
          <div className="pt-12">
            <div className="bg-primary/5 p-12 rounded-[3rem] border-2 border-dashed border-primary/20 flex flex-col items-center text-center gap-6">
              <ShieldCheck className="w-16 h-16 text-primary/30" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Console Super Administrateur</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
                  Gestion globale des identifiants et monitoring multi-entreprise.
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
            <CategoryTiles profile={profile} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
