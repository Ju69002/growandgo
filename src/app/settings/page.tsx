
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <Settings className="w-20 h-20 text-primary opacity-20 mb-4" />
        <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Paramètres du Compte</h1>
        <p className="text-muted-foreground font-medium max-w-md">Personnalisez vos préférences de notification et votre profil utilisateur.</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mt-8">Configuration en cours</p>
      </div>
    </DashboardLayout>
  );
}
