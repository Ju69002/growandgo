
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, Key, CheckCircle2, Eye, EyeOff } from 'lucide-react';
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
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

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
      if (finalRole === 'particulier') finalCompanyName = "Mon Espace Personnel";

      let finalCompanyId = normalizeId(finalCompanyName);
      if (finalRole === 'particulier') finalCompanyId = `private-${lowerId}`;

      if (lowerId === 'jsecchi') {
        finalRole = 'super_admin';
        finalCompanyName = "GrowAndGo";
        finalCompanyId = "growandgo";
      }

      await setDoc(doc(db, 'users', uid), {
        uid: uid,
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
        email: email,
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      }, { merge: true });

      if (finalRole !== 'employee') {
        const batch = writeBatch(db);
        const defaultCategories = [
          { id: 'finance', label: 'Finances & comptabilité', icon: 'finance', subCategories: ["Factures Ventes", "Factures Achats", "Relevés Bancaires", "TVA & Impôts"] },
          { id: 'juridique', label: 'Juridique & Administratif', icon: 'juridique', subCategories: ["Statuts & KBis", "Assurances", "Contrats de bail", "PV Assemblée"] },
          { id: 'commercial', label: 'Commercial & Clients', icon: 'travail', subCategories: ["Devis", "Contrats Clients", "Fiches Prospects", "Appels d'offres"] },
          { id: 'fournisseurs', label: 'Fournisseurs & Achats', icon: 'fournisseurs', subCategories: ["Contrats Fournisseurs", "Bons de commande", "Bons de livraison"] },
          { id: 'rh', label: 'Ressources Humaines (RH)', icon: 'rh', subCategories: ["Contrats de travail", "Bulletins de paie", "Mutuelle & Prévoyance", "Congés"] },
          { id: 'marketing', label: 'Communication & Marketing', icon: 'marketing', subCategories: ["Identité visuelle", "Campagnes Pub", "Réseaux Sociaux", "Presse"] }
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
      toast({ title: "Compte créé avec succès !" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur d'inscription", description: error.message });
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
      const email = `${lowerId}@espace.internal`;
      await signInWithEmailAndPassword(auth, email, password.trim());
      toast({ title: "Connexion réussie" });
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Accès refusé", description: "Identifiant ou mot de passe incorrect." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-2xl border-none p-4 rounded-[2.5rem] bg-white">
          <CardHeader className="text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-xl">
              <Image src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} alt="Logo" fill className="object-cover p-2" />
            </div>
            <div>
              <CardTitle className="text-3xl font-black text-[#1E4D3B] uppercase tracking-tighter">GROW&GO</CardTitle>
              <CardDescription className="text-[#1E4D3B]/60 font-medium">
                {signUpSuccess ? "Inscription réussie !" : isSignUp ? "Créer un nouvel identifiant" : "Connectez-vous à votre espace"}
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
                  <div className="grid grid-cols-1 gap-4">
                    <Input placeholder="Prénom Nom" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                    <div className="space-y-1">
                      <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as UserRole)}>
                        <SelectTrigger className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold text-muted-foreground">
                          <SelectValue placeholder="Votre Rôle" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Patron</SelectItem>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="employee">Employé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedRole !== 'particulier' && (
                    <Input placeholder="Nom de votre Entreprise" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
                  )}
                </>
              )}
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Identifiant" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-bold" required />
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
              <Button type="submit" className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer mon identifiant" : "Se connecter")}
              </Button>
              <button type="button" className="w-full text-xs font-black uppercase tracking-widest text-[#1E4D3B]/60 py-2" onClick={() => { setSignUpSuccess(false); setIsSignUp(!isSignUp); }}>
                {isSignUp ? "Déjà un compte ? Connexion" : "Pas encore de compte ? Créer un identifiant"}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
