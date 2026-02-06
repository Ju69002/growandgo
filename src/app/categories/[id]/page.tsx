'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, FolderOpen, Loader2, FileUp, Check, X, FileText, Info, FileSearch, BrainCircuit } from 'lucide-react';
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

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const categoryId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const [activeSubCategory, setActiveSubCategory] = useState<string>('all');
  
  // States pour le flux d'importation
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
      setShowImportConfirm(true); 
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startAiAnalysis = async () => {
    if (!currentFileUrl || !db || !companyId || !allCategories) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Préparation de l'analyse impossible. Vérifiez que tout est chargé.",
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
        throw new Error("L'IA n'a pas retourné de diagnostic.");
      }
    } catch (error) {
      console.error("Analyse error:", error);
      toast({
        variant: "destructive",
        title: "Échec de l'analyse",
        description: "L'IA n'a pas pu lire ou classer ce document.",
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
      title: "Document rangé !",
      description: `${analyzedDoc.name} est maintenant dans ${analyzedDoc.suggestedCategoryLabel} > ${analyzedDoc.suggestedSubCategory}`,
    });

    setShowValidation(false);
    
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
                      <AlertDialogAction onClick={() => {
                        if (categoryRef) deleteDocumentNonBlocking(categoryRef);
                        router.push('/');
                      }} className="bg-destructive text-white hover:bg-destructive/90">
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
                  L'IA analyse le document...
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

      {/* Étape 1 : Pop-up d'accueil après sélection du fichier */}
      <Dialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary text-xl">
              <FileUp className="w-6 h-6" />
              Fichier chargé
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Le fichier <strong>{currentFileName}</strong> a été chargé avec succès.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-10 bg-muted/30 rounded-2xl border-2 border-dashed border-primary/20">
            <FileText className="w-16 h-16 text-primary/40 mb-3" />
            <span className="text-sm font-bold text-primary/80 uppercase tracking-widest">{currentFileName.split('.').pop()}</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Voulez-vous que l'IA utilise l'OCR pour analyser et classer ce document automatiquement ?
          </p>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowImportConfirm(false)} className="flex-1">
              Annuler
            </Button>
            <Button onClick={startAiAnalysis} className="flex-1 bg-primary hover:bg-primary/90 shadow-md">
              <BrainCircuit className="w-4 h-4 mr-2" />
              Analyser & Classer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Étape 2 : Pop-up de Diagnostic et Validation de la destination */}
      <Dialog open={showValidation} onOpenChange={setShowValidation}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary text-xl">
              <BrainCircuit className="w-6 h-6" />
              Diagnostic de l'IA
            </DialogTitle>
            <DialogDescription className="text-base pt-1">
              L'IA a terminé l'analyse OCR et suggère l'emplacement suivant :
            </DialogDescription>
          </DialogHeader>

          {analyzedDoc ? (
            <div className="space-y-6 py-4">
              <Card className="bg-primary/5 border-primary/10 border-2 shadow-none overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary text-primary-foreground rounded-xl shadow-lg">
                      <FileText className="w-8 h-8" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="font-bold text-xl text-primary leading-tight">{analyzedDoc.name}</h4>
                      <p className="text-sm text-muted-foreground font-medium italic">"{analyzedDoc.summary}"</p>
                    </div>
                  </div>

                  <Separator className="bg-primary/10" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 p-3 bg-white rounded-lg border shadow-sm">
                      <span className="text-[10px] font-black uppercase text-primary/60 tracking-tighter">Destination Suggérée</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-primary hover:bg-primary text-white text-xs px-2.5 py-0.5">
                          {analyzedDoc.suggestedCategoryLabel}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1.5 p-3 bg-white rounded-lg border shadow-sm">
                      <span className="text-[10px] font-black uppercase text-secondary/60 tracking-tighter">Sous-Dossier</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-secondary text-secondary font-bold text-xs px-2.5 py-0.5">
                          {analyzedDoc.suggestedSubCategory}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {analyzedDoc.reasoning && (
                    <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                      <span className="font-bold text-foreground">Logique IA :</span> {analyzedDoc.reasoning}
                    </div>
                  )}
                </CardContent>
              </Card>

              {Object.keys(analyzedDoc.extractedData || {}).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Données OCR extraites</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(analyzedDoc.extractedData).slice(0, 6).map(([key, value]) => (
                      <div key={key} className="bg-muted/30 p-2.5 rounded-xl text-[11px] truncate border border-transparent hover:border-muted-foreground/20 transition-colors">
                        <span className="text-muted-foreground font-bold uppercase text-[9px] block mb-0.5">{key}</span> 
                        <span className="font-semibold text-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Finalisation du diagnostic...</p>
            </div>
          )}

          <DialogFooter className="gap-3 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setShowValidation(false)} className="flex-1 h-11">
              <X className="w-4 h-4 mr-2" />
              Ignorer
            </Button>
            <Button onClick={confirmClassification} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11 shadow-lg active:scale-95 transition-all">
              <Check className="w-5 h-5 mr-2" />
              Valider & Ranger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
