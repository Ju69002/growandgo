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
  FileText,
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
import { User } from '@/lib/types';
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
  const isSuperAdmin = profile?.role === 'super_admin';

  const mainItems = [
    { title: 'Dashboard', icon: LayoutDashboard, url: '/' },
    { title: 'Documents', icon: FileText, url: '/documents' },
    { title: 'Équipe', icon: Users, url: '/team' },
  ];

  const configItems = [
    { title: 'Entreprise', icon: Building2, url: '/company' },
    { title: 'Modules', icon: Briefcase, url: '/modules' },
    { title: 'Abonnement', icon: CreditCard, url: '/billing' },
    { title: 'Sécurité & Sync', icon: KeyRound, url: '/settings/security' },
  ];

  const isItemActive = (url: string) => {
    if (url === '/' && pathname !== '/') return false;
    return pathname === url || pathname.startsWith(url + '/');
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-20 flex items-center px-4 bg-sidebar">
        <div className="flex items-center gap-3 font-bold text-sidebar-foreground">
          <div className="relative w-12 h-12 overflow-hidden rounded-lg border border-white/20 shadow-xl bg-white">
            <Image 
              src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
              alt="Grow&Go Logo" 
              fill
              className="object-cover p-0.5"
              data-ai-hint="design studio logo"
            />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg leading-tight tracking-tight">Grow&Go</span>
            <span className="text-[10px] uppercase tracking-widest opacity-70 font-medium">Design Studio</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={isItemActive(item.url)}
                    className={cn(
                      "transition-all duration-200 px-4 h-11 rounded-xl mx-2 w-[calc(100%-1rem)]",
                      isItemActive(item.url) 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-lg" 
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon className={cn("w-5 h-5", isItemActive(item.url) ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60")} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    asChild 
                    tooltip="Gestion des Comptes" 
                    isActive={isItemActive('/accounts')}
                    className={cn(
                      "transition-all duration-200 px-4 h-11 rounded-xl mx-2 w-[calc(100%-1rem)]",
                      isItemActive('/accounts') 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-lg" 
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href="/accounts">
                      <UserCheck className={cn("w-5 h-5", isItemActive('/accounts') ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60")} />
                      <span>Comptes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 font-bold uppercase text-[10px] tracking-widest px-4 mb-2">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    tooltip={item.title} 
                    isActive={isItemActive(item.url)}
                    className={cn(
                      "transition-all duration-200 px-4 h-11 rounded-xl mx-2 w-[calc(100%-1rem)]",
                      isItemActive(item.url) 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-lg" 
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={item.url}>
                      <item.icon className={cn("w-5 h-5", isItemActive(item.url) ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60")} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 bg-sidebar border-t border-sidebar-border/30">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              isActive={isItemActive('/settings')}
              className={cn(
                "transition-all duration-200 px-4 h-11 rounded-xl mx-2 w-[calc(100%-1rem)]",
                isItemActive('/settings') 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-lg" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Link href="/settings">
                <Settings className={cn("w-5 h-5", isItemActive('/settings') ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/60")} />
                <span>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
