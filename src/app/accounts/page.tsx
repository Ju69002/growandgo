
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
import { collection, doc, query, where } from 'firebase/firestore';
import { User, UserRole, Company } from '@/lib/types';
import { 
  ShieldCheck, 
  Trash2, 
  Key, 
  ShieldAlert, 
  UserCog, 
  Loader2,
  RefreshCcw,
  Lock,
  Building2,
  Edit2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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
  DialogDescription as DialogDesc,
} from "@/components/ui/dialog";

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [editingPasswordUser, setEditingPasswordUser] = useState<{ uid: string, loginId: string, password?: string } | null>(null);
  const [editingCompanyUser, setEditingCompanyUser] = useState<{ uid: string, loginId: string, companyName: string } | null>(null);
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

  const handleRoleChange = (userId: string, currentRole: UserRole) => {
    if (!db) return;
    const newRole: UserRole = currentRole === 'admin' ? 'employee' : 'admin';
    const profileRef = doc(db, 'users', userId);
    updateDocumentNonBlocking(profileRef, { 
      role: newRole,
      adminMode: newRole === 'admin',
      isCategoryModifier: newRole === 'admin'
    });
    toast({ title: "Rôle mis à jour" });
  };

  const handleDeleteUser = (userId: string) => {
    if (!db) return;
    const profileRef = doc(db, 'users', userId);
    deleteDocumentNonBlocking(profileRef);
    toast({ title: "Profil supprimé" });
  };

  const handleUpdatePassword = () => {
    if (!db || !editingPasswordUser || !newPassword.trim()) return;
    const profileRef = doc(db, 'users', editingPasswordUser.uid);
    updateDocumentNonBlocking(profileRef, { password: newPassword.trim() });
    toast({ title: "Mot de passe modifié" });
    setEditingPasswordUser(null);
    setNewPassword('');
  };

  const handleUpdateCompany = () => {
    if (!db || !editingCompanyUser || !newCompanyName.trim()) return;
    const profileRef = doc(db, 'users', editingCompanyUser.uid);
    updateDocumentNonBlocking(profileRef, { companyName: newCompanyName.trim() });
    toast({ title: "Entreprise mise à jour pour cet utilisateur" });
    setEditingCompanyUser(null);
    setNewCompanyName('');
  };

  if (isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vérification...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShieldAlert className="w-20 h-20 text-rose-950 opacity-20" />
          <h1 className="text-2xl font-black uppercase tracking-tighter">Accès Réservé</h1>
        </div>
      </DashboardLayout>
    );
  }

  const uniqueUsers = Array.from(
    new Map(
      (allProfiles || [])
        .filter(u => u.loginId || u.loginId_lower)
        .map(u => [u.loginId_lower || u.loginId?.toLowerCase(), u])
    ).values()
  ).sort((a, b) => {
    if (a.role === 'super_admin') return -1;
    if (b.role === 'super_admin') return 1;
    return (a.loginId || '').localeCompare(b.loginId || '');
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tighter text-primary uppercase flex items-center gap-3">
            <UserCog className="w-10 h-10" />
            Répertoire des Accès
          </h1>
          <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary font-bold">
            {uniqueUsers.length} COMPTES UNIQUES
          </Badge>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-primary-foreground p-8">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              Gestion des Profils
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isUsersLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px] pl-8">Utilisateur</TableHead>
                    <TableHead>Entreprise (Indépendante)</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Mot de passe</TableHead>
                    <TableHead className="text-right pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uniqueUsers.map((u) => {
                    return (
                      <TableRow key={u.uid} className="hover:bg-primary/5 border-b-primary/5">
                        <TableCell className="pl-8 py-6">
                          <div className="flex items-center gap-3 font-bold">{u.name}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 group">
                            <span className="text-sm font-semibold">{u.companyName || u.companyId}</span>
                            {u.role !== 'super_admin' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary"
                                onClick={() => {
                                  setEditingCompanyUser({ uid: u.uid, loginId: u.loginId, companyName: u.companyName || u.companyId });
                                  setNewCompanyName(u.companyName || u.companyId);
                                }}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={u.role === 'super_admin' ? "bg-rose-950" : u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground"}>
                            {u.role.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs font-black text-primary">{u.loginId}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-rose-900 font-black group">
                            <Lock className="w-3 h-3 opacity-50" />
                            <span className="font-mono text-sm">{u.password || "Meqoqo1998"}</span>
                            {u.role !== 'super_admin' && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-primary" onClick={() => { setEditingPasswordUser({ uid: u.uid, loginId: u.loginId, password: u.password }); setNewPassword(u.password || ''); }}>
                                <Key className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {u.role !== 'super_admin' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" className="rounded-full font-bold text-[9px] uppercase h-8 px-3 gap-1.5" onClick={() => handleRoleChange(u.uid, u.role)}>
                                <RefreshCcw className="w-3 h-3" />
                                {u.role === 'admin' ? 'Employé' : 'Patron'}
                              </Button>
                              <AlertDialog>
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-rose-950">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <AlertDialogContent className="rounded-[2rem]">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Cette action supprimera définitivement l'identifiant <strong>{u.loginId}</strong> ({u.name}).
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.uid)} className="bg-rose-950 rounded-full">Confirmer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingPasswordUser} onOpenChange={(open) => !open && setEditingPasswordUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Changer le mot de passe</DialogTitle>
            <DialogDesc>Nouveau mot de passe pour {editingPasswordUser?.loginId}.</DialogDesc>
          </DialogHeader>
          <div className="py-4">
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl h-12 font-bold text-rose-900" placeholder="Mot de passe..." />
          </div>
          <DialogFooter>
            <Button onClick={handleUpdatePassword} disabled={!newPassword.trim()} className="rounded-full font-bold px-8 bg-primary">Mettre à jour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingCompanyUser} onOpenChange={(open) => !open && setEditingCompanyUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader>
            <DialogTitle>Modifier l'entreprise</DialogTitle>
            <DialogDesc>Change le nom d'entreprise pour {editingCompanyUser?.loginId} uniquement.</DialogDesc>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={newCompanyName} 
              onChange={(e) => setNewCompanyName(e.target.value)} 
              className="rounded-xl h-12 font-bold" 
              placeholder="Nom de l'entreprise..." 
            />
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateCompany} disabled={!newCompanyName.trim()} className="rounded-full font-bold px-8 bg-primary">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
