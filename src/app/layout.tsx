
'use client';

import { useState, useEffect } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { Ban, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import './globals.css';

function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company } = useDoc<Company>(companyRef);

  if (!mounted) {
    return <div className="min-h-screen bg-[#F5F2EA]">{children}</div>;
  }

  // Vérification de l'abonnement
  const isInactive = profile?.subscriptionStatus === 'inactive' && profile?.role !== 'super_admin';

  const handleLogout = async () => {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    await signOut(auth);
    window.location.href = '/login';
  };

  if (isInactive) {
    return (
      <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-[3rem] shadow-2xl p-12 text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Ban className="w-12 h-12" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-primary">Accès Suspendu</h1>
            <p className="text-muted-foreground font-medium">
              Désolé <strong>{profile?.name}</strong>, votre abonnement Grow&Go Studio n'est plus actif.
            </p>
          </div>
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-900 leading-relaxed font-bold">
              Votre accès a été désactivé par le Super Administrateur. Veuillez contacter votre responsable pour rétablir votre studio.
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="w-full rounded-full h-12 font-bold gap-2">
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  const primary = company?.primaryColor || '157 44% 21%';
  const background = company?.backgroundColor || '43 38% 96%';
  const foreground = company?.foregroundColor || '157 44% 11%';
  
  const lightnessMatch = background.match(/(\d+)%$/);
  const lightness = lightnessMatch ? parseInt(lightnessMatch[1]) : 96;
  const isDark = lightness < 40;

  const card = isDark ? '157 44% 11%' : '0 0% 100%';
  const border = isDark ? '157 44% 20%' : '157 20% 85%';
  const muted = isDark ? '157 44% 15%' : '43 38% 90%';
  const mutedForeground = isDark ? '157 20% 70%' : '157 20% 40%';

  const themeStyles = {
    '--primary': primary,
    '--background': background,
    '--foreground': foreground,
    '--card': card,
    '--card-foreground': foreground,
    '--popover': card,
    '--popover-foreground': foreground,
    '--border': border,
    '--input': border,
    '--ring': primary,
    '--muted': muted,
    '--muted-foreground': mutedForeground,
  } as React.CSSProperties;

  return (
    <div 
      style={themeStyles} 
      className="min-h-screen bg-background text-foreground transition-colors duration-500 flex flex-col"
    >
      {children}
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/20 selection:text-primary h-full">
        <FirebaseClientProvider>
          <ThemeInjector>
            {children}
          </ThemeInjector>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
