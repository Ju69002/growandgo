
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  User as UserIcon, 
  Building2, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Mail, 
  Fingerprint 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    if (profile?.name) setUserName(profile.name);
    if (profile?.email) setUserEmail(profile.email);
    if (company?.name) setCompanyName(company.name);
  }, [profile, company]);

  const handleSave = () => {
    if (!db || !user || !companyId) return;
    setIsSaving(true);

    // Mise à jour du profil utilisateur (Nom et Email de récupération)
    const userDocRef = doc(db, 'users', user.uid);
    updateDocumentNonBlocking(userDocRef, { 
      name: userName,
      email: userEmail 
    });

    // Mise à jour de l'entreprise si le rôle le permet
    const isPatronOrSuper = profile?.role === 'admin' || profile?.role === 'super_admin';
    if (isPatronOrSuper && companyName.trim()) {
      const compDocRef = doc(db, 'companies', companyId);
      updateDocumentNonBlocking(compDocRef, { name: companyName });
    }

    setTimeout(() => {
      setIsSaving(false);
      toast({ 
        title: "Profil mis à jour", 
        description: "Vos modifications ont été enregistrées avec succès." 
      });
    }, 500);
  };

  const isPatronOrSuper = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Chargement de votre compte...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <UserIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Mon Profil</h1>
            <p className="text-muted-foreground font-medium">Gérez vos informations personnelles et celles de votre studio.</p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Informations Personnelles */}
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Fingerprint className="w-6 h-6" />
                    Identité & Accès
                  </CardTitle>
                  <CardDescription className="text-primary-foreground/70">
                    Vos informations de connexion et d'affichage.
                  </CardDescription>
                </div>
                <Badge className={cn(
                  "font-black uppercase text-[10px] h-6 px-3",
                  profile?.role === 'super_admin' ? "bg-rose-950 text-white" : 
                  profile?.role === 'admin' ? "bg-white text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'admin' ? 'Patron' : 'Employé'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="uname" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Votre Nom Complet</Label>
                  <Input 
                    id="uname"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ex: Jean Dupont..."
                    className="rounded-xl border-primary/10 h-12 font-bold"
                  />
                </div>
                <div className="space-y-2 opacity-60">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant de connexion</Label>
                  <div className="flex items-center gap-2 h-12 px-4 bg-muted rounded-xl font-mono text-sm font-bold border border-black/5">
                    <ShieldCheck className="w-4 h-4" />
                    {profile?.loginId}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uemail" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail de récupération</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="uemail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="Ex: jean.dupont@gmail.com"
                    className="rounded-xl border-primary/10 h-12 pl-11 font-bold"
                  />
                </div>
                <p className="text-[9px] text-muted-foreground ml-1">Cet e-mail est utilisé pour réinitialiser votre mot de passe en cas d'oubli.</p>
              </div>
            </CardContent>
          </Card>

          {/* Informations Entreprise (Si Patron) */}
          {isPatronOrSuper && (
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
              <CardHeader className="bg-secondary text-secondary-foreground p-8">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Building2 className="w-6 h-6" />
                  Studio / Entreprise
                </CardTitle>
                <CardDescription className="text-secondary-foreground/70">
                  Identité visuelle de votre espace de travail.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cname" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom du Studio</Label>
                  <Input 
                    id="cname"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Grow&Go Design Studio..."
                    className="rounded-xl border-primary/10 h-12 font-bold"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium bg-muted/30 p-4 rounded-xl">
                  <strong>INFO :</strong> Ce nom apparaîtra en haut à gauche de l'application pour vous et tous vos employés rattachés.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end pt-4">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !userName.trim()}
              className="rounded-full px-12 h-14 font-bold bg-primary hover:bg-primary/90 shadow-xl gap-3 text-lg"
            >
              {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
              Enregistrer les modifications
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
