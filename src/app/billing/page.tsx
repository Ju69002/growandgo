
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditCard, ShieldCheck, Ban, CheckCircle2, Users, FileDown, Loader2, Euro, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  useCollection 
} from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { generateInvoicePDF } from '@/lib/invoice-utils';
import { useToast } from '@/hooks/use-toast';
import { updateSubscriptionData } from '@/services/billing-sync';

export default function BillingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company, isLoading: isCompanyLoading } = useDoc<Company>(companyRef);

  // Requête pour compter les utilisateurs de l'entreprise en temps réel
  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'users'),
      where('companyId', '==', companyId),
      where('isProfile', '==', true)
    );
  }, [db, companyId]);

  const { data: teamMembers } = useCollection<User>(teamQuery);

  // Effet pour mettre à jour les données de l'abonnement en base
  useEffect(() => {
    if (db && companyId && teamMembers && profile?.role === 'admin') {
      updateSubscriptionData(db, companyId, teamMembers.length);
    }
  }, [db, companyId, teamMembers, profile]);

  const handleDownloadInvoice = () => {
    if (!profile || !company) return;
    setIsGenerating(profile.uid);
    try {
      const amountStr = (company.subscription?.totalMonthlyAmount || 0).toFixed(2).replace('.', ',');
      generateInvoicePDF(profile, amountStr);
      toast({ title: "Facture générée" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur lors de la génération PDF" });
    } finally {
      setIsGenerating(null);
    }
  };

  if (!mounted || isProfileLoading || isCompanyLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary opacity-20 w-10 h-10" />
        </div>
      </DashboardLayout>
    );
  }

  const isPatron = profile?.role === 'admin';
  const isActive = company?.subscriptionStatus !== 'inactive';
  const pricePerUser = 39.99;
  const userCount = teamMembers?.length || 1;
  const totalAmount = userCount * pricePerUser;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <CreditCard className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Abonnement</h1>
              <p className="text-muted-foreground font-medium">Tarification unique de 39,99€ par collaborateur.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <CardTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <Users className="w-6 h-6" />
                Détail de la Facturation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl border-2 border-dashed">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Utilisateurs actifs</p>
                  <p className="text-3xl font-black text-primary">{userCount} collaborateurs</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Prix par tête</p>
                  <p className="text-xl font-bold">{pricePerUser.toFixed(2)}€ / mois</p>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Total mensuel</h3>
                  <p className="text-sm text-muted-foreground">Calculé automatiquement selon l'équipe.</p>
                </div>
                <div className="text-4xl font-black text-primary">
                  {totalAmount.toFixed(2).replace('.', ',')}€
                  <span className="text-sm font-bold text-muted-foreground ml-1">TTC</span>
                </div>
              </div>

              {isPatron && (
                <div className="pt-8 border-t flex justify-end">
                  <Button 
                    onClick={handleDownloadInvoice} 
                    disabled={!!isGenerating}
                    className="rounded-full h-12 px-8 font-bold bg-primary shadow-lg gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    Télécharger la dernière facture
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className={cn("p-8 text-white", isActive ? "bg-emerald-600" : "bg-rose-600")}>
              <div className="flex flex-col items-center gap-2">
                {isActive ? <CheckCircle2 className="w-10 h-10" /> : <Ban className="w-10 h-10" />}
                <CardTitle className="text-lg font-black uppercase tracking-widest">
                  {isActive ? "Compte Actif" : "Accès Suspendu"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6 text-center">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Prochaine échéance</p>
                <p className="text-xl font-black text-primary">08 Mars 2026</p>
              </div>
              <div className="p-4 bg-primary/5 rounded-2xl flex items-start gap-3 text-left">
                <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-[10px] leading-relaxed font-bold text-primary/70">
                  Le Patron est l'unique responsable du paiement. Tout nouvel employé ajouté sera facturé au prorata sur la prochaine période.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
