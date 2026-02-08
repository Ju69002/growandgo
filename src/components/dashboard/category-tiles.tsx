'use client';

import * as React from 'react';
import { CategoryTile } from './category-tile';
import { 
  CreditCard, 
  FileText, 
  Users, 
  Calendar, 
  Plus, 
  LayoutGrid,
  Briefcase,
  Megaphone,
  Package,
  Scale,
  ShieldCheck,
  Wand2,
  Loader2
} from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CategoryTilesProps {
  profile: User;
}

const ICON_MAP: Record<string, any> = {
  finance: CreditCard,
  admin: FileText,
  rh: Users,
  agenda: Calendar,
  juridique: Scale,
  marketing: Megaphone,
  fournisseurs: Package,
  travail: Briefcase,
  commercial: Briefcase,
  securite: ShieldCheck,
  default: LayoutGrid
};

const COLOR_MAP: Record<string, string> = {
  finance: 'text-emerald-600 bg-emerald-50',
  juridique: 'text-blue-600 bg-blue-50',
  rh: 'text-indigo-600 bg-indigo-50',
  agenda: 'text-amber-600 bg-amber-50',
  marketing: 'text-purple-600 bg-purple-50',
  fournisseurs: 'text-orange-600 bg-orange-50',
  commercial: 'text-slate-600 bg-slate-50',
  default: 'text-gray-600 bg-gray-50'
};

export function CategoryTiles({ profile }: CategoryTilesProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = React.useState(false);
  const companyId = profile.companyId;

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'categories'),
      where('companyId', '==', companyId)
    );
  }, [db, companyId]);

  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  const handleInitialize = async () => {
    if (!db || !companyId) return;
    setIsInitializing(true);

    const defaultCategories = [
      { id: 'agenda', label: 'Agenda Équipe', icon: 'agenda', subCategories: [] },
      { 
        id: 'finance', 
        label: 'Finances & comptabilité', 
        icon: 'finance', 
        subCategories: ["Factures Ventes", "Factures Achats", "Relevés Bancaires", "TVA & Impôts"] 
      },
      { 
        id: 'juridique', 
        label: 'Juridique & Administratif', 
        icon: 'juridique', 
        subCategories: ["Statuts & KBis", "Assurances", "Contrats de bail", "PV Assemblée"] 
      },
      { 
        id: 'commercial', 
        label: 'Commercial & Clients', 
        icon: 'travail', 
        subCategories: ["Devis", "Contrats Clients", "Fiches Prospects", "Appels d'offres"] 
      },
      { 
        id: 'fournisseurs', 
        label: 'Fournisseurs & Achats', 
        icon: 'fournisseurs', 
        subCategories: ["Contrats Fournisseurs", "Bons de commande", "Bons de livraison"] 
      },
      { 
        id: 'rh', 
        label: 'Ressources Humaines (RH)', 
        icon: 'rh', 
        subCategories: ["Contrats de travail", "Bulletins de paie", "Mutuelle & Prévoyance", "Congés"] 
      },
      { 
        id: 'marketing', 
        label: 'Communication & Marketing', 
        icon: 'marketing', 
        subCategories: ["Identité visuelle", "Campagnes Pub", "Réseaux Sociaux", "Presse"] 
      }
    ];

    try {
      for (const cat of defaultCategories) {
        const catRef = doc(db, 'companies', companyId, 'categories', cat.id);
        setDocumentNonBlocking(catRef, {
          id: cat.id,
          label: cat.label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'standard',
          companyId: companyId,
          icon: cat.icon,
          subCategories: cat.subCategories || []
        }, { merge: true });
      }
      toast({ title: "Studio initialisé !", description: "Tous vos dossiers ont été créés." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'initialiser les dossiers." });
    } finally {
      setIsInitializing(false);
    }
  };

  if (isLoading || !companyId) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const isAdminOrSuper = profile.role === 'admin' || profile.role === 'super_admin';

  // Filtrer l'agenda car il est affiché en haut du dashboard désormais
  const displayableCategories = (categories || []).filter(cat => {
    if (cat.id === 'agenda') return false; 
    if (isAdminOrSuper) return true;
    return cat.visibleToEmployees === true;
  });

  const sortedCategories = [...displayableCategories].sort((a, b) => {
    if (a.type === 'standard' && b.type !== 'standard') return -1;
    if (a.type !== 'standard' && b.type === 'standard') return 1;
    return a.label.localeCompare(b.label);
  });

  const isStudioIncomplete = isAdminOrSuper && (categories || []).length < 5;

  return (
    <div className="space-y-8">
      {isStudioIncomplete && (
        <div className="bg-primary/5 border-2 border-dashed border-primary/20 p-8 rounded-[2rem] text-center space-y-4 animate-in fade-in slide-in-from-top-4">
          <Wand2 className="w-12 h-12 text-primary mx-auto opacity-40" />
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-primary">Initialisez votre Studio</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Configurez instantanément vos 7 dossiers experts (RH, Finance, Juridique...) et votre Agenda.</p>
          </div>
          <Button 
            onClick={handleInitialize} 
            disabled={isInitializing}
            className="rounded-full bg-primary hover:bg-primary/90 h-12 px-8 font-bold shadow-lg"
          >
            {isInitializing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Générer la structure standard
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedCategories.map((category) => {
          const iconKey = (category.icon || category.id).toLowerCase();
          const Icon = ICON_MAP[iconKey] || ICON_MAP.default;
          
          return (
            <CategoryTile
              key={category.id}
              id={category.id}
              label={category.label}
              icon={Icon}
              badgeCount={category.badgeCount || 0}
              isVisible={category.visibleToEmployees}
              isAdminMode={isAdminOrSuper}
              canModify={isAdminOrSuper}
              colorClass={COLOR_MAP[category.id] || COLOR_MAP[iconKey] || COLOR_MAP.default}
              companyId={companyId}
            />
          );
        })}
        
        {isAdminOrSuper && (
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-chat-category-creation'));
            }}
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/20 rounded-[2rem] hover:bg-muted/50 hover:border-primary/50 transition-all group h-full min-h-[220px]"
          >
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 transition-transform">
              <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
            </div>
            <span className="font-bold text-muted-foreground group-hover:text-primary text-center text-sm uppercase tracking-widest">Nouveau Dossier</span>
            <span className="text-[10px] text-muted-foreground mt-1 text-center font-medium">L'IA créera ce dossier pour toute l'équipe</span>
          </button>
        )}
      </div>
    </div>
  );
}
