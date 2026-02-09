
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, getDoc, collection, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, Eye, EyeOff, Terminal, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { UserRole } from '@/lib/types';
import { normalizeId } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;
    setIsLoading(true);
    setError(null);

    try {
      const lowerId = loginId.trim().toLowerCase();
      const email = `${lowerId}@espace.internal`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password.trim());
      const uid = userCredential.user.uid;

      const finalCompanyName = companyName.trim();
      const finalCompanyId = normalizeId(finalCompanyName);

      const userData = {
        uid: uid,
        isProfile: true, 
        companyId: finalCompanyId,
        companyName: finalCompanyName,
        role: selectedRole,
        adminMode: selectedRole === 'admin',
        isCategoryModifier: selectedRole === 'admin',
        name: name.trim() || loginId.trim(),
        loginId: loginId.trim(),
        loginId_lower: lowerId,
        password: password.trim(), 
        email: email,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      };

      // Règle d'or : Utilisation de l'UID comme ID de document Firestore
      await setDoc(doc(db, 'users', uid), userData, { merge: true });

      const companyRef = doc(db, 'companies', finalCompanyId);
      await setDoc(companyRef, {
        id: finalCompanyId,
        name: finalCompanyName,
        subscriptionStatus: 'active',
        subscription: {
          pricePerUser: 39.99,
          activeUsersCount: 1,
          totalMonthlyAmount: 39.99,
          currency: 'EUR',
          status: 'active'
        }
      }, { merge: true });

      setSignUpSuccess(true);
      setIsSignUp(false);
      toast({ title: "Compte créé !", description: "Vous pouvez maintenant vous connecter." });
    } catch (err: any) {
      setError(err.message);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setIsLoading(true);
    setError(null);

    try {
      const lowerId = loginId.trim().toLowerCase();
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('loginId_lower', '==', lowerId), limit(1));
      const querySnapshot = await getDocs(q);
      
      // RÈGLE STRICTE : Vérification Firestore avant tentative d'Authentification
      if (querySnapshot.empty) {
        setError("Aucun identifiant reconnu. Veuillez vous inscrire si vous n'avez pas créé de compte.");
        setIsLoading(false);
        return;
      }

      const legacyData = querySnapshot.docs[0].data();
      const targetEmail = legacyData.email || `${lowerId}@espace.internal`;

      // Tentative de connexion via Firebase Auth
      await signInWithEmailAndPassword(auth, targetEmail, password.trim());

      const userCredential = auth.currentUser;
      if (!userCredential) throw new Error("Erreur d'authentification");
      
      const uid = userCredential.uid;
      const userDocRef = doc(db, 'users', uid);
      
      // RÈGLE : Vérification avant écriture (Ne pas écraser si le document existe déjà)
      const docSnap = await getDoc(userDocRef);
      
      if (!docSnap.exists()) {
        await setDoc(userDocRef, {
          ...legacyData,
          uid: uid,
          isProfile: true, // Marqueur indispensable pour être visible
          loginId: loginId.trim(),
          loginId_lower: lowerId,
          email: targetEmail,
          password: password.trim(),
          role: legacyData.role || 'employee',
          name: legacyData.name || loginId.trim(),
          companyId: legacyData.companyId || 'pending',
          createdAt: legacyData.createdAt || new Date().toISOString()
        });
      }

      router.push('/');
    } catch (err: any) {
      console.error("Login error:", err);
      let msg = "Identifiant ou mot de passe incorrect.";
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = "Mot de passe incorrect pour cet identifiant.";
      }
      setError(msg);
      toast({ 
        variant: "destructive", 
        title: "Accès refusé", 
        description: msg
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
        <Card className="shadow-2xl border-none p-4 rounded-[3rem] bg-white">
          <CardHeader className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
              <Image src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} alt="Logo" fill className="object-cover p-2" />
            </div>
            <div>
              <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter">GROW&GO</CardTitle>
              <CardDescription className="text-primary/60 font-medium">
                {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Créer un identifiant" : "Connectez-vous à votre espace"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {isSignUp && (
                <>
                  <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-bold" required />
                  <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                    <SelectTrigger className="h-12 bg-muted/30 border-none rounded-xl font-bold">
                      <SelectValue placeholder="Votre Rôle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Patron</SelectItem>
                      <SelectItem value="employee">Employé</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Nom Entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 bg-muted/30 border-none rounded-xl font-bold" required />
                </>
              )}
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Identifiant" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-12 h-12 bg-muted/30 border-none rounded-xl font-bold" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer mon compte" : "Se connecter")}
              </Button>
              <button type="button" className="w-full text-xs font-black uppercase tracking-widest text-primary/60 py-2" onClick={() => { setIsSignUp(!isSignUp); setSignUpSuccess(false); setError(null); }}>
                {isSignUp ? "Déjà un compte ? Connexion" : "Pas encore de compte ? Créer un identifiant"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-dashed">
              <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase opacity-40 gap-2" onClick={() => setShowDevMode(!showDevMode)}>
                <Terminal className="w-3 h-3" />
                Mode Développement
              </Button>
              {showDevMode && (
                <div className="mt-4 grid gap-2 animate-in slide-in-from-top-2">
                  {[
                    { id: 'JSecchi', role: 'Admin', pass: 'Meqoqo1998' }
                  ].map(acc => (
                    <div 
                      key={acc.id} 
                      className="p-3 bg-muted/30 rounded-xl text-[10px] flex justify-between items-center cursor-pointer hover:bg-primary/10 transition-colors" 
                      onClick={() => { 
                        setLoginId(acc.id); 
                        setPassword(acc.pass); 
                        setError(null);
                        toast({ title: `Identifiants pour ${acc.id} remplis` });
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-black text-primary uppercase">{acc.id}</span>
                        <span className="text-[8px] opacity-60">({acc.role})</span>
                      </div>
                      <span className="font-mono bg-white px-2 py-0.5 rounded border shadow-sm">{acc.pass}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
