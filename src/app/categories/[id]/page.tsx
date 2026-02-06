'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, ChevronLeft, Trash2, FolderOpen, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { useState } from 'react';
import { analyzeUploadedDocument } from '@/ai/flows/analyze-uploaded-document';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId || 'default-company';
  const isAdmin = profile?.role === 'admin' && profile?.adminMode;

  const categoryRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, categoryId, companyId]);

  const { data: category, isLoading } = useDoc<Category>(categoryRef);

  const handleImportWithAI = async () => {
    if (!db || !companyId || !category) return;
    setIsAnalyzing(true);
    
    // Simulation d'un fichier PDF
    const mockFileUrl = `https://picsum.photos/seed/${Math.random()}/800/1200`;
    
    try {
      // 1. On crée le document en mode "Analyse"
      const docsRef = collection(db, 'companies', companyId, 'documents');
      const tempDocId = "doc_" + Date.now();
      
      // 2. On lance l'analyse IA
      const analysis = await analyzeUploadedDocument({
        fileUrl: mockFileUrl,
        categoryId: categoryId,
        availableSubCategories: category.subCategories || ['Général']
      });

      // 3. On enregistre le document classé
      addDocumentNonBlocking(docsRef, {
        name: analysis.name,
        categoryId: categoryId,
        subCategory: analysis.suggestedSubCategory,
        projectColumn: 'administrative',
        status: 'waiting_verification',
        extractedData: analysis.extractedData,
        fileUrl: mockFileUrl,
        createdAt: new Date().toLocaleDateString(),
        companyId: companyId
      });

      toast({
        title: "Document classé par l'IA",
        description: `Le fichier a été rangé dans : ${analysis.suggestedSubCategory}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur d'analyse",
        description: "L'IA n'a pas pu traiter ce document.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteCategory = () => {
    if (!db || !categoryRef) return;
    deleteDocumentNonBlocking(categoryRef);
    router.push('/');
  };

  const subCategories = category?.subCategories || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour au dashboard
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                {isLoading ? 'Chargement...' : (category?.label || 'Catégorie')}
              </h1>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer cette catégorie ?</AlertDialogTitle>
                      <AlertDialogDescription>Toutes les données seront définitivement supprimées.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-white hover:bg-destructive/90">
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 shadow-lg transition-all active:scale-95" 
              onClick={handleImportWithAI}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyse IA en cours...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Scanner & Classer un PDF
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveSubCategory}>
            <div className="border-b bg-muted/20 px-4">
              <TabsList className="h-14 bg-transparent gap-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4 font-semibold">
                  Tous les documents
                </TabsTrigger>
                {subCategories.map((sub) => (
                  <TabsTrigger key={sub} value={sub} className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4 font-semibold flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    {sub}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="p-6">
              <TabsContent value="all" className="mt-0">
                <DocumentList categoryId={categoryId} />
              </TabsContent>
              {subCategories.map((sub) => (
                <TabsContent key={sub} value={sub} className="mt-0">
                  <DocumentList categoryId={categoryId} subCategory={sub} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
