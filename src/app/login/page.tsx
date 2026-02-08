
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
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, Users, Key, CheckCircle2, ShieldCheck, User } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { User as UserProfile, UserRole } from '@/lib/types';
import { cn, normalizeId } from '@/lib/utils';
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

  const allUsersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);

  const { data: allUsers, isLoading: isUsersLoading } = useCollection<UserProfile>(allUsersQuery);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setIsLoading(true);

    try {
      const lowerId = loginId.trim().toLowerCase();
      const profileId = `profile_${lowerId}`;
      
      const q = query(collection(db, 'users'), where('loginId_lower', '==', lowerId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        throw new Error("Cet identifiant existe déjà.");
      }

      let finalRole = selectedRole;
      const finalCompanyName = companyName.trim();
      const finalCompanyId = normalizeId(finalCompanyName);

      if (lowerId === 'jsecchi') {
        finalRole = 'super_admin';
      }

      await setDoc(doc(db, 'users', profileId), {
        uid: profileId,
        isProfile: true,
        companyId: finalCompanyId,
        companyName: finalCompanyName,
        role: finalRole,
        adminMode: finalRole !== 'employee',
        isCategoryModifier: finalRole !== 'employee',
        name: name.trim() || loginId.trim(),
        loginId: loginId.trim(),
        loginId_lower: lowerId,
        password: password.trim(),
        email: `${lowerId}@studio.internal`,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      });

      // Si c'est un patron, on initialise les catégories par défaut avec les IDs standardisés
      if (finalRole !== 'employee') {
        const batch = writeBatch(db);
        const defaultCategories = [
          { 
            id: 'finance', 
            label: 'Finances & comptabilité', 
            icon: 'finance', 
            subCategories: ["Factures Ventes", "Factures Achats", "Relevés Bancaires", "TVA & Impôts"] 
          },
          { 
            id: 'juridique', 
            label: 'Juridique & Administratif', 
            icon: 'juridique', 
            subCategories: ["Statuts & KBis", "Assurances", "Contrats de bail", "PV Assemblée"] 
          },
          { 
            id: 'commercial', 
            label: 'Commercial & Clients', 
            icon: 'travail', 
            subCategories: ["Devis", "Contrats Clients", "Fiches Prospects", "Appels d'offres"] 
          },
          { 
            id: 'fournisseurs', 
            label: 'Fournisseurs & Achats', 
            icon: 'fournisseurs', 
            subCategories: ["Contrats Fournisseurs", "Bons de commande", "Bons de livraison"] 
          },
          { 
            id: 'rh', 
            label: 'Ressources Humaines (RH)', 
            icon: 'rh', 
            subCategories: ["Contrats de travail", "Bulletins de paie", "Mutuelle & Prévoyance", "Congés"] 
          },
          { 
            id: 'marketing', 
            label: 'Communication & Marketing', 
            icon: 'marketing', 
            subCategories: ["Identité visuelle", "Campagnes Pub", "Réseaux Sociaux", "Presse"] 
          }
        ];

        for (const cat of defaultCategories) {
          const catRef = doc(db, 'companies', finalCompanyId, 'categories', cat.id);
          batch.set(catRef, {
            id: cat.id,
            label: cat.label,
            badgeCount: 0,
            visibleToEmployees: cat.id !== 'finance',
            type: 'standard',
            companyId: finalCompanyId,
            icon: cat.icon,
            subCategories: cat.subCategories || []
          }, { merge: true });
        }
        await batch.commit();
      }

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
      const q = query(collection(db, 'users'), where('loginId_lower', '==', lowerId));
      const querySnap = await getDocs(q);
      
      let profileData: UserProfile | null = null;
      if (!querySnap.empty) {
        profileData = querySnap.docs[0].data() as UserProfile;
      }

      if (!profileData) throw new Error("Identifiant inconnu.");
      if (profileData.password?.trim() !== password.trim()) throw new Error("Mot de passe incorrect.");

      const userCredential = await signInAnonymously(auth);
      const sessionUid = userCredential.user.uid;

      const normalizedCompanyId = normalizeId(profileData.companyName || profileData.companyId);

      await setDoc(doc(db, 'users', sessionUid), {
        ...profileData,
        uid: sessionUid,
        companyId: normalizedCompanyId,
        isProfile: false,
        isSession: true,
        lastLogin: serverTimestamp()
      });

      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Accès refusé", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="w-full md:w-80 space-y-4">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border-none">
            <div className="flex items-center gap-2 mb-4 text-[#1E4D3B]">
              <Users className="w-5 h-5" />
              <h3 className="font-black uppercase text-[10px] tracking-widest">Répertoire Studio</h3>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {isUsersLoading ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary/20" /></div>
              ) : displayUsers.map(u => (
                <div key={u.uid} className="flex flex-col p-3 rounded-xl bg-muted/30 border border-black/5 gap-1.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-black text-primary">{u.loginId}</span>
                    <Badge className={cn("text-[8px] font-black uppercase h-4 px-1", u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground")}>
                      {u.role === 'super_admin' ? 'SA' : u.role === 'admin' ? 'P' : 'E'}
                    </Badge>
                  </div>
                  <p className="text-[8px] font-black uppercase text-muted-foreground/60 truncate">{u.companyName || u.companyId}</p>
                  <div className="flex items-center gap-1.5 text-rose-950 bg-rose-50/50 p-1.5 rounded border border-rose-100">
                    <Key className="w-3 h-3 opacity-50" />
                    <span className="text-[11px] font-mono font-black tracking-tight">{u.password || '••••••'}</span>
                  </div>
                </div>
              ))}
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
                {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Nouveau Studio" : "Connexion Studio"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {signUpSuccess && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-800 uppercase">Votre espace est prêt. Connectez-vous.</p>
              </div>
            )}
            <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-4">
              {isSignUp && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                    <div className="space-y-1">
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                        <SelectTrigger className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold text-muted-foreground">
                          <SelectValue placeholder="Votre Rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Le Patron</SelectItem>
                          <SelectItem value="employee">Employé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Input placeholder="Nom du Studio (Entreprise)" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                </>
              )}
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Identifiant Unique" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
              </div>
              <Button type="submit" className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer mon Studio" : "Se connecter")}
              </Button>
              <button type="button" className="w-full text-xs font-black uppercase tracking-widest text-[#1E4D3B]/60 py-2" onClick={() => { setSignUpSuccess(false); setIsSignUp(!isSignUp); }}>
                {isSignUp ? "Déjà un compte ? Connexion" : "Nouveau ? Créer un studio"}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
