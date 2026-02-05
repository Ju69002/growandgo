
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
  FolderLock,
  LayoutGrid
} from 'lucide-react';
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Category, User } from '@/lib/types';

interface CategoryTilesProps {
  isAdminMode: boolean;
}

const ICON_MAP: Record<string, any> = {
  finance: CreditCard,
  admin: FileText,
  rh: Users,
  agenda: Calendar,
  signatures: PenTool,
  custom_cee: FolderLock,
  default: LayoutGrid
};

const COLOR_MAP: Record<string, string> = {
  finance: 'text-emerald-600 bg-emerald-50',
  admin: 'text-blue-600 bg-blue-50',
  rh: 'text-indigo-600 bg-indigo-50',
  agenda: 'text-amber-600 bg-amber-50',
  signatures: 'text-purple-600 bg-purple-50',
  custom_cee: 'text-teal-600 bg-teal-50',
  default: 'text-gray-600 bg-gray-50'
};

export function CategoryTiles({ isAdminMode }: CategoryTilesProps) {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const categoriesQuery = useMemoFirebase(() => {
    // CRITICAL: Only run query if profile and companyId are available to avoid permission errors
    if (!db || !user || !profile || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, user, profile, companyId]);

  const { data: categories, isLoading } = useCollection<Category>(categoriesQuery);

  if (isLoading || !profile || !companyId) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {categories?.map((category) => (
        <CategoryTile
          key={category.id}
          id={category.id}
          label={category.label}
          icon={ICON_MAP[category.id] || ICON_MAP.default}
          badgeCount={category.badgeCount || 0}
          isVisible={category.visibleToEmployees}
          isAdminMode={isAdminMode}
          colorClass={COLOR_MAP[category.id] || COLOR_MAP.default}
          companyId={companyId}
        />
      ))}
      
      {isAdminMode && (
        <button 
          onClick={() => {
            window.dispatchEvent(new CustomEvent('open-chat-category-creation'));
          }}
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/20 rounded-2xl hover:bg-muted/50 hover:border-primary/50 transition-all group"
        >
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 transition-transform">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
          </div>
          <span className="font-medium text-muted-foreground group-hover:text-primary">Nouvelle Catégorie</span>
          <span className="text-xs text-muted-foreground mt-1">(Dites à l'IA de créer une tuile)</span>
        </button>
      )}
    </div>
  );
}
