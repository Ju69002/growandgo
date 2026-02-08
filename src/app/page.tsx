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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [mounted, user, isUserLoading, router]);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  const handleLogout = async () => {
    if (auth) {
      await signOut(auth);
      router.push('/login');
    }
  };

  if (!mounted || isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initialisation du studio...</p>
      </div>
    );
  }

  if (!user) return null;

  // Si le chargement est terminé mais qu'aucun profil n'est trouvé, on affiche une alerte
  if (!isProfileLoading && !profile && mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] p-8 text-center space-y-6">
        <div className="p-4 bg-rose-100 rounded-full">
           <AlertTriangle className="w-12 h-12 text-rose-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">Profil non synchronisé</h2>
          <p className="text-muted-foreground max-w-sm mx-auto font-medium">
            Votre session est active mais les données de votre profil sont introuvables.
          </p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="rounded-full px-8 h-12 font-bold gap-2">
          <LogOut className="w-4 h-4" />
          Reconnecter mon ID
        </Button>
      </div>
    );
  }

  if (isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary opacity-50" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Accès sécurisé...</p>
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
                isSuperAdmin ? "bg-rose-950 text-white" : profile.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {isSuperAdmin ? 'Super Admin' : profile.role === 'admin' ? 'Patron' : 'Employé'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 font-medium italic">
            Bienvenue dans le Studio {profile?.companyName || "Grow&Go"}, {profile?.name}.
          </p>
        </header>

        {isSuperAdmin ? (
          <div className="pt-12">
            <div className="bg-primary/5 p-12 rounded-[3rem] border-2 border-dashed border-primary/20 flex flex-col items-center text-center gap-6">
              <ShieldCheck className="w-16 h-16 text-primary/30" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Répertoire Global Activé</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
                  Utilisez le menu latéral pour gérer les comptes et les accès de tous les studios.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="pt-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
               <FileText className="w-6 h-6 text-primary" />
               Dossiers du Studio
            </h2>
            {profile && <CategoryTiles profile={profile} />}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
