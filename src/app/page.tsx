
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useAuth, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { 
  Loader2, 
  FileText, 
  ChevronRight, 
  CheckCircle2,
  Maximize2,
  Zap,
  ListTodo,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { syncBillingTasks } from '@/services/billing-sync';
import { startOfWeek, endOfWeek, isWithinInterval, parse, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const syncLockRef = useRef(false);

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
  
  const isSuperAdmin = profile?.role === 'super_admin';
  const isParticulier = profile?.role === 'particulier';
  const companyId = profile?.companyId || null;

  // Optimisation : On ne récupère les utilisateurs pour la synchro que si on est SuperAdmin
  // et on ne le fait qu'une fois de manière asynchrone
  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allUsers } = useCollection<User>(allUsersQuery);

  useEffect(() => {
    if (db && user && isSuperAdmin && allUsers && !syncLockRef.current) {
      syncLockRef.current = true;
      // Exécution différée pour ne pas bloquer le rendu initial
      const timer = setTimeout(() => {
        syncBillingTasks(db, user.uid, allUsers);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [db, user, isSuperAdmin, allUsers]);

  const pendingDocsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('status', '!=', 'archived')
    );
  }, [db, companyId]);

  const { data: pendingTasks, isLoading: isTasksLoading } = useCollection<BusinessDocument>(pendingDocsQuery);

  const weeklyTasks = useMemo(() => {
    if (!pendingTasks) return [];
    const now = new Date();
    const start = startOfWeek(now, { locale: fr, weekStartsOn: 1 });
    const end = endOfWeek(now, { locale: fr, weekStartsOn: 1 });

    return pendingTasks
      .filter(task => {
        // Uniquement les tâches v4 pour éviter le bruit
        if (task.isBillingTask && !task.id.startsWith('billing_v4')) return false;
        
        try {
          const taskDate = parse(task.createdAt, 'dd/MM/yyyy', new Date());
          if (!isValid(taskDate)) return false;
          return isWithinInterval(taskDate, { start, end });
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = parse(a.createdAt, 'dd/MM/yyyy', new Date()).getTime();
        const dateB = parse(b.createdAt, 'dd/MM/yyyy', new Date()).getTime();
        return dateA - dateB;
      });
  }, [pendingTasks]);

  if (!mounted || isUserLoading) return null;
  if (!user) return null;

  const isJSecchi = profile?.loginId?.toLowerCase() === 'jsecchi' || profile?.loginId_lower === 'jsecchi';
  const companyDisplayName = isParticulier ? "Espace Privé" : (isJSecchi ? "GrowAndGo" : (profile?.companyName || "GrowAndGo"));

  return (
    <DashboardLayout>
      <div className="space-y-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-300">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-none">Tableau de bord</h1>
              {profile ? (
                <Badge className={cn(
                  "font-black uppercase text-[10px] h-5 px-2",
                  isSuperAdmin ? "bg-rose-950 text-white" : 
                  profile.role === 'admin' ? "bg-primary text-primary-foreground" : 
                  profile.role === 'particulier' ? "bg-amber-600 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isSuperAdmin ? 'ADMIN' : profile.role === 'admin' ? 'PATRON' : profile.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                </Badge>
              ) : (
                <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
              )}
            </div>
            <p className="text-muted-foreground font-medium italic">
              {companyDisplayName}, Bienvenue {profile?.name || '...'}.
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <aside className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" />
                Tâches de la semaine
              </h2>
            </div>
            
            <div className="grid gap-3">
              {isTasksLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
                ))
              ) : weeklyTasks.length > 0 ? (
                weeklyTasks.map((task) => {
                  const dateParts = task.createdAt.split('/');
                  const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
                  
                  return (
                    <Link 
                      href={task.isBillingTask 
                        ? `/categories/agenda?date=${formattedDate}` 
                        : `/categories/${task.categoryId}`} 
                      key={task.id}
                    >
                      <Card className={cn(
                        "border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group",
                        task.isBillingTask && "bg-amber-50/50 border border-amber-100"
                      )}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            task.isBillingTask ? "bg-amber-100 text-amber-600" : "bg-primary/5 text-primary"
                          )}>
                            {task.isBillingTask ? <Zap className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{task.name}</p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">
                                {task.isBillingTask ? "Facturation" : task.status.replace('_', ' ')}
                              </p>
                              <p className="text-[9px] font-bold text-primary/40">{task.createdAt}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:translate-x-1 transition-transform shrink-0" />
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })
              ) : (
                <div className="p-10 border-2 border-dashed rounded-[2rem] text-center space-y-2 bg-muted/5">
                  <CheckCircle2 className="w-8 h-8 text-primary/30 mx-auto" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aucune tâche cette semaine</p>
                </div>
              )}
            </div>
          </aside>

          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                {isParticulier ? "Mon Agenda" : "Agenda collaboratif"}
              </h2>
              <Button asChild variant="outline" size="sm" className="rounded-full h-8 px-4 font-black uppercase text-[10px] tracking-widest gap-2">
                <Link href="/categories/agenda">
                  <Maximize2 className="w-3 h-3" /> Agrandir
                </Link>
              </Button>
            </div>
            <div className="h-[420px] border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
              {companyId ? (
                <SharedCalendar companyId={companyId} isCompact={true} />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground animate-pulse">
                   Chargement de l'agenda...
                </div>
              )}
            </div>
          </div>
        </div>

        <section className="pt-8 border-t">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
            <FileText className="w-7 h-7 text-primary" />
            {isParticulier ? "Mes Dossiers Personnels" : "Dossiers de l'espace de travail"}
          </h2>
          {profile && <CategoryTiles profile={profile} />}
        </section>
      </div>
    </DashboardLayout>
  );
}
