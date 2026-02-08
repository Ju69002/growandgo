'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff, CheckCircle2, Building2, Users, Key } from 'lucide-react';
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

  // Récupération en temps réel des IDs pour le répertoire latéral
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);

  const { data: allUsers } = useCollection<User>(usersQuery);

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

  const createProfile = async (uid: string, loginId: string, role: string, displayName: string, pass: string, cName?: string) => {
    if (!db) return;
    const lowerId = loginId.toLowerCase().trim();
    
    let finalRole = role;
    let finalCompanyId = 'default-studio';
    let finalCompanyName = cName || 'Mon Studio';

    if (lowerId === 'jsecchi') {
      finalRole = 'super_admin';
      finalCompanyId = 'growandgo-hq';
      finalCompanyName = 'Grow&Go HQ';
    } else {
      finalCompanyId = finalCompanyName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    }

    await ensureCompanyExists(finalCompanyId, finalCompanyName);
    
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid,
      companyId: finalCompanyId,
      role: finalRole,
      adminMode: finalRole !== 'employee',
      isCategoryModifier: finalRole !== 'employee',
      name: displayName || loginId,
      loginId: loginId.trim(),
      loginId_lower: lowerId,
      password: pass, // Stockage en clair pour le prototype
      email: `${lowerId}@studio.internal`,
      createdAt: new Date().toISOString()
    }, { merge: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setIsLoading(true);

    try {
      const normalizedId = loginId.trim();
      const lowerId = normalizedId.toLowerCase();
      const internalEmail = `${lowerId}@studio.internal`;
      
      if (isSignUp) {
        if (!companyName.trim()) throw new Error("Le nom de l'entreprise est requis.");
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId_lower', '==', lowerId));
        const checkSnap = await getDocs(q);
        if (!checkSnap.empty) throw new Error("Cet identifiant est déjà utilisé.");

        const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
        await createProfile(userCredential.user.uid, normalizedId, 'employee', name || normalizedId, password, companyName);

        await signOut(auth);
        setSignUpSuccess(true);
        setIsSignUp(false);
        setPassword('');
        setName('');
        setCompanyName('');
        toast({ title: "Compte créé !", description: "Identifiez-vous pour accéder à votre studio." });
      } else {
        if (lowerId === 'jsecchi' && password === 'Meqoqo1998') {
          try {
            await signInWithEmailAndPassword(auth, internalEmail, password);
          } catch (e: any) {
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
              await createUserWithEmailAndPassword(auth, internalEmail, password);
            } else throw e;
          }
          await createProfile(auth.currentUser!.uid, 'JSecchi', 'super_admin', 'Julien Secchi', password);
        } else {
          await signInWithEmailAndPassword(auth, internalEmail, password);
          // Mise à jour du mot de passe dans le document pour le répertoire si nécessaire
          const userDocRef = doc(db, 'users', auth.currentUser!.uid);
          await setDoc(userDocRef, { password: password }, { merge: true });
        }

        toast({ title: "Bienvenue dans votre Studio" });
        router.push('/');
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let message = "Identifiant ou mot de passe incorrect.";
      if (error.code === 'auth/email-already-in-use') message = "Cet identifiant est déjà pris.";
      if (error.code === 'permission-denied') message = "Erreur de permissions Firestore.";
      if (error.message) message = error.message;
      toast({ variant: "destructive", title: "Erreur d'accès", description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <div className="flex flex-col md:flex-row gap-8 items-start max-w-5xl w-full">
        
        {/* Répertoire des identifiants (Visibles pour les tests) */}
        <div className="w-full md:w-80 space-y-4 md:sticky md:top-10">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border-none">
            <div className="flex items-center gap-2 mb-4 text-[#1E4D3B]">
              <Users className="w-5 h-5" />
              <h3 className="font-black uppercase text-[10px] tracking-widest">Identifiants en base</h3>
            </div>
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-2 scrollbar-thin">
              {allUsers && allUsers.length > 0 ? (
                allUsers.map(u => (
                  <div key={u.uid} className="flex flex-col p-3 rounded-xl bg-muted/30 border border-black/5 gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold truncate text-primary">{u.loginId}</span>
                      <Badge className={cn(
                        "text-[8px] font-black uppercase h-4 px-1 shrink-0",
                        u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {u.role === 'super_admin' ? 'SA' : u.role === 'admin' ? 'P' : 'E'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-rose-950">
                      <Key className="w-3 h-3 opacity-50" />
                      <span className="text-[10px] font-mono font-black">{u.password || 'Non défini'}</span>
                    </div>
                    <span className="text-[8px] text-muted-foreground truncate opacity-70 italic">{u.name}</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-muted-foreground italic text-center py-4">Aucun identifiant actif</p>
              )}
            </div>
            <div className="mt-6 p-3 bg-primary/5 rounded-xl text-[9px] text-primary/60 leading-relaxed">
              <p className="font-bold mb-1">NOTES :</p>
              SA = Super Admin (JSecchi)<br/>
              P = Patron<br/>
              E = Employé
            </div>
          </div>
        </div>

        {/* Formulaire Principal */}
        <Card className="flex-1 w-full shadow-2xl border-none p-4 rounded-[2.5rem] bg-white">
          <CardHeader className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
              <Image 
                src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
                alt="Logo" 
                fill 
                className="object-cover p-2" 
                data-ai-hint="design studio logo"
              />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-[#1E4D3B] uppercase tracking-tighter">Grow&Go Studio</CardTitle>
              <CardDescription className="text-[#1E4D3B]/60 font-medium">
                {signUpSuccess ? "Inscrit avec succès !" : isSignUp ? "Nouvel identifiant Studio" : "Accès à votre espace de travail"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {signUpSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Profil créé. Identifiez-vous ci-dessous.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom & Prénom</Label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ex: Marc Lavoine" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom de l'Entreprise</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ex: Paul S.A." 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant Studio</Label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Ex: MLavoine" 
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-11 pr-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-2 h-8 w-8 p-0 flex items-center justify-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <Button 
                  type="submit" 
                  className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Lancer mon Studio" : "Se connecter")}
                </Button>

                <button
                  type="button"
                  className="w-full text-xs font-bold uppercase tracking-widest text-[#1E4D3B]/60 hover:bg-[#1E4D3B]/5 py-2 rounded-xl transition-colors"
                  onClick={() => {
                    setSignUpSuccess(false);
                    setIsSignUp(!isSignUp);
                    setLoginId('');
                    setPassword('');
                    setName('');
                    setCompanyName('');
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
