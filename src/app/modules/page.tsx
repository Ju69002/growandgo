
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Briefcase } from 'lucide-react';

export default function ModulesPage() {
  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8 text-center flex flex-col items-center justify-center min-h-[60vh]">
        <Briefcase className="w-20 h-20 text-primary opacity-20 mb-4" />
        <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Modules & Extensions</h1>
        <p className="text-muted-foreground font-medium max-w-md">Activez des fonctionnalités avancées comme la RH, la Finance ou la Signature électronique.</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mt-8">Module en cours de finalisation</p>
      </div>
    </DashboardLayout>
  );
}
