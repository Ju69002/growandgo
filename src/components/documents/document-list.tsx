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
import { MoreHorizontal, FileText, CheckCircle2, AlertCircle, Clock, FolderOpen, Eye, X, Download, ExternalLink, Loader2 } from 'lucide-react';
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
import { BusinessDocument, DocumentStatus, User } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

const statusConfig: Record<DocumentStatus, { label: string; icon: any; color: string }> = {
  pending_analysis: { label: 'Analyse IA', icon: Clock, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  waiting_verification: { label: 'Vérification', icon: AlertCircle, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  waiting_validation: { label: 'Validation', icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  archived: { label: 'Archivé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

interface DocumentListProps {
  categoryId: string;
  subCategory?: string;
}

export function DocumentList({ categoryId, subCategory }: DocumentListProps) {
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
  const companyId = profile?.companyId || 'default-company';

  const docsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    
    let q = query(
      collection(db, 'companies', companyId, 'documents'),
      where('categoryId', '==', categoryId)
    );

    if (subCategory) {
      q = query(q, where('subCategory', '==', subCategory));
    }

    return q;
  }, [db, categoryId, companyId, subCategory]);

  const { data: documents, isLoading } = useCollection<BusinessDocument>(docsQuery);

  React.useEffect(() => {
    if (viewingDoc?.fileUrl) {
      setIsBlobLoading(true);
      if (viewingDoc.fileUrl.startsWith('data:')) {
        try {
          const parts = viewingDoc.fileUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const b64Data = parts[1];
          const byteCharacters = atob(b64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mime });
          const url = URL.createObjectURL(blob);
          setSafeUrl(url);
          setIsBlobLoading(false);
          return () => URL.revokeObjectURL(url);
        } catch (e) {
          setSafeUrl(viewingDoc.fileUrl);
          setIsBlobLoading(false);
        }
      } else {
        setSafeUrl(viewingDoc.fileUrl);
        setIsBlobLoading(false);
      }
    } else {
      setSafeUrl(null);
      setIsBlobLoading(false);
    }
  }, [viewingDoc]);

  const handleDelete = (docId: string) => {
    if (!db || !companyId) return;
    const docRef = doc(db, 'companies', companyId, 'documents', docId);
    deleteDocumentNonBlocking(docRef);
  };

  const isPDF = (url: string) => url.toLowerCase().includes('pdf') || url.toLowerCase().includes('application/pdf');

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des documents...</div>;
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground">
        <FolderOpen className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium text-lg">Dossier vide</p>
        <p className="text-sm">Aucun document n'a encore été classé dans {subCategory || 'cette section'}.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[350px]">Document</TableHead>
              <TableHead>Sous-dossier</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date d'import</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => {
              const status = statusConfig[doc.status] || statusConfig.pending_analysis;
              return (
                <TableRow key={doc.id} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <span className="truncate max-w-[200px]">{doc.name || 'Sans titre'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <FolderOpen className="w-3 h-3" />
                      {doc.subCategory || 'Général'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={status.color}>
                      <status.icon className="w-3 h-3 mr-1.5" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {doc.createdAt}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 gap-2" onClick={() => setViewingDoc(doc)}>
                        <Eye className="w-4 h-4" />
                        Voir
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Gestion</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setViewingDoc(doc)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ouvrir
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <a href={doc.fileUrl} download={doc.name} className="flex items-center">
                              <Download className="w-4 h-4 mr-2" />
                              Télécharger
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(doc.id)}>
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
        <DialogContent className="sm:max-w-[95vw] h-[95vh] p-0 flex flex-col gap-0 overflow-hidden bg-slate-900 border-none">
          <DialogHeader className="p-4 border-b bg-card flex flex-row items-center justify-between space-y-0 z-20">
            <div className="flex-1 min-w-0 pr-4">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 truncate">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                {viewingDoc?.name}
              </DialogTitle>
              <DialogDescription className="truncate">
                {viewingDoc?.subCategory || 'Général'} • Importé le {viewingDoc?.createdAt}
              </DialogDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
               <Button variant="outline" size="sm" asChild>
                  <a href={safeUrl || viewingDoc?.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ouvrir externe
                  </a>
               </Button>
               <Button variant="outline" size="sm" asChild>
                  <a href={safeUrl || viewingDoc?.fileUrl} download={viewingDoc?.name}>
                    <Download className="w-4 h-4 mr-2" />
                    Télécharger
                  </a>
               </Button>
               <Button variant="ghost" size="icon" onClick={() => setViewingDoc(null)}>
                  <X className="w-5 h-5" />
               </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-slate-800/50 flex items-center justify-center overflow-hidden relative">
            {isBlobLoading ? (
              <div className="flex flex-col items-center gap-4 text-white">
                <Loader2 className="w-12 h-12 animate-spin opacity-50" />
                <p className="text-sm font-medium animate-pulse">Préparation du document...</p>
              </div>
            ) : viewingDoc && safeUrl && (
              isPDF(viewingDoc.fileUrl) ? (
                <iframe
                  src={`${safeUrl}#toolbar=0&navpanes=0`}
                  className="w-full h-full border-none bg-white"
                  title={viewingDoc.name}
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                  <img
                    src={safeUrl}
                    alt={viewingDoc.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
