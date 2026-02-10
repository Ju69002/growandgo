
'use client';

import { useState, useEffect } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { Toaster } from '@/components/ui/toaster';
import { Ban, ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import './globals.css';

function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Protection des routes : on autorise explicitement /login et /register sans session
  useEffect(() => {
    if (mounted && !isUserLoading && !user && pathname !== '/login' && pathname !== '/register') {
      router.push('/login');
    }
  }, [mounted, user, isUserLoading, pathname, router]);

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company } = useDoc<Company>(companyRef);

  if (!mounted || isUserLoading) {
    return <div className="min-h-screen bg-[#F5F2EA] flex items-center justify-center"><Loader2 className="animate-spin opacity-20" /></div>;
  }

  // Pas d'injection de thème complexe sur les pages d'auth
  if (pathname === '/login' || pathname === '/register') {
    return <div className="min-h-screen bg-[#F5F2EA]">{children}</div>;
  }

  const isGlobalAdmin = profile?.companyId === 'admin_global';
  const isFamily = profile?.role === 'family';
  // Le rôle Family est immunisé contre la suspension (Lifetime)
  const isInactive = profile?.subscriptionStatus === 'inactive' && !isGlobalAdmin && !isFamily;

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
              Désolé <strong>{profile?.name}</strong>, votre accès à l'espace de travail GROW&GO n'est plus actif.
            </p>
          </div>
          <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
            <p className="text-xs text-rose-900 leading-relaxed font-bold">
              Votre accès a été désactivé par l'administrateur. Veuillez contacter votre responsable pour rétablir vos accès.
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

  const themeStyles = {
    '--primary': primary,
    '--background': background,
    '--foreground': foreground,
    '--card': isDark ? '157 44% 11%' : '0 0% 100%',
    '--card-foreground': foreground,
    '--popover': isDark ? '157 44% 11%' : '0 0% 100%',
    '--popover-foreground': foreground,
    '--border': isDark ? '157 44% 20%' : '157 20% 85%',
    '--input': isDark ? '157 44% 20%' : '157 20% 85%',
    '--ring': primary,
    '--muted': isDark ? '157 44% 15%' : '43 38% 90%',
    '--muted-foreground': isDark ? '157 20% 70%' : '157 20% 40%',
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="min-h-screen bg-background text-foreground transition-colors duration-500 flex flex-col">
      {children}
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
