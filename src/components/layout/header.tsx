
'use client';

import { Search, Bell, UserCircle, ShieldCheck, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useUser, useDoc, useMemoFirebase, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { User, BusinessDocument, DocumentStatus } from '@/lib/types';
import Link from 'next/link';

const statusIcons: Record<DocumentStatus, any> = {
  pending_analysis: Clock,
  waiting_verification: AlertCircle,
  waiting_validation: AlertCircle,
  archived: CheckCircle2,
};

export function Header() {
  const { user } = useUser();
  const db = useFirestore();

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
      limit(5)
    );
  }, [db, companyId]);

  const { data: notifications } = useCollection<BusinessDocument>(notificationsQuery);
  const unreadCount = notifications?.length || 0;

  return (
    <header className="h-16 border-b bg-card px-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger />
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Rechercher un document, un dossier..."
            className="pl-9 bg-muted/50 border-none focus-visible:ring-primary"
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        {profile?.role !== 'employee' && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <Label htmlFor="admin-mode" className="text-xs font-medium cursor-pointer">Mode Architecte</Label>
            <Switch 
              id="admin-mode" 
              checked={profile?.adminMode || false}
              onCheckedChange={(checked) => {
                if (userRef) {
                  updateDocumentNonBlocking(userRef, { adminMode: checked });
                }
              }}
            />
          </div>
        )}
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="p-4 border-b">Notifications ({unreadCount})</DropdownMenuLabel>
            <div className="max-h-80 overflow-y-auto">
              {!companyId ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Initialisation...
                </div>
              ) : notifications && notifications.length > 0 ? (
                notifications.map((notif) => {
                  const Icon = statusIcons[notif.status] || Clock;
                  return (
                    <Link href={`/categories/${notif.categoryId}`} key={notif.id}>
                      <div className="p-4 border-b hover:bg-muted/50 transition-colors flex items-start gap-3 cursor-pointer">
                        <div className="mt-1 p-2 bg-primary/10 rounded-full">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{notif.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">Besoin d'action : {notif.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Aucune notification pour le moment.
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/notifications" className="w-full text-center p-3 text-primary font-bold cursor-pointer">
                Voir toutes les tâches à faire
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <UserCircle className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.name || 'Mon Compte'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profil</DropdownMenuItem>
            <DropdownMenuItem>Facturation</DropdownMenuItem>
            <DropdownMenuItem>Équipe</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Déconnexion</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
