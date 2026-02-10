
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Building, Mail, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { normalizeId } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const generateLoginId = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) return parts[0]; 
    const firstName = parts[0];
    const lastName = parts.slice(1).join('');
    return (firstName.charAt(0).toUpperCase() + lastName.charAt(0).toUpperCase() + lastName.slice(1)).replace(/[^a-zA-Z0-9]/g, '');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !auth) return;
    setIsLoading(true);
    setError(null);

    try {
      const generatedId = generateLoginId(name);
      const lowerId = generatedId.toLowerCase();

      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('loginId_lower', '==', lowerId), limit(1));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        throw new Error(`L'identifiant "${generatedId}" est déjà utilisé. Veuillez modifier légèrement votre nom (ex: ajouter un chiffre).`);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password.trim());
      const uid = userCredential.user.uid;

      const finalCompanyId = normalizeId(companyName);
      const companyRef = doc(db, 'companies', finalCompanyId);
      
      await setDoc(companyRef, {
        id: finalCompanyId,
        name: companyName.trim(),
        subscriptionStatus: 'active',
        subscription: {
          pricePerUser: 39.99,
          activeUsersCount: 1,
          totalMonthlyAmount: 39.99,
          currency: 'EUR',
          status: 'active',
          nextBillingDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 8).toISOString()
        }
      }, { merge: true });

      const userData = {
        uid: uid,
        isProfile: true,
        companyId: finalCompanyId,
        companyName: companyName.trim(),
        role: 'admin', 
        adminMode: true,
        isCategoryModifier: true,
        name: name.trim(),
        loginId: generatedId,
        loginId_lower: lowerId,
        password: password.trim(), 
        email: email.trim(),
        subscriptionStatus: 'active',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), userData);

      setSuccessId(generatedId);
      toast({ title: "Compte créé avec succès !" });
    } catch (err: any) {
      setError(err.message);
      toast({ variant: "destructive", title: "Erreur d'inscription", description: err.message });
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
              <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter">INSCRIPTION PATRON</CardTitle>
              <CardDescription className="text-primary/60 font-medium italic">
                Créez votre espace Grow&Go en quelques secondes.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nom complet (ex: Antoine Dupont)" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" 
                    required 
                  />
                </div>

                <div className="relative">
                  <Building className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Nom de l'entreprise (ex: Rugby)" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" 
                    required 
                  />
                </div>

                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="email"
                    placeholder="Email de contact" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" 
                    required 
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="password"
                    placeholder="Mot de passe" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" 
                    required 
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-xl mt-4" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Créer mon espace"}
              </Button>

              <button 
                type="button" 
                className="w-full text-xs font-black uppercase tracking-widest text-primary/60 py-2" 
                onClick={() => router.push('/login')}
              >
                Déjà un compte ? Se connecter
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!successId} onOpenChange={() => {}}>
        <DialogContent className="rounded-[3rem] p-8 text-center sm:max-w-md border-none shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase text-primary">Inscription Réussie !</DialogTitle>
            <DialogDescription className="text-lg font-medium py-4">
              <span className="block mb-2">Votre identifiant de connexion est :</span>
              <span className="block my-4 p-4 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 text-3xl font-black text-primary tracking-widest">
                {successId}
              </span>
              <span className="block text-sm text-muted-foreground mt-2">
                Notez-le bien, il vous servira à vous connecter à votre espace Grow&Go.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              onClick={() => router.push('/')} 
              className="w-full h-12 rounded-full font-bold bg-primary shadow-lg"
            >
              Accéder à mon tableau de bord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
