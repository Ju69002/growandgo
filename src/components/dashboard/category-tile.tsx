'use client';

import * as React from 'react';
import { LucideIcon, Eye, EyeOff, Edit3, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';

interface CategoryTileProps {
  id: string;
  label: string;
  icon: LucideIcon;
  badgeCount: number;
  isVisible: boolean;
  isAdminMode: boolean;
  colorClass: string;
  companyId: string;
}

export function CategoryTile({
  id,
  label,
  icon: Icon,
  badgeCount,
  isVisible,
  isAdminMode,
  colorClass,
  companyId
}: CategoryTileProps) {
  const db = useFirestore();

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!db) return;
    const categoryRef = doc(db, 'companies', companyId, 'categories', id);
    updateDocumentNonBlocking(categoryRef, { visibleToEmployees: !isVisible });
  };

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newName = prompt('Nouveau nom pour la catégorie :', label);
    if (newName && newName !== label && db) {
      const categoryRef = doc(db, 'companies', companyId, 'categories', id);
      updateDocumentNonBlocking(categoryRef, { label: newName });
    }
  };

  return (
    <Card className={cn(
      "relative group overflow-hidden border-none shadow-md transition-all hover:shadow-lg bg-card",
      !isVisible && !isAdminMode && "hidden",
      !isVisible && isAdminMode && "opacity-60"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-8">
          <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-105", colorClass)}>
            <Icon className="w-8 h-8" />
          </div>
          {badgeCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground font-bold px-2.5 py-1 rounded-lg animate-in zoom-in">
              {badgeCount}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight text-foreground">{label}</h3>
          <p className="text-sm text-muted-foreground">
            {badgeCount > 0 
              ? `${badgeCount} actions en attente` 
              : "Tout est à jour"}
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button asChild variant="link" className="p-0 text-primary font-semibold group/link">
            <Link href={`/categories/${id}`} className="flex items-center gap-2">
              Explorer
              <ArrowRight className="w-4 h-4 group-hover/link:translate-x-1 transition-transform" />
            </Link>
          </Button>

          {isAdminMode && (
            <div className="flex items-center gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={toggleVisibility}
                title={isVisible ? "Masquer pour les employés" : "Rendre visible pour les employés"}
              >
                {isVisible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={handleRename}
                title="Renommer la tuile"
              >
                <Edit3 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
