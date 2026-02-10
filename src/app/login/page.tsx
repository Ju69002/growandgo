'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDocs, getDoc, collection, query, where, limit, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, UserCircle, Eye, EyeOff, Terminal, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function LoginPage() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDevMode, setShowDevMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !db) return;
    setIsLoading(true);
    setError(null);

    try {
      const lowerId = loginId.trim().toLowerCase();
      
      // 1. Vérification Firestore STRICTE
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('loginId_lower', '==', lowerId), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        setError("Aucun identifiant reconnu. Veuillez vous inscrire si vous n'avez pas créé de compte.");
        setIsLoading(false);
        return;
      }

      const legacyData = querySnapshot.docs[0].data();
      const targetEmail = legacyData.email;
      const storedPassword = legacyData.password;

      // 2. Authentification Firebase
      try {
        await signInWithEmailAndPassword(auth, targetEmail, password.trim());
      } catch (authErr: any) {
        if (password.trim() === storedPassword) {
          setError("Désynchronisation détectée : Le mot de passe correspond au répertoire mais l'accès de sécurité Firebase est différent. Contactez Julien Secchi.");
        } else {
          setError("Identifiant ou mot de passe incorrect.");
        }
        setIsLoading(false);
        return;
      }

      const userCredential = auth.currentUser;
      if (!userCredential) throw new Error("Erreur d'authentification");
      
      const uid = userCredential.uid;
      const userDocRef = doc(db, 'users', uid);
      
      // 3. Réparation automatique si ID aléatoire détecté
      if (querySnapshot.docs[0].id !== uid) {
        await setDoc(userDocRef, {
          ...legacyData,
          uid: uid,
          isProfile: true,
          loginId_lower: lowerId
        }, { merge: true });
      }

      router.push('/');
    } catch (err: any) {
      console.error("Login error:", err);
      setError("Une erreur technique est survenue.");
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
              <CardDescription className="text-primary/60 font-medium">Connectez-vous à votre espace</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="leading-tight">{error}</span>
                </div>
              )}
              
              <div className="relative">
                <UserCircle className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Identifiant" value={loginId} onChange={(e) => setLoginId(e.target.value)} className="pl-11 h-12 bg-muted/30 border-none rounded-xl font-bold" required />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-11 pr-12 h-12 bg-muted/30 border-none rounded-xl font-bold" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-muted-foreground hover:text-primary">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <Button type="submit" className="w-full h-14 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-lg shadow-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Se connecter"}
              </Button>
              
              <button 
                type="button" 
                className="w-full text-xs font-black uppercase tracking-widest text-primary/60 py-2" 
                onClick={() => router.push('/register')}
              >
                Nouveau ? Créer un espace patron
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-dashed">
              <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase opacity-40 gap-2" onClick={() => setShowDevMode(!showDevMode)}>
                <Terminal className="w-3 h-3" />
                Mode Administration
              </Button>
              {showDevMode && (
                <div className="mt-4 grid gap-2 animate-in slide-in-from-top-2">
                  <div 
                    className="p-3 bg-muted/30 rounded-xl text-[10px] flex justify-between items-center cursor-pointer hover:bg-primary/10" 
                    onClick={() => { setLoginId('JSecchi'); setPassword('Meqoqo1998'); }}
                  >
                    <span className="font-black text-primary uppercase">JSecchi (Admin)</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded border">Meqoqo1998</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
