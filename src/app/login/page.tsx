
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;

    setIsLoading(true);
    // On transforme l'ID en email pour Firebase Auth (convention interne)
    const email = `${id.toLowerCase()}@growandgo.ai`;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Vérification/Initialisation du profil JSecchi si nécessaire
      if (id.toLowerCase() === 'jsecchi') {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setDocumentNonBlocking(userRef, {
            uid: user.uid,
            companyId: 'growandgo-hq',
            role: 'super_admin',
            adminMode: true,
            isCategoryModifier: true,
            name: 'JSecchi (Propriétaire)',
            email: email
          }, { merge: true });
        }
      }

      toast({ title: "Connexion réussie", description: `Bienvenue dans votre espace Grow&Go.` });
      router.push('/');
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Échec de connexion", 
        description: "Identifiant ou mot de passe incorrect." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-none">
        <CardHeader className="text-center space-y-4">
          <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-2xl border bg-white shadow-lg">
            <Image 
              src={logo?.imageUrl || ""} 
              alt="Logo" 
              fill 
              className="object-cover p-1" 
            />
          </div>
          <div>
            <CardTitle className="text-2xl font-black text-primary uppercase tracking-tighter">Grow&Go Design Studio</CardTitle>
            <CardDescription>Veuillez vous identifier pour accéder à vos dossiers.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Identifiant</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="id" 
                  placeholder="Votre ID..." 
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  className="pl-10 h-11 border-primary/10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pass" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="pass" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 border-primary/10"
                  required
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Se connecter"}
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t text-center text-[10px] text-muted-foreground uppercase tracking-widest">
            BusinessPilot SaaS - Sécurisé par JSecchi
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
