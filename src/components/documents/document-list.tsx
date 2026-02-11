
'use client';

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, FileText, CheckCircle2, AlertCircle, Clock, FolderOpen, Eye, X, ExternalLink, Loader2, EyeOff, Hash, Zap } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { BusinessDocument, User, Category } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

export function DocumentList({ categoryId, subCategory }: { categoryId: string; subCategory?: string }) {
  const db = useFirestore();
  const { user } = useUser();
  const [viewingDoc, setViewingDoc] = React.useState<BusinessDocument | null>(null);
  const [safeUrl, setSafeUrl] = React.useState<string | null>(null);
  const [isBlobLoading, setIsBlobLoading] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId; 

  const categoryRef = useMemoFirebase(() => {
    if (!db || !companyId || !categoryId) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, companyId, categoryId]);
  const { data: category } = useDoc<Category>(categoryRef);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !companyId || !categoryId) return null;
    
    const filterField = category?.isClientFolder ? 'clientId' : 'categoryId';
    let q = query(
      collection(db, 'companies', companyId, 'documents'),
      where(filterField, '==', categoryId)
    );

    if (subCategory && subCategory !== 'all') {
      q = query(q, where('subCategory', '==', subCategory));
    }

    return q;
  }, [db, categoryId, companyId, subCategory, category?.isClientFolder]);

  const { data: documents, isLoading } = useCollection<BusinessDocument>(docsQuery);

  React.useEffect(() => {
    let url: string | null = null;
    const prepareDoc = async () => {
      if (!viewingDoc?.fileUrl) { setSafeUrl(null); return; }
      setIsBlobLoading(true);
      try {
        if (viewingDoc.fileUrl.startsWith('data:')) {
          const parts = viewingDoc.fileUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const b64Data = parts[1];
          const byteCharacters = atob(b64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mime });
          url = URL.createObjectURL(blob);
          setSafeUrl(url);
        } else {
          setSafeUrl(viewingDoc.fileUrl);
        }
      } catch (e) {
        setSafeUrl(viewingDoc.fileUrl);
      } finally {
        setIsBlobLoading(false);
      }
    };
    prepareDoc();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [viewingDoc]);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des documents...</div>;

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground">
        <FolderOpen className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium text-lg">Dossier vide</p>
        <p className="text-sm">Aucun document archivé ici.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-in fade-in">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[350px]">Archive</TableHead>
              <TableHead>Sous-dossier</TableHead>
              <TableHead>Émetteur</TableHead>
              <TableHead>Date / Fidélité</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg text-primary"><FileText className="w-5 h-5" /></div>
                    <div className="flex flex-col max-w-[200px]">
                      <span className="truncate font-bold">{doc.name}</span>
                      <span className="text-[10px] text-muted-foreground italic truncate">{doc.summary_flash}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                    <FolderOpen className="w-3 h-3" /> {doc.subCategory}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-primary opacity-70">{doc.issuerEntity || 'Inconnu'}</span>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <div className="flex flex-col gap-1">
                    <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                    <Badge className="w-fit text-[8px] h-4 bg-emerald-500/10 text-emerald-600 border-none">{doc.confidenceScore}%</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setViewingDoc(doc)}><Eye className="w-4 h-4" /> Voir</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setViewingDoc(doc)}><Eye className="w-4 h-4 mr-2" /> Aperçu</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteDocumentNonBlocking(doc(db, 'companies', companyId!, 'documents', doc.id))}>Supprimer</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewingDoc} onOpenChange={() => setViewingDoc(null)}>
        <DialogContent className="sm:max-w-[95vw] h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-950 border-none">
          <DialogHeader className="p-4 border-b bg-card flex flex-row items-center justify-between space-y-0 z-20">
            <div className="flex-1 min-w-0 pr-4">
              <div className="text-xl font-bold flex items-center gap-2 truncate text-primary uppercase tracking-tighter">
                <FileText className="w-5 h-5" /> {viewingDoc?.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground font-black uppercase">
                {viewingDoc?.category} / {viewingDoc?.subCategory} • Sujet : {viewingDoc?.clientName}
              </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" asChild><a href={safeUrl || viewingDoc?.fileUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4 mr-2" /> Ouvrir</a></Button>
               <Button variant="ghost" size="icon" onClick={() => setViewingDoc(null)} className="text-muted-foreground"><X className="w-5 h-5" /></Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden">
            <div className="md:col-span-2 bg-slate-900 flex items-center justify-center relative">
              {isBlobLoading ? (
                <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
              ) : viewingDoc && safeUrl ? (
                viewingDoc.fileUrl.includes('pdf') || viewingDoc.fileUrl.startsWith('data:application/pdf') ? (
                  <iframe src={`${safeUrl}#toolbar=0`} className="w-full h-full border-none bg-white" />
                ) : (
                  <img src={safeUrl} alt={viewingDoc.name} className="max-w-full max-h-full object-contain shadow-2xl" />
                )
              ) : <div className="text-white opacity-20">Aperçu indisponible</div>}
            </div>
            
            <div className="bg-white border-l p-8 space-y-8 overflow-y-auto">
              <div className="p-6 bg-primary/5 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Zap className="w-4 h-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Résumé IA</p>
                </div>
                <p className="text-sm font-medium leading-relaxed italic">"{viewingDoc?.summary_flash}"</p>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase opacity-40">Détails Extraits</p>
                <div className="grid gap-4">
                  {viewingDoc?.extractedData && Object.entries(viewingDoc.extractedData).map(([k, v]) => (
                    <div key={k} className="p-3 bg-muted/30 rounded-xl">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1">{k.replace(/_/g, ' ')}</p>
                      <p className="text-xs font-bold text-primary truncate">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
