'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, FolderOpen, FileUp, FileText, Loader2, Sparkles, AlertCircle, CheckCircle2, Info, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, useUser, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { useState, useRef } from 'react';
import { analyzeUploadedDocument, AnalyzeUploadedDocumentOutput } from '@/ai/flows/analyze-uploaded-document';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ImportStep = 'idle' | 'confirm_analysis' | 'analyzing' | 'confirm_placement';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [currentFileUrl, setCurrentFileUrl] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<AnalyzeUploadedDocumentOutput | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId || 'default-company';

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, companyId]);

  const { data: allCategories } = useCollection<Category>(categoriesQuery);

  const categoryRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, categoryId, companyId]);

  const { data: category, isLoading: isCatLoading } = useDoc<Category>(categoryRef);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCurrentFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCurrentFileUrl(e.target?.result as string);
      setImportStep('confirm_analysis');
    };
    reader.readAsDataURL(file);
    // On réinitialise l'input pour permettre de sélectionner le même fichier deux fois
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startAiAnalysis = async () => {
    if (!currentFileUrl || !allCategories) return;
    setImportStep('analyzing');
    try {
      const result = await analyzeUploadedDocument({
        fileUrl: currentFileUrl,
        currentCategoryId: categoryId,
        availableCategories: allCategories.map(c => ({
          id: c.id,
          label: c.label,
          subCategories: c.subCategories || []
        }))
      });
      setAnalysisResult(result);
      setImportStep('confirm_placement');
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erreur d'analyse IA",
        description: "L'IA n'a pas pu traiter ce document. Passage au classement standard.",
      });
      setImportStep('idle');
    }
  };

  const finalizeImport = () => {
    if (!db || !companyId || !analysisResult) return;

    const targetCategoryId = analysisResult.suggestedCategoryId;
    const targetSubCategory = analysisResult.suggestedSubCategory;

    // Si c'est un nouveau sous-dossier suggéré par l'IA, on met à jour la catégorie
    if (analysisResult.isNewSubCategory) {
      const targetCatRef = doc(db, 'companies', companyId, 'categories', targetCategoryId);
      const targetCatData = allCategories?.find(c => c.id === targetCategoryId);
      const updatedSubs = [...(targetCatData?.subCategories || []), targetSubCategory];
      updateDocumentNonBlocking(targetCatRef, { subCategories: updatedSubs });
    }

    const docsRef = collection(db, 'companies', companyId, 'documents');
    addDocumentNonBlocking(docsRef, {
      name: analysisResult.name,
      categoryId: targetCategoryId,
      subCategory: targetSubCategory,
      projectColumn: 'administrative',
      status: 'waiting_verification',
      extractedData: analysisResult.extractedData,
      fileUrl: currentFileUrl,
      createdAt: new Date().toLocaleDateString(),
      companyId: companyId
    });

    toast({
      title: "Document classé avec succès !",
      description: `Rangé dans ${analysisResult.suggestedCategoryLabel} > ${targetSubCategory}`,
    });

    setImportStep('idle');
    // Si l'IA a suggéré une autre catégorie, on redirige l'utilisateur
    if (targetCategoryId !== categoryId) {
      router.push(`/categories/${targetCategoryId}`);
    }
  };

  const isImageFile = currentFileName.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/);

  return (
    <DashboardLayout>
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="application/pdf,image/png,image/jpeg,image/webp" 
      />
      
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" /> Retour au tableau de bord
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                {isCatLoading ? 'Chargement...' : (category?.label || 'Catégorie')}
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="w-5 h-5 mr-2" /> Importer un document / photo
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveSubCategory}>
            <div className="border-b bg-muted/20 px-4">
              <TabsList className="h-14 bg-transparent gap-6">
                <TabsTrigger value="all" className="rounded-none h-full px-4 font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary">Tout voir</TabsTrigger>
                {(category?.subCategories || []).map((sub) => (
                  <TabsTrigger key={sub} value={sub} className="rounded-none h-full px-4 font-semibold data-[state=active]:border-b-2 data-[state=active]:border-primary flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" /> {sub}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <div className="p-6">
              <TabsContent value="all" className="mt-0">
                <DocumentList categoryId={categoryId} />
              </TabsContent>
              {(category?.subCategories || []).map((sub) => (
                <TabsContent key={sub} value={sub} className="mt-0">
                  <DocumentList categoryId={categoryId} subCategory={sub} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      </div>

      <Dialog open={importStep !== 'idle'} onOpenChange={(open) => !open && setImportStep('idle')}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <div className="sr-only">
            <DialogTitle>Importation intelligente de document ou image</DialogTitle>
            <DialogDescription>Processus d'analyse OCR et de rangement automatique via IA.</DialogDescription>
          </div>
          
          {importStep === 'confirm_analysis' && (
            <div className="p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                  {isImageFile ? <ImageIcon className="w-6 h-6 text-primary" /> : <FileText className="w-6 h-6 text-primary" />}
                  Nouveau fichier
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Fichier : <span className="font-semibold text-foreground">{currentFileName}</span>
                </DialogDescription>
              </DialogHeader>
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 text-center space-y-3">
                <Sparkles className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm font-medium">Lancer l'analyse intelligente ?</p>
                <p className="text-xs text-muted-foreground">L'IA Gemini 2.5 Flash Lite va lire votre {isImageFile ? 'photo' : 'document'} pour identifier le meilleur dossier (OCR).</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setImportStep('idle')} className="flex-1">Annuler</Button>
                <Button onClick={startAiAnalysis} className="flex-1 bg-primary">Analyser via IA</Button>
              </div>
            </div>
          )}

          {importStep === 'analyzing' && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[350px]">
              <DialogHeader className="items-center">
                <div className="relative">
                  <Loader2 className="w-16 h-16 text-primary animate-spin" />
                  <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <DialogTitle className="text-2xl font-bold mt-6">Lecture OCR en cours...</DialogTitle>
                <DialogDescription className="max-w-[300px]">
                  L'IA analyse le contenu de votre {isImageFile ? 'image' : 'document'} pour déterminer son importance et son rangement.
                </DialogDescription>
              </DialogHeader>
            </div>
          )}

          {importStep === 'confirm_placement' && analysisResult && (
            <div className="p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                   <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Analyse terminée
                </DialogTitle>
                <DialogDescription>Voici la proposition de rangement établie par l'IA.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-xl border space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Titre identifié</span>
                  <p className="font-bold text-primary">{analysisResult.name}</p>
                </div>

                <div className={cn(
                  "p-4 rounded-xl border space-y-2",
                  analysisResult.isNewSubCategory ? "bg-amber-50 border-amber-200" : "bg-primary/5 border-primary/20"
                )}>
                  <div className="flex justify-between items-center">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", analysisResult.isNewSubCategory ? "text-amber-700" : "text-primary")}>
                      {analysisResult.isNewSubCategory ? "Nouveau sous-dossier proposé" : "Dossier de destination"}
                    </span>
                    {analysisResult.isNewSubCategory && <Badge className="bg-amber-600">Création IA</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary">{analysisResult.suggestedCategoryLabel}</Badge>
                    <span className="text-muted-foreground">/</span>
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <FolderOpen className="w-3 h-3" />
                      {analysisResult.suggestedSubCategory}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 bg-muted/30 rounded-xl border border-dashed">
                  <div className="flex gap-2 items-start">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      "{analysisResult.reasoning}"
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setImportStep('idle')} className="flex-1">Ignorer</Button>
                <Button onClick={finalizeImport} className="flex-1 bg-primary">Valider & Ranger</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
