
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  User as UserIcon, 
  Building2, 
  Save, 
  Loader2, 
  Fingerprint,
  Mail,
  Edit2,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  LayoutTemplate
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  useFirestore, 
  useUser, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import { User } from '@/lib/types';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);

  useEffect(() => {
    if (profile) {
      setUserName(profile.name || '');
      setUserEmail(profile.email || '');
      setUserPassword(profile.password || '');
      setCompanyName(profile.companyName || profile.companyId || '');
    }
  }, [profile]);

  const checkDuplicateNames = async (name: string) => {
    if (!db || !name.trim() || name === profile?.name) {
      setDuplicateNames([]);
      return;
    }

    try {
      const q = query(collection(db, 'users'), where('name', '==', name.trim()));
      const querySnapshot = await getDocs(q);
      
      const otherUsers = querySnapshot.docs
        .map(d => d.data() as User)
        .filter(u => u.loginId?.toLowerCase() !== profile?.loginId?.toLowerCase());
      
      setDuplicateNames(Array.from(new Set(otherUsers.map(u => u.loginId))));
    } catch (e) {
      console.error("Erreur check doublons:", e);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (userName) checkDuplicateNames(userName);
    }, 500);
    return () => clearTimeout(timer);
  }, [userName]);

  const handleSave = async () => {
    if (!db || !user || !profile) return;
    setIsSaving(true);

    try {
      const q = query(collection(db, 'users'), where('loginId_lower', '==', profile.loginId.toLowerCase()));
      const snapshot = await getDocs(q);
      
      snapshot.forEach((uDoc) => {
        const ref = doc(db, 'users', uDoc.id);
        updateDocumentNonBlocking(ref, { 
          name: userName.trim(),
          email: userEmail.trim(),
          password: userPassword.trim(),
          companyName: companyName.trim()
        });
      });

      if (profile.role === 'admin' || profile.companyId === 'admin_global') {
        const compRef = doc(db, 'companies', profile.companyId);
        updateDocumentNonBlocking(compRef, { name: companyName.trim() });
      }
      
      toast({ 
        title: "Profil mis à jour", 
        description: `Les modifications pour ${userName} ont été enregistrées en base de données.` 
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer les modifications." });
    } finally {
      setIsSaving(false);
    }
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
            <p className="text-muted-foreground font-medium">Gérez votre identité, vos identifiants et vos accès en temps réel.</p>
          </div>
        </div>

        {duplicateNames.length > 0 && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 rounded-2xl">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle className="font-black uppercase text-xs">Attention : Doublon détecté</AlertTitle>
            <AlertDescription className="text-sm font-medium">
              Un autre compte utilise déjà le nom "<strong>{userName}</strong>" (Identifiant : {duplicateNames.join(', ')}). 
              Veuillez utiliser un nom unique pour éviter toute confusion.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-primary text-primary-foreground p-8">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Fingerprint className="w-6 h-6" />
                  Identité & Sécurité
                </CardTitle>
                <Badge className={cn(
                  "font-black uppercase text-[10px] h-6 px-3",
                  profile?.companyId === 'admin_global' ? "bg-rose-950 text-white" : 
                  profile?.role === 'admin' ? "bg-white text-primary" : 
                  profile?.role === 'particulier' ? "bg-amber-500 text-white" :
                  "bg-muted text-muted-foreground"
                )}>
                  {profile?.companyId === 'admin_global' ? 'ADMIN GLOBAL' : profile?.role === 'admin' ? 'PATRON' : profile?.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Identifiant (Login ID)</Label>
                  <div className="relative">
                    <Fingerprint className="absolute left-3 top-3.5 w-4 h-4 text-primary/40" />
                    <Input 
                      value={profile?.loginId || ''}
                      readOnly
                      className="pl-10 rounded-xl bg-muted/5 border-primary/10 h-12 font-bold text-primary opacity-100 cursor-default"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uname" className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <Edit2 className="w-3 h-3" /> Nom Complet (Prénom & Nom)
                  </Label>
                  <Input 
                    id="uname"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className={cn(
                      "rounded-xl h-12 font-bold focus:ring-primary",
                      duplicateNames.length > 0 ? "border-rose-500 bg-rose-50" : "border-primary/10"
                    )}
                    placeholder="Ex: Julien Secchi"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" /> Mot de passe
                  </Label>
                  <div className="relative">
                    <Input 
                      type={showPassword ? "text" : "password"}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      className="pr-12 rounded-xl border-primary/10 h-12 font-bold focus:ring-primary"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uemail" className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2">
                    <Mail className="w-3 h-3" /> Adresse E-mail
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

              <div className="p-6 bg-muted/10 rounded-3xl border-2 border-dashed border-primary/10 space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-6 h-6 text-primary" />
                  <div className="flex-1">
                    <Label htmlFor="compName" className="text-[10px] font-black uppercase text-muted-foreground">Espace de travail (Studio / Entreprise)</Label>
                    <Input 
                      id="compName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 rounded-xl h-11 font-bold border-none shadow-sm bg-white"
                      placeholder="Nom de votre espace..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !userName.trim()}
                  className="rounded-full px-12 h-14 font-bold bg-primary hover:bg-primary/90 shadow-xl gap-3 text-lg"
                >
                  {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                  Enregistrer les modifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
