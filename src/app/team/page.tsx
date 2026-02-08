
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, User as UserIcon, Building2, Key, Info, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeamPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;
  const isParticulier = profile?.role === 'particulier';
  const isSuperAdmin = profile?.role === 'super_admin';

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    // On filtre strictement par isProfile pour éviter les doublons de session
    return query(
      collection(db, 'users'), 
      where('companyId', '==', companyId),
      where('isProfile', '==', true)
    );
  }, [db, companyId]);

  const { data: teamMembers, isLoading } = useCollection<User>(teamQuery);

  if (isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-20 px-6 text-center space-y-8 flex flex-col items-center">
          <div className="p-6 bg-primary/5 rounded-[3rem] border-2 border-dashed border-primary/20">
            <UserCog className="w-20 h-20 text-primary opacity-40 mx-auto" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Gestion Globale</h1>
            <p className="text-muted-foreground font-medium max-w-md mx-auto">
              En tant qu'<strong>Administrateur</strong>, vous gérez l'ensemble des utilisateurs via le <strong>Répertoire</strong>.
            </p>
          </div>
          <div className="bg-primary p-6 rounded-2xl border flex items-start gap-4 text-left max-w-lg text-white shadow-xl">
            <Info className="w-6 h-6 mt-1 shrink-0" />
            <p className="text-sm leading-relaxed font-bold">
              La vue "Équipe" est réservée aux entreprises clientes. Pour gérer les accès, modifier les rôles ou supprimer des comptes, rendez-vous dans l'onglet Administration > Répertoire.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (isParticulier) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-20 px-6 text-center space-y-8 flex flex-col items-center">
          <div className="p-6 bg-amber-50 rounded-[3rem] border-2 border-dashed border-amber-200">
            <UserIcon className="w-20 h-20 text-amber-600 opacity-40 mx-auto" />
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Espace Privé</h1>
            <p className="text-muted-foreground font-medium max-w-md mx-auto">
              En tant que <strong>Particulier</strong>, vous disposez d'un accès strictement confidentiel. 
              Aucun autre utilisateur n'est lié à votre espace de travail.
            </p>
          </div>
          <div className="bg-primary/5 p-6 rounded-2xl border flex items-start gap-4 text-left max-w-lg">
            <Info className="w-6 h-6 text-primary mt-1 shrink-0" />
            <p className="text-sm leading-relaxed">
              Toutes vos données (documents, agenda, paramètres) sont isolées. Vous ne pouvez pas ajouter de collaborateurs à cet abonnement privé.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Mon Équipe</h1>
            <p className="text-muted-foreground font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Collaborateurs de votre espace de travail
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary font-bold border-primary/20 h-7 px-3">
            {teamMembers?.length || 0} MEMBRES
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Chargement...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers?.map((member) => (
              <Card key={member.uid} className="border-none shadow-md hover:shadow-xl transition-all rounded-[2rem] overflow-hidden bg-card border-l-4 border-l-primary/10">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary/10 shadow-sm">
                      <AvatarImage src={`https://picsum.photos/seed/${member.uid}/100/100`} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xl font-black uppercase">
                        {member.name?.substring(0, 2) || "GG"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <CardTitle className="text-xl font-bold">{member.name}</CardTitle>
                      <Badge 
                        className={cn(
                          "w-fit font-black uppercase text-[10px] h-5 px-2",
                          member.role === 'super_admin' ? "bg-rose-950 text-white" :
                          member.role === 'admin' ? "bg-primary text-primary-foreground" : 
                          member.role === 'particulier' ? "bg-amber-600 text-white" :
                          "bg-muted text-muted-foreground"
                        )}
                      >
                        {member.role === 'super_admin' ? 'ADMIN' : member.role === 'admin' ? 'PATRON' : member.role === 'particulier' ? 'PARTICULIER' : 'EMPLOYÉ'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 p-2 rounded-xl">
                    <Key className="w-4 h-4 text-primary/60" />
                    <span className="font-medium text-xs">Identifiant : {member.loginId}</span>
                  </div>
                  {(member.role !== 'employee') && (
                    <div className="flex items-center gap-3 text-sm text-emerald-600 font-bold bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="uppercase text-[10px] tracking-widest">Responsable</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
