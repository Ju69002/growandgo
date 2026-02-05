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
import { MoreHorizontal, FileText, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BusinessDocument, DocumentStatus } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';

const statusConfig: Record<DocumentStatus, { label: string; icon: any; color: string }> = {
  pending_analysis: { label: 'Analyse IA', icon: Clock, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  waiting_verification: { label: 'Vérification', icon: AlertCircle, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  waiting_validation: { label: 'Validation', icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  archived: { label: 'Archivé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function DocumentList({ categoryId }: { categoryId: string }) {
  const db = useFirestore();
  const companyId = 'default-company';

  const docsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'companies', companyId, 'documents'),
      where('category_id', '==', categoryId)
    );
  }, [db, categoryId, companyId]);

  const { data: documents, isLoading } = useCollection<BusinessDocument>(docsQuery);

  const handleDelete = (docId: string) => {
    if (!db) return;
    const docRef = doc(db, 'companies', companyId, 'documents', docId);
    deleteDocumentNonBlocking(docRef);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Chargement des documents...</div>;
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-card text-muted-foreground">
        <FileText className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium text-lg">Aucun document trouvé</p>
        <p className="text-sm">Importez votre premier fichier pour commencer l'analyse.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow>
            <TableHead className="w-[400px]">Document</TableHead>
            <TableHead>Type</TableHead>
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
                    <div className="p-2 bg-muted rounded-lg">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="truncate max-w-[250px]">{doc.name || 'Sans titre'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {doc.project_column}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={status.color}>
                    <status.icon className="w-3 h-3 mr-1.5" />
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {doc.created_at}
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-0.5">
                    {Object.entries(doc.extracted_data || {}).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground uppercase text-[10px] font-bold">{k}:</span> {String(v)}
                      </div>
                    ))}
                    {Object.keys(doc.extracted_data || {}).length === 0 && (
                      <span className="italic text-muted-foreground">Analyse en cours...</span>
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
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>Voir le document</DropdownMenuItem>
                      <DropdownMenuItem>Vérifier l'extraction</DropdownMenuItem>
                      <DropdownMenuItem>Valider</DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
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
