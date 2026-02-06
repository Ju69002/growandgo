
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, FolderOpen, Loader2, FileUp, Check, X, FileText, Info, FileSearch, BrainCircuit, Sparkles } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';

type ImportStep = 'idle' | 'confirm' | 'analyzing' | 'results';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  
  // Machine à états pour l'import
  const [importStep, setImportStep] = useState<ImportStep>('idle');
  const [analyzedDoc, setAnalyzedDoc] = useState<AnalyzeUploadedDocumentOutput | null>(null);
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
      setImportStep('confirm');
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startAiAnalysis = async () => {
    if (!currentFileUrl || !allCategories) return;

    setImportStep('analyzing');

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
        setImportStep('results');
      } else {
        throw new Error("L'IA n'a pas pu analyser le document.");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      toast({
        variant: "destructive",
        title: "Échec de l'analyse",
        description: "L'IA n'a pas pu lire ce document. Vérifiez le format.",
      });
      setImportStep('idle');
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
      title: "Document classé !",
      description: `Rangé dans ${analyzedDoc.suggestedCategoryLabel} > ${analyzedDoc.suggestedSubCategory}`,
    });

    setImportStep('idle');
    setAnalyzedDoc(null);
    
    if (analyzedDoc.suggestedCategoryId !== categoryId) {
      router.push(`/categories/${analyzedDoc.suggestedCategoryId}`);
    }
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
              Retour au tableau de bord
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
                      <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
                      <AlertDialogDescription>Cela supprimera définitivement tous les réglages associés.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => {
                        if (categoryRef) deleteDocumentNonBlocking(categoryRef);
                        router.push('/');
                      }} className="bg-destructive text-white hover:bg-destructive/90">
                        Confirmer la suppression
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
            >
              <FileUp className="w-5 h-5 mr-2" />
              Importer un document
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveSubCategory}>
            <div className="border-b bg-muted/20 px-4">
              <TabsList className="h-14 bg-transparent gap-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4 font-semibold text-muted-foreground data-[state=active]:text-primary">
                  Tout voir
                </TabsTrigger>
                {subCategories.map((sub) => (
                  <TabsTrigger key={sub} value={sub} className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none h-full px-4 font-semibold text-muted-foreground data-[state=active]:text-primary flex items-center gap-2">
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

      {/* MODAL UNIQUE POUR LE FLUX D'IMPORTATION */}
      <Dialog open={importStep !== 'idle'} onOpenChange={(open) => !open && setImportStep('idle')}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
          
          {/* ÉTAPE 1 : CONFIRMATION D'IMPORT */}
          {importStep === 'confirm' && (
            <div className="p-8 space-y-6">
              <DialogHeader className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-primary">Document prêt</DialogTitle>
                  <DialogDescription className="text-muted-foreground">Fichier : <span className="font-semibold text-foreground">{currentFileName}</span></DialogDescription>
                </div>
              </DialogHeader>
              <div className="bg-muted/50 p-6 rounded-2xl border-2 border-dashed border-primary/20 text-center">
                <p className="text-sm text-muted-foreground">
                  Voulez-vous que l'IA utilise l'OCR pour analyser, nommer et classer ce document automatiquement dans vos dossiers ?
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setImportStep('idle')} className="flex-1 h-12 rounded-xl">
                  Annuler
                </Button>
                <Button onClick={startAiAnalysis} className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-md">
                  <BrainCircuit className="w-4 h-4 mr-2" />
                  Analyser & Classer
                </Button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : ANALYSE EN COURS */}
          {importStep === 'analyzing' && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
              <DialogHeader className="items-center">
                <div className="relative mb-4">
                  <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <BrainCircuit className="w-10 h-10 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                <DialogTitle className="text-2xl font-bold text-primary animate-pulse text-center">Analyse OCR en cours...</DialogTitle>
                <DialogDescription className="text-muted-foreground max-w-[300px] text-center">L'IA lit le contenu de votre document pour déterminer le meilleur emplacement.</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <div className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-primary/80 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : RÉSULTATS ET VALIDATION */}
          {importStep === 'results' && analyzedDoc && (
            <div className="animate-in fade-in zoom-in duration-300">
              <div className="bg-primary p-6 text-primary-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6" />
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-primary-foreground">Diagnostic de l'Architecte</DialogTitle>
                    <DialogDescription className="hidden">Confirmation du rangement du document analysé par l'IA.</DialogDescription>
                  </DialogHeader>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setImportStep('idle')} className="text-primary-foreground hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-8 space-y-6">
                <Card className="bg-primary/5 border-primary/20 border-2 shadow-none overflow-hidden">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-white border rounded-xl shadow-sm text-primary">
                        <FileSearch className="w-8 h-8" />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-primary leading-tight truncate">{analyzedDoc.name}</h4>
                        <p className="text-xs text-muted-foreground italic line-clamp-2">"{analyzedDoc.summary}"</p>
                      </div>
                    </div>

                    <Separator className="bg-primary/10" />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1 p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-[10px] font-black uppercase text-primary/60 tracking-tighter block">Dossier suggéré</span>
                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                          {analyzedDoc.suggestedCategoryLabel}
                        </Badge>
                      </div>
                      <div className="space-y-1 p-3 bg-white rounded-lg border shadow-sm">
                        <span className="text-[10px] font-black uppercase text-secondary/60 tracking-tighter block">Sous-dossier</span>
                        <Badge variant="outline" className="border-secondary/30 text-secondary font-bold">
                          {analyzedDoc.suggestedSubCategory}
                        </Badge>
                      </div>
                    </div>

                    {analyzedDoc.reasoning && (
                      <div className="p-3 bg-muted/40 rounded-lg text-[11px] text-muted-foreground border border-muted">
                        <span className="font-bold text-foreground">Logique IA :</span> {analyzedDoc.reasoning}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {Object.keys(analyzedDoc.extractedData || {}).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Données extraites par OCR</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(analyzedDoc.extractedData).slice(0, 4).map(([key, value]) => (
                        <div key={key} className="bg-muted/30 p-2.5 rounded-xl text-[11px] truncate border border-transparent">
                          <span className="text-muted-foreground font-bold uppercase text-[9px] block mb-0.5">{key}</span> 
                          <span className="font-semibold text-foreground">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <Button variant="ghost" onClick={() => setImportStep('idle')} className="flex-1 h-12 rounded-xl">
                    Annuler
                  </Button>
                  <Button onClick={confirmClassification} className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg active:scale-95 transition-all">
                    <Check className="w-5 h-5 mr-2" />
                    Valider & Ranger
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
