
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
  AlertTriangle,
  User as UserIcon,
  Search
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
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editingPasswordUser, setEditingPasswordUser] = useState<User | null>(null);
  const [editingCompanyUser, setEditingCompanyUser] = useState<User | null>(null);
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [editingNameUser, setEditingNameUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newName, setNewName] = useState('');
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

  const uniqueUsers = useMemo(() => {
    if (!allProfiles) return [];
    
    const userGroups = new Map<string, User[]>();
    allProfiles.forEach(u => {
      const id = (u.loginId_lower || u.loginId?.toLowerCase() || '').trim();
      if (!id) return;
      if (!userGroups.has(id)) userGroups.set(id, []);
      userGroups.get(id)!.push(u);
    });

    return Array.from(userGroups.entries()).map(([id, docs]) => {
      const profileDoc = docs.find(d => d.isProfile === true);
      const baseDoc = profileDoc || docs[0];
      
      const bestName = docs.find(d => d.name && d.name.toLowerCase() !== id.toLowerCase())?.name || baseDoc.name || baseDoc.loginId;
      
      let finalUser = { ...baseDoc, name: bestName };
      
      if (id === 'jsecchi') {
        finalUser.companyName = "GrowAndGo";
        finalUser.companyId = "GrowAndGo";
      } else if (finalUser.role === 'particulier') {
        finalUser.companyName = "Espace Privé";
      } else if (!finalUser.companyName && finalUser.companyId) {
        finalUser.companyName = finalUser.companyId;
      }
      
      return finalUser;
    })
    .filter(u => {
      if (!searchQuery) return true;
      const search = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(search) ||
        u.loginId?.toLowerCase().includes(search) ||
        u.companyName?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
  }, [allProfiles, searchQuery]);

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

  const handleUpdateName = () => {
    if (!db || !editingNameUser || !newName.trim()) return;
    updateAllUserDocs(editingNameUser.loginId, { name: newName.trim() });
    toast({ title: "Nom mis à jour" });
    setEditingNameUser(null);
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

    if (newRole === 'particulier') {
      updates.companyName = "Mon Espace Personnel";
      updates.companyId = `private-${editingRoleUser.loginId.toLowerCase()}`;
    } else if (editingRoleUser.role === 'particulier' && (newRole === 'admin' || newRole === 'employee')) {
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
      <div className="max-w-7xl mx-auto py-8 px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase flex items-center gap-3">
              <UserCog className="w-8 h-8" />
              Répertoire
            </h1>
            <p className="text-muted-foreground font-medium text-sm">Contrôle global des utilisateurs et des permissions.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher..." 
                className="pl-9 h-10 w-64 rounded-full bg-white border-primary/10 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Badge variant="outline" className="h-10 px-4 border-primary/20 text-primary font-bold bg-white">{uniqueUsers.length} comptes</Badge>
          </div>
        </div>

        <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-primary text-primary-foreground">
                <TableRow className="hover:bg-primary/95 border-none">
                  <TableHead className="pl-8 py-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Utilisateur</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Entreprise</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70 text-center">Rôle</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70 text-center">Abonnement</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Identifiant (ID)</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((u) => (
                  <TableRow key={u.uid} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs">
                          {u.name?.charAt(0) || u.loginId?.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-primary whitespace-nowrap">{u.name || u.loginId}</span>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" 
                              onClick={() => { setEditingNameUser(u); setNewName(u.name || u.loginId || ''); }}
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="w-2.5 h-2.5 opacity-40" />
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '08/02/2026'}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-semibold whitespace-nowrap",
                          u.role === 'particulier' ? "text-amber-600 italic" : "text-foreground"
                        )}>{u.companyName || u.companyId}</span>
                        {u.loginId_lower !== 'jsecchi' && u.role !== 'particulier' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-primary transition-opacity" 
                            onClick={() => { setEditingCompanyUser(u); setNewCompanyName(u.companyName || u.companyId || ''); }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase px-2 h-5 tracking-tighter whitespace-nowrap",
                          u.role === 'super_admin' ? "bg-rose-950" : 
                          u.role === 'admin' ? "bg-primary" : 
                          u.role === 'particulier' ? "bg-amber-600" :
                          "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                          {u.role === 'super_admin' ? 'ADMIN' : u.role === 'admin' ? 'PATRON' : u.role === 'particulier' ? 'PART.' : 'EMP.'}
                        </Badge>
                        {u.role !== 'super_admin' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 text-primary transition-opacity"
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
                    <TableCell className="text-center py-4">
                      {u.role !== 'super_admin' ? (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className={cn(
                            "rounded-full h-6 px-3 text-[9px] font-black uppercase tracking-widest gap-1.5 transition-all",
                            u.subscriptionStatus === 'inactive' ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                          )}
                          onClick={() => toggleSubscription(u.loginId, u.subscriptionStatus)}
                        >
                          {u.subscriptionStatus === 'inactive' ? <Ban className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                          {u.subscriptionStatus === 'inactive' ? 'Désactivé' : 'Actif'}
                        </Button>
                      ) : (
                        <Badge className="bg-emerald-600 font-black uppercase text-[9px] h-5">TOUJOURS ACTIF</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant="outline" className="font-mono text-[10px] font-black text-primary/60 border-primary/5 bg-primary/5 px-2 py-0">
                        {u.loginId}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {u.role !== 'super_admin' && (
                          <>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-primary hover:bg-primary/10" 
                               title="Modifier le mot de passe"
                               onClick={() => { setEditingPasswordUser(u); setNewPassword(u.password || ''); }}
                             >
                               <Key className="w-4 h-4" />
                             </Button>
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-rose-950 hover:bg-rose-50" 
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

      {/* DIALOGS (Inchangés pour la logique, juste arrondis) */}
      <Dialog open={!!editingNameUser} onOpenChange={(open) => !open && setEditingNameUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier le nom complet</DialogTitle>
            <DialogDescription>Mise à jour pour l'utilisateur : <strong>{editingNameUser?.loginId}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom et Prénom</span>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl h-12 font-bold" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateName} className="rounded-full bg-primary px-8">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingPasswordUser} onOpenChange={(open) => !open && setEditingPasswordUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier le mot de passe</DialogTitle>
            <DialogDescription>Mise à jour pour l'utilisateur : <strong>{editingPasswordUser?.loginId}</strong></DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nouveau mot de passe</span>
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl h-12 font-bold" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePassword} className="rounded-full bg-primary px-8">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCompanyUser} onOpenChange={(open) => !open && setEditingCompanyUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier l'entreprise</DialogTitle>
            <DialogDescription>Mise à jour de l'espace pour <strong>{editingCompanyUser?.loginId}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom d'affichage</span>
              <Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="rounded-xl h-12 font-bold" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdateCompany} className="rounded-full bg-primary px-8">Mettre à jour</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRoleUser} onOpenChange={(open) => !open && setEditingRoleUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>Permissions pour <strong>{editingRoleUser?.loginId}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nouveau Rôle</span>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger className="rounded-xl h-12 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Patron</SelectItem>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="employee">Employé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(editingRoleUser?.role === 'particulier' && (newRole === 'admin' || newRole === 'employee')) && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label className="text-[10px] font-black uppercase text-rose-600">Nom de l'entreprise requis</Label>
                <Input placeholder="Nom de l'entreprise..." value={roleCompanyInput} onChange={(e) => setRoleCompanyInput(e.target.value)} className="rounded-xl h-12 font-bold" />
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleUpdateRole} className="rounded-full bg-primary px-8">Appliquer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
            <AlertDialogDescription>Action irréversible pour <strong>{deletingUser?.loginId}</strong>.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-rose-950 rounded-full">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
