'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';
import { doc, collection, query, where, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { User, Company } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  UserPlus, 
  Users, 
  Mail, 
  Fingerprint, 
  Calendar,
  CheckCircle2,
  Copy,
  AlertCircle,
  Zap,
  ArrowUpCircle
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { updateSubscriptionData } from '@/services/billing-sync';

export default function TeamPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  const [generatedCreds, setGeneratedCreds] = useState({ loginId: '', password: '' });

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company } = useDoc<Company>(companyRef);

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'users'), 
      where('companyId', '==', companyId),
      where('isProfile', '==', true)
    );
  }, [db, companyId]);

  const { data: teamMembers, isLoading: isTeamLoading } = useCollection<User>(teamQuery);

  const planType = company?.subscription?.planType || 'individual';
  const isIndividual = planType === 'individual';

  const handleOpenAddMember = () => {
    if (isIndividual && companyId !== 'admin_global') {
      setIsUpgradeModalOpen(true);
    } else {
      setIsAddModalOpen(true);
    }
  };

  const handleUpgradeToBusiness = async () => {
    if (!db || !companyId) return;
    setIsUpgrading(true);
    try {
      const ref = doc(db, 'companies', companyId);
      await updateDoc(ref, {
        'subscription.planType': 'business',
        'subscription.basePrice': 199.99,
        'subscription.pricePerUser': 14.99
      });
      await updateSubscriptionData(db, companyId, teamMembers?.length || 1, 'business');
      setIsUpgradeModalOpen(false);
      setIsAddModalOpen(true);
      toast({ title: "Forfait Business activé !" });
    } catch (e) {
      toast({ variant: "destructive", title: "Échec de l'upgrade" });
    } finally {
      setIsUpgrading(false);
    }
  };

  const generateTempPassword = () => {
    return `Grow-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  const checkLoginIdUniqueness = async (loginId: string) => {
    if (!db) return loginId;
    const q = query(collection(db, 'users'), where('loginId_lower', '==', loginId.toLowerCase()));
    const snap = await getDocs(q);
    if (snap.empty) return loginId;
    return `${loginId}${Math.floor(Math.random() * 100)}`;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !companyId || !profile) return;
    setIsLoading(true);

    try {
      const baseId = (firstName.charAt(0) + lastName).replace(/[^a-zA-Z]/g, '');
      const loginId = await checkLoginIdUniqueness(baseId);
      const tempPassword = generateTempPassword();

      const secondaryAppName = `secondary-${Date.now()}`;
      const secondaryApp = getApps().find(app => app.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), tempPassword);
      const uid = userCredential.user.uid;

      const newUser: Partial<User> = {
        uid: uid,
        companyId: companyId,
        companyName: profile.companyName,
        role: 'employee',
        name: `${firstName.trim()} ${lastName.trim()}`,
        loginId: loginId,
        loginId_lower: loginId.toLowerCase(),
        password: tempPassword,
        email: email.trim(),
        isProfile: true,
        createdAt: new Date().toISOString(),
        adminMode: false,
        isCategoryModifier: false,
        subscriptionStatus: 'active'
      };

      await setDoc(doc(db, 'users', uid), newUser);
      await updateSubscriptionData(db, companyId, (teamMembers?.length || 0) + 1, planType);

      setGeneratedCreds({ loginId, password: tempPassword });
      setIsAddModalOpen(false);
      setIsSuccessModalOpen(true);
      
      setFirstName('');
      setLastName('');
      setEmail('');
      
      toast({ title: "Membre ajouté avec succès" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur lors de l'ajout", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié dans le presse-papier" });
  };

  const isPatron = profile?.role === 'admin' || profile?.companyId === 'admin_global';

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase flex items-center gap-3">
              <Users className="w-8 h-8" />
              Mon Équipe
            </h1>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-black uppercase text-[10px] border-primary/20 bg-primary/5 text-primary">
                Forfait {planType}
              </Badge>
              <p className="text-muted-foreground text-sm font-medium">
                {isIndividual ? "Solo - Limité à 1 utilisateur" : `${teamMembers?.length || 1} membres actifs`}
              </p>
            </div>
          </div>
          {isPatron && (
            <div className="flex flex-col items-end gap-2">
              <Button 
                onClick={handleOpenAddMember}
                className="rounded-full h-12 px-8 font-bold bg-primary shadow-lg gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Ajouter un membre
              </Button>
              {isIndividual && companyId !== 'admin_global' && (
                <p className="text-[10px] font-black uppercase text-muted-foreground mr-4">+14,99€ / employé (Forfait Business)</p>
              )}
            </div>
          )}
        </div>

        <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            {isTeamLoading ? (
              <div className="p-20 flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Récupération de l'équipe...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none">
                    <TableHead className="pl-8 py-6 text-[10px] font-black uppercase tracking-widest">Collaborateur</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Identifiant</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Email</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Rôle</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Date d'arrivée</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers?.map((member) => (
                    <TableRow key={member.uid} className="hover:bg-primary/5 transition-colors group">
                      <TableCell className="pl-8 py-4 font-bold text-primary">{member.name}</TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2">
                          <Fingerprint className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">{member.loginId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          {member.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-center py-4">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-2.5 h-6 border-none",
                          member.role === 'admin' ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {member.role === 'admin' ? 'PATRON' : 'EMPLOYÉ'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8 py-4">
                        <div className="flex items-center justify-end gap-2 text-[10px] font-medium text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {member.createdAt ? new Date(member.createdAt).toLocaleDateString('fr-FR') : '---'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isUpgradeModalOpen} onOpenChange={setIsUpgradeModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8 text-center">
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Zap className="w-10 h-10" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase text-primary tracking-tighter">Passez au Forfait Business</DialogTitle>
            <DialogDescription asChild>
              <span className="block pt-4 space-y-4">
                <span className="block text-base font-medium text-muted-foreground">
                  L'offre Individuel est limitée à 1 utilisateur. Débloquez la puissance de votre équipe.
                </span>
                <span className="block p-6 bg-muted/50 rounded-3xl border-2 border-dashed border-primary/20">
                  <span className="block text-3xl font-black text-primary">199,99€ <span className="text-sm">/ mois</span></span>
                  <span className="block text-xs font-bold text-muted-foreground mt-1 uppercase tracking-widest">+ 14,99€ par employé supplémentaire</span>
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8 flex flex-col gap-3">
            <Button 
              onClick={handleUpgradeToBusiness} 
              disabled={isUpgrading}
              className="w-full h-14 bg-primary rounded-2xl font-bold text-lg shadow-xl gap-2"
            >
              {isUpgrading ? <Loader2 className="animate-spin" /> : <ArrowUpCircle className="w-5 h-5" />}
              Activer mon offre Business
            </Button>
            <Button variant="ghost" onClick={() => setIsUpgradeModalOpen(false)} className="font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Plus tard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary">Inviter un membre</DialogTitle>
            <DialogDescription>Remplissez les informations pour générer ses accès.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddMember} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fname" className="text-[10px] font-black uppercase tracking-widest ml-1">Prénom</Label>
                <Input id="fname" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className="rounded-xl font-bold h-12" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lname" className="text-[10px] font-black uppercase tracking-widest ml-1">Nom</Label>
                <Input id="lname" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className="rounded-xl font-bold h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest ml-1">Email de contact</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean.dupont@email.com" className="rounded-xl font-bold h-12" required />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-tight text-amber-900 font-medium">
                Un compte de sécurité sera créé. Vous recevrez son identifiant et un mot de passe temporaire à la fin de l'opération.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full h-14 bg-primary rounded-2xl font-bold text-lg shadow-lg">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Générer les accès"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="rounded-[3rem] p-8 text-center sm:max-w-md border-none shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase text-primary">Accès Générés !</DialogTitle>
            <DialogDescription asChild>
              <span className="block space-y-4 pt-4">
                <span className="block text-sm font-medium text-muted-foreground">Transmettez ces informations à votre nouveau collaborateur :</span>
                
                <span className="grid gap-3">
                  <span className="block p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-primary/20 relative group">
                    <span className="block text-[10px] font-black uppercase opacity-40 mb-1">Identifiant</span>
                    <span className="block text-2xl font-black text-primary tracking-widest">{generatedCreds.loginId}</span>
                    <Button 
                      variant="ghost" size="icon" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(generatedCreds.loginId)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </span>

                  <span className="block p-4 bg-muted/50 rounded-2xl border-2 border-dashed border-primary/20 relative group">
                    <span className="block text-[10px] font-black uppercase opacity-40 mb-1">Mot de passe temporaire</span>
                    <span className="block text-2xl font-black text-primary tracking-widest">{generatedCreds.password}</span>
                    <Button 
                      variant="ghost" size="icon" className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(generatedCreds.password)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </span>
                </span>

                <span className="block text-[10px] text-rose-600 font-bold bg-rose-50 p-3 rounded-xl">
                  Note : Pour des raisons de sécurité, ces informations ne seront plus affichées. Copiez-les maintenant.
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button onClick={() => setIsSuccessModalOpen(false)} className="w-full h-12 rounded-full font-bold bg-primary shadow-lg">
              Terminer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
