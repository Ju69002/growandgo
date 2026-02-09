
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
import { Card, CardContent } from '@/components/ui/card';
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
  deleteDocumentNonBlocking,
  useAuth
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { User, UserRole } from '@/lib/types';
import { 
  ShieldCheck, 
  Trash2, 
  UserCog, 
  Loader2,
  Search,
  Mail,
  Building2,
  Key,
  Eye,
  EyeOff,
  AlertCircle
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

export default function AccountsPage() {
  const { user: currentUser } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [editingPassUser, setEditingPassUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !currentUser) return null;
    return doc(db, 'users', currentUser.uid);
  }, [db, currentUser]);

  const { data: myProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);
  const isGlobalAdmin = myProfile?.companyId === 'admin_global' || myProfile?.role === 'super_admin';

  const profilesQuery = useMemoFirebase(() => {
    if (!db || !isGlobalAdmin) return null;
    return query(collection(db, 'users'), where('isProfile', '==', true));
  }, [db, isGlobalAdmin]);

  const { data: allProfiles, isLoading: isUsersLoading } = useCollection<User>(profilesQuery);

  const uniqueUsers = useMemo(() => {
    if (!allProfiles) return [];
    
    const realProfiles = allProfiles.filter(u => u.uid === u.id || u.isProfile);
    const companyCounts = new Map<string, number>();
    const companyPatrons = new Map<string, string>();

    realProfiles.forEach(u => {
      const cId = u.companyId?.toLowerCase().trim();
      if (cId) {
        companyCounts.set(cId, (companyCounts.get(cId) || 0) + 1);
        if (u.role === 'admin') companyPatrons.set(cId, u.name || u.loginId);
      }
    });

    return realProfiles.map(u => {
      const cId = u.companyId?.toLowerCase().trim();
      const userCount = companyCounts.get(cId) || 0;
      const patronName = companyPatrons.get(cId) || "son patron";
      const isInternalAdmin = u.companyId === 'admin_global';
      const calculatedAmount = isInternalAdmin ? 0 : (userCount * 39.99);

      return { 
        ...u, 
        companyName: isInternalAdmin ? "Grow&Go Admin" : (u.companyName || u.companyId),
        displaySubscription: {
          totalAmount: calculatedAmount,
          activeUsers: userCount,
          patronName: patronName
        }
      };
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
    .sort((a, b) => (a.companyId === 'admin_global' ? -1 : 1));
  }, [allProfiles, searchQuery]);

  const handleSendResetEmail = async (email: string) => {
    if (!auth || !email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "E-mail envoyé", description: `Lien de réinitialisation envoyé à ${email}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "L'utilisateur n'existe pas encore dans Firebase Auth ou l'e-mail est invalide." });
    }
  };

  const handleDeleteUser = () => {
    if (!db || !deletingUser) return;
    deleteDocumentNonBlocking(doc(db, 'users', deletingUser.id));
    toast({ title: "Compte supprimé" });
    setDeletingUser(null);
  };

  const handleUpdateRole = () => {
    if (!db || !editingRoleUser) return;
    updateDocumentNonBlocking(doc(db, 'users', editingRoleUser.id), { 
      role: newRole,
      adminMode: newRole === 'admin',
      isCategoryModifier: newRole === 'admin'
    });
    toast({ title: "Rôle mis à jour" });
    setEditingRoleUser(null);
  };

  const handleUpdatePassword = () => {
    if (!db || !editingPassUser || !newPassword.trim()) return;
    updateDocumentNonBlocking(doc(db, 'users', editingPassUser.id), { 
      password: newPassword.trim()
    });
    toast({ title: "Mémo mis à jour", description: "Le mot de passe Firestore est synchronisé avec le mode dev." });
    setEditingPassUser(null);
  };

  const togglePassVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!mounted || isProfileLoading || isUsersLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-primary opacity-20" /></div>;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-8 px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase flex items-center gap-3">
              <UserCog className="w-8 h-8" />
              Répertoire & Abonnements
            </h1>
            <p className="text-muted-foreground font-medium text-sm">Gestion globale des accès et facturations.</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher..." 
              className="pl-9 h-10 w-64 rounded-full bg-white border-primary/10 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-primary text-primary-foreground">
                <TableRow className="hover:bg-primary/95 border-none">
                  <TableHead className="pl-8 py-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Utilisateur / ID</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Entreprise</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Abonnement</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Mot de passe</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/70 text-center">Rôle</TableHead>
                  <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uniqueUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-primary/5 transition-colors group">
                    <TableCell className="pl-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-primary">{u.name || u.loginId}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">ID: {u.loginId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-primary/40" />
                        <span className="text-xs font-semibold">{u.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {u.companyId === 'admin_global' ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 font-bold text-[9px]">OFFERT</Badge>
                      ) : u.role === 'admin' ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-primary">{u.displaySubscription.totalAmount.toFixed(2)}€</span>
                          <span className="text-[9px] text-muted-foreground">39,99€ × {u.displaySubscription.activeUsers} pers.</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">Payé par {u.displaySubscription.patronName}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border">
                          {showPasswords[u.id] ? (u.password || '---') : '••••••••'}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => togglePassVisibility(u.id)}
                        >
                          {showPasswords[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <Badge className={cn(
                        "text-[10px] font-black uppercase px-3 h-6",
                        u.companyId === 'admin_global' ? "bg-rose-950" : (u.role === 'admin' ? "bg-primary" : "bg-muted text-muted-foreground")
                      )}>
                        {u.companyId === 'admin_global' ? 'ADMIN' : (u.role === 'admin' ? 'PATRON' : 'EMPLOYÉ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Lien de reset" onClick={() => handleSendResetEmail(u.email)}><Mail className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Modifier mot de passe" onClick={() => { setEditingPassUser(u); setNewPassword(u.password || ''); }}><Key className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Changer rôle" onClick={() => { setEditingRoleUser(u); setNewRole(u.role); }}><ShieldCheck className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" title="Supprimer" onClick={() => setDeletingUser(u)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingPassUser} onOpenChange={(open) => !open && setEditingPassUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader><DialogTitle>Modifier le mot de passe (Mémo)</DialogTitle></DialogHeader>
          <div className="py-4 space-y-6">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-800">Information Importante</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Modifier ce champ met à jour l'affichage et le mode développement. Pour changer l'accès réel, l'utilisateur doit utiliser un lien de réinitialisation.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl font-bold" />
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePassword} className="rounded-full bg-primary px-8">Enregistrer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingRoleUser} onOpenChange={(open) => !open && setEditingRoleUser(null)}>
        <DialogContent className="rounded-[2rem]">
          <DialogHeader><DialogTitle>Modifier le rôle</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Patron</SelectItem>
                <SelectItem value="employee">Employé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleUpdateRole} className="rounded-full bg-primary px-8">Appliquer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader><AlertDialogTitle>Supprimer le compte ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-rose-600 rounded-full">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
