
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditCard, ShieldCheck, Ban, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export default function BillingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);

  const invoicesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'users', user.uid, 'invoices'),
      orderBy('date', 'desc'),
      limit(1)
    );
  }, [db, user]);

  const { data: lastInvoices } = useCollection(invoicesQuery);

  useEffect(() => {
    async function checkAndGenerateInvoice() {
      if (!db || !profile || profile.role === 'super_admin' || isGenerating) return;

      const creationDate = new Date(profile.createdAt || new Date());
      const now = new Date();
      
      // Calculer le nombre de mois depuis la création
      const monthsSinceCreation = (now.getFullYear() - creationDate.getFullYear()) * 12 + (now.getMonth() - creationDate.getMonth());
      
      if (monthsSinceCreation >= 0) {
        // Vérifier si une facture existe pour le mois en cours
        const currentMonthId = `${now.getFullYear()}-${now.getMonth() + 1}`;
        const q = query(
          collection(db, 'users', profile.uid, 'invoices'),
          where('monthId', '==', currentMonthId)
        );
        const snap = await getDocs(q);

        if (snap.empty) {
          setIsGenerating(true);
          const amount = profile.role === 'admin' ? 99.99 : 69.99;
          const invoiceData = {
            userId: profile.uid,
            userName: profile.name,
            companyId: profile.companyId,
            companyName: profile.companyName,
            amount: amount,
            date: new Date().toISOString(),
            monthId: currentMonthId,
            status: 'paid',
            label: profile.role === 'admin' ? 'Plan Patron' : 'Plan Employé'
          };

          // 1. Créer la facture pour l'utilisateur
          const userInvoicesRef = collection(db, 'users', profile.uid, 'invoices');
          addDocumentNonBlocking(userInvoicesRef, invoiceData);

          // 2. Créer une copie pour l'ADMIN (JSecchi)
          const adminId = 'profile_jsecchi';
          const adminReceivedRef = collection(db, 'users', adminId, 'received_invoices');
          addDocumentNonBlocking(adminReceivedRef, {
            ...invoiceData,
            originalInvoiceUser: profile.uid
          });
          
          setIsGenerating(false);
        }
      }
    }

    checkAndGenerateInvoice();
  }, [db, profile, isGenerating]);

  const isActive = profile?.subscriptionStatus !== 'inactive' || profile?.role === 'super_admin';

  const getPrice = () => {
    if (profile?.role === 'super_admin') return "0,00";
    if (profile?.role === 'admin') return "99,99";
    return "69,99";
  };

  const getPlanName = () => {
    if (profile?.role === 'super_admin') return "Compte Super Administrateur";
    if (profile?.role === 'admin') return "Plan Patron";
    return "Plan Employé";
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-tight">Abonnement Espace</h1>
            <p className="text-muted-foreground font-medium">Gérez vos paiements et le statut de votre accès collaboratif.</p>
          </div>
        </div>

        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
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
              Espace de travail GROW&GO
            </CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-8 text-center">
            <div className="flex flex-col items-center gap-6 p-8 rounded-[2rem] bg-muted/30 border-2 border-dashed">
              <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center shadow-inner",
                isActive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              )}>
                {isActive ? <CheckCircle2 className="w-10 h-10" /> : <Ban className="w-10 h-10" />}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">{isActive ? "Votre espace est opérationnel" : "Accès restreint"}</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  {isActive 
                    ? "Tous vos outils collaboratifs et documents sont accessibles sans restriction." 
                    : "Veuillez contacter votre administrateur pour rétablir vos accès."}
                </p>
              </div>
            </div>

            <div className="max-w-md mx-auto space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plan de facturation</h4>
              <div className="p-6 rounded-2xl border bg-card hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2 bg-primary/5 rounded-xl">
                      <CreditCard className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{getPlanName()}</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase">Renouvellement automatique</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary">{getPrice()}€<span className="text-sm font-bold text-muted-foreground">/mois</span></p>
                    {profile?.role === 'super_admin' && <p className="text-[9px] font-black text-emerald-600 uppercase">Inclus</p>}
                  </div>
                </div>
              </div>
              {isGenerating && (
                <div className="flex items-center justify-center gap-2 text-primary/50 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Génération de la facture...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
