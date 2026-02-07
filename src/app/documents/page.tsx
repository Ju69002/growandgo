'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { User, BusinessDocument } from '@/lib/types';
import { FileText, Loader2, FolderSearch, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function GlobalDocumentsPage() {
  const { user } = useUser();
  const db = useFirestore();

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const allDocsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'documents'));
  }, [db, companyId]);

  const { data: documents, isLoading } = useCollection<BusinessDocument>(allDocsQuery);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-primary uppercase">Tous les Documents</h1>
            <p className="text-muted-foreground font-medium">Gérez l'ensemble des fichiers de votre studio Grow&Go.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-30" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Récupération des documents...</p>
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed rounded-[2rem] bg-muted/10 text-muted-foreground gap-4">
            <FolderSearch className="w-16 h-16 opacity-20" />
            <p className="font-bold text-xl uppercase tracking-tighter">Aucun document trouvé</p>
            <p className="text-sm">Importez des documents depuis le tableau de bord ou une catégorie.</p>
          </div>
        ) : (
          <div className="bg-card rounded-[2rem] border-none shadow-xl overflow-hidden">
             <div className="p-8">
               <p className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-6">{documents.length} DOCUMENTS AU TOTAL</p>
               <div className="rounded-2xl border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">
                    <tr>
                      <th className="px-6 py-4">Nom du fichier</th>
                      <th className="px-6 py-4">Catégorie</th>
                      <th className="px-6 py-4">Statut</th>
                      <th className="px-6 py-4">Importé le</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-primary/5 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-primary/40" />
                            <span className="font-bold text-foreground">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="uppercase text-[9px] font-black border-primary/10">
                            {doc.categoryId}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Badge className="font-black uppercase text-[9px] bg-primary/10 text-primary border-none">
                            {doc.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground">{doc.createdAt}</td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/categories/${doc.categoryId}`}>
                            <Badge className="cursor-pointer hover:bg-primary transition-colors bg-muted text-muted-foreground hover:text-white flex items-center gap-2 w-fit ml-auto">
                              <Eye className="w-3 h-3" /> VOIR
                            </Badge>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               </div>
             </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
