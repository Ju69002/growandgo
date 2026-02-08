
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { 
  Loader2, 
  FileText, 
  LogOut, 
  AlertTriangle, 
  ListTodo, 
  Calendar as CalendarIcon, 
  ChevronRight, 
  CheckCircle2,
  Maximize2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { signOut } from 'firebase/auth';
import Link from 'next/link';

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
  
  const companyId = profile?.companyId ? profile.companyId : null;

  const pendingDocsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('status', '!=', 'archived'),
      limit(5)
    );
  }, [db, companyId]);

  const { data: pendingTasks } = useCollection<BusinessDocument>(pendingDocsQuery);

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
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initialisation de l'espace...</p>
      </div>
    );
  }

  if (!user) return null;

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
  const isJSecchi = profile?.loginId?.toLowerCase() === 'jsecchi' || profile?.loginId_lower === 'jsecchi';
  const companyDisplayName = isJSecchi ? "GrowAndGo" : (profile?.companyName || "GrowAndGo");

  return (
    <DashboardLayout>
      <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-500">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">Tableau de bord</h1>
              {profile && (
                <Badge className={cn(
                  "font-black uppercase text-[10px] h-5 px-2",
                  isSuperAdmin ? "bg-rose-950 text-white" : profile.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {isSuperAdmin ? 'ADMIN' : profile.role === 'admin' ? 'PATRON' : 'EMPLOYÉ'}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-medium italic">
              Espace {companyDisplayName}, Bienvenue {profile?.name}.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" />
                Tâches de la semaine
              </h2>
            </div>
            
            <div className="space-y-3">
              {pendingTasks && pendingTasks.length > 0 ? (
                pendingTasks.map((task) => (
                  <Link href={`/categories/${task.categoryId}`} key={task.id}>
                    <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 bg-primary/5 rounded-lg text-primary">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{task.name}</p>
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">{task.status.replace('_', ' ')}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform" />
                      </CardContent>
                    </Card>
                  </Link>
                ))
              ) : (
                <div className="p-10 border-2 border-dashed rounded-[2rem] text-center space-y-2 bg-muted/5">
                  <CheckCircle2 className="w-8 h-8 text-primary/30 mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tout est à jour</p>
                </div>
              )}
              {pendingTasks && pendingTasks.length > 0 && (
                <Button asChild variant="ghost" className="w-full font-black uppercase text-[10px] tracking-widest h-10 rounded-xl">
                  <Link href="/notifications">Voir tout</Link>
                </Button>
              )}
            </div>
          </aside>

          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Agenda collaboratif
              </h2>
              <Button asChild variant="outline" size="sm" className="rounded-full h-8 px-4 font-black uppercase text-[10px] tracking-widest gap-2">
                <Link href="/categories/agenda">
                  <Maximize2 className="w-3 h-3" /> Agrandir
                </Link>
              </Button>
            </div>
            <div className="h-[500px] border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
              {companyId ? (
                <SharedCalendar companyId={companyId} isCompact={true} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
                   Initialisation de l'agenda...
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="pt-8 border-t">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary" />
            Dossiers de l'espace de travail
          </h2>
          {profile && <CategoryTiles profile={profile} />}
        </section>
      </div>
    </DashboardLayout>
  );
}
