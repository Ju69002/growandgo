import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { CategoryTiles } from '@/components/dashboard/category-tiles';
import { ShieldCheck, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Home() {
  // Mocking session and context for the demo
  const userRole = 'admin'; // Simulated role
  const adminMode = true; // Simulated admin_mode

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-primary">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Bienvenue sur BusinessPilot. Gérez vos documents et vos opérations en un seul endroit.
            </p>
          </div>
          {userRole === 'admin' && (
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full border border-primary/20">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-semibold">Mode Architecte {adminMode ? 'Activé' : 'Désactivé'}</span>
            </div>
          )}
        </header>

        {adminMode && (
          <Alert className="bg-teal-50 border-teal-200">
            <Info className="h-4 w-4 text-teal-600" />
            <AlertTitle className="text-teal-800">Mode Architecte</AlertTitle>
            <AlertDescription className="text-teal-700">
              Vous pouvez maintenant modifier les étiquettes des tuiles et leur visibilité pour vos employés.
            </AlertDescription>
          </Alert>
        )}

        <CategoryTiles isAdminMode={adminMode} />
      </div>
    </DashboardLayout>
  );
}