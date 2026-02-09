
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CreditCard, ShieldCheck, Ban, CheckCircle2, Users, Calendar, Euro, FileDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  useCollection 
} from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { generateInvoicePDF } from '@/lib/invoice-utils';
import { useToast } from '@/hooks/use-toast';
import { syncBillingTasks } from '@/services/billing-sync';

export default function BillingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const syncLock = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  const isSuperAdmin = profile?.companyId === 'admin_global' || profile?.role === 'super_admin';

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<User>(allUsersQuery);

  useEffect(() => {
    if (db && user && isSuperAdmin && allUsers && !syncLock.current) {
      syncLock.current = true;
      syncBillingTasks(db, user.uid, allUsers.filter(u => u.isProfile || u.role !== 'super_admin'));
    }
  }, [db, user, isSuperAdmin, allUsers]);

  const getPriceData = (userData: User | null) => {
    // Sécurisation contre le crash si userData est null
    if (!userData) return { price: "0,00", label: "CHARGEMENT..." };
    
    if (userData.companyId === 'admin_global' || userData.role === 'super_admin') {
      return { price: "0,00", label: "ADMIN" };
    }
    
    if (userData.role === 'particulier') {
      return { price: "39,99", label: "PARTICULIER" };
    }
    
    if (userData.role === 'employee') {
      return { price: "0,00", label: "INCLUS" };
    }
    
    // Calcul pour le Patron (admin) selon les nouveaux paliers
    const companyEmployees = allUsers?.filter(u => 
      u.companyId === userData.companyId && 
      u.role === 'employee' && 
      u.subscriptionStatus !== 'inactive'
    ) || [];
    
    const n = companyEmployees.length;
    // Patron + (0-5) employés = 199.99€
    if (n <= 5) return { price: "199,99", label: "FORFAIT 0-5 EMP." };
    // Patron + (6-10) employés = 399.99€
    if (n <= 10) return { price: "399,99", label: "FORFAIT 6-10 EMP." };
    
    // Patron + (11-infini) = 399.99 + 39.99 par employé sup
    const extra = (n - 10) * 39.99;
    const total = 399.99 + extra;
    return { 
      price: total.toFixed(2).replace('.', ','), 
      label: `FORFAIT ${n} EMP.` 
    };
  };

  const handleDownloadInvoice = (userData: User) => {
    setIsGenerating(userData.uid);
    try {
      const { price } = getPriceData(userData);
      generateInvoicePDF(userData, price);
      toast({ title: "Facture générée" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur lors de la génération PDF" });
    } finally {
      setIsGenerating(null);
    }
  };

  const uniqueProfiles = useMemo(() => {
    if (!allUsers) return [];
    const map = new Map();
    allUsers.forEach(u => {
      const id = (u.loginId_lower || u.loginId || '').toLowerCase();
      if (id && !map.has(id)) map.set(id, u);
    });
    return Array.from(map.values()).sort((a, b) => (a.companyId === 'admin_global' ? -1 : 1));
  }, [allUsers]);

  if (!mounted || isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-primary opacity-20 w-10 h-10" />
        </div>
      </DashboardLayout>
    );
  }

  const isActive = profile?.subscriptionStatus !== 'inactive' || isSuperAdmin;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary">
              <CreditCard className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Abonnement</h1>
              <p className="text-muted-foreground font-medium">Gestion des tarifs et récapitulatif des comptes.</p>
            </div>
          </div>
        </div>

        {isSuperAdmin ? (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <Users className="w-7 h-7" />
                  Récapitulatif des Tarifs
                </CardTitle>
                <Badge className="bg-white text-primary font-black uppercase px-4 h-8 border-none shadow-lg">
                  {uniqueProfiles.length} COMPTES
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-8 py-4">Utilisateur</TableHead>
                    <TableHead>Type de Plan</TableHead>
                    <TableHead>Date création</TableHead>
                    <TableHead>Prix mensuel</TableHead>
                    <TableHead className="text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingUsers ? (
                    <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                  ) : uniqueProfiles.map((u) => {
                    const priceData = getPriceData(u);
                    return (
                      <TableRow key={u.uid} className="hover:bg-primary/5">
                        <TableCell className="pl-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-bold">{u.name || u.loginId}</span>
                            <span className="font-mono text-[10px] text-muted-foreground uppercase">{u.loginId}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="font-black uppercase text-[10px] bg-muted text-muted-foreground">
                            {priceData.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '08/02/2026'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-black text-primary">
                            {priceData.price}€
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {u.companyId !== 'admin_global' && u.role !== 'employee' && (
                            <Button variant="ghost" size="sm" className="h-8 rounded-full gap-2 font-black uppercase text-[10px]" onClick={() => handleDownloadInvoice(u)} disabled={!!isGenerating}>
                              {isGenerating === u.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                              Facture
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white max-w-4xl mx-auto">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <ShieldCheck className="w-7 h-7" />
                  Statut de l'Accès
                </CardTitle>
                <Badge className={cn("font-black uppercase text-xs h-8 px-4", isActive ? "bg-emerald-500" : "bg-rose-500")}>
                  {isActive ? "ACTIF" : "SUSPENDU"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-10 space-y-8 text-center">
              <div className="p-8 rounded-[2rem] bg-muted/30 border-2 border-dashed">
                <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4", isActive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600")}>
                  {isActive ? <CheckCircle2 className="w-10 h-10" /> : <Ban className="w-10 h-10" />}
                </div>
                <h3 className="text-2xl font-bold">{isActive ? "Espace opérationnel" : "Accès restreint"}</h3>
              </div>
              <div className="max-w-md mx-auto p-6 rounded-2xl border bg-card">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <p className="font-bold">Plan actuel</p>
                    <p className="text-[10px] font-black uppercase text-muted-foreground">{profile ? getPriceData(profile).label : '...'}</p>
                  </div>
                  <p className="text-2xl font-black text-primary">{profile ? getPriceData(profile).price : '0,00'}€<span className="text-sm font-bold text-muted-foreground">/mois</span></p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
