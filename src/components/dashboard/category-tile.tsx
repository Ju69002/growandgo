'use client';

import * as React from 'react';
import { LucideIcon, Eye, EyeOff, Edit3, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CategoryTileProps {
  id: string;
  label: string;
  icon: LucideIcon;
  badgeCount: number;
  isVisible: boolean;
  isAdminMode: boolean;
  colorClass: string;
}

export function CategoryTile({
  id,
  label,
  icon: Icon,
  badgeCount,
  isVisible,
  isAdminMode,
  colorClass
}: CategoryTileProps) {
  return (
    <Card className={cn(
      "relative group overflow-hidden border-none shadow-md transition-all hover:shadow-lg",
      !isVisible && !isAdminMode && "hidden",
      !isVisible && isAdminMode && "opacity-60 grayscale-[0.5]"
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-8">
          <div className={cn("p-4 rounded-2xl", colorClass)}>
            <Icon className="w-8 h-8" />
          </div>
          {badgeCount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground font-bold px-2.5 py-1 rounded-lg">
              {badgeCount}
            </Badge>
          )}
        </div>

        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight">{label}</h3>
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
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                <Edit3 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}