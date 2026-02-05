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

  // Valeur par défaut : Indigo (#3F51B5) en HSL
  const primaryColor = company?.primaryColor || '231 48% 48%';

  return (
    <div style={{ '--primary': primaryColor } as React.CSSProperties} className="contents">
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
      <body className="font-body antialiased selection:bg-primary/20 selection:text-primary">
        <FirebaseClientProvider>
          <ThemeInjector>
            {children}
          </ThemeInjector>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}