'use client';

import * as React from 'react';
import { CategoryTile } from './category-tile';
import { 
  CreditCard, 
  FileText, 
  Users, 
  Calendar, 
  PenTool, 
  Plus, 
  LayoutGrid,
  Home,
  Briefcase,
  Settings,
  Bell,
  Scale,
  HardHat,
  ShieldCheck
} from 'lucide-react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Category, User } from '@/lib/types';

interface CategoryTilesProps {
  profile: User;
}

const ICON_MAP: Record<string, any> = {
  finance: CreditCard,
  admin: FileText,
  rh: Users,
  agenda: Calendar,
  signatures: PenTool,
  maison: Home,
  home: Home,
  travail: Briefcase,
  work: Briefcase,
  juridique: Scale,
  legal: Scale,
  chantier: HardHat,
  construction: HardHat,
  securite: ShieldCheck,
  parametres: Settings,
  settings: Settings,
  notifications: Bell,
  default: LayoutGrid
};

const COLOR_MAP: Record<string, string> = {
  finance: 'text-emerald-600 bg-emerald-50',
  admin: 'text-blue-600 bg-blue-50',
  rh: 'text-indigo-600 bg-indigo-50',
  agenda: 'text-amber-600 bg-amber-50',
  signatures: 'text-purple-600 bg-purple-50',
  juridique: 'text-slate-600 bg-slate-50',
  travail: 'text-orange-600 bg-orange-50',
  default: 'text-gray-600 bg-gray-50'
};

export function CategoryTiles({ profile }: CategoryTilesProps) {
  const db = useFirestore();
  const companyId = profile.companyId;

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(
      collection(db, 'companies', companyId, 'categories'),
      where('companyId', '==', companyId)
    );
  }, [db, companyId]);

  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

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

  const displayableCategories = (categories || []).filter(cat => {
    if (isAdminOrSuper) return true;
    return cat.visibleToEmployees === true;
  });

  const sortedCategories = [...displayableCategories].sort((a, b) => {
    if (a.id === 'agenda') return -1;
    if (a.type === 'standard' && b.type !== 'standard') return -1;
    if (a.type !== 'standard' && b.type === 'standard') return 1;
    return a.label.localeCompare(b.label);
  });

  return (
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
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/20 rounded-2xl hover:bg-muted/50 hover:border-primary/50 transition-all group h-full min-h-[220px]"
        >
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 transition-transform">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="font-bold text-muted-foreground group-hover:text-primary text-center text-sm uppercase tracking-widest">Nouveau Dossier</span>
          <span className="text-[10px] text-muted-foreground mt-1 text-center font-medium">L'IA créera ce dossier pour toute l'équipe</span>
        </button>
      )}
    </div>
  );
}
