
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { firebaseConfig } from '@/firebase/config';
import { doc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { User, UserRole } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Loader2, 
  UserPlus, 
  Mail, 
  Fingerprint, 
  CheckCircle2,
  Copy,
  AlertCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function TeamPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');

  const [generatedCreds, setGeneratedCreds] = useState({ loginId: '', password: '' });

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'users'), 
      where('companyId', '==', companyId),
      where('isProfile', '==', true)
    );
  }, [db, companyId]);

  const { data: teamMembers, isLoading: isTeamLoading } = useCollection<User>(teamQuery);

  const isAdmin = profile?.role === 'admin' || profile?.companyId === 'admin_global';
  const isFamily = profile?.role === 'family';
  const isPatron = profile?.role === 'patron';
  const canAddMembers = isAdmin || isFamily || isPatron;

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
        role: selectedRole,
        name: `${firstName.trim()} ${lastName.trim()}`,
        loginId: loginId,
        loginId_lower: loginId.toLowerCase(),
        password: tempPassword,
        email: email.trim(),
        isProfile: true,
        createdAt: new Date().toISOString(),
        adminMode: selectedRole !== 'employee',
        isCategoryModifier: selectedRole !== 'employee',
        subscriptionStatus: 'active'
      };

      await setDoc(doc(db, 'users', uid), newUser);

      setGeneratedCreds({ loginId, password: tempPassword });
      setIsAddModalOpen(false);
      setIsSuccessModalOpen(true);
      
      setFirstName('');
      setLastName('');
      setEmail('');
      setSelectedRole('employee');
      
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

  const getRoleLabel = (role: UserRole) => {
    switch(role) {
      case 'admin': return 'ADMINISTRATEUR';
      case 'patron': return 'DIRIGEANT';
      case 'family': return 'FAMILLE';
      default: return 'COLLABORATEUR';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch(role) {
      case 'admin': return 'bg-rose-950 text-white';
      case 'patron': return 'bg-primary text-white';
      case 'family': return 'bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.3)]';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-12 px-6 space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tighter text-primary uppercase">Mon Équipe</h1>
            <p className="text-muted-foreground font-medium italic">Gérez les membres de votre studio Grow&Go.</p>
          </div>
          {canAddMembers && (
            <Button 
              onClick={() => setIsAddModalOpen(true)}
              className="rounded-full h-14 px-10 font-bold bg-primary hover:bg-primary/90 shadow-2xl transition-all hover:scale-105 gap-3"
            >
              <UserPlus className="w-6 h-6" />
              Inviter un membre
            </Button>
          )}
        </div>

        {isTeamLoading ? (
          <div className="flex flex-col items-center justify-center p-24 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chargement des profils...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {teamMembers?.map((member) => (
              <Card key={member.uid} className="border-none shadow-lg hover:shadow-2xl transition-all duration-300 rounded-[2.5rem] overflow-hidden bg-white group">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-4 border-primary/5 shadow-inner">
                      <AvatarImage src={`https://picsum.photos/seed/${member.uid}/200/200`} />
                      <AvatarFallback className="bg-primary/5 text-primary font-black text-2xl">
                        {member.name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                      <Badge className={cn("px-3 h-6 border-none text-[9px] font-black uppercase tracking-widest", getRoleColor(member.role))}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-1 w-full">
                    <h3 className="text-xl font-bold text-primary truncate px-2">{member.name}</h3>
                    <div className="flex items-center justify-center gap-2 text-muted-foreground/60">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium truncate max-w-[180px]">{member.email}</span>
                    </div>
                  </div>

                  <div className="w-full pt-4 border-t border-dashed flex items-center justify-between">
                    <div className="flex flex-col items-start">
                      <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">Identifiant</span>
                      <div className="flex items-center gap-1.5">
                        <Fingerprint className="w-3 h-3 text-primary/30" />
                        <span className="font-mono text-[11px] font-bold text-primary/70">{member.loginId}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-tighter">Arrivée</span>
                      <p className="text-[10px] font-bold text-muted-foreground">
                        {member.createdAt ? new Date(member.createdAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) : '---'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-md p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Nouveau membre</DialogTitle>
            <DialogDescription>Créez les accès pour votre nouveau collaborateur.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleAddMember(e); }} className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Prénom</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className="rounded-xl font-bold h-12 border-primary/10" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Nom</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className="rounded-xl font-bold h-12 border-primary/10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Email de contact</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean.dupont@email.com" className="rounded-xl font-bold h-12 border-primary/10" required />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Rôle attribué</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                <SelectTrigger className="rounded-xl h-12 font-bold border-primary/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Collaborateur (Employé)</SelectItem>
                  {isAdmin && (
                    <>
                      <SelectItem value="family">Famille (Admin Lifetime)</SelectItem>
                      <SelectItem value="patron">Dirigeant (Patron)</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-relaxed text-amber-900 font-bold">
                Un compte de sécurité sera généré. Notez bien les identifiants qui s'afficheront sur l'écran suivant pour les transmettre.
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading} className="w-full h-14 bg-primary rounded-2xl font-black uppercase text-sm shadow-xl tracking-widest">
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "Générer les accès"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <DialogContent className="rounded-[3rem] p-10 text-center sm:max-w-md border-none shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase text-primary">Accès Prêts !</DialogTitle>
            <DialogDescription asChild>
              <span className="block space-y-6 pt-4">
                <span className="block text-sm font-medium text-muted-foreground text-center">Transmettez ces informations au collaborateur :</span>
                
                <span className="grid gap-4">
                  <span className="block p-5 bg-muted/50 rounded-[2rem] border-2 border-dashed border-primary/20 relative group">
                    <span className="block text-[10px] font-black uppercase opacity-40 mb-1 text-center">Identifiant</span>
                    <span className="block text-3xl font-black text-primary tracking-widest text-center">{generatedCreds.loginId}</span>
                    <Button 
                      variant="ghost" size="icon" className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(generatedCreds.loginId)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </span>

                  <span className="block p-5 bg-muted/50 rounded-[2rem] border-2 border-dashed border-primary/20 relative group">
                    <span className="block text-[10px] font-black uppercase opacity-40 mb-1 text-center">Mot de passe temporaire</span>
                    <span className="block text-2xl font-black text-primary tracking-widest text-center">{generatedCreds.password}</span>
                    <Button 
                      variant="ghost" size="icon" className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(generatedCreds.password)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </span>
                </span>

                <span className="block text-[10px] text-rose-600 font-black uppercase tracking-widest bg-rose-50 p-4 rounded-2xl text-center leading-tight">
                  Attention : Ces codes ne seront plus affichés après fermeture.
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-8">
            <Button onClick={() => setIsSuccessModalOpen(false)} className="w-full h-12 rounded-full font-black uppercase tracking-widest text-xs bg-primary shadow-lg">
              J'ai copié les accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
