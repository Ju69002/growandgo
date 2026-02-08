
'use client';

import { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { 
  ShieldCheck, 
  Loader2, 
  ListTodo, 
  Calendar as CalendarIcon, 
  Maximize2, 
  FileText, 
  CheckCircle2, 
  X,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  useCollection 
} from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, startOfToday, addDays, parseISO, isValid, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Home() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  
  const [mounted, setMounted] = useState(false);
  const [isCalendarFull, setIsCalendarFull] = useState(false);

  // 1. Déclaration de TOUS les Hooks au sommet (Rules of Hooks)
  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);
  
  const companyId = profile?.companyId;

  const documentsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('status', 'in', ['waiting_verification', 'waiting_validation']),
      limit(20)
    );
  }, [db, companyId]);

  const { data: documents } = useCollection<BusinessDocument>(documentsQuery);

  const meetingsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'events'), limit(20));
  }, [db, companyId]);

  const { data: meetings } = useCollection<CalendarEvent>(meetingsQuery);

  // 2. Gestion du montage et de la redirection prioritaire
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router, mounted]);

  // 3. Calcul des tâches hebdomadaires
  const weeklyTasks = useMemo(() => {
    if (!mounted || (!documents && !meetings)) return [];
    const today = startOfToday();
    const endOfWeekDate = addDays(today, 7);
    const interval = { start: today, end: endOfWeekDate };
    const tasks: any[] = [];

    documents?.forEach(doc => {
      const extractedDate = doc.extractedData?.date || doc.extractedData?.expiryDate;
      let taskDate = today;
      if (extractedDate) {
        try {
          const parsed = parseISO(extractedDate);
          if (isValid(parsed)) taskDate = parsed;
        } catch (e) { }
      }
      if (taskDate <= endOfWeekDate) {
        tasks.push({
          id: doc.id,
          name: doc.name,
          date: taskDate,
          type: 'document',
          subCategory: doc.subCategory,
          categoryId: doc.categoryId
        });
      }
    });

    meetings?.forEach(meet => {
      if (!meet.debut) return;
      try {
        const meetDate = parseISO(meet.debut);
        if (isValid(meetDate) && isWithinInterval(meetDate, interval)) {
          tasks.push({
            id: meet.id,
            name: meet.titre,
            date: meetDate,
            type: 'meeting',
            subCategory: 'Réunion',
            categoryId: 'agenda'
          });
        }
      } catch (e) { }
    });
    return tasks.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [mounted, documents, meetings]);

  // 4. Rendus conditionnels sécurisés APRES les Hooks
  if (!mounted || isUserLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F5F2EA]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirection forcée vers login
  }

  if (!isProfileLoading && !profile) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center space-y-6">
          <div className="p-6 bg-destructive/10 rounded-[2.5rem]">
             <AlertTriangle className="w-16 h-16 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter text-primary">Profil Inaccessible</h2>
            <p className="text-muted-foreground max-w-md mx-auto font-medium">
              Votre identifiant est connecté mais votre profil Studio est manquant ou en cours de réparation.
            </p>
          </div>
          <Button 
            onClick={() => router.push('/login')}
            className="rounded-full px-12 h-14 bg-primary font-bold shadow-xl text-lg uppercase"
          >
            Retourner à l'identification
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isSuperAdmin = profile?.role === 'super_admin';

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
              {isSuperAdmin ? 'Super Admin' : profile?.role === 'admin' ? 'Patron' : 'Employé'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 font-medium italic">
            Bienvenue dans votre espace {profile?.name || profile?.loginId}.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-6 border-b border-muted/50 flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <ListTodo className="w-5 h-5 text-primary" />
                Actions Hebdo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 max-h-[400px] overflow-y-auto">
              {weeklyTasks.length > 0 ? (
                weeklyTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl border bg-muted/5 hover:bg-muted/10 transition-all">
                    <div className="flex items-center gap-4">
                      {task.type === 'meeting' ? <CalendarIcon className="w-4 h-4 text-amber-500" /> : <FileText className="w-4 h-4 text-primary" />}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate max-w-[180px]">{task.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black">
                          {format(task.date, "EEEE d MMMM", { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-black border-primary/20">
                      {task.subCategory || 'Studio'}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 gap-4">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Tout est à jour</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="pb-4 border-b border-muted/50 flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Aperçu Agenda
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm" 
                className="rounded-full font-black uppercase text-[10px]"
                onClick={() => setIsCalendarFull(true)}
              >
                <Maximize2 className="w-4 h-4 mr-2" /> Plein Écran
              </Button>
            </CardHeader>
            <CardContent className="p-0 h-[400px]">
              {companyId && <SharedCalendar companyId={companyId} isCompact />}
            </CardContent>
          </Card>
        </div>

        {!isSuperAdmin && profile && (
          <div className="pt-8">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
               <FileText className="w-6 h-6 text-primary" />
               Dossiers Studio
            </h2>
            <CategoryTiles profile={profile} />
          </div>
        )}

        {isSuperAdmin && (
          <div className="pt-12 border-t border-dashed border-primary/10">
            <div className="bg-primary/5 p-12 rounded-[3rem] border-2 border-dashed border-primary/20 flex flex-col items-center text-center gap-6">
              <ShieldCheck className="w-16 h-16 text-primary/30" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Console Super Administrateur</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
                  Gestion globale des accès et des entreprises Studio.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCalendarFull} onOpenChange={setIsCalendarFull}>
        <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 overflow-hidden bg-background rounded-[2.5rem]">
          <div className="sr-only">
            <DialogTitle>Agenda Partagé Studio</DialogTitle>
          </div>
          <div className="h-full flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-primary text-primary-foreground">
              <div className="flex items-center gap-4">
                <CalendarIcon className="w-7 h-7" />
                <h2 className="font-black text-2xl uppercase tracking-tighter">AGENDA DU STUDIO</h2>
              </div>
              <Button variant="ghost" size="icon" className="text-white" onClick={() => setIsCalendarFull(false)}>
                <X className="w-7 h-7" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              {companyId && <SharedCalendar companyId={companyId} defaultView="month" />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
