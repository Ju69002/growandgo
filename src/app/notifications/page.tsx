
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Clock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User, BusinessDocument, DocumentStatus } from '@/lib/types';

export default function NotificationsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const pendingDocsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId.toLowerCase(), 'documents'),
      where('status', 'in', ['pending_analysis', 'waiting_verification', 'waiting_validation'])
    );
  }, [db, companyId]);

  const { data: rawTasks, isLoading } = useCollection<BusinessDocument>(pendingDocsQuery);

  // Filtre pour n'afficher que les documents d'importation
  const tasks = rawTasks?.filter(t => !t.isBillingTask) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Centre de Notifications</h1>
          <p className="text-muted-foreground mt-1">Suivi des documents importés par toute l'entreprise.</p>
        </div>

        <div className="grid gap-4">
          {isLoading ? (
            <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto" /></div>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <Card key={task.id} className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                <CardContent className="p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-primary/5 rounded-xl text-primary"><FileText className="w-6 h-6" /></div>
                    <div>
                      <h3 className="font-bold text-lg text-primary">{task.name}</h3>
                      <p className="text-[10px] font-black uppercase text-muted-foreground opacity-50">Dossier : {task.categoryId}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" className="rounded-full font-bold">
                    <Link href={`/categories/${task.categoryId}`}>Traiter <ArrowRight className="w-4 h-4 ml-2" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-card rounded-[3rem] border-2 border-dashed border-primary/10">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-bold text-primary">Tout est à jour</h2>
              <p className="text-muted-foreground">Aucun document en attente de traitement.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
