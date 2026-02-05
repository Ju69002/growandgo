'use client';

import { FirebaseClientProvider } from '@/firebase';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import './globals.css';

/**
 * ThemeInjector écoute les changements de couleur dans Firestore pour l'entreprise 
 * et les injecte dans les variables CSS de l'application.
 */
function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();

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

  // Valeurs par défaut HSL
  const primary = company?.primaryColor || '231 48% 48%';
  const background = company?.backgroundColor || '0 0% 96%';
  const foreground = company?.foregroundColor || '222 47% 11%';
  
  // Calcul simplifié pour les cartes et bordures si le fond change
  const isDark = background.includes(' 0% 0%') || background.includes(' 20% 10%');
  const card = isDark ? '222 47% 11%' : '0 0% 100%';
  const border = isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%';

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
    '--muted': isDark ? '217.2 32.6% 17.5%' : '210 40% 96.1%',
    '--muted-foreground': isDark ? '215 20.2% 65.1%' : '215.4 16.3% 46.9%',
  } as React.CSSProperties;

  return (
    <div style={themeStyles} className="contents">
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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-primary/20 selection:text-primary min-h-screen bg-background text-foreground transition-colors duration-500">
        <FirebaseClientProvider>
          <ThemeInjector>
            {children}
          </ThemeInjector>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
