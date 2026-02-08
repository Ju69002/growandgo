
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  // Redirection automatique si déjà connecté (et pas en train de confirmer une inscription)
  useEffect(() => {
    if (!isUserLoading && user && !signUpSuccess) {
      router.push('/');
    }
  }, [user, isUserLoading, router, signUpSuccess]);

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

  const createProfile = async (uid: string, loginId: string, role: string, displayName: string) => {
    if (!db) return;
    const lowerId = loginId.toLowerCase().trim();
    
    let finalRole = role;
    let finalCompanyId = 'default-studio';
    let finalCompanyName = 'Mon Studio';

    // Logique multi-entreprise prédéfinie
    if (lowerId === 'jsecchi') {
      finalRole = 'super_admin';
      finalCompanyId = 'growandgo-hq';
      finalCompanyName = 'Grow&Go HQ';
    } else if (lowerId === 'adupont') {
      finalRole = 'admin';
      finalCompanyId = 'Paul';
      finalCompanyName = 'Entreprise Paul';
    } else if (lowerId === 'bdupres') {
      finalRole = 'employee';
      finalCompanyId = 'Paul';
      finalCompanyName = 'Entreprise Paul';
    } else if (lowerId === 'lvecchio') {
      finalRole = 'admin';
      finalCompanyId = 'Oreal';
      finalCompanyName = 'Entreprise Oreal';
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
      
      // Cas spécial Super Admin JSecchi
      if (!isSignUp && lowerId === 'jsecchi' && password === 'Meqoqo1998') {
        const userCredential = await signInWithEmailAndPassword(auth, internalEmail, password);
        await createProfile(userCredential.user.uid, 'JSecchi', 'super_admin', 'Julien Secchi');
        toast({ title: "Accès Super Admin", description: "Studio déverrouillé." });
        router.push('/');
        return;
      }

      if (isSignUp) {
        // Vérification des doublons dans Firestore avant création Auth
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId_lower', '==', lowerId));
        const checkSnap = await getDocs(q);
        
        if (!checkSnap.empty) {
          throw new Error("Cet identifiant est déjà utilisé dans le Studio.");
        }

        // Création dans Auth
        const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
        // Création du profil
        await createProfile(userCredential.user.uid, normalizedId, 'employee', name || normalizedId);

        // Déconnexion immédiate pour forcer la saisie manuelle
        await signOut(auth);
        setSignUpSuccess(true);
        setIsSignUp(false);
        setPassword('');
        toast({ title: "Inscription réussie !", description: "Veuillez maintenant vous identifier." });
      } else {
        // Connexion standard
        // On vérifie d'abord si l'identifiant existe dans notre base
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId_lower', '==', lowerId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("Identifiant inconnu dans ce Studio.");
        }
        
        const userData = querySnapshot.docs[0].data();
        const userCredential = await signInWithEmailAndPassword(auth, userData.email, password);
        
        // Auto-réparation du profil si manquant
        const userDocRef = doc(db, 'users', userCredential.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
          await createProfile(userCredential.user.uid, userData.loginId, userData.role || 'employee', userData.name);
        }

        toast({ title: "Bienvenue", description: `Accès au studio : ${userData.companyId}` });
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let message = error.message || "Erreur de connexion.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = "Identifiant ou mot de passe incorrect.";
      }
      toast({ variant: "destructive", title: "Accès refusé", description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-none p-4 rounded-[2.5rem] bg-white animate-in fade-in zoom-in duration-300">
        <CardHeader className="text-center space-y-4">
          <div className="relative w-24 h-24 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
            <Image 
              src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
              alt="Logo" 
              fill 
              className="object-cover p-2" 
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-[#1E4D3B] uppercase tracking-tighter">Grow&Go Studio</CardTitle>
            <CardDescription className="text-[#1E4D3B]/60 font-medium">
              {signUpSuccess ? "Identification requise" : isSignUp ? "Nouvel identifiant" : "Identification"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {signUpSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Inscription validée ! Connectez-vous.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5 animate-in slide-in-from-left-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</Label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Votre Nom..." 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="loginId" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant Studio</Label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="loginId" 
                  placeholder="Ex: ADupont" 
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pass" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="pass" 
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
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer mon ID" : "Se connecter")}
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
                }}
              >
                {isSignUp ? "Déjà un ID ? Connexion" : "Nouvel ID ? Inscription"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
