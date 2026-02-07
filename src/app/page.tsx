
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
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  CalendarDays,
  User as UserIcon
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
  setDocumentNonBlocking, 
  useAuth, 
  useCollection 
} from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument, CalendarEvent } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, addDays, startOfToday, parseISO, isValid } from 'date-fns';
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

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

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

  const [isCalendarFull, setIsCalendarFull] = useState(false);

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Chargement de votre espace Grow&Go...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de bord</h1>
            <Badge className={cn(
              "font-black uppercase text-[10px] h-5 px-2",
              profile.role === 'super_admin' ? "bg-rose-950 text-white" : 
              profile.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {profile.role === 'super_admin' ? 'Super Admin' : profile.role === 'admin' ? 'Patron' : 'Employé'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            Bienvenue {profile.name}. Planning hebdomadaire et suivi des dossiers.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-none shadow-md overflow-hidden bg-card h-full flex flex-col">
            <CardHeader className="pb-4 border-b flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-primary" />
                Tâches de la semaine
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
              {weeklyTasks.length > 0 ? (
                weeklyTasks.map(task => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/5 hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-3">
                      {task.type === 'meeting' ? <CalendarIcon className="w-4 h-4 text-amber-500" /> : <FileText className="w-4 h-4 text-primary" />}
                      <div className="flex flex-col">
                        <span className="text-sm font-bold truncate max-w-[200px]">{task.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {format(task.date, "EEEE d MMMM", { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] uppercase font-black", statusConfig[task.status]?.color)}>
                      {statusConfig[task.status]?.label || task.subCategory}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center opacity-40 grayscale">
                  <CheckCircle2 className="w-10 h-10 mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Tout est à jour pour cette semaine</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-card h-full relative group flex flex-col">
            <CardHeader className="pb-2 border-b flex flex-row items-center justify-between space-y-0 bg-muted/5">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Agenda (3 prochains jours)
              </CardTitle>
              <Button 
                variant="secondary" 
                size="sm" 
                className="rounded-full font-bold gap-2 shadow-sm"
                onClick={() => setIsCalendarFull(true)}
              >
                <Maximize2 className="w-4 h-4" />
                Agrandir
              </Button>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <div className="h-full min-h-[350px]">
                {companyId && <SharedCalendar companyId={companyId} isCompact />}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="pt-4">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Vos Dossiers Grow&Go
          </h2>
          <CategoryTiles profile={profile} />
        </div>
      </div>

      <Dialog open={isCalendarFull} onOpenChange={setIsCalendarFull}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden bg-background border-none shadow-2xl">
          <div className="sr-only">
            <DialogTitle>Agenda</DialogTitle>
          </div>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-primary text-primary-foreground">
              <h2 className="font-black text-xl flex items-center gap-3">
                <CalendarIcon className="w-6 h-6" />
                AGENDA
              </h2>
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
