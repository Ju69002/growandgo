'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, FolderOpen, Loader2, FileUp, Check, X, FileText, Info, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { useState, useRef } from 'react';
import { analyzeUploadedDocument, AnalyzeUploadedDocumentOutput } from '@/ai/flows/analyze-uploaded-document';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedDoc, setAnalyzedDoc] = useState<AnalyzeUploadedDocumentOutput | null>(null);
  
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  
  const [currentFileUrl, setCurrentFileUrl] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: category, isLoading: isCatLoading } = useDoc<Category>(categoryRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, companyId]);

  const { data: allCategories } = useCollection<Category>(categoriesQuery);

  const handleStartImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      setCurrentFileUrl(dataUri);
      setShowImportConfirm(true); // Ouvrir le premier pop-up de confirmation
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startAiAnalysis = async () => {
    if (!currentFileUrl || !db || !companyId) return;

    if (!allCategories || allCategories.length === 0) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Les catégories ne sont pas encore chargées. Veuillez réessayer.",
      });
      return;
    }

    setShowImportConfirm(false);
    setIsAnalyzing(true);

    try {
      const analysis = await analyzeUploadedDocument({
        fileUrl: currentFileUrl,
        currentCategoryId: categoryId,
        availableCategories: allCategories.map(c => ({
          id: c.id,
          label: c.label,
          subCategories: c.subCategories || []
        }))
      });

      if (analysis) {
        setAnalyzedDoc(analysis);
        setShowValidation(true);
      } else {
        throw new Error("Pas de réponse de l'IA");
      }
    } catch (error) {
      console.error("Analyse error:", error);
      toast({
        variant: "destructive",
        title: "Erreur d'analyse",
        description: "L'IA n'a pas pu traiter ce document. Vérifiez le format (PDF ou Image).",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const confirmClassification = () => {
    if (!db || !companyId || !analyzedDoc) return;

    const docsRef = collection(db, 'companies', companyId, 'documents');
    
    addDocumentNonBlocking(docsRef, {
      name: analyzedDoc.name,
      categoryId: analyzedDoc.suggestedCategoryId,
      subCategory: analyzedDoc.suggestedSubCategory,
      projectColumn: 'administrative',
      status: 'waiting_verification',
      extractedData: analyzedDoc.extractedData,
      fileUrl: currentFileUrl,
      createdAt: new Date().toLocaleDateString(),
      companyId: companyId
    });

    toast({
      title: "Document classé avec succès",
      description: `Le document a été rangé dans ${analyzedDoc.suggestedCategoryLabel} > ${analyzedDoc.suggestedSubCategory}`,
    });

    setShowValidation(false);
    
    if (analyzedDoc.suggestedCategoryId !== categoryId) {
      router.push(`/categories/${analyzedDoc.suggestedCategoryId}`);
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
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        accept="application/pdf,image/*"
      />
      
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour au dashboard
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                {isCatLoading ? 'Chargement...' : (category?.label || 'Catégorie')}
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
              onClick={handleStartImport}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Analyse IA en cours...
                </>
              ) : (
                <>
                  <FileUp className="w-5 h-5 mr-2" />
                  Importer un document
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

      {/* Pop-up 1 : Confirmation après sélection du fichier */}
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <FileUp className="w-5 h-5" />
              Document importé
            </DialogTitle>
            <DialogDescription>
              Le fichier <strong>{currentFileName}</strong> a été chargé avec succès. Que souhaitez-vous faire ?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6 bg-muted/20 rounded-xl border border-dashed">
            <FileText className="w-12 h-12 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">{currentFileName}</span>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowImportConfirm(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={startAiAnalysis} className="flex-1 bg-primary hover:bg-primary/90">
              <FileSearch className="w-4 h-4 mr-2" />
              Analyser et Classer par l'IA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pop-up 2 : Validation du classement IA */}
      <Dialog open={showValidation} onOpenChange={setShowValidation}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Info className="w-5 h-5" />
              Confirmation du classement IA
            </DialogTitle>
            <DialogDescription>
              L'IA a analysé votre document. Veuillez confirmer le rangement suggéré.
            </DialogDescription>
          </DialogHeader>

          {analyzedDoc ? (
            <div className="space-y-6 py-4">
              <Card className="bg-muted/30 border-none">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-lg">{analyzedDoc.name}</h4>
                      <p className="text-sm text-muted-foreground">{analyzedDoc.summary}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Ranger dans</span>
                      <div className="flex items-center gap-2 font-semibold">
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                          {analyzedDoc.suggestedCategoryLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Sous-dossier</span>
                      <div className="flex items-center gap-2 font-semibold">
                        <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/20">
                          {analyzedDoc.suggestedSubCategory}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {Object.keys(analyzedDoc.extractedData || {}).length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Données extraites par l'IA</span>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(analyzedDoc.extractedData).map(([key, value]) => (
                      <div key={key} className="bg-muted/50 p-2 rounded-lg text-xs">
                        <span className="text-muted-foreground font-medium">{key}:</span> {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowValidation(false)} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={confirmClassification} className="flex-1 bg-primary hover:bg-primary/90">
              <Check className="w-4 h-4 mr-2" />
              Valider & Ranger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
