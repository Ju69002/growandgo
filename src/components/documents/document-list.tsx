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
import { MoreHorizontal, FileText, CheckCircle2, AlertCircle, Clock, Archive } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BusinessDocument, DocumentStatus } from '@/lib/types';

const statusConfig: Record<DocumentStatus, { label: string; icon: any; color: string }> = {
  pending_analysis: { label: 'Analyse IA', icon: Clock, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  waiting_verification: { label: 'Vérification', icon: AlertCircle, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  waiting_validation: { label: 'Validation', icon: AlertCircle, color: 'bg-destructive/10 text-destructive border-destructive/20' },
  archived: { label: 'Archivé', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

const MOCK_DOCS: BusinessDocument[] = [
  {
    id: '1',
    category_id: 'finance',
    name: 'Facture Amazon Web Services - Janvier.pdf',
    status: 'waiting_verification',
    project_column: 'budget',
    extracted_data: { montant: '124.50€', tva: '20.75€' },
    file_url: '#',
    created_at: '2023-11-01',
  },
  {
    id: '2',
    category_id: 'finance',
    name: 'Loyer Bureau - Quittance.pdf',
    status: 'archived',
    project_column: 'administrative',
    extracted_data: { montant: '1500€' },
    file_url: '#',
    created_at: '2023-10-25',
  },
  {
    id: '3',
    category_id: 'finance',
    name: 'Note de frais - Déjeuner Client.jpg',
    status: 'pending_analysis',
    project_column: 'budget',
    extracted_data: {},
    file_url: '#',
    created_at: '2023-11-02',
  },
  {
    id: '4',
    category_id: 'finance',
    name: 'Contrat Maintenance Serveur.pdf',
    status: 'waiting_validation',
    project_column: 'administrative',
    extracted_data: { client: 'TechCorp' },
    file_url: '#',
    created_at: '2023-10-30',
  },
];

export function DocumentList({ categoryId }: { categoryId: string }) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
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
          {MOCK_DOCS.map((doc) => {
            const status = statusConfig[doc.status];
            return (
              <TableRow key={doc.id} className="hover:bg-muted/10 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <span className="truncate max-w-[250px]">{doc.name}</span>
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
                    {Object.entries(doc.extracted_data).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-muted-foreground uppercase text-[10px] font-bold">{k}:</span> {v}
                      </div>
                    ))}
                    {Object.keys(doc.extracted_data).length === 0 && (
                      <span className="italic text-muted-foreground">En cours...</span>
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
                      <DropdownMenuItem className="text-destructive">Supprimer</DropdownMenuItem>
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