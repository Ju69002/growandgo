
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { SharedCalendar } from '@/components/agenda/shared-calendar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, FolderOpen, FileUp, FileText, Loader2, Sparkles, CheckCircle2, Info, ImageIcon, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, useUser, useCollection } from '@/firebase';
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

const compressImage = async (dataUrl: string, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
};

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
  const companyId = profile?.companyId;

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, companyId]);

  const { data: allCategories } = useCollection<Category>(categoriesQuery);

  const categoryRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId, 'categories', categoryId);
  }, [db, categoryId, companyId]);

  const { data: category, isLoading: isCatLoading } = useDoc<Category>(categoryRef);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCurrentFileName(file.name);
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = async (e) => {
      let resultUrl = e.target?.result as string;
      if (isImage) {
        try {
          toast({ title: "Optimisation de l'image...", description: "Réduction de la taille pour un traitement ultra-rapide." });
          resultUrl = await compressImage(resultUrl);
        } catch (err) { console.error(err); }
      }
      setCurrentFileUrl(resultUrl);
      setImportStep('confirm_analysis');
    };
    reader.readAsDataURL(file);
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
      toast({ variant: "destructive", title: "Erreur d'analyse IA", description: "L'IA n'a pas pu traiter ce document." });
      setImportStep('idle');
    }
  };

  const finalizeImport = () => {
    if (!db || !companyId || !analysisResult) return;
    const targetCategoryId = analysisResult.suggestedCategoryId;
    const targetSubCategory = analysisResult.suggestedSubCategory;
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
      createdAt: new Date().toLocaleDateString('fr-FR'),
      companyId: companyId
    });
    toast({ title: "Document classé !", description: `Rangé dans ${analysisResult.suggestedCategoryLabel} > ${targetSubCategory}` });
    setImportStep('idle');
    if (targetCategoryId !== categoryId) router.push(`/categories/${targetCategoryId}`);
  };

  const isAgenda = categoryId === 'agenda';

  return (
    <DashboardLayout>
      <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf,image/png,image/jpeg,image/webp" />
      
      <div className={cn("space-y-6 mx-auto py-8", isAgenda ? "w-full px-0" : "max-w-7xl px-4 sm:px-6 lg:px-8")}>
        <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4", isAgenda && "px-8")}>
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
              <ChevronLeft className="w-4 h-4 mr-1" /> Retour au tableau de bord
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                {isCatLoading || !companyId ? 'Chargement...' : (category?.label || (isAgenda ? 'Agenda' : 'Catégorie'))}
              </h1>
            </div>
          </div>
          {!isAgenda && companyId && (
            <div className="flex gap-3">
              <Button size="lg" className="bg-primary hover:bg-primary/90 shadow-lg" onClick={() => fileInputRef.current?.click()}>
                <FileUp className="w-5 h-5 mr-2" /> Importer un document / photo
              </Button>
            </div>
          )}
        </div>

        {!companyId ? (
          <div className="flex flex-col items-center justify-center p-20 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary opacity-50" />
            <p className="text-muted-foreground font-medium animate-pulse">Initialisation de votre espace...</p>
          </div>
        ) : isAgenda ? (
          <div className="w-full bg-background min-h-[80vh]">
            {/* L'agenda plein écran est forcé en vue mensuelle sans sélecteur */}
            <SharedCalendar 
              companyId={companyId} 
              defaultView="month" 
              hideViewSwitcher={true} 
            />
          </div>
        ) : (
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
        )}
      </div>

      <Dialog open={importStep !== 'idle'} onOpenChange={(open) => !open && setImportStep('idle')}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl bg-card">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Importation intelligente</DialogTitle>
            <DialogDescription>Traitement via Gemini 2.5 Flash Lite.</DialogDescription>
          </DialogHeader>
          {importStep === 'confirm_analysis' && (
            <div className="p-8 space-y-6">
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 text-center space-y-3">
                <Sparkles className="w-10 h-10 text-primary mx-auto" />
                <p className="text-sm font-medium">Lancer l'analyse OCR ?</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setImportStep('idle')} className="flex-1">Annuler</Button>
                <Button onClick={startAiAnalysis} className="flex-1 bg-primary">Analyser</Button>
              </div>
            </div>
          )}
          {importStep === 'analyzing' && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
              <p className="font-medium">Lecture OCR en cours...</p>
            </div>
          )}
          {importStep === 'confirm_placement' && analysisResult && (
            <div className="p-8 space-y-6">
              <div className="p-4 bg-muted/50 rounded-xl border">
                <p className="font-bold text-primary">{analysisResult.name}</p>
                <div className="mt-2 flex gap-2">
                  <Badge>{analysisResult.suggestedCategoryLabel}</Badge>
                  <Badge variant="outline">{analysisResult.suggestedSubCategory}</Badge>
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
