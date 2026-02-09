
'use client';

import { Search, Bell, UserCircle, LogOut, Clock, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
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
import { User, BusinessDocument, DocumentStatus } from '@/lib/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const statusIcons: Record<DocumentStatus, any> = {
  pending_analysis: Clock,
  waiting_verification: AlertCircle,
  waiting_validation: AlertCircle,
  archived: CheckCircle2,
};

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
      collection(db, 'companies', companyId, 'documents'),
      where('status', 'in', ['pending_analysis', 'waiting_verification', 'waiting_validation']),
      limit(20) // Augmenté pour trouver de vrais docs parmi les éventuels anciens docs de facturation
    );
  }, [db, companyId]);

  const { data: rawNotifications } = useCollection<BusinessDocument>(notificationsQuery);
  
  // Filtre pour n'afficher que les documents d'importation réels
  const notifications = rawNotifications?.filter(n => 
    !n.isBillingTask && 
    !n.name?.toLowerCase().includes('facture')
  ) || [];
  
  const unreadCount = notifications.length;

  const handleLogout = async () => {
    if (auth) {
      await auth.signOut();
      router.push('/login');
    }
  };

  const getRoleLabel = (role?: string) => {
    if (role === 'super_admin') return 'ADMIN';
    if (role === 'admin') return 'PATRON';
    if (role === 'particulier') return 'PARTICULIER';
    return 'EMPLOYÉ';
  };

  return (
    <header className="h-16 border-b bg-card px-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger />
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un dossier..."
            className="pl-9 bg-muted/50 border-none focus-visible:ring-primary h-9"
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-none rounded-2xl overflow-hidden">
            <DropdownMenuLabel className="p-4 border-b bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest">
              Documents en attente ({unreadCount})
            </DropdownMenuLabel>
            <div className="max-h-80 overflow-y-auto bg-white">
              {!companyId ? (
                <div className="p-8 text-center text-muted-foreground text-sm font-medium italic">Chargement...</div>
              ) : notifications.length > 0 ? (
                notifications.map((notif) => {
                  const Icon = statusIcons[notif.status] || Clock;
                  return (
                    <Link href={`/categories/${notif.categoryId}`} key={notif.id}>
                      <div className="p-4 border-b hover:bg-primary/5 transition-colors flex items-start gap-3 cursor-pointer">
                        <div className="mt-1 p-2 bg-primary/10 rounded-full">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate text-primary">{notif.name}</p>
                          <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{notif.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-10 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-20" />
                  <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/40">Tout est traité</p>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="p-0">
              <Link href="/notifications" className="w-full text-center p-4 bg-muted/50 hover:bg-muted text-primary font-black cursor-pointer text-[10px] uppercase tracking-widest">
                Voir toutes les notifications
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 shadow-2xl border-none rounded-2xl p-2">
            <DropdownMenuLabel className="px-4 py-3 flex flex-col">
              <span className="font-bold text-base truncate">{profile?.name || 'Mon Compte'}</span>
              <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{getRoleLabel(profile?.role)}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link href="/settings" className="flex items-center gap-2 py-2">
                <UserCircle className="w-4 h-4" /> Profil & Espace
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="rounded-xl cursor-pointer">
              <Link href="/settings" className="flex items-center gap-2 py-2">
                <ShieldCheck className="w-4 h-4" /> Sécurité
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-muted/50" />
            <DropdownMenuItem className="text-destructive font-bold flex items-center gap-2 rounded-xl py-2 cursor-pointer hover:bg-destructive/10" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
