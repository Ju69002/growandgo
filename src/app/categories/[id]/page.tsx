'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Upload, ChevronLeft, Filter, Download } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Category } from '@/lib/types';

export default function CategoryPage() {
  const params = useParams();
  const categoryId = params.id as string;
  const db = useFirestore();
  const companyId = 'default-company';

  const categoryRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, categoryId, companyId]);

  const { data: category, isLoading } = useDoc<Category>(categoryRef);

  const handleImport = () => {
    if (!db) return;
    const docsRef = collection(db, 'companies', companyId, 'documents');
    
    // Simulate an import for the prototype
    const name = prompt("Nom du fichier à simuler :", "Facture_Achat.pdf");
    if (name) {
      addDocumentNonBlocking(docsRef, {
        name,
        category_id: categoryId,
        project_column: 'budget',
        status: 'pending_analysis',
        extracted_data: {},
        file_url: 'https://picsum.photos/seed/doc/200/300',
        created_at: new Date().toLocaleDateString(),
        companyId: companyId
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour au dashboard
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-primary">
              {isLoading ? 'Chargement...' : (category?.label || 'Catégorie')}
            </h1>
            <p className="text-muted-foreground">
              {category?.ai_instructions || "Gérez vos documents et validez les extractions de l'IA."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtres
            </Button>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
            <Button 
              size="sm" 
              className="bg-primary hover:bg-primary/90"
              onClick={handleImport}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importer
            </Button>
          </div>
        </div>

        <DocumentList categoryId={categoryId} />
      </div>
    </DashboardLayout>
  );
}
