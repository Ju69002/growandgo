
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
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const mainItems = [
  { title: 'Dashboard', icon: LayoutDashboard, url: '/' },
  { title: 'Documents', icon: FileText, url: '#' },
  { title: 'Équipe', icon: Users, url: '#' },
];

const configItems = [
  { title: 'Entreprise', icon: Building2, url: '#' },
  { title: 'Modules', icon: Briefcase, url: '#' },
  { title: 'Abonnement', icon: CreditCard, url: '#' },
  { title: 'Sécurité', icon: ShieldCheck, url: '#' },
];

export function AppSidebar() {
  const logo = PlaceHolderImages.find(img => img.id === 'app-logo');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-20 flex items-center px-4">
        <div className="flex items-center gap-3 font-bold text-sidebar-foreground">
          <div className="relative w-10 h-10 overflow-hidden rounded-xl border border-white/10 shadow-lg bg-white/5">
            <Image 
              src={logo?.imageUrl || "https://picsum.photos/seed/growgo/100/100"} 
              alt="Grow&Go Logo" 
              fill
              className="object-contain p-1"
              data-ai-hint="green leaf logo"
            />
          </div>
          <span className="group-data-[collapsible=icon]:hidden text-lg tracking-tight">Grow&Go</span>
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
