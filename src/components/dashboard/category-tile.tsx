'use client';

import * as React from 'react';
import { LucideIcon, Eye, EyeOff, Edit3, ArrowRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useFirestore, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CategoryTileProps {
  id: string;
  label: string;
  icon: LucideIcon;
  badgeCount: number;
  isVisible: boolean;
  isAdminMode: boolean;
  canModify: boolean;
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
  canModify,
  colorClass,
  companyId,
}: CategoryTileProps) {
  const db = useFirestore();
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState(label);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!db || !companyId || !isAdminMode) return;
    const categoryRef = doc(db, 'companies', companyId, 'categories', id);
    updateDocumentNonBlocking(categoryRef, { visibleToEmployees: !isVisible });
  };

  const handleRenameSubmit = () => {
    if (newLabel && newLabel !== label && db && companyId && canModify) {
      const categoryRef = doc(db, 'companies', companyId, 'categories', id);
      updateDocumentNonBlocking(categoryRef, { label: newLabel });
      setIsRenameOpen(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (db && companyId && canModify) {
      const categoryRef = doc(db, 'companies', companyId, 'categories', id);
      deleteDocumentNonBlocking(categoryRef);
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      <Card className={cn(
        "relative group overflow-hidden border-none shadow-md transition-all hover:shadow-lg h-full min-h-[220px] bg-white",
        !isVisible && !isAdminMode && "hidden",
        !isVisible && isAdminMode && "opacity-60 grayscale-[0.5]"
      )}>
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex items-start justify-between mb-8">
            <div className={cn(
              "p-4 rounded-2xl transition-transform group-hover:scale-110 shadow-sm", 
              colorClass
            )}>
              <Icon className="w-8 h-8" />
            </div>
            {badgeCount > 0 && (
              <Badge className="bg-destructive text-destructive-foreground font-black px-2.5 py-1 rounded-lg animate-in zoom-in uppercase text-[10px]">
                {badgeCount} ALERTES
              </Badge>
            )}
          </div>

          <div className="space-y-1 flex-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">{label}</h3>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              {badgeCount > 0 
                ? `${badgeCount} documents à traiter` 
                : "Dossier à jour"}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button asChild variant="link" className="p-0 font-black uppercase text-[11px] tracking-widest group/link h-auto text-primary">
              <Link href={`/categories/${id}`} className="flex items-center gap-2">
                Ouvrir
                <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
              </Link>
            </Button>

            {isAdminMode && (
              <div className="flex items-center gap-1.5 bg-black/5 p-1 rounded-full">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-7 w-7 rounded-full hover:bg-black/10"
                  onClick={toggleVisibility}
                  title={isVisible ? "Masquer pour les employés" : "Rendre visible pour les employés"}
                >
                  {isVisible ? <Eye className="h-3.5 h-3.5" /> : <EyeOff className="h-3.5 h-3.5" />}
                </Button>
                
                {canModify && (
                  <>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 rounded-full hover:bg-black/10"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setNewLabel(label);
                        setIsRenameOpen(true);
                      }}
                    >
                      <Edit3 className="h-3.5 h-3.5" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 rounded-full hover:bg-destructive/10 text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 h-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Renommer la catégorie</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>Nouveau nom</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Annuler</Button>
            <Button onClick={handleRenameSubmit}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>Toutes les données associées seront définitivement supprimées.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-white hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
