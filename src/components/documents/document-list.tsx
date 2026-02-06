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
import { MoreHorizontal, FileText, CheckCircle2, AlertCircle, Clock, FolderOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  const handleDelete = (docId: string) => {
    if (!db || !companyId) return;
    const docRef = doc(db, 'companies', companyId, 'documents', docId);
    deleteDocumentNonBlocking(docRef);
  };

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
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[350px]">Document</TableHead>
            <TableHead>Sous-dossier</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Date d'import</TableHead>
            <TableHead>Détails IA</TableHead>
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
                <TableCell>
                  <div className="text-xs space-y-0.5 max-w-[150px]">
                    {Object.entries(doc.extractedData || {}).length > 0 ? (
                      Object.entries(doc.extractedData).slice(0, 2).map(([k, v]) => (
                        <div key={k} className="truncate">
                          <span className="text-muted-foreground uppercase text-[10px] font-bold">{k}:</span> {String(v)}
                        </div>
                      ))
                    ) : (
                      <span className="italic text-muted-foreground">Analyse IA...</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Gestion</DropdownMenuLabel>
                      <DropdownMenuItem>Voir</DropdownMenuItem>
                      <DropdownMenuItem>Vérifier</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(doc.id)}>
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
