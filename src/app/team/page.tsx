
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, ShieldCheck, User as UserIcon } from 'lucide-react';

export default function TeamPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'users'), where('companyId', '==', companyId));
  }, [db, companyId]);

  const { data: teamMembers, isLoading } = useCollection<User>(teamQuery);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Mon Équipe</h1>
          <p className="text-muted-foreground font-medium">Les collaborateurs de votre studio Grow&Go.</p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recherche de vos collaborateurs...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers?.map((member) => (
              <Card key={member.uid} className="border-none shadow-md hover:shadow-xl transition-all rounded-[2rem] overflow-hidden bg-card">
                <CardHeader className="p-8 pb-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 border-2 border-primary/10">
                      <AvatarImage src={`https://picsum.photos/seed/${member.uid}/100/100`} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xl font-black uppercase">
                        {member.name?.substring(0, 2) || "GG"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-xl font-bold">{member.name}</CardTitle>
                      <Badge 
                        variant={member.role === 'admin' || member.role === 'super_admin' ? "default" : "secondary"}
                        className="mt-1 font-black uppercase text-[10px]"
                      >
                        {member.role === 'super_admin' ? 'Super Admin' : member.role === 'admin' ? 'Patron' : 'Employé'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-4">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <UserIcon className="w-4 h-4" />
                    <span>ID: {member.loginId}</span>
                  </div>
                  {member.role !== 'employee' && (
                    <div className="flex items-center gap-3 text-sm text-emerald-600 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="uppercase text-[10px] tracking-widest">Accès Administrateur</span>
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
