
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, Users, Key, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const allUsersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'users');
  }, [db]);

  const { data: allUsers, isLoading: isUsersLoading } = useCollection<User>(allUsersQuery);

  const ensureCompanyExists = async (companyId: string, companyName: string) => {
    if (!db) return;
    const companyRef = doc(db, 'companies', companyId);
    const companySnap = await getDoc(companyRef);
    if (!companySnap.exists()) {
      await setDoc(companyRef, {
        id: companyId,
        name: companyName,
        subscriptionStatus: 'active',
        primaryColor: '157 44% 21%',
        backgroundColor: '43 38% 96%',
        foregroundColor: '157 44% 11%',
        modulesConfig: { showRh: true, showFinance: true, customLabels: {} }
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setIsLoading(true);

    try {
      const lowerId = loginId.trim().toLowerCase();
      
      // Vérification doublon stricte
      const q = query(collection(db, 'users'), where('loginId_lower', '==', lowerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error("Cet identifiant est déjà utilisé.");
      }

      let finalRole = 'employee';
      let finalCompanyId = companyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
      let finalCompanyName = companyName;

      if (lowerId === 'jsecchi') {
        finalRole = 'super_admin';
        finalCompanyId = 'growandgo-hq';
        finalCompanyName = 'Grow&Go HQ';
      }

      await ensureCompanyExists(finalCompanyId, finalCompanyName);
      
      // Utilisation d'un ID de document FIXE pour empêcher les doublons au niveau Firestore
      const profileRef = doc(db, 'users', `profile_${lowerId}`);
      await setDoc(profileRef, {
        uid: profileRef.id,
        isProfile: true,
        companyId: finalCompanyId,
        role: finalRole,
        adminMode: finalRole !== 'employee',
        isCategoryModifier: finalRole !== 'employee',
        name: name || loginId,
        loginId: loginId.trim(),
        loginId_lower: lowerId,
        password: password,
        email: `${lowerId}@studio.internal`,
        updatedAt: new Date().toISOString()
      });

      setSignUpSuccess(true);
      setIsSignUp(false);
      setPassword('');
      setName('');
      setCompanyName('');
      toast({ title: "Compte créé !", description: "Vous pouvez maintenant vous connecter." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setIsLoading(true);

    try {
      const lowerId = loginId.trim().toLowerCase();
      
      // Recherche du profil par loginId_lower
      const q = query(collection(db, 'users'), where('loginId_lower', '==', lowerId));
      const querySnap = await getDocs(q);
      
      let profileData: User | null = null;
      if (!querySnap.empty) {
        profileData = querySnap.docs[0].data() as User;
      }

      // Fallback JSecchi si la base est vide (pour le premier accès)
      if (!profileData && lowerId === 'jsecchi') {
        profileData = {
          uid: 'jsecchi-fixed',
          isProfile: true,
          companyId: 'growandgo-hq',
          role: 'super_admin',
          name: 'JSecchi',
          loginId: 'JSecchi',
          loginId_lower: 'jsecchi',
          password: 'Meqoqo1998'
        } as User;
      }

      if (!profileData) throw new Error("Identifiant inconnu.");
      if (profileData.password !== password) throw new Error("Mot de passe incorrect.");

      const userCredential = await signInAnonymously(auth);
      const sessionUid = userCredential.user.uid;

      // Création de la session active
      await setDoc(doc(db, 'users', sessionUid), {
        ...profileData,
        uid: sessionUid,
        isProfile: false,
        isSession: true,
        lastLogin: serverTimestamp()
      });

      toast({ title: "Accès autorisé", description: `Bienvenue ${profileData.name}` });
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur d'accès", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrage et dédoublonnage strict pour le répertoire visuel (affiche tous les loginId uniques)
  const displayUsers = Array.from(
    new Map(
      (allUsers || [])
        .filter(u => u.loginId || u.loginId_lower)
        .map(u => [u.loginId_lower || u.loginId?.toLowerCase(), u])
    ).values()
  ).sort((a, b) => {
    if (a.role === 'super_admin') return -1;
    if (b.role === 'super_admin') return 1;
    return (a.loginId || '').localeCompare(b.loginId || '');
  });

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <div className="flex flex-col md:flex-row gap-8 items-start max-w-5xl w-full">
        
        <div className="w-full md:w-80 space-y-4 md:sticky md:top-10">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border-none">
            <div className="flex items-center gap-2 mb-4 text-[#1E4D3B]">
              <Users className="w-5 h-5" />
              <h3 className="font-black uppercase text-[10px] tracking-widest">Répertoire (Tests)</h3>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
              {isUsersLoading ? (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary/20" />
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Chargement...</p>
                </div>
              ) : displayUsers.length > 0 ? (
                displayUsers.map(u => (
                  <div key={u.uid} className="flex flex-col p-3 rounded-xl bg-muted/30 border border-black/5 gap-1.5 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] font-black text-primary">{u.loginId}</span>
                      <Badge className={cn(
                        "text-[8px] font-black uppercase h-4 px-1",
                        u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {u.role === 'super_admin' ? 'SA' : u.role === 'admin' ? 'P' : 'E'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-950 bg-rose-50/50 p-1.5 rounded border border-rose-100">
                      <Key className="w-3 h-3 opacity-50" />
                      <span className="text-[11px] font-mono font-black tracking-tight">{u.password || 'Meqoqo1998'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 rounded-xl bg-muted/30 border border-black/5 gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-primary">JSecchi</span>
                    <Badge className="text-[8px] font-black uppercase h-4 px-1 bg-rose-950">SA</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-rose-950 bg-rose-50/50 p-1.5 rounded border border-rose-100">
                    <Key className="w-3 h-3 opacity-50" />
                    <span className="text-[11px] font-mono font-black tracking-tight">Meqoqo1998</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Card className="flex-1 w-full shadow-2xl border-none p-4 rounded-[2.5rem] bg-white">
          <CardHeader className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
              <Image src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} alt="Logo" fill className="object-cover p-2" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-[#1E4D3B] uppercase tracking-tighter">Grow&Go Studio</CardTitle>
              <CardDescription className="text-[#1E4D3B]/60 font-medium">
                {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Nouveau Studio" : "Accès à votre espace de travail"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {signUpSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Compte créé avec succès ! Connectez-vous.</p>
              </div>
            )}

            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</Label>
                    <Input placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom de l'Entreprise</Label>
                    <Input placeholder="Ex: Carrefour, Paul S.A..." value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant Studio</Label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Identifiant" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input type={showPassword ? "text" : "password"} placeholder="••••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                  <button type="button" className="absolute right-2 top-2 h-8 w-8 p-0 flex items-center justify-center" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <Button type="submit" className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Lancer mon Studio" : "Se connecter")}
                </Button>

                <button
                  type="button"
                  className="w-full text-xs font-black uppercase tracking-widest text-[#1E4D3B]/60 hover:bg-[#1E4D3B]/5 py-2 rounded-xl transition-colors"
                  onClick={() => {
                    setSignUpSuccess(false);
                    setIsSignUp(!isSignUp);
                    setLoginId('');
                    setPassword('');
                  }}
                >
                  {isSignUp ? "Déjà un accès ? Connexion" : "Nouveau ? Créer un identifiant"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
