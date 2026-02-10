
'use client';

import { Search, Bell, UserCircle, LogOut, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser, useDoc, useMemoFirebase, useCollection, useAuth } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const companyId = profile?.companyId;

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId.toLowerCase(), 'documents'),
      where('status', 'in', ['pending_analysis', 'waiting_verification', 'waiting_validation']),
      limit(10)
    );
  }, [db, companyId]);

  const { data: rawNotifications } = useCollection<BusinessDocument>(notificationsQuery);
  
  const notifications = rawNotifications?.filter(n => !n.isBillingTask) || [];
  const unreadCount = notifications.length;

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/login');
    }
  };

  const role = profile?.role;
  const isAdmin = role === 'admin' || profile?.companyId === 'admin_global';
  const isPatron = role === 'patron';
  const isFamily = role === 'family';
  
  let roleLabel = "COLLABORATEUR";
  if (isAdmin) roleLabel = "ADMINISTRATEUR";
  else if (isPatron) roleLabel = "DIRIGEANT";
  else if (isFamily) roleLabel = "FAMILLE";

  return (
    <header className="h-16 border-b bg-card px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger />
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Rechercher..." className="pl-9 bg-muted/50 border-none h-9" />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden lg:flex flex-col items-end mr-2">
          <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest leading-none">{roleLabel}</span>
          <span className="text-xs font-bold text-primary">{profile?.name}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-none rounded-2xl overflow-hidden">
            <DropdownMenuLabel className="p-4 border-b bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest">
              Nouveaux Documents ({unreadCount})
            </DropdownMenuLabel>
            <div className="max-h-80 overflow-y-auto bg-white">
              {notifications.length > 0 ? (
                notifications.map((notif) => (
                  <Link href={`/categories/${notif.categoryId}`} key={notif.id}>
                    <div className="p-4 border-b hover:bg-primary/5 transition-colors flex items-start gap-3 cursor-pointer">
                      <div className="mt-1 p-2 bg-primary/10 rounded-full"><Clock className="w-4 h-4 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-primary">{notif.name}</p>
                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-50">Importé par l'équipe</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-10 text-center text-muted-foreground italic text-sm">Aucun nouveau document</div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-2xl border-none rounded-2xl p-2">
            <DropdownMenuLabel className="px-4 py-3">
              <span className="font-bold">{profile?.name || profile?.loginId || 'Mon Compte'}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link href="/settings" className="w-full h-full flex items-center">
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive font-bold cursor-pointer" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
