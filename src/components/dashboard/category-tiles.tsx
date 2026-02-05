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
  FolderLock
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CategoryTilesProps {
  isAdminMode: boolean;
}

const MOCK_CATEGORIES = [
  { id: 'finance', label: 'Finances', icon: CreditCard, badgeCount: 3, visible: true, color: 'text-emerald-600 bg-emerald-50' },
  { id: 'admin', label: 'Administratif', icon: FileText, badgeCount: 12, visible: true, color: 'text-blue-600 bg-blue-50' },
  { id: 'rh', label: 'Ressources Humaines', icon: Users, badgeCount: 0, visible: true, color: 'text-indigo-600 bg-indigo-50' },
  { id: 'agenda', label: 'Agenda & Échéances', icon: Calendar, badgeCount: 5, visible: true, color: 'text-amber-600 bg-amber-50' },
  { id: 'signatures', label: 'Signatures', icon: PenTool, badgeCount: 2, visible: true, color: 'text-purple-600 bg-purple-50' },
  { id: 'custom_cee', label: 'Dossiers CEE', icon: FolderLock, badgeCount: 8, visible: false, color: 'text-teal-600 bg-teal-50' },
];

export function CategoryTiles({ isAdminMode }: CategoryTilesProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {MOCK_CATEGORIES.map((category) => (
        <CategoryTile
          key={category.id}
          id={category.id}
          label={category.label}
          icon={category.icon}
          badgeCount={category.badgeCount}
          isVisible={category.visible}
          isAdminMode={isAdminMode}
          colorClass={category.color}
        />
      ))}
      
      {isAdminMode && (
        <button className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl hover:bg-muted/50 transition-colors group">
          <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <span className="font-medium text-muted-foreground">Nouvelle Catégorie</span>
          <span className="text-xs text-muted-foreground mt-1">(Super Admin Uniquement)</span>
        </button>
      )}
    </div>
  );
}