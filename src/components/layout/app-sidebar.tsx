
'use client';

import * as React from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Settings,
  CreditCard,
  KeyRound,
  UserCheck,
  Cloud,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const { user } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

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

  const role = profile?.role;
  const isAdmin = role === 'admin' || profile?.companyId === 'admin_global';
  const isPatron = role === 'patron';
  const isFamily = role === 'family';
  const isBusiness = company?.subscription?.planType === 'business' || isAdmin || isFamily;
  
  const displayName = company?.name || profile?.companyName || "GROW&GO";

  const mainItems = [
    { title: 'Tableau de bord', icon: LayoutDashboard, url: '/' },
    { title: 'Équipe', icon: Users, url: '/team' },
  ];

  const configItems = [
    { title: 'Abonnement', icon: CreditCard, url: '/billing' },
    { title: 'Sécurité & Sync', icon: KeyRound, url: '/settings/security' },
  ];

  if (isBusiness) {
    configItems.push({ title: 'Intégrations Cloud', icon: Cloud, url: '/settings/integrations' });
  }

  const isItemActive = (url: string) => pathname === url || (url !== '/' && pathname.startsWith(url));

  let roleLabel = "COLLABORATEUR";
  if (isAdmin) roleLabel = "ADMINISTRATEUR";
  else if (isPatron) roleLabel = "DIRIGEANT";
  else if (isFamily) roleLabel = "FAMILLE";

  return (
    <Sidebar collapsible="icon" className="border-r-0 z-50">
      <SidebarHeader className="h-20 flex items-center justify-center p-4 bg-sidebar">
        <div className="flex items-center gap-3 font-bold text-sidebar-foreground w-full">
          <div className="relative w-10 h-10 overflow-hidden rounded-lg border bg-white shadow-xl flex items-center justify-center mx-auto shrink-0">
            <Image 
              src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
              alt="Logo" 
              fill
              className="object-cover p-1"
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden flex-1 min-w-0">
            <span className="text-sm font-black uppercase leading-tight tracking-tighter text-white truncate">
              {displayName}
            </span>
            <span className="text-[9px] uppercase tracking-widest opacity-50 font-black text-white">
              {roleLabel}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2 group-data-[collapsible=icon]:hidden">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={isItemActive(item.url)}
                    className={cn(
                      "transition-all duration-200 h-11 rounded-xl font-bold px-4",
                      isItemActive(item.url) ? "bg-white text-primary" : "text-white hover:bg-white/10"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2 group-data-[collapsible=icon]:hidden">Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isItemActive('/accounts')} className={cn("h-11 rounded-xl font-bold px-4", isItemActive('/accounts') ? "bg-white text-primary" : "text-white")}>
                    <Link href="/accounts">
                      <UserCheck className="w-5 h-5" />
                      <span>Répertoire</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2 group-data-[collapsible=icon]:hidden">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isItemActive(item.url)} className={cn("h-11 rounded-xl font-bold px-4", isItemActive(item.url) ? "bg-white text-primary" : "text-white")}>
                    <Link href={item.url}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-sidebar border-t border-white/5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/settings'} className={cn("h-11 rounded-xl font-bold px-4", pathname === '/settings' ? "bg-white text-primary" : "text-white")}>
              <Link href="/settings">
                <Settings className="w-5 h-5" />
                <span>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
