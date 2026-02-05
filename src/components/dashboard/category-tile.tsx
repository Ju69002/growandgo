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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  const [isRenameOpen, setIsRenameOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [newLabel, setNewLabel] = React.useState(label);

  const toggleVisibility = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!db || !companyId) return;
    const categoryRef = doc(db, 'companies', companyId, 'categories', id);
    updateDocumentNonBlocking(categoryRef, { visibleToEmployees: !isVisible });
  };

  const handleRenameSubmit = () => {
    if (newLabel && newLabel !== label && db && companyId) {
      const categoryRef = doc(db, 'companies', companyId, 'categories', id);
      updateDocumentNonBlocking(categoryRef, { label: newLabel });
      setIsRenameOpen(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (db && companyId) {
      const categoryRef = doc(db, 'companies', companyId, 'categories', id);
      deleteDocumentNonBlocking(categoryRef);
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      <Card className={cn(
        "relative group overflow-hidden border-none shadow-md transition-all hover:shadow-lg bg-card h-full",
        !isVisible && !isAdminMode && "hidden",
        !isVisible && isAdminMode && "opacity-60"
      )}>
        <CardContent className="p-6 h-full flex flex-col">
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

          <div className="space-y-1 flex-1">
            <h3 className="text-xl font-bold tracking-tight text-foreground">{label}</h3>
            <p className="text-sm text-muted-foreground">
              {badgeCount > 0 
                ? `${badgeCount} actions en attente` 
                : "Tout est à jour"}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button asChild variant="link" className="p-0 text-primary font-semibold group/link h-auto">
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
                  title={isVisible ? "Masquer pour les employés" : "Afficher pour les employés"}
                >
                  {isVisible ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full hover:bg-muted"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewLabel(label);
                    setIsRenameOpen(true);
                  }}
                  title="Renommer la tuile"
                >
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8 rounded-full hover:bg-destructive/10 text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDeleteOpen(true);
                  }}
                  title="Supprimer la tuile"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fenêtre de modification du nom */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Renommer la catégorie</DialogTitle>
            <DialogDescription>
              Modifiez le nom affiché pour la tuile "{label}".
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid items-center gap-4">
              <Label htmlFor="name">Nouveau nom</Label>
              <Input
                id="name"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Annuler</Button>
            <Button onClick={handleRenameSubmit}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fenêtre de confirmation de suppression */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer "{label}" ? Toutes les données liées à cette catégorie seront inaccessibles. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}