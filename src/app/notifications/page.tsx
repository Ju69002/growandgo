
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

const statusConfig: Record<DocumentStatus, { label: string; icon: any; color: string }> = {
  pending_analysis: { label: 'Analyse en cours', icon: Clock, color: 'bg-amber-100 text-amber-700' },
  waiting_verification: { label: 'À vérifier', icon: AlertCircle, color: 'bg-blue-100 text-blue-700' },
  waiting_validation: { label: 'À valider', icon: AlertCircle, color: 'bg-destructive/10 text-destructive' },
  archived: { label: 'Archivé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
};

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
      collection(db, 'companies', companyId, 'documents'),
      where('status', 'in', ['pending_analysis', 'waiting_verification', 'waiting_validation'])
    );
  }, [db, companyId]);

  const { data: tasks, isLoading } = useCollection<BusinessDocument>(pendingDocsQuery);

  // Filtre strict : on exclut les tâches de facturation et les documents nommés "Facture"
  const filteredTasks = tasks?.filter(t => 
    !t.isBillingTask && 
    !t.name?.toLowerCase().includes('facture')
  ) || [];

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Centre de Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Documents importés en attente de traitement pour l'ensemble de l'entreprise.
          </p>
        </div>

        <div className="grid gap-4">
          {!companyId || isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-24 bg-muted" />
              </Card>
            ))
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task) => {
              const config = statusConfig[task.status] || statusConfig.pending_analysis;
              return (
                <Card key={task.id} className="hover:shadow-md transition-all border-none shadow-sm rounded-2xl overflow-hidden bg-white">
                  <CardContent className="p-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="p-3 bg-primary/5 rounded-xl text-primary">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg truncate text-primary">{task.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={config.color}>
                            <config.icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                          <span className="text-[10px] font-black uppercase text-muted-foreground opacity-50">
                            Importé le {task.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="outline" size="sm" className="rounded-full font-bold">
                      <Link href={`/categories/${task.categoryId}`} className="flex items-center gap-2">
                        Traiter
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="text-center py-20 bg-card rounded-[3rem] border-2 border-dashed border-primary/10">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4 opacity-20" />
              <h2 className="text-xl font-bold text-primary">Aucun document en attente</h2>
              <p className="text-muted-foreground">Votre centre de notifications est parfaitement propre.</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
