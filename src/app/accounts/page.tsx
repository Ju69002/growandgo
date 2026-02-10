
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
  const isGlobalAdmin = myProfile?.companyId === 'admin_global' || myProfile?.role === 'admin';

  const profilesQuery = useMemoFirebase(() => {
    if (!db || !isGlobalAdmin) return null;
    return query(collection(db, 'users'), where('isProfile', '==', true));
  }, [db, isGlobalAdmin]);

  const { data: allProfiles, isLoading: isUsersLoading } = useCollection<User>(profilesQuery);

  const uniqueUsers = useMemo(() => {
    if (!allProfiles) return [];
    
    const companyCounts = new Map<string, number>();
    const companyPatrons = new Map<string, string>();

    allProfiles.forEach(u => {
      const cId = u.companyId?.toLowerCase().trim();
      if (cId) {
        companyCounts.set(cId, (companyCounts.get(cId) || 0) + 1);
        if (u.role === 'patron') {
          companyPatrons.set(cId, u.name || u.loginId);
        }
      }
    });

    return allProfiles.map(u => {
      const cId = u.companyId?.toLowerCase().trim();
      const userCount = companyCounts.get(cId) || 0;
      const patronName = companyPatrons.get(cId) || "son dirigeant";
      const isInternalAdmin = u.companyId === 'admin_global' || u.role === 'admin';
      
      const totalAmount = isInternalAdmin ? 0 : (userCount * 39.99);

      return { 
        ...u, 
        companyName: isInternalAdmin ? "Grow&Go Platform" : (u.companyName || u.companyId),
        displaySubscription: {
          totalAmount: totalAmount,
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
    .sort((a, b) => {
      if (a.companyId === 'admin_global') return -1;
      if (b.companyId === 'admin_global') return 1;
      return (a.companyId || '').localeCompare(b.companyId || '');
    });
  }, [allProfiles, searchQuery]);

  const handleSendResetEmail = async (email: string) => {
    if (!auth || !email) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "E-mail envoyé", description: `Lien de reset envoyé à ${email}.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'envoyer le mail de sécurité." });
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
      adminMode: newRole === 'patron' || newRole === 'admin',
      isCategoryModifier: newRole === 'patron' || newRole === 'admin'
    });
    toast({ title: "Rôle mis à jour" });
    setEditingRoleUser(null);
  };

  const handleUpdatePassword = () => {
    if (!db || !editingPassUser || !newPassword.trim()) return;
    updateDocumentNonBlocking(doc(db, 'users', editingPassUser.id), { 
      password: newPassword.trim()
    });
    toast({ title: "Mémo mot de passe mis à jour" });
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
              Répertoire Plateforme
            </h1>
            <p className="text-muted-foreground font-medium text-sm italic">Affichage strict des profils réels (isProfile: true).</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un profil..." 
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
                  <TableHead className="pl-8 py-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground/70">Utilisateur</TableHead>
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
                        <span className="text-[10px] text-muted-foreground font-mono">UID: {u.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-primary/40" />
                        <span className="text-xs font-semibold">{u.companyName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      {u.companyId === 'admin_global' || u.role === 'admin' ? (
                        <Badge variant="secondary" className="bg-rose-950 text-white font-bold text-[9px] border-none uppercase">Offert (Plateforme)</Badge>
                      ) : u.role === 'patron' ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-primary">{(u.displaySubscription.totalAmount).toFixed(2)}€ / mois</span>
                          <span className="text-[9px] text-muted-foreground font-bold">39,99€ × {u.displaySubscription.activeUsers} collaborateurs</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-muted-foreground italic">Inclus dans l'abonnement</span>
                          <span className="text-[9px] font-black text-primary/60 uppercase">Payé par {u.displaySubscription.patronName}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] bg-muted px-2 py-0.5 rounded border">
                          {showPasswords[u.id] ? (u.password || '---') : '••••••••'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePassVisibility(u.id)}>
                          {showPasswords[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-4">
                      <Badge className={cn(
                        "text-[10px] font-black uppercase px-3 h-6 border-none",
                        u.companyId === 'admin_global' || u.role === 'admin' ? "bg-rose-950 text-white" : (u.role === 'patron' ? "bg-primary text-white" : "bg-muted text-muted-foreground")
                      )}>
                        {u.companyId === 'admin_global' || u.role === 'admin' ? 'ADMINISTRATEUR' : (u.role === 'patron' ? 'DIRIGEANT' : 'COLLABORATEUR')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-8 py-4">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleSendResetEmail(u.email)}><Mail className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingPassUser(u); setNewPassword(u.password || ''); }}><Key className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setEditingRoleUser(u); setNewRole(u.role); }}><ShieldCheck className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => setDeletingUser(u)}><Trash2 className="w-4 h-4" /></Button>
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
          <DialogHeader><DialogTitle>Modifier le mémo mot de passe</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <Label>Nouveau mot de passe d'affichage</Label>
            <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl font-bold" />
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-900 leading-tight">Attention : cette action modifie uniquement le rappel visuel. Pour changer l'accès réel, l'utilisateur doit utiliser l'option "Oublié" ou vous devez envoyer un mail de reset.</p>
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
                <SelectItem value="patron">Dirigeant (Patron)</SelectItem>
                <SelectItem value="employee">Collaborateur (Employé)</SelectItem>
                <SelectItem value="admin">Administrateur (Plateforme)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter><Button onClick={handleUpdateRole} className="rounded-full bg-primary px-8">Appliquer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent className="rounded-[2rem]">
          <AlertDialogHeader><AlertDialogTitle>Supprimer définitivement le profil ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-rose-600 rounded-full">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
