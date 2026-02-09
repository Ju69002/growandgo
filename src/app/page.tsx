
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { User, CalendarEvent } from '@/lib/types';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { 
  ChevronRight, 
  CheckCircle2,
  Maximize2,
  Zap,
  ListTodo,
  Calendar as CalendarIcon,
  Loader2,
  FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { syncBillingTasks } from '@/services/billing-sync';
import { startOfWeek, endOfWeek, isWithinInterval, parseISO, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { SharedCalendar } from '@/components/agenda/shared-calendar';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const syncLockRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sécurité : Redirection vers /login si non authentifié
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

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'), where('isProfile', '==', true));
  }, [db, isSuperAdmin]);

  const { data: allUsers } = useCollection<User>(allUsersQuery);

  // Synchronisation des tâches de facturation avec try/catch
  useEffect(() => {
    const handleSync = async () => {
      if (db && user && isSuperAdmin && allUsers && !syncLockRef.current) {
        syncLockRef.current = true;
        try {
          await syncBillingTasks(db, user.uid, allUsers);
        } catch (error) {
          console.error("Facturation sync error:", error);
        }
      }
    };
    handleSync();
  }, [db, user, isSuperAdmin, allUsers]);

  const eventsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    const normalizedId = companyId.toLowerCase();
    return query(collection(db, 'companies', normalizedId, 'events'));
  }, [db, companyId]);

  const { data: allEvents, isLoading: isEventsLoading } = useCollection<CalendarEvent>(eventsQuery);

  // Extraction dynamique des tâches de la semaine avec sécurité
  const weeklyTasks = useMemo(() => {
    try {
      if (!allEvents) return [];
      const now = new Date();
      const start = startOfWeek(now, { locale: fr, weekStartsOn: 1 });
      const end = endOfWeek(now, { locale: fr, weekStartsOn: 1 });

      return allEvents
        .filter(event => {
          if (!event.isBillingEvent) return false;
          try {
            const eventDate = parseISO(event.debut);
            if (!isValid(eventDate)) return false;
            return isWithinInterval(eventDate, { start, end });
          } catch (e) {
            return false;
          }
        })
        .sort((a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime());
    } catch (err) {
      return [];
    }
  }, [allEvents]);

  if (!mounted || isUserLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" /></div>;
  }

  if (!user) return null;

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

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
              <ListTodo className="w-6 h-6" />
              Tâches de la semaine
            </h2>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {isEventsLoading ? (
              Array(2).fill(0).map((_, i) => (
                <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />
              ))
            ) : weeklyTasks.length > 0 ? (
              weeklyTasks.map((task) => {
                const taskDate = parseISO(task.debut);
                return (
                  <Link 
                    href="/billing" 
                    key={task.id}
                    className="block"
                  >
                    <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-3xl overflow-hidden group bg-amber-50/50 border border-amber-100 h-full">
                      <CardContent className="p-6 flex items-center gap-6">
                        <div className="p-4 rounded-2xl shrink-0 bg-amber-100 text-amber-600 shadow-inner">
                          <Zap className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xl font-bold leading-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {task.titre.replace('Facture - ', 'Générer facture pour ')}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-[11px] font-black uppercase text-muted-foreground opacity-60 tracking-wider">
                              Action de facturation client
                            </p>
                            <p className="text-[10px] font-black text-primary/40 uppercase">
                              {isValid(taskDate) ? format(taskDate, 'EEEE dd MMMM', { locale: fr }) : ''}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-muted-foreground/30 group-hover:translate-x-1 transition-transform shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            ) : (
              <div className="p-16 border-2 border-dashed rounded-[3rem] text-center space-y-3 bg-muted/5 border-primary/10">
                <CheckCircle2 className="w-12 h-12 text-primary/20 mx-auto" />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Aucune action de facturation prévue cette semaine</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-2 text-primary">
              <CalendarIcon className="w-6 h-6" />
              {isParticulier ? "Mon Agenda" : "Agenda collaboratif"}
            </h2>
            <Button asChild variant="outline" size="sm" className="rounded-full h-9 px-6 font-black uppercase text-[10px] tracking-widest gap-2 bg-white">
              <Link href="/categories/agenda">
                <Maximize2 className="w-4 h-4" /> Voir tout l'agenda
              </Link>
            </Button>
          </div>
          <div className="h-[1100px] border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white ring-1 ring-primary/5">
            {companyId ? (
              <SharedCalendar 
                companyId={companyId} 
                isCompact={false} 
                defaultView="3day" 
                hideViewSwitcher={true} 
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-4">
                 <Loader2 className="w-10 h-10 animate-spin text-primary/20" />
                 <p className="text-[10px] font-black uppercase tracking-widest">Initialisation de l'agenda...</p>
              </div>
            )}
          </div>
        </section>

        <section className="pt-24 border-t border-primary/10">
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-10 flex items-center gap-3 text-primary">
            <FileText className="w-7 h-7" />
            {isParticulier ? "Mes Dossiers Personnels" : "Dossiers de l'espace de travail"}
          </h2>
          {profile && <CategoryTiles profile={profile} />}
        </section>
      </div>
    </DashboardLayout>
  );
}
