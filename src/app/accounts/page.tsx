
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
import { User } from '@/lib/types';
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
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useMemo } from 'react';
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
import { cn, normalizeId } from '@/lib/utils';

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  // States pour les dialogues partagés
  const [editingPasswordUser, setEditingPasswordUser] = useState<User | null>(null);
  const [editingCompanyUser, setEditingCompanyUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

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

  // Mémoïsation de la liste unique pour éviter des calculs lourds à chaque render
  const uniqueUsers = useMemo(() => {
    if (!allProfiles) return [];
    return Array.from(
      new Map(
        allProfiles
          .filter(u => u.loginId || u.loginId_lower)
          .sort((a, b) => (a.isProfile ? 1 : -1))
          .map(u => [u.loginId_lower || u.loginId?.toLowerCase(), u])
      ).values()
    ).sort((a, b) => (a.role === 'super_admin' ? -1 : 1));
  }, [allProfiles]);

  const updateAllUserDocs = async (loginId: string, updates: Partial<User>) => {
    if (!db || !allProfiles) return;
    const lowerId = loginId.toLowerCase();
    const related = allProfiles.filter(u => (u.loginId_lower === lowerId) || (u.loginId?.toLowerCase() === lowerId));
    related.forEach(uDoc => {
      const ref = doc(db, 'users', uDoc.uid);
      updateDocumentNonBlocking(ref, updates);
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

  if (isProfileLoading || isUsersLoading) return <div className="flex items-center justify-center min-h-screen bg-[#F5F2EA]"><Loader2 className="animate-spin text-primary opacity-50" /></div>;

  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F2EA] p-8 text-center gap-6"><ShieldAlert className="w-20 h-20 text-primary opacity-20" /><h1 className="text-2xl font-black uppercase tracking-tighter text-primary">Accès Super Admin Requis</h1><Button onClick={() => window.location.href = '/'}>Retour à l'accueil</Button></div>;

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
                  <TableHead className="pl-8">Utilisateur</TableHead>
                  <TableHead>Entreprise / ID</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Abonnement</TableHead>
                  <TableHead>Identifiant</TableHead>
                  <TableHead className="text-right pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((u) => (
                  <TableRow key={u.uid} className="hover:bg-primary/5 border-b-primary/5">
                    <TableCell className="pl-8 py-6 font-bold">{u.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 group">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{u.companyName || u.companyId}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary" 
                            onClick={() => { 
                              setEditingCompanyUser(u); 
                              setNewCompanyName(u.companyName || u.companyId); 
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{u.companyId}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge className={u.role === 'super_admin' ? "bg-rose-950" : "bg-primary"}>{u.role.toUpperCase()}</Badge></TableCell>
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
                    <TableCell><span className="font-mono text-xs font-black text-primary">{u.loginId}</span></TableCell>
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

      {/* Dialogues partagés déportés hors de la boucle pour performance mémoire */}
      
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
            <DialogDescription>Mise à jour du Studio pour <strong>{editingCompanyUser?.loginId}</strong>. L'identifiant technique sera synchronisé.</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground">Nom d'affichage</span>
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
