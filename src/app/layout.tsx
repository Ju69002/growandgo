'use client';

import { FirebaseClientProvider } from '@/firebase';
import { useFirestore, useDoc, useUser, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import './globals.css';

function ThemeInjector({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const db = useFirestore();

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId || 'default-company';

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const { data: company } = useDoc<Company>(companyRef);

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ThemeInjector>
            {children}
          </ThemeInjector>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
