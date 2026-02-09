
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
  Building2,
  Briefcase,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User, Company } from '@/lib/types';
import { cn, normalizeId } from '@/lib/utils';

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

  const isSuperAdmin = profile?.role === 'super_admin' || profile?.companyId === 'admin_global';
  const isParticulier = profile?.role === 'particulier';
  
  let displayName = company?.name || profile?.companyName || profile?.companyId || "GROW&GO";
  if (isParticulier) displayName = "Mon Espace Privé";

  const mainItems = [
    { title: 'Tableau de bord', icon: LayoutDashboard, url: '/' },
    ...(!isSuperAdmin ? [{ 
      title: isParticulier ? 'Mes Accès' : 'Équipe', 
      icon: Users, 
      url: '/team' 
    }] : []),
  ];

  const configItems = [
    { title: 'Abonnement', icon: CreditCard, url: '/billing' },
    { title: 'Sécurité & Sync', icon: KeyRound, url: '/settings/security' },
  ];

  const isItemActive = (url: string, exact = false) => {
    if (url === '/' && pathname !== '/') return false;
    if (exact) return pathname === url;
    // For non-exact matches, we ensure it's either the exact path or a subpath
    return pathname === url || pathname.startsWith(url + '/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 z-50">
      <SidebarHeader className="h-20 flex items-center justify-center group-data-[collapsible=icon]:p-2 p-4 bg-sidebar">
        <div className="flex items-center gap-3 font-bold text-sidebar-foreground w-full">
          <div className="relative w-10 h-10 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 overflow-hidden rounded-lg border border-white/20 shadow-xl bg-white shrink-0 mx-auto transition-all">
            <Image 
              src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
              alt="Logo" 
              fill
              className="object-cover p-0.5"
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden max-w-[160px] flex-1">
            <span className="text-sm font-black uppercase leading-tight tracking-tighter text-white truncate">
              {displayName}
            </span>
            <span className="text-[9px] uppercase tracking-widest opacity-50 font-black text-white truncate">
              {isSuperAdmin ? "Administration" : isParticulier ? "Confidentiel" : "Espace de travail"}
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2 group-data-[collapsible=icon]:hidden">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const active = isItemActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title} 
                      isActive={active}
                      className={cn(
                        "transition-all duration-200 h-11 rounded-xl font-bold px-4",
                        active 
                          ? "bg-white text-primary shadow-lg hover:bg-white hover:text-primary" 
                          : "text-white hover:bg-white/10",
                        "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center"
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon className={cn("w-5 h-5 shrink-0", active ? "text-primary" : "text-white")} />
                        <span className={cn("group-data-[collapsible=icon]:hidden", active ? "text-primary" : "text-white")}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-white/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2 group-data-[collapsible=icon]:hidden">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    tooltip="Gestion des Comptes" 
                    isActive={isItemActive('/accounts')}
                    className={cn(
                      "transition-all duration-200 h-11 rounded-xl font-bold px-4",
                      isItemActive('/accounts') 
                        ? "bg-white text-primary shadow-lg hover:bg-white hover:text-primary" 
                        : "text-white hover:bg-white/10",
                      "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center"
                    )}
                  >
                    <Link href="/accounts">
                      <UserCheck className={cn("w-5 h-5 shrink-0", isItemActive('/accounts') ? "text-primary" : "text-white")} />
                      <span className={cn("group-data-[collapsible=icon]:hidden", isItemActive('/accounts') ? "text-primary" : "text-white")}>Répertoire</span>
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
              {configItems.map((item) => {
                const active = isItemActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      tooltip={item.title} 
                      isActive={active}
                      className={cn(
                        "transition-all duration-200 h-11 rounded-xl font-bold px-4",
                        active 
                          ? "bg-white text-primary shadow-lg hover:bg-white hover:text-primary" 
                          : "text-white hover:bg-white/10",
                        "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center"
                      )}
                    >
                      <Link href={item.url}>
                        <item.icon className={cn("w-5 h-5 shrink-0", active ? "text-primary" : "text-white")} />
                        <span className={cn("group-data-[collapsible=icon]:hidden", active ? "text-primary" : "text-white")}>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-sidebar border-t border-sidebar-border/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={isItemActive('/settings', true)}
              className={cn(
                "transition-all duration-200 h-11 rounded-xl font-bold px-4",
                isItemActive('/settings', true) 
                  ? "bg-white text-primary shadow-lg hover:bg-white hover:text-primary" 
                  : "text-white hover:bg-white/10",
                "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center"
              )}
            >
              <Link href="/settings">
                <Settings className={cn("w-5 h-5 shrink-0", isItemActive('/settings', true) ? "text-primary" : "text-white")} />
                <span className={cn("group-data-[collapsible=icon]:hidden", isItemActive('/settings', true) ? "text-primary" : "text-white")}>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
