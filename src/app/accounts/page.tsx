
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
  User as UserIcon, 
  Trash2, 
  Key, 
  ShieldAlert, 
  UserCog, 
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: myProfile } = useDoc<User>(userProfileRef);
  const isSuperAdmin = myProfile?.role === 'super_admin';

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'users'));
  }, [db]);

  const { data: allUsers, isLoading } = useCollection<User>(usersQuery);

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
      description: "Le profil a été retiré de la base de données. L'accès est révoqué immédiatement." 
    });
  };

  if (!isSuperAdmin && myProfile) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <ShieldAlert className="w-20 h-20 text-destructive opacity-20" />
          <h1 className="text-2xl font-black uppercase">Accès Refusé</h1>
          <p className="text-muted-foreground">Seul le Super Administrateur peut gérer les comptes.</p>
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
              Gestion des Comptes
            </h1>
            <p className="text-muted-foreground font-medium">Contrôlez les accès et les rôles de votre équipe Grow&Go.</p>
          </div>
          <Badge variant="outline" className="px-4 py-1 border-primary/20 text-primary font-bold">
            {allUsers?.length || 0} UTILISATEURS
          </Badge>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="bg-primary text-primary-foreground p-8">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="w-6 h-6" />
              Liste des Accès
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Chargement de la base...</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[250px] font-black uppercase text-[10px] tracking-widest pl-8">Utilisateur</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Identifiant</TableHead>
                    <TableHead className="font-black uppercase text-[10px] tracking-widest">Rôle</TableHead>
                    <TableHead className="text-right font-black uppercase text-[10px] tracking-widest pr-8">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allUsers?.map((u) => (
                    <TableRow key={u.uid} className="hover:bg-primary/5 transition-colors border-b-primary/5">
                      <TableCell className="pl-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                            <UserIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-lg">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-xl w-fit border">
                          <Key className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-sm font-bold">{u.loginId}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {u.role === 'super_admin' ? (
                          <Badge className="bg-destructive text-destructive-foreground font-black uppercase text-[10px] px-3">
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
                      <TableCell className="text-right pr-8">
                        {u.role !== 'super_admin' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="rounded-full font-bold text-[10px] uppercase h-9 px-4 gap-2 hover:bg-primary hover:text-primary-foreground border-primary/20"
                              onClick={() => handleRoleChange(u.uid, u.role)}
                            >
                              <RefreshCcw className="w-3 h-3" />
                              Passer en {u.role === 'admin' ? 'Employé' : 'Patron'}
                            </Button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-9 w-9 text-rose-800 hover:bg-rose-100 hover:text-rose-900 rounded-full transition-colors"
                                  title="Supprimer cet utilisateur"
                                >
                                  <Trash2 className="w-5 h-5 stroke-[2.5]" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
                                <AlertDialogHeader>
                                  <AlertDialogTitle className="text-2xl font-black uppercase flex items-center gap-2">
                                    <AlertTriangle className="text-rose-800 w-6 h-6" />
                                    Supprimer le compte ?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription className="text-base">
                                    Cette action retirera <strong>{u.name}</strong> de la base de données. L'utilisateur devra <strong>se réinscrire</strong> s'il souhaite accéder à nouveau au studio.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-3">
                                  <AlertDialogCancel className="rounded-full font-bold h-11 px-8 border-primary/20">Annuler</AlertDialogCancel>
                                  <AlertDialogAction 
                                    onClick={() => handleDeleteUser(u.uid)}
                                    className="bg-rose-800 hover:bg-rose-900 text-white rounded-full font-bold h-11 px-8"
                                  >
                                    Confirmer la suppression
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="bg-amber-50 border-2 border-dashed border-amber-200 p-6 rounded-3xl flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-2xl text-amber-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="font-bold text-amber-900 uppercase text-xs tracking-widest">Note de Sécurité</p>
            <p className="text-amber-800 text-sm">
              La suppression est immédiate. Les documents déjà importés par cet utilisateur ne seront pas supprimés, mais son accès sera révoqué.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
