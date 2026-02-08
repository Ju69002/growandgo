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
  AlertCircle,
  Clock,
  CalendarDays,
  Users,
  X
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

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  waiting_verification: { label: 'À vérifier', icon: AlertCircle, color: 'text-blue-600 bg-blue-50' },
  waiting_validation: { label: 'À valider', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  pending_analysis: { label: 'Analyse...', icon: Loader2, color: 'text-muted-foreground bg-muted' },
  dated: { label: 'Échéance', icon: CalendarDays, color: 'text-rose-600 bg-rose-50' }
};

export default function Home() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);
  const [isCalendarFull, setIsCalendarFull] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Move all hooks BEFORE any conditional returns to satisfy Rules of Hooks
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

  const weeklyTasks = useMemo(() => {
    if (!documents && !meetings) return [];
    const today = startOfToday();
    const endOfWeekDate = addDays(today, 7);
    const interval = { start: today, end: endOfWeekDate };
    const tasks: any[] = [];

    documents?.forEach(doc => {
      const extractedDate = doc.extractedData?.date || doc.extractedData?.expiryDate || doc.extractedData?.deliveryDate;
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
          status: (doc.extractedData?.date || doc.extractedData?.expiryDate || doc.extractedData?.deliveryDate) ? 'dated' : doc.status,
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
            status: 'event',
            subCategory: 'Réunion',
            categoryId: 'agenda'
          });
        }
      } catch (e) { }
    });
    return tasks.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [documents, meetings]);

  // Handle redirects in useEffect
  useEffect(() => {
    if (mounted && !isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router, mounted]);

  // Early returns for loading states (AFTER all hooks)
  if (isUserLoading || !mounted || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse font-black uppercase text-[10px] tracking-widest">
            {isUserLoading ? 'Authentification...' : 'Chargement du studio...'}
          </p>
        </div>
      </div>
    );
  }

  // Final session check
  if (!user) return null;

  const isSuperAdmin = profile?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Tableau de bord</h1>
            <Badge className={cn(
              "font-black uppercase text-[10px] h-5 px-2 shadow-sm",
              profile?.role === 'super_admin' ? "bg-rose-950 text-white" : 
              profile?.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'admin' ? 'Patron' : 'Employé'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 font-medium">
            Bienvenue {profile?.name}. Planning hebdomadaire et suivi des dossiers de studio.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white h-full flex flex-col">
            <CardHeader className="pb-6 border-b border-muted/50 flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <ListTodo className="w-5 h-5" />
                </div>
                Tâches de la semaine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3 flex-1 overflow-y-auto max-h-[450px]">
              {weeklyTasks.length > 0 ? (
                weeklyTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl border border-muted bg-muted/[0.02] hover:bg-muted/10 transition-all hover:translate-x-1 group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-2 rounded-xl group-hover:scale-110 transition-transform shadow-sm",
                        task.type === 'meeting' ? "bg-amber-100 text-amber-600" : "bg-primary/5 text-primary"
                      )}>
                        {task.type === 'meeting' ? <CalendarIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate max-w-[200px] text-foreground">{task.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
                          {format(task.date, "EEEE d MMMM", { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] uppercase font-black shadow-sm", statusConfig[task.status]?.color)}>
                      {statusConfig[task.status]?.label || task.subCategory}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-30 grayscale gap-4">
                  <CheckCircle2 className="w-16 h-16 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em]">Sérénité totale • Studio à jour</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white h-full relative group flex flex-col">
            <CardHeader className="pb-4 border-b border-muted/50 flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <div className="flex flex-col gap-1">
                <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  Agenda Partagé
                </CardTitle>
                <div className="flex items-center gap-1.5 ml-12">
                   <Users className="w-3 h-3 text-primary/40" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-primary/40">Studio Sync</span>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full font-black uppercase text-[9px] tracking-widest gap-2 h-8 px-4 border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                onClick={() => setIsCalendarFull(true)}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Agrandir
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="h-full min-h-[400px]">
                {companyId && <SharedCalendar companyId={companyId} isCompact />}
              </div>
            </CardContent>
          </Card>
        </div>

        {!isSuperAdmin && profile && (
          <div className="pt-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
              <div className="p-2 bg-primary text-white rounded-xl shadow-lg">
                <FileText className="w-6 h-6" />
              </div>
              Dossiers Grow&Go
            </h2>
            <CategoryTiles profile={profile} />
          </div>
        )}

        {isSuperAdmin && (
          <div className="pt-12 border-t border-dashed border-primary/10">
            <div className="bg-primary/5 p-12 rounded-[3rem] border-2 border-dashed border-primary/20 flex flex-col items-center text-center gap-6 shadow-inner">
              <ShieldCheck className="w-16 h-16 text-primary/20 animate-pulse" />
              <div className="space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight text-primary">Console Super Admin</h2>
                <p className="text-sm text-muted-foreground font-medium max-w-lg mx-auto">
                  Gestion globale des accès et des entreprises. Les dossiers de travail sont réservés aux espaces Studios (Patron/Employé).
                </p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="rounded-full font-black uppercase text-[10px] tracking-widest px-8 border-primary/20">Audit Système</Button>
                <Button className="rounded-full font-black uppercase text-[10px] tracking-widest px-8 bg-primary">Gestion Utilisateurs</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCalendarFull} onOpenChange={setIsCalendarFull}>
        <DialogContent className="max-w-[98vw] w-full h-[95vh] p-0 overflow-hidden bg-background border-none shadow-[0_0_100px_rgba(0,0,0,0.3)] rounded-[2.5rem]">
          <div className="sr-only">
            <DialogTitle>Agenda Partagé Studio</DialogTitle>
          </div>
          <div className="h-full flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-primary text-primary-foreground shadow-lg z-10">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl shadow-inner">
                   <CalendarIcon className="w-7 h-7" />
                </div>
                <div className="flex flex-col">
                  <h2 className="font-black text-2xl uppercase tracking-tighter leading-none">AGENDA PARTAGÉ</h2>
                  <div className="flex items-center gap-2 mt-1 opacity-70">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{companyId} Studio</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 hover:bg-white/10 text-white" onClick={() => setIsCalendarFull(false)}>
                <X className="w-7 h-7" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto bg-muted/[0.02]">
              {companyId && <SharedCalendar companyId={companyId} defaultView="month" />}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
