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
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff, Mail, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { sendResetEmail } from '@/firebase/non-blocking-login';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  useEffect(() => {
    if (!isUserLoading && user) {
      if (!isSignUp) {
        router.push('/');
      }
    }
  }, [user, isUserLoading, router, isSignUp]);

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

  const handleForgotPassword = async () => {
    if (!auth || !resetEmail.trim()) return;
    setIsResetLoading(true);
    try {
      await sendResetEmail(auth, resetEmail.trim());
      toast({ 
        title: "E-mail envoyé", 
        description: "Si cet e-mail correspond à un compte, vous recevrez un lien de réinitialisation." 
      });
      setIsResetOpen(false);
      setResetEmail('');
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Échec", 
        description: "Impossible d'envoyer l'e-mail de récupération." 
      });
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    const trimmedId = id.trim();
    if (!trimmedId) return;

    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!email.trim()) {
          toast({ variant: "destructive", title: "E-mail requis", description: "Veuillez renseigner un e-mail pour la récupération." });
          setIsLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const newUser = userCredential.user;
        
        const isTargetSuperAdmin = trimmedId === 'JSecchi';
        const companyId = isTargetSuperAdmin ? 'growandgo-hq' : 'Default Studio';
        const companyName = isTargetSuperAdmin ? 'Grow&Go HQ' : 'Nouveau Studio';

        await ensureCompanyExists(companyId, companyName);
        
        const userRef = doc(db, 'users', newUser.uid);
        await setDoc(userRef, {
          uid: newUser.uid,
          companyId: companyId,
          role: isTargetSuperAdmin ? 'super_admin' : 'employee',
          adminMode: isTargetSuperAdmin,
          isCategoryModifier: isTargetSuperAdmin,
          name: name || trimmedId,
          email: email.trim(),
          loginId: trimmedId
        });

        toast({ title: "Compte créé !", description: "Vous pouvez maintenant vous connecter." });
        await signOut(auth);
        setIsSignUp(false);
        setPassword('');
      } else {
        // Recherche de l'e-mail associé à l'ID
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('loginId', '==', trimmedId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          toast({ variant: "destructive", title: "Échec", description: "Identifiant inconnu." });
          setIsLoading(false);
          return;
        }

        const userData = querySnapshot.docs[0].data();
        const userEmail = userData.email;

        // Connexion avec l'e-mail trouvé
        await signInWithEmailAndPassword(auth, userEmail, password);
        toast({ title: "Connexion réussie", description: "Chargement de votre studio..." });
        router.push('/');
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Échec d'authentification", 
        description: "Identifiant ou mot de passe incorrect." 
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
              src={logo?.imageUrl || ""} 
              alt="Logo" 
              fill 
              className="object-cover p-2" 
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-[#1E4D3B] uppercase tracking-tighter">Grow&Go Design Studio</CardTitle>
            <CardDescription className="text-[#1E4D3B]/60 font-medium">
              {isSignUp ? "Créez votre accès personnel." : "Authentification requise pour vos dossiers."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom Complet</Label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="name" 
                    placeholder="Votre nom..." 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant (Respectez la casse)</Label>
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="id" 
                  placeholder="Ex: JSecchi..." 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail de récupération</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email"
                    placeholder="Ex: bertrand@gmail.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                    required={isSignUp}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pass" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mot de passe</Label>
                {!isSignUp && (
                  <button 
                    type="button" 
                    onClick={() => setIsResetOpen(true)}
                    className="text-[9px] font-black uppercase tracking-widest text-primary hover:underline"
                  >
                    ID ou Mot de passe oublié ?
                  </button>
                )}
              </div>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-2 h-8 w-8 p-0 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit" 
                className="w-full h-14 bg-[#1E4D3B] hover:bg-[#1E4D3B]/90 rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95"
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isSignUp ? "Créer un compte" : "Se connecter")}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs font-bold uppercase tracking-widest text-[#1E4D3B]/60 hover:bg-[#1E4D3B]/5 rounded-xl"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setId('');
                  setPassword('');
                  setEmail('');
                  setName('');
                }}
              >
                {isSignUp ? "Déjà inscrit ? Se connecter" : "Nouveau ? Créer un compte"}
              </Button>
            </div>
          </form>
          <div className="mt-8 pt-6 border-t border-[#F5F2EA] text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            BusinessPilot SaaS • Sécurité Propriétaire
          </div>
        </CardContent>
      </Card>

      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
          <DialogHeader className="space-y-3">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto">
              <Sparkles className="w-7 h-7" />
            </div>
            <DialogTitle className="text-2xl font-black uppercase text-center tracking-tighter">Récupération</DialogTitle>
            <DialogDescription className="text-center font-medium">
              Saisissez l'e-mail renseigné lors de votre inscription pour recevoir un lien de réinitialisation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">E-mail de contact</Label>
              <Input 
                value={resetEmail} 
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Ex: bertrand@gmail.com"
                className="rounded-xl border-primary/10 h-12 font-bold"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-3">
            <Button 
              onClick={handleForgotPassword} 
              className="w-full h-12 rounded-full font-bold bg-primary shadow-lg"
              disabled={isResetLoading || !resetEmail.trim()}
            >
              {isResetLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Envoyer le lien"}
            </Button>
            <Button variant="ghost" onClick={() => setIsResetOpen(false)} className="w-full font-bold">
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
