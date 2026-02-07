
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
  ShieldCheck,
  Briefcase,
  KeyRound,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';

export function AppSidebar() {
  const { user } = useUser();
  const db = useFirestore();
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  const userRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userRef);
  const isSuperAdmin = profile?.role === 'super_admin';

  const mainItems = [
    { title: 'Dashboard', icon: LayoutDashboard, url: '/' },
    { title: 'Documents', icon: FileText, url: '#' },
    { title: 'Équipe', icon: Users, url: '#' },
  ];

  const configItems = [
    { title: 'Entreprise', icon: Building2, url: '#' },
    { title: 'Modules', icon: Briefcase, url: '#' },
    { title: 'Abonnement', icon: CreditCard, url: '#' },
    { title: 'Sécurité & Sync', icon: KeyRound, url: '/settings/security' },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-20 flex items-center px-4">
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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Link href={item.url}>
                      <item.icon />
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
            <SidebarGroupLabel className="text-sidebar-foreground/50">Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Comptes" className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-emerald-400 font-bold">
                    <Link href="/accounts">
                      <UserCheck className="w-5 h-5" />
                      <span>Comptes</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50">Configuration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title} className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <Link href="#">
                <Settings />
                <span>Paramètres</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
