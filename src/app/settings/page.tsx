
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  User as UserIcon, 
  Building2, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Fingerprint,
  Mail,
  Edit2,
  Lock
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
  const [isSaving, setIsSaving] = useState(false);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  useEffect(() => {
    if (profile?.name) setUserName(profile.name);
    if (profile?.email) setUserEmail(profile.email);
  }, [profile]);

  const handleSave = () => {
    if (!db || !user) return;
    setIsSaving(true);

    const userDocRef = doc(db, 'users', user.uid);
    updateDocumentNonBlocking(userDocRef, { 
      name: userName,
      email: userEmail
    });

    setTimeout(() => {
      setIsSaving(false);
      toast({ 
        title: "Profil mis à jour", 
        description: "Vos modifications ont été enregistrées." 
      });
    }, 500);
  };

  if (isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-xs font-black uppercase text-muted-foreground">Accès au profil...</p>
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
            <p className="text-muted-foreground font-medium">Gérez votre identité et vos accès.</p>
          </div>
        </div>

        <div className="grid gap-6">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Fingerprint className="w-6 h-6" />
                  Identité & Rôle
                </CardTitle>
                <Badge className={cn(
                  "font-black uppercase text-[10px] h-6 px-3",
                  profile?.role === 'super_admin' ? "bg-rose-950 text-white" : 
                  profile?.role === 'admin' ? "bg-white text-primary" : 
                  profile?.role === 'particulier' ? "bg-amber-500 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {profile?.role === 'super_admin' ? 'ADMIN' : profile?.role === 'admin' ? 'PATRON' : profile?.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Identifiant (Fixe)</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground/40" />
                    <Input 
                      value={profile?.loginId || ''}
                      disabled
                      className="pl-10 rounded-xl bg-muted/30 border-primary/5 h-12 font-bold opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Entreprise (Fixe)</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground/40" />
                    <Input 
                      value={profile?.companyName || profile?.companyId || 'Non défini'}
                      disabled
                      className="pl-10 rounded-xl bg-muted/30 border-primary/5 h-12 font-bold opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uname" className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <Edit2 className="w-3 h-3" /> Nom Complet
                  </Label>
                  <Input 
                    id="uname"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="rounded-xl border-primary/10 h-12 font-bold focus:ring-primary"
                    placeholder="Prénom Nom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uemail" className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <Mail className="w-3 h-3" /> E-mail
                  </Label>
                  <Input 
                    id="uemail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="rounded-xl border-primary/10 h-12 font-bold focus:ring-primary"
                    placeholder="votre@email.com"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !userName.trim()}
                  className="rounded-full px-12 h-14 font-bold bg-primary hover:bg-primary/90 shadow-xl gap-3 text-lg"
                >
                  {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  Enregistrer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
