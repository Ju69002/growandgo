
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditCard, ShieldCheck, Ban, CheckCircle2, History, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function BillingPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);

  const isActive = profile?.subscriptionStatus !== 'inactive' || profile?.role === 'super_admin';

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-tight">Abonnement Studio</h1>
            <p className="text-muted-foreground font-medium">Gérez vos paiements et le statut de votre accès collaboratif.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7" />
                  Statut de l'Accès
                </CardTitle>
                <Badge className={cn(
                  "font-black uppercase text-xs h-8 px-4 border-none shadow-lg",
                  isActive ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}>
                  {isActive ? "ABONNEMENT ACTIF" : "ABONNEMENT SUSPENDU"}
                </Badge>
              </div>
              <CardDescription className="text-primary-foreground/70 font-medium">
                Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="flex items-center gap-6 p-6 rounded-[2rem] bg-muted/30 border-2 border-dashed">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center shadow-inner",
                  isActive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                )}>
                  {isActive ? <CheckCircle2 className="w-8 h-8" /> : <Ban className="w-8 h-8" />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold">{isActive ? "Votre Studio est pleinement opérationnel" : "Accès restreint par l'administrateur"}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isActive 
                      ? "Tous vos outils collaboratifs et documents sont accessibles sans restriction." 
                      : "Veuillez contacter votre Super Administrateur (JSecchi) pour rétablir vos accès."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Plan Actuel</h4>
                <div className="p-6 rounded-2xl border bg-card hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/5 rounded-xl">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">Grow&Go Studio Premium</p>
                        <p className="text-xs text-muted-foreground">Accès illimité aux 7 dossiers et assistant IA</p>
                      </div>
                    </div>
                    <p className="text-2xl font-black text-primary">0,00€<span className="text-sm font-bold text-muted-foreground">/mois</span></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-primary/5">
            <CardHeader className="p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 pt-0 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between group cursor-pointer">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">Facture #GG-00{i}</p>
                    <p className="text-[9px] font-black uppercase text-muted-foreground">{10 - i} Mai 2024</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-primary/30 group-hover:translate-x-1 transition-transform" />
                </div>
              ))}
              <div className="pt-4 border-t border-primary/10">
                <p className="text-[10px] font-black uppercase text-center text-primary opacity-40">Aucune autre facture</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
