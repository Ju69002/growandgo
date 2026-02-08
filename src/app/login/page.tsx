
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
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff, CheckCircle2, Building2, Users, Key } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User } from '@/lib/types';
import { cn } from '@/lib/utils';

// Mot de passe technique interne pour le service Auth de Firebase
// Permet de synchroniser les changements faits par le Super Admin dans Firestore
const INTERNAL_AUTH_PASS = "StudioAccess123!";

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
    
    // Nettoyage des doublons Firestore
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('loginId_lower', '==', lowerId));
    const snap = await getDocs(q);
    
    for (const d of snap.docs) {
      if (d.id !== uid) {
        try { await deleteDoc(doc(db, 'users', d.id)); } catch (e) {}
      }
    }

    let finalRole = role;
    let finalCompanyId = 'default-studio';
    let finalCompanyName = cName || 'Mon Studio';

    if (lowerId === 'jsecchi') {
      finalRole = 'super_admin';
      finalCompanyId = 'growandgo-hq';
      finalCompanyName = 'Grow&Go HQ';
    } else {
      const existingDoc = snap.docs.find(d => d.id === uid);
      if (existingDoc?.exists()) {
        const data = existingDoc.data();
        finalCompanyId = data.companyId || finalCompanyId;
      } else if (cName) {
        finalCompanyId = cName.toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
        finalCompanyName = cName;
      }
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
      password: pass, // Mot de passe en clair pour le répertoire
      email: `${lowerId}@studio.internal`,
      updatedAt: new Date().toISOString()
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

        // Création avec le mot de passe technique
        const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, INTERNAL_AUTH_PASS);
        await createProfile(userCredential.user.uid, normalizedId, 'employee', name || normalizedId, password, companyName);

        await signOut(auth);
        setSignUpSuccess(true);
        setIsSignUp(false);
        setPassword('');
        setName('');
        setCompanyName('');
        toast({ title: "Compte créé avec succès !" });
      } else {
        // LOGIQUE DE CONNEXION SYNCHRONISÉE
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId_lower', '==', lowerId));
        const userSnap = await getDocs(q);
        
        let targetDoc = userSnap.docs[0]?.data();
        
        // Si c'est JSecchi et qu'il n'existe pas, on autorise la création/restauration
        if (!targetDoc && lowerId === 'jsecchi') {
          try {
            const cred = await signInWithEmailAndPassword(auth, internalEmail, password === "Meqoqo1998" ? password : INTERNAL_AUTH_PASS);
            await createProfile(cred.user.uid, normalizedId, 'super_admin', "JSecchi", password);
            toast({ title: "Accès Super Admin autorisé" });
            router.push('/');
            return;
          } catch (e) {
             // Fallback si l'utilisateur auth n'existe pas encore
             const cred = await createUserWithEmailAndPassword(auth, internalEmail, INTERNAL_AUTH_PASS);
             await createProfile(cred.user.uid, normalizedId, 'super_admin', "JSecchi", password);
             toast({ title: "Accès Super Admin autorisé" });
             router.push('/');
             return;
          }
        }

        if (!targetDoc) throw new Error("Identifiant inconnu.");
        
        // Vérification du mot de passe contre Firestore (Source de vérité)
        if (targetDoc.password !== password) {
          throw new Error("Mot de passe incorrect.");
        }

        // Connexion à Firebase Auth avec le mot de passe interne
        // Cela permet de se connecter même si le Super Admin a changé le mot de passe dans Firestore
        try {
          await signInWithEmailAndPassword(auth, internalEmail, INTERNAL_AUTH_PASS);
        } catch (authError: any) {
          // Si l'auth interne échoue (ex: compte créé avec l'ancienne méthode), on essaie le mot de passe saisi
          await signInWithEmailAndPassword(auth, internalEmail, password);
          // Et on met à jour l'auth avec le pass interne pour les prochaines fois
          // (Optionnel pour un prototype)
        }

        toast({ title: "Accès autorisé" });
        router.push('/');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur d'accès", description: error.message || "Identifiant ou mot de passe incorrect." });
    } finally {
      setIsLoading(false);
    }
  };

  const displayUsers = Array.from(
    new Map(
      (allUsers || [])
        .filter(u => u.loginId)
        .map(u => [u.loginId?.toLowerCase().trim(), u])
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
              {displayUsers.length > 0 ? (
                displayUsers.map(u => {
                   const displayPass = u.password || (u.loginId?.toLowerCase() === 'jsecchi' ? 'Meqoqo1998' : 'Non défini');
                   return (
                    <div key={u.uid} className="flex flex-col p-3 rounded-xl bg-muted/30 border border-black/5 gap-1.5 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[12px] font-black text-primary">{u.loginId}</span>
                        <Badge className={cn(
                          "text-[8px] font-black uppercase h-4 px-1 shrink-0",
                          u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {u.role === 'super_admin' ? 'SA' : u.role === 'admin' ? 'P' : 'E'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-950 bg-rose-50/50 p-1.5 rounded border border-rose-100">
                        <Key className="w-3 h-3 opacity-50" />
                        <span className="text-[11px] font-mono font-black tracking-tight">{displayPass}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary/20" />
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Chargement de la base...</p>
                </div>
              )}
            </div>
          </div>
        </div>

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
                {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Nouveau Studio" : "Accès à votre espace de travail"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {signUpSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Utilisez vos identifiants ci-dessous.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</Label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Ex: Marc Lavoine" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold"
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
                        className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold"
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
                    className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold"
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
                    className="pl-11 pr-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold"
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
                  className="w-full text-xs font-black uppercase tracking-widest text-[#1E4D3B]/60 hover:bg-[#1E4D3B]/5 py-2 rounded-xl transition-colors"
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
