
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  useFirestore, 
  useCollection, 
  useUser, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { User, UserRole } from '@/lib/types';
import { 
  ShieldCheck, 
  Trash2, 
  Key, 
  ShieldAlert, 
  UserCog, 
  Loader2,
  Edit2,
  Building,
  Ban,
  CheckCircle2,
  Calendar,
  UserCircle,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, normalizeId } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  
  // States pour les dialogues partagés
  const [editingPasswordUser, setEditingPasswordUser] = useState<User | null>(null);
  const [editingCompanyUser, setEditingCompanyUser] = useState<User | null>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [roleCompanyInput, setRoleCompanyInput] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: myProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);
  
  const isSuperAdmin = !isProfileLoading && myProfile?.role === 'super_admin';

  const profilesQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allProfiles, isLoading: isUsersLoading } = useCollection<User>(profilesQuery);

  // Mémoïsation de la liste unique avec nettoyage des noms d'entreprise
  const uniqueUsers = useMemo(() => {
    if (!allProfiles) return [];
    return Array.from(
      new Map(
        allProfiles
          .filter(u => u.loginId || u.loginId_lower)
          .sort((a, b) => (a.isProfile ? 1 : -1))
          .map(u => {
            const lowerId = (u.loginId_lower || u.loginId?.toLowerCase());
            let finalUser = { ...u };
            
            if (lowerId === 'jsecchi') {
              finalUser.companyName = "GrowAndGo";
              finalUser.companyId = "GrowAndGo";
            } else if (u.role === 'particulier') {
              finalUser.companyName = "Espace Privé";
            } else if (!u.companyName && u.companyId) {
              // Restauration visuelle si le nom est manquant mais l'ID existe
              finalUser.companyName = u.companyId;
            }
            
            return [lowerId, finalUser];
          })
      ).values()
    ).sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
  }, [allProfiles]);

  const updateAllUserDocs = async (loginId: string, updates: Partial<User>) => {
    if (!db || !allProfiles) return;
    const lowerId = loginId.toLowerCase();
    const related = allProfiles.filter(u => (u.loginId_lower === lowerId) || (u.loginId?.toLowerCase() === lowerId));
    related.forEach(uDoc => {
      const ref = doc(db, 'users', uDoc.uid);
      updateDocumentNonBlocking(ref, { ...updates });
    });
  };

  const handleDeleteUser = () => {
    if (!db || !allProfiles || !deletingUser) return;
    const loginId = deletingUser.loginId;
    const lowerId = loginId.toLowerCase();
    const related = allProfiles.filter(u => (u.loginId_lower === lowerId) || (u.loginId?.toLowerCase() === lowerId));
    related.forEach(uDoc => {
      const ref = doc(db, 'users', uDoc.uid);
      deleteDocumentNonBlocking(ref);
    });
    toast({ title: "Compte supprimé" });
    setDeletingUser(null);
  };

  const toggleSubscription = (loginId: string, currentStatus?: string) => {
    const newStatus = currentStatus === 'inactive' ? 'active' : 'inactive';
    updateAllUserDocs(loginId, { subscriptionStatus: newStatus as any });
    toast({ 
      title: newStatus === 'active' ? "Accès rétabli" : "Accès suspendu",
      description: `L'abonnement de ${loginId} est désormais ${newStatus === 'active' ? 'actif' : 'inactif'}.`
    });
  };

  const handleUpdatePassword = () => {
    if (!db || !editingPasswordUser || !newPassword.trim()) return;
    updateAllUserDocs(editingPasswordUser.loginId, { password: newPassword.trim() });
    toast({ title: "Mot de passe modifié" });
    setEditingPasswordUser(null);
  };

  const handleUpdateCompany = () => {
    if (!db || !editingCompanyUser || !newCompanyName.trim()) return;
    const newId = normalizeId(newCompanyName);
    updateAllUserDocs(editingCompanyUser.loginId, { 
      companyName: newCompanyName.trim(),
      companyId: newId 
    });
    toast({ title: "Espace mis à jour" });
    setEditingCompanyUser(null);
  };

  const handleUpdateRole = () => {
    if (!db || !editingRoleUser) return;

    const updates: Partial<User> = {
      role: newRole,
      adminMode: newRole !== 'employee',
      isCategoryModifier: newRole !== 'employee'
    };

    // Logique d'isolation Particulier
    if (newRole === 'particulier') {
      updates.companyName = "Mon Espace Personnel";
      updates.companyId = `private-${editingRoleUser.loginId.toLowerCase()}`;
    } else if (editingRoleUser.role === 'particulier' && (newRole === 'admin' || newRole === 'employee')) {
      // Transition depuis Particulier : on force le nom d'entreprise
      if (!roleCompanyInput.trim()) {
        toast({ variant: "destructive", title: "Action requise", description: "Veuillez renseigner le nom de l'entreprise." });
        return;
      }
      updates.companyName = roleCompanyInput.trim();
      updates.companyId = normalizeId(roleCompanyInput);
    }

    updateAllUserDocs(editingRoleUser.loginId, updates);
    toast({ title: "Rôle mis à jour", description: `L'utilisateur est désormais ${newRole.toUpperCase()}.` });
    setEditingRoleUser(null);
    setRoleCompanyInput('');
  };

  if (!mounted || isProfileLoading || isUsersLoading) return <div className="flex items-center justify-center min-h-screen bg-[#F5F2EA]"><Loader2 className="animate-spin text-primary opacity-50" /></div>;

  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] p-8 text-center gap-6"><ShieldAlert className="w-20 h-20 text-primary opacity-20" /><h1 className="text-2xl font-black uppercase tracking-tighter text-primary">Accès Admin Requis</h1><Button onClick={() => window.location.href = '/'}>Retour à l'accueil</Button></div>;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase flex items-center gap-3"><UserCog className="w-10 h-10" />Répertoire</h1>
            <p className="text-muted-foreground font-medium">Gestion globale des accès et des entreprises.</p>
          </div>
          <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary font-bold">{uniqueUsers.length} UTILISATEURS</Badge>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-primary-foreground p-8"><CardTitle className="text-xl flex items-center gap-2"><ShieldCheck className="w-6 h-6" />Gestion des Espaces</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-8">Utilisateur (Nom & Prénom)</TableHead>
                  <TableHead>Entreprise / Créé le</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Abonnement</TableHead>
                  <TableHead>Identifiant (ID)</TableHead>
                  <TableHead className="text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((u) => (
                  <TableRow key={u.uid} className="hover:bg-primary/5 border-b-primary/5">
                    <TableCell className="pl-8 py-6 font-bold text-base text-primary">
                      {u.name || u.loginId}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 group">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-sm font-semibold",
                            u.role === 'particulier' && "text-amber-600 italic"
                          )}>{u.companyName || u.companyId}</span>
                          {u.loginId_lower !== 'jsecchi' && u.role !== 'particulier' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary" 
                              onClick={() => { 
                                setEditingCompanyUser(u); 
                                setNewCompanyName(u.companyName || u.companyId || ''); 
                              }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground">
                          <Calendar className="w-3 h-3 opacity-30" />
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '08/02/2026'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 group">
                        <Badge className={
                          u.role === 'super_admin' ? "bg-rose-950" : 
                          u.role === 'admin' ? "bg-primary" : 
                          u.role === 'particulier' ? "bg-amber-600" :
                          "bg-primary"
                        }>
                          {u.role === 'super_admin' ? 'ADMIN' : u.role === 'admin' ? 'PATRON' : u.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                        </Badge>
                        {u.role !== 'super_admin' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary"
                            onClick={() => {
                              setEditingRoleUser(u);
                              setNewRole(u.role);
                              setRoleCompanyInput(u.role === 'particulier' ? '' : (u.companyName || u.companyId || ''));
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.role !== 'super_admin' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={cn(
                            "rounded-full h-7 px-3 text-[10px] font-black uppercase tracking-widest gap-2",
                            u.subscriptionStatus === 'inactive' ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                          )}
                          onClick={() => toggleSubscription(u.loginId, u.subscriptionStatus)}
                        >
                          {u.subscriptionStatus === 'inactive' ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {u.subscriptionStatus === 'inactive' ? 'Suspendu' : 'Actif'}
                        </Button>
                      ) : (
                        <Badge className="bg-emerald-600 font-black uppercase text-[10px]">TOUJOURS ACTIF</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px] font-black text-primary border-primary/10 bg-primary/5">
                        {u.loginId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <div className="flex items-center justify-end gap-2">
                        {u.role !== 'super_admin' && (
                          <>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="text-primary" 
                               onClick={() => { 
                                 setEditingPasswordUser(u); 
                                 setNewPassword(u.password || ''); 
                               }}
                             >
                               <Key className="w-4 h-4" />
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="text-rose-950" 
                               onClick={() => setDeletingUser(u)}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingPasswordUser} onOpenChange={(open) => !open && setEditingPasswordUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>Mise à jour pour l'utilisateur : <strong>{editingPasswordUser?.loginId}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-4"><Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl h-12 font-bold" /></div>
          <DialogFooter><Button onClick={handleUpdatePassword} className="rounded-full bg-primary">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCompanyUser} onOpenChange={(open) => !open && setEditingCompanyUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier l'entreprise</DialogTitle>
            <DialogDescription>Mise à jour de l'espace de travail pour <strong>{editingCompanyUser?.loginId}</strong>. L'identifiant technique sera synchronisé.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom d'affichage</span>
              <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="rounded-xl h-12 font-bold" />
            </div>
            {newCompanyName && (
              <div className="p-3 bg-muted rounded-xl border border-dashed flex items-center gap-3">
                <Building className="w-4 h-4 text-primary" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase text-muted-foreground">Nouvel ID technique</span>
                  <span className="text-xs font-mono font-bold text-primary">{normalizeId(newCompanyName)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleUpdateCompany} className="rounded-full bg-primary">Mettre à jour & Lier</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRoleUser} onOpenChange={(open) => !open && setEditingRoleUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>Changement des permissions pour <strong>{editingRoleUser?.loginId}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nouveau Rôle</span>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger className="rounded-xl h-12 font-bold">
                  <SelectValue placeholder="Choisir un rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Patron</SelectItem>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="employee">Employé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Champ conditionnel pour le nom d'entreprise lors du passage de Particulier -> Autre */}
            {(editingRoleUser?.role === 'particulier' && (newRole === 'admin' || newRole === 'employee')) && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase text-rose-600 flex items-center gap-2">
                  <AlertTriangle className="w-3 h-3" /> Nom de l'entreprise requis
                </Label>
                <Input 
                  placeholder="Nom de l'entreprise de destination..." 
                  value={roleCompanyInput}
                  onChange={(e) => setRoleCompanyInput(e.target.value)}
                  className="rounded-xl h-12 font-bold border-rose-200"
                />
              </div>
            )}

            <div className="p-4 bg-muted/50 rounded-xl border flex items-start gap-3">
              <UserCircle className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-xs leading-relaxed font-medium space-y-1">
                <p>
                  Les rôles <strong>Patron</strong> et <strong>Particulier</strong> ont des accès complets. Le rôle <strong>Employé</strong> est restreint.
                </p>
                {newRole === 'particulier' && (
                  <p className="text-amber-600 font-bold">
                    Attention : Le passage en Particulier isolera cet utilisateur dans son propre espace privé.
                  </p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateRole} className="rounded-full bg-primary">Appliquer le changement</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible pour <strong>{deletingUser?.loginId}</strong>. L'utilisateur n'aura plus accès à son espace de travail.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-rose-950 rounded-full">Supprimer définitivement</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
