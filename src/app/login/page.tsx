
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User, UserRole } from '@/lib/types';
import { normalizeId } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  // MODE TEST : Liste des identifiants existants
  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);

  const { data: allUsers } = useCollection<User>(usersQuery);

  const uniqueUsers = useMemo(() => {
    if (!allUsers) return [];
    const map = new Map();
    allUsers.forEach(u => {
      const id = (u.loginId_lower || u.loginId || '').toLowerCase();
      if (id && !map.has(id)) map.set(id, u);
    });
    return Array.from(map.values()).sort((a, b) => (a.role === 'admin' ? -1 : 1));
  }, [allUsers]);

  const isAdminMissing = useMemo(() => {
    return !uniqueUsers.some(u => u.loginId_lower === 'jsecchi');
  }, [uniqueUsers]);

  const handleForceCreateAdmin = async () => {
    if (!db || !auth) return;
    setIsLoading(true);
    try {
      const email = 'jsecchi@espace.internal';
      const pass = 'Meqoqo1998';
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        const uid = cred.user.uid;
        await setDoc(doc(db, 'users', uid), {
          uid,
          loginId: 'JSecchi',
          loginId_lower: 'jsecchi',
          name: 'Admin Global',
          role: 'admin',
          companyId: 'admin_global',
          enterpriseId: 'admin_global',
          companyName: 'GrowAndGo Admin',
          adminMode: true,
          isCategoryModifier: true,
          isProfile: true,
          subscriptionStatus: 'active',
          email: email,
          createdAt: new Date().toISOString()
        }, { merge: true });
        toast({ title: "Admin JSecchi créé avec succès !" });
      } catch (e) {
        toast({ title: "Admin déjà présent", description: "Vérifiez vos identifiants." });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;
    setIsLoading(true);

    try {
      const lowerId = loginId.trim().toLowerCase();
      const email = `${lowerId}@espace.internal`;
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password.trim());
      const uid = userCredential.user.uid;

      let finalRole = selectedRole;
      let finalCompanyName = companyName.trim();
      let finalCompanyId = normalizeId(finalCompanyName);

      if (lowerId === 'jsecchi') {
        finalRole = 'admin';
        finalCompanyName = "GrowAndGo Admin";
        finalCompanyId = "admin_global";
      } else if (finalRole === 'particulier') {
        finalCompanyName = "Mon Espace Personnel";
        finalCompanyId = `private-${lowerId}`;
      }

      const userData = {
        uid: uid,
        isProfile: true,
        companyId: finalCompanyId,
        enterpriseId: finalCompanyId,
        companyName: finalCompanyName,
        role: finalRole,
        adminMode: finalRole === 'admin',
        isCategoryModifier: finalRole === 'admin',
        name: name.trim() || loginId.trim(),
        loginId: loginId.trim(),
        loginId_lower: lowerId,
        password: password.trim(), 
        email: email,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), userData, { merge: true });

      setSignUpSuccess(true);
      setIsSignUp(false);
      toast({ title: "Compte créé !" });
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
      
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('loginId_lower', '==', lowerId), limit(1));
      const querySnapshot = await getDocs(q);
      
      let targetEmail = `${lowerId}@espace.internal`;
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        if (userData.email) targetEmail = userData.email;
      }

      const result = await signInWithEmailAndPassword(auth, targetEmail, password.trim());
      
      // FORÇAGE ADMIN JSECCHI : Découplage de l'e-mail
      if (lowerId === 'jsecchi') {
        await setDoc(doc(db, 'users', result.user.uid), {
          role: 'admin',
          adminMode: true,
          isCategoryModifier: true,
          companyId: 'admin_global',
          companyName: 'GrowAndGo Admin',
          loginId: 'JSecchi',
          loginId_lower: 'jsecchi'
        }, { merge: true });
      }

      toast({ title: "Connexion réussie" });
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Accès refusé", description: "Identifiant ou mot de passe incorrect." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-stretch overflow-hidden">
      <div className="hidden lg:flex flex-col w-80 bg-white/40 backdrop-blur-xl border-r p-8 overflow-y-auto animate-in slide-in-from-left duration-500">
        <div className="flex items-center gap-3 mb-8">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <h2 className="text-sm font-black uppercase tracking-tighter text-primary">Mode Test</h2>
        </div>
        
        {isAdminMissing && (
          <Button 
            variant="outline" 
            className="mb-6 border-dashed border-primary/20 bg-primary/5 text-primary font-bold text-xs h-12 rounded-xl hover:bg-primary/10"
            onClick={handleForceCreateAdmin}
            disabled={isLoading}
          >
            <ShieldCheck className="w-4 h-4 mr-2" /> Initialiser Admin JSecchi
          </Button>
        )}

        <div className="space-y-3">
          {uniqueUsers.map(u => (
            <button 
              key={u.uid}
              onClick={() => { setLoginId(u.loginId); setPassword('Meqoqo1998'); }}
              className="w-full text-left p-4 rounded-2xl hover:bg-white transition-all border border-transparent hover:border-primary/10 group shadow-sm hover:shadow-md"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-black text-primary group-hover:text-primary transition-colors">{u.loginId}</p>
                <Badge className={u.companyId === 'admin_global' ? "bg-primary text-[8px]" : "bg-muted text-muted-foreground text-[8px]"}>
                  {u.role?.toUpperCase()}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium truncate">{u.email}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full animate-in zoom-in-95 duration-500">
          <Card className="shadow-2xl border-none p-4 rounded-[3rem] bg-white">
            <CardHeader className="text-center space-y-4">
              <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
                <Image src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} alt="Logo" fill className="object-cover p-2" />
              </div>
              <div>
                <CardTitle className="text-3xl font-black text-[#1E4D3B] uppercase tracking-tighter">GROW&GO</CardTitle>
                <CardDescription className="text-[#1E4D3B]/60 font-medium">
                  {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Créer un identifiant" : "Connectez-vous à votre espace"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {signUpSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-xs font-bold text-emerald-800 uppercase">Compte prêt. Connectez-vous.</p>
                </div>
              )}
              <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
                {isSignUp && (
                  <>
                    <Input placeholder="Nom complet" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                    <div className="space-y-1">
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                        <SelectTrigger className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold">
                          <SelectValue placeholder="Votre Rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Patron</SelectItem>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="employee">Employé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedRole !== 'particulier' && (
                      <Input placeholder="Nom Entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                    )}
                  </>
                )}
                <div className="relative">
                  <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Identifiant (ex: JSecchi)" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Mot de passe" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="pl-11 pr-12 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" 
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <Button type="submit" className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer mon compte" : "Se connecter")}
                </Button>
                <button type="button" className="w-full text-xs font-black uppercase tracking-widest text-[#1E4D3B]/60 py-2 hover:text-[#1E4D3B]" onClick={() => setIsSignUp(!isSignUp)}>
                  {isSignUp ? "Déjà un compte ? Connexion" : "Pas encore de compte ? Créer un identifiant"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
