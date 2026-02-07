
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
import { Label } from '@/components/ui/label';
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
import { User, UserRole, Company } from '@/lib/types';
import { 
  ShieldCheck, 
  User as UserIcon, 
  Trash2, 
  Key, 
  ShieldAlert, 
  UserCog, 
  Loader2,
  AlertTriangle,
  RefreshCcw,
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
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<{ uid: string, name: string, companyId: string } | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: myProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);
  
  const isSuperAdmin = !isProfileLoading && myProfile?.role === 'super_admin';

  const usersQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'users'));
  }, [db, isSuperAdmin]);

  const { data: allUsers, isLoading: isUsersLoading } = useCollection<User>(usersQuery);

  const companiesQuery = useMemoFirebase(() => {
    if (!db || !isSuperAdmin) return null;
    return query(collection(db, 'companies'));
  }, [db, isSuperAdmin]);

  const { data: allCompanies } = useCollection<Company>(companiesQuery);

  const handleRoleChange = (userId: string, currentRole: UserRole) => {
    if (!db) return;
    const newRole: UserRole = currentRole === 'admin' ? 'employee' : 'admin';
    const userRef = doc(db, 'users', userId);
    updateDocumentNonBlocking(userRef, { 
      role: newRole,
      adminMode: newRole === 'admin',
      isCategoryModifier: newRole === 'admin'
    });
    toast({ 
      title: "Rôle mis à jour", 
      description: `L'utilisateur est désormais ${newRole === 'admin' ? 'Patron' : 'Employé'}.` 
    });
  };

  const handleDeleteUser = (userId: string) => {
    if (!db) return;
    const userRef = doc(db, 'users', userId);
    deleteDocumentNonBlocking(userRef);
    toast({ 
      title: "Utilisateur supprimé", 
      description: "Le profil a été retiré définitivement de la base." 
    });
  };

  const handleUpdateUserAffiliation = () => {
    if (!db || !editingUser) return;
    const userRef = doc(db, 'users', editingUser.uid);
    updateDocumentNonBlocking(userRef, { companyId: editingUser.companyId });
    toast({ 
      title: "Entreprise mise à jour", 
      description: `${editingUser.name} est désormais rattaché à : ${editingUser.companyId}` 
    });
    setEditingUser(null);
  };

  if (isProfileLoading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vérification des droits...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShieldAlert className="w-20 h-20 text-rose-900 opacity-20" />
          <h1 className="text-2xl font-black uppercase tracking-tighter">Accès Réservé</h1>
          <p className="text-muted-foreground">Seul le Super Administrateur peut gérer les accès globaux.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase flex items-center gap-3">
              <UserCog className="w-10 h-10" />
              Comptes Utilisateurs
            </h1>
            <p className="text-muted-foreground font-medium">Gestion individuelle des accès et des entreprises.</p>
          </div>
          <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary font-bold">
            {allUsers?.length || 0} PROFILS ACTIFS
          </Badge>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-primary-foreground p-8">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              Répertoire des Accès
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isUsersLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Chargement de la base...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[200px] font-black uppercase text-[10px] tracking-widest pl-8">Utilisateur</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Entreprise</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Rôle</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">ID Connexion</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers?.map((u) => {
                    const company = allCompanies?.find(c => c.id === u.companyId);
                    const companyDisplayName = company?.name || u.companyId;

                    return (
                      <TableRow key={u.uid} className="hover:bg-primary/5 transition-colors border-b-primary/5">
                        <TableCell className="pl-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                              <UserIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 group">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold">{companyDisplayName}</span>
                              <span className="text-[8px] text-muted-foreground opacity-50 uppercase tracking-tighter">ID: {u.companyId}</span>
                            </div>
                            {u.role !== 'super_admin' && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                onClick={() => setEditingUser({ uid: u.uid, name: u.name, companyId: u.companyId })}
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.role === 'super_admin' ? (
                            <Badge className="bg-rose-950 text-white font-black uppercase text-[9px] px-2">
                              Super Admin
                            </Badge>
                          ) : (
                            <Badge 
                              className={u.role === 'admin' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}
                              variant={u.role === 'admin' ? "default" : "outline"}
                            >
                              {u.role === 'admin' ? "PATRON" : "EMPLOYÉ"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg w-fit border border-black/5">
                            <Key className="w-3 h-3 text-muted-foreground" />
                            <span className="font-mono text-xs font-bold">{u.loginId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          {u.role !== 'super_admin' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-full font-bold text-[9px] uppercase h-8 px-3 gap-1.5 hover:bg-primary hover:text-primary-foreground border-primary/20"
                                onClick={() => handleRoleChange(u.uid, u.role)}
                              >
                                <RefreshCcw className="w-3 h-3" />
                                {u.role === 'admin' ? 'Vers Employé' : 'Vers Patron'}
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-rose-950 hover:bg-rose-100 hover:text-rose-950 rounded-full"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                                      <AlertTriangle className="text-rose-950 w-6 h-6" />
                                      Supprimer le compte ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-base">
                                      Cette action supprimera définitivement <strong>{u.name}</strong>. Il devra se réinscrire pour accéder à nouveau au studio.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="mt-6 gap-3">
                                    <AlertDialogCancel className="rounded-full font-bold h-11 px-8 border-primary/20">Annuler</AlertDialogCancel>
                                    <AlertDialogAction 
                                      onClick={() => handleDeleteUser(u.uid)}
                                      className="bg-rose-950 hover:bg-rose-900 text-white rounded-full font-bold h-11 px-8 border-none"
                                    >
                                      Confirmer
                                    </AlertDialogAction>
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

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tighter">Modifier l'Entreprise</DialogTitle>
            <DialogDescription className="text-xs">
              Mettez à jour le nom de l'entreprise associée à <strong>{editingUser?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nom ou ID de l'entreprise</Label>
              <Input 
                value={editingUser?.companyId || ''} 
                onChange={(e) => setEditingUser(prev => prev ? { ...prev, companyId: e.target.value } : null)}
                placeholder="Ex: Studio Dubois..."
                className="rounded-xl border-primary/10 h-12 font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUser(null)} className="rounded-full font-bold">Annuler</Button>
            <Button onClick={handleUpdateUserAffiliation} className="rounded-full font-bold px-8 bg-primary">Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
