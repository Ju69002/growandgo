
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
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { generateInvoicePDF } from '@/lib/invoice-utils';
import { useToast } from '@/hooks/use-toast';

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

  const { data: profile } = useDoc<User>(userRef);

  const isSuperAdmin = profile?.role === 'super_admin';

  const allUsersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<User>(allUsersQuery);

  const isActive = profile?.subscriptionStatus !== 'inactive' || isSuperAdmin;

  const getPrice = (role?: string) => {
    if (role === 'super_admin') return "0,00";
    if (role === 'admin') return "99,99";
    return "69,99";
  };

  const getRoleLabel = (role?: string) => {
    if (role === 'super_admin') return "ADMIN";
    if (role === 'admin') return "PATRON";
    return "EMPLOYÉ";
  };

  const handleDownloadInvoice = (userData: User) => {
    setIsGenerating(userData.uid);
    try {
      const price = getPrice(userData.role);
      generateInvoicePDF(userData, price);
      toast({ title: "Facture générée", description: `Le document pour ${userData.name} est prêt.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur PDF", description: "Impossible de générer le document." });
    } finally {
      setIsGenerating(null);
    }
  };

  const uniqueProfiles = useMemo(() => {
    if (!allUsers) return [];
    return Array.from(
      new Map(
        allUsers
          .filter(u => u.loginId || u.loginId_lower)
          .sort((a, b) => (a.isProfile ? 1 : -1))
          .map(u => {
            const lowerId = (u.loginId_lower || u.loginId?.toLowerCase());
            return [lowerId, u];
          })
      ).values()
    ).sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
  }, [allUsers]);

  if (!mounted) return null;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-12 px-6 space-y-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <CreditCard className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase leading-tight">Abonnement Espace</h1>
            <p className="text-muted-foreground font-medium">Gestion des accès et récapitulatif des comptes actifs.</p>
          </div>
        </div>

        {isSuperAdmin ? (
          <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <Users className="w-7 h-7" />
                  Récapitulatif des Abonnements
                </CardTitle>
                <Badge className="bg-white text-primary font-black uppercase px-4 h-8 border-none shadow-lg">
                  {uniqueProfiles.length} UTILISATEURS
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-8 py-4">Utilisateur / ID</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Date de création</TableHead>
                    <TableHead>Prix mensuel</TableHead>
                    <TableHead className="text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniqueProfiles.map((u) => (
                    <TableRow key={u.uid} className="hover:bg-primary/5 border-b-primary/5">
                      <TableCell className="pl-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-base">{u.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{u.loginId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "font-black uppercase text-[10px] h-6 px-3",
                          u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {getRoleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                          <Calendar className="w-4 h-4 opacity-30" />
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '08/02/2026'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-black text-primary">
                          <Euro className="w-4 h-4 opacity-50" />
                          {getPrice(u.role)}€
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        {u.role !== 'super_admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full gap-2 font-black uppercase text-[10px] tracking-widest text-primary hover:bg-primary/10"
                            onClick={() => handleDownloadInvoice(u)}
                            disabled={!!isGenerating}
                          >
                            {isGenerating === u.uid ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            Facture
                          </Button>
                        )}
                        {u.role === 'super_admin' && (
                          <Badge variant="outline" className="text-[9px] font-black uppercase opacity-30">GRATUIT</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
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
                  Statut de votre Accès
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
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Votre Plan actuel</h4>
                <div className="p-6 rounded-2xl border bg-card hover:border-primary/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-2 bg-primary/5 rounded-xl">
                        <CreditCard className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">Plan {getRoleLabel(profile?.role)}</p>
                        <p className="text-[10px] text-muted-foreground font-black uppercase">Renouvellement automatique</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary">{getPrice(profile?.role)}€<span className="text-sm font-bold text-muted-foreground">/mois</span></p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
