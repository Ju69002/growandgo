'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, setDocumentNonBlocking, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setIsLoading(true);
    const email = `${id.toLowerCase().trim()}@growandgo.ai`;

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        
        const userRef = doc(db, 'users', newUser.uid);
        setDocumentNonBlocking(userRef, {
          uid: newUser.uid,
          companyId: id.toLowerCase().trim() === 'jsecchi' ? 'growandgo-hq' : 'default-company',
          role: id.toLowerCase().trim() === 'jsecchi' ? 'super_admin' : 'employee',
          adminMode: id.toLowerCase().trim() === 'jsecchi',
          isCategoryModifier: id.toLowerCase().trim() === 'jsecchi',
          name: name || id,
          email: email
        }, { merge: true });

        toast({ title: "Compte créé !", description: "Bienvenue dans l'univers Grow&Go." });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const loggedUser = userCredential.user;

        if (id.toLowerCase().trim() === 'jsecchi') {
          const userRef = doc(db, 'users', loggedUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            setDocumentNonBlocking(userRef, {
              uid: loggedUser.uid,
              companyId: 'growandgo-hq',
              role: 'super_admin',
              adminMode: true,
              isCategoryModifier: true,
              name: 'JSecchi (Propriétaire)',
              email: email
            }, { merge: true });
          }
        }
        toast({ title: "Connexion réussie", description: `Ravi de vous revoir.` });
      }
      router.push('/');
    } catch (error: any) {
      let message = "Une erreur est survenue.";
      
      if (
        error.code === 'auth/wrong-password' || 
        error.code === 'auth/invalid-credential' || 
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/invalid-email'
      ) {
        message = "Identifiant ou mot de passe incorrect.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "Cet identifiant est déjà utilisé.";
      } else if (error.code === 'auth/weak-password') {
        message = "Le mot de passe doit contenir au moins 6 caractères.";
      }
      
      toast({ 
        variant: "destructive", 
        title: isSignUp ? "Échec de l'inscription" : "Échec de connexion", 
        description: message 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-none p-4 rounded-[2rem] bg-white">
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
            <CardTitle className="text-2xl font-black text-[#1E4D3B] uppercase tracking-tighter">Grow&Go Design Studio</CardTitle>
            <CardDescription className="text-[#1E4D3B]/60 font-medium">
              {isSignUp ? "Créez votre compte pour commencer." : "Veuillez vous identifier pour accéder à vos dossiers."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div className="space-y-2">
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
            
            <div className="space-y-2">
              <Label htmlFor="id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Identifiant</Label>
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

            <div className="space-y-2">
              <Label htmlFor="pass" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="pass" 
                  type="password" 
                  placeholder="••••••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 bg-[#F9F9F7] border-none rounded-xl font-medium"
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
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
                  toast({ title: isSignUp ? "Mode Connexion" : "Mode Inscription" });
                }}
              >
                {isSignUp ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? S'inscrire"}
              </Button>
            </div>
          </form>
          <div className="mt-8 pt-6 border-t border-[#F5F2EA] text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            BusinessPilot SaaS - Sécurisé par JSecchi
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
