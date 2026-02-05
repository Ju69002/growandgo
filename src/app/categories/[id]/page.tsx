import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Upload, ChevronLeft, Filter, Download } from 'lucide-react';
import Link from 'next/link';

export default function CategoryPage({ params }: { params: { id: string } }) {
  const categoryId = params.id;
  
  // Mock category data
  const categoryName = categoryId.charAt(0).toUpperCase() + categoryId.slice(1);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour au dashboard
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-primary">{categoryName}</h1>
            <p className="text-muted-foreground">Gérez vos documents et validez les extractions de l'IA.</p>
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
            <Button size="sm" className="bg-primary">
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