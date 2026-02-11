
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, FolderOpen, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const categoryRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, categoryId, companyId]);

  const { data: category, isLoading: isCatLoading } = useDoc<Category>(categoryRef);

  const isAgenda = categoryId === 'agenda';

  if (!mounted) return null;

  return (
    <DashboardLayout>
      <div className={cn("space-y-6 mx-auto py-8", isAgenda ? "w-full px-0" : "max-w-7xl px-4 sm:px-6 lg:px-8")}>
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4", isAgenda && "px-8")}>
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" /> Retour au tableau de bord
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">
                {isCatLoading || !companyId ? 'Chargement...' : (category?.label || (isAgenda ? 'Agenda' : 'Dossier'))}
              </h1>
              {category?.isClientFolder && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-black uppercase text-[10px]">Dossier Client</Badge>
              )}
            </div>
          </div>
          
          {!isAgenda && (
            <Button asChild variant="outline" className="rounded-full border-primary/20 text-primary font-bold gap-2">
              <Link href="/documents">
                Aller au centre d'upload
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          )}
        </div>

        {!companyId ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground font-medium italic">Accès à l'espace de travail...</p>
          </div>
        ) : isAgenda ? (
          <div className="w-full bg-background min-h-[80vh]">
            <SharedCalendar companyId={companyId} defaultView="month" hideViewSwitcher={true} />
          </div>
        ) : (
          <div className="bg-card border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
            <Tabs defaultValue="all" className="w-full" onValueChange={setActiveSubCategory}>
              <div className="border-b bg-muted/10 px-8">
                <TabsList className="h-16 bg-transparent gap-8">
                  <TabsTrigger value="all" className="rounded-none h-full px-4 font-bold uppercase text-[10px] tracking-widest data-[state=active]:border-b-4 data-[state=active]:border-primary data-[state=active]:bg-transparent">Tout voir</TabsTrigger>
                  {(category?.subCategories || []).map((sub) => (
                    <TabsTrigger key={sub} value={sub} className="rounded-none h-full px-4 font-bold uppercase text-[10px] tracking-widest data-[state=active]:border-b-4 data-[state=active]:border-primary flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" /> {sub}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              <div className="p-8">
                <TabsContent value="all" className="mt-0">
                  <DocumentList categoryId={categoryId} />
                </TabsContent>
                {(category?.subCategories || []).map((sub) => (
                  <TabsContent key={sub} value={sub} className="mt-0">
                    <DocumentList categoryId={categoryId} subCategory={sub} />
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
