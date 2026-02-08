
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

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
        modulesConfig: {
          showRh: true,
          showFinance: true,
          customLabels: {}
        }
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setIsLoading(true);

    try {
      const normalizedId = loginId.toLowerCase().trim();
      
      if (isSignUp) {
        // 1. Vérifier si l'identifiant existe déjà (SÉCURITÉ ANTI-DOUBLON)
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId', '==', normalizedId));
        const checkSnap = await getDocs(q);
        
        if (!checkSnap.empty) {
          throw new Error("Cet identifiant est déjà utilisé par un autre membre.");
        }

        // 2. Création Auth
        const internalEmail = `${normalizedId}@studio.internal`;
        const userCredential = await createUserWithEmailAndPassword(auth, internalEmail, password);
        const newUser = userCredential.user;
        
        const isTargetSuperAdmin = normalizedId === 'jsecchi';
        const companyId = isTargetSuperAdmin ? 'growandgo-hq' : 'default-studio';
        const companyName = isTargetSuperAdmin ? 'Grow&Go HQ' : 'Mon Studio';

        await ensureCompanyExists(companyId, companyName);
        
        // 3. Création Profil Firestore (Immédiate)
        const userRef = doc(db, 'users', newUser.uid);
        await setDoc(userRef, {
          uid: newUser.uid,
          companyId: companyId,
          role: isTargetSuperAdmin ? 'super_admin' : 'employee',
          adminMode: isTargetSuperAdmin,
          isCategoryModifier: isTargetSuperAdmin,
          name: name || loginId,
          loginId: normalizedId,
          email: internalEmail,
          createdAt: new Date().toISOString()
        });

        toast({ title: "Bienvenue !", description: "Votre compte studio a été créé avec succès." });
      } else {
        // 4. Recherche de l'e-mail technique via l'Identifiant (LOGIN)
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId', '==', normalizedId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("Identifiant inconnu dans ce studio.");
        }

        const userData = querySnapshot.docs[0].data();
        const emailToUse = userData.email;

        // 5. Connexion Firebase Auth
        await signInWithEmailAndPassword(auth, emailToUse, password);
        toast({ title: "Connexion réussie", description: "Chargement de votre espace..." });
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      let message = error.message || "Une erreur est survenue.";
      
      if (error.code === 'auth/email-already-in-use') {
        message = "Cet identifiant est déjà associé à un compte.";
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = "Identifiant ou mot de passe incorrect.";
      } else if (error.code === 'auth/weak-password') {
        message = "Le mot de passe doit faire au moins 6 caractères.";
      }
      
      toast({ 
        variant: "destructive", 
        title: "Échec", 
        description: message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-none p-4 rounded-[2.5rem] bg-white">
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
              {isSignUp ? "Créer un nouvel accès" : "Connexion par Identifiant"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</Label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Ex: Julien Secchi..." 
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
                  placeholder="Ex: JSecchi" 
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
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer l'accès" : "Accéder au Studio")}
              </Button>

              <button
                type="button"
                className="w-full text-xs font-bold uppercase tracking-widest text-[#1E4D3B]/60 hover:bg-[#1E4D3B]/5 py-2 rounded-xl"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setLoginId('');
                  setPassword('');
                  setName('');
                }}
              >
                {isSignUp ? "Déjà membre ? Se connecter" : "Nouveau membre ? S'inscrire"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
