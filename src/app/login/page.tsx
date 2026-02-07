
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, UserPlus, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [id, setId] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    const trimmedId = id.trim();
    if (!trimmedId) return;

    setIsLoading(true);
    // L'email Firebase Auth est toujours en minuscule pour éviter les doublons techniques
    const email = `${trimmedId.toLowerCase()}@growandgo.ai`;

    try {
      if (isSignUp) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;
          
          // Seul l'identifiant exact "JSecchi" a les droits de super_admin
          const isSuperAdmin = trimmedId === 'JSecchi';
          
          const userRef = doc(db, 'users', newUser.uid);
          await setDoc(userRef, {
            uid: newUser.uid,
            companyId: isSuperAdmin ? 'growandgo-hq' : 'default-company',
            role: isSuperAdmin ? 'super_admin' : 'employee',
            adminMode: isSuperAdmin,
            isCategoryModifier: isSuperAdmin,
            name: name || trimmedId,
            email: email,
            loginId: trimmedId // Stockage de la casse originale pour vérification stricte
          });

          toast({ title: "Compte créé !", description: "Redirection vers la connexion..." });
          
          await signOut(auth);
          setIsSignUp(false);
          setPassword('');
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            toast({ 
              variant: "destructive", 
              title: "Échec", 
              description: "Un compte avec cet identifiant existe déjà dans la base." 
            });
          } else {
            throw authError;
          }
        }
      } else {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const loggedUser = userCredential.user;

          const userRef = doc(db, 'users', loggedUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            // Vérification STRICTE de la casse de l'identifiant
            if (userData.loginId === trimmedId) {
              const t = toast({ title: "Connexion réussie", description: "Chargement de votre espace..." });
              // Faire disparaître le toast de succès après 3 secondes
              setTimeout(() => t.dismiss(), 3000);
              router.push('/');
            } else {
              // Mauvaise casse (ex: Jsecchi au lieu de JSecchi)
              await signOut(auth);
              toast({ 
                variant: "destructive", 
                title: "Échec", 
                description: "Identifiant ou mot de passe incorrect." 
              });
            }
          } else {
            await signOut(auth);
            toast({ 
              variant: "destructive", 
              title: "Échec", 
              description: "Identifiant non reconnu dans la base." 
            });
          }
        } catch (authError: any) {
          toast({ 
            variant: "destructive", 
            title: "Échec", 
            description: "Identifiant ou mot de passe incorrect." 
          });
        }
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Échec", 
        description: "Une erreur est survenue lors de l'accès au compte." 
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

            <div className="space-y-2">
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
                  setId('');
                  setPassword('');
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
    </div>
  );
}
