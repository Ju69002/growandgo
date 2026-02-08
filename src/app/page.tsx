
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { 
  FileText, 
  ChevronRight, 
  CheckCircle2,
  Maximize2,
  Zap,
  ListTodo,
  Calendar as CalendarIcon,
  Loader2
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

  const { data: profile } = useDoc<User>(userRef);
  
  const isSuperAdmin = profile?.role === 'super_admin';
  const isParticulier = profile?.role === 'particulier';
  const companyId = profile?.companyId || null;

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allUsers } = useCollection<User>(allUsersQuery);

  useEffect(() => {
    if (db && user && isSuperAdmin && allUsers && !syncLockRef.current) {
      syncLockRef.current = true;
      const timer = setTimeout(() => {
        syncBillingTasks(db, user.uid, allUsers);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [db, user, isSuperAdmin, allUsers]);

  const pendingDocsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    const normalizedId = companyId.toLowerCase();
    return query(
      collection(db, 'companies', normalizedId, 'documents'),
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
        // Filtrer strictement sur la version V1 stable
        if (task.isBillingTask && !task.id.startsWith('billing_v1')) return false;
        try {
          const taskDate = parse(task.createdAt, 'dd/MM/yyyy', new Date());
          if (!isValid(taskDate)) return false;
          return isWithinInterval(taskDate, { start, end });
        } catch (e) {
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const dateA = parse(a.createdAt, 'dd/MM/yyyy', new Date()).getTime();
          const dateB = parse(b.createdAt, 'dd/MM/yyyy', new Date()).getTime();
          return dateA - dateB;
        } catch (e) { return 0; }
      });
  }, [pendingTasks]);

  if (!mounted || isUserLoading || !user) return null;

  const companyDisplayName = isParticulier ? "Espace Privé" : (profile?.companyName || "GrowAndGo");

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
                  isSuperAdmin ? "bg-rose-950 text-white" : 
                  profile.role === 'admin' ? "bg-primary text-primary-foreground" : 
                  profile.role === 'particulier' ? "bg-amber-600 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {isSuperAdmin ? 'ADMIN' : profile.role === 'admin' ? 'PATRON' : profile.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground font-medium italic">
              {companyDisplayName}, Bienvenue {profile?.name || '...'}.
            </p>
          </div>
        </header>

        {/* Tâches de la semaine - PRIORITAIRE EN HAUT */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
              <ListTodo className="w-6 h-6 text-primary" />
              Tâches de la semaine
            </h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {isTasksLoading ? (
              Array(2).fill(0).map((_, i) => (
                <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />
              ))
            ) : weeklyTasks.length > 0 ? (
              weeklyTasks.map((task) => {
                return (
                  <Link 
                    href={task.isBillingTask ? `/billing` : `/categories/${task.categoryId}`} 
                    key={task.id}
                    className="block"
                  >
                    <Card className={cn(
                      "border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group h-full",
                      task.isBillingTask && "bg-amber-50/50 border border-amber-100"
                    )}>
                      <CardContent className="p-6 flex items-center gap-6">
                        <div className={cn(
                          "p-3 rounded-xl shrink-0",
                          task.isBillingTask ? "bg-amber-100 text-amber-600" : "bg-primary/5 text-primary"
                        )}>
                          {task.isBillingTask ? <Zap className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                            {task.name}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[11px] font-black uppercase text-muted-foreground opacity-60 tracking-wider">
                              {task.isBillingTask ? "Action requise" : task.status.replace('_', ' ')}
                            </p>
                            <p className="text-[10px] font-bold text-primary/40">{task.createdAt}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:translate-x-1 transition-transform shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <div className="p-12 border-2 border-dashed rounded-[3rem] text-center space-y-3 bg-muted/5">
                <CheckCircle2 className="w-10 h-10 text-primary/30 mx-auto" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aucune tâche en attente</p>
              </div>
            )}
          </div>
        </section>

        {/* Agenda - PLEINE LARGEUR SANS SCROLL */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2">
              <CalendarIcon className="w-6 h-6 text-primary" />
              {isParticulier ? "Mon Agenda" : "Agenda collaboratif"}
            </h2>
            <Button asChild variant="outline" size="sm" className="rounded-full h-9 px-5 font-black uppercase text-[11px] tracking-widest gap-2">
              <Link href="/categories/agenda">
                <Maximize2 className="w-4 h-4" /> Agrandir
              </Link>
            </Button>
          </div>
          <div className="h-[750px] border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white border border-primary/5">
            {companyId ? (
              <SharedCalendar companyId={companyId} isCompact={false} defaultView="3day" />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/5">
                 <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
              </div>
            )}
          </div>
        </section>

        {/* Dossiers */}
        <section className="pt-10 border-t border-primary/10">
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
