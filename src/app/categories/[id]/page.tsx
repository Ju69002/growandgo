'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DocumentList } from '@/components/documents/document-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Trash2, FolderOpen, FileUp, Check, X, FileText, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useMemoFirebase, addDocumentNonBlocking, deleteDocumentNonBlocking, useUser } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { Category, User } from '@/lib/types';
import { useState, useRef } from 'react';
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

type ImportStep = 'idle' | 'confirm' | 'importing';

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

  const executeSimpleImport = () => {
    if (!db || !companyId || !currentFileUrl) return;

    setImportStep('importing');

    const docsRef = collection(db, 'companies', companyId, 'documents');
    
    addDocumentNonBlocking(docsRef, {
      name: currentFileName || "Nouveau document",
      categoryId: categoryId,
      subCategory: "", // Rangement dans "Tout voir"
      projectColumn: 'administrative',
      status: 'waiting_verification',
      extractedData: {},
      fileUrl: currentFileUrl,
      createdAt: new Date().toLocaleDateString(),
      companyId: companyId
    });

    toast({
      title: "Document importé",
      description: `Le fichier a été ajouté avec succès dans ce dossier.`,
    });

    setTimeout(() => {
      setImportStep('idle');
      setCurrentFileUrl("");
      setCurrentFileName("");
    }, 1000);
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

      <Dialog open={importStep !== 'idle'} onOpenChange={(open) => !open && setImportStep('idle')}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl">
          
          {importStep === 'confirm' && (
            <div className="p-8 space-y-6">
              <DialogHeader className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold text-primary">Prêt pour l'import</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Fichier : <span className="font-semibold text-foreground">{currentFileName}</span>
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="bg-muted/50 p-6 rounded-2xl border-2 border-dashed border-primary/20 text-center">
                <p className="text-sm text-muted-foreground">
                  Souhaitez-vous importer ce document dans ce dossier ? Il sera visible dans la section "Tout voir".
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setImportStep('idle')} className="flex-1 h-12 rounded-xl">
                  Annuler
                </Button>
                <Button onClick={executeSimpleImport} className="flex-1 h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-md">
                  <Check className="w-4 h-4 mr-2" />
                  Confirmer l'import
                </Button>
              </div>
            </div>
          )}

          {importStep === 'importing' && (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-6 min-h-[300px]">
              <DialogHeader className="items-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                <DialogTitle className="text-2xl font-bold text-primary mt-4 text-center">Enregistrement...</DialogTitle>
                <DialogDescription className="text-muted-foreground text-center">
                  Votre document est en cours de transfert vers votre espace sécurisé.
                </DialogDescription>
              </DialogHeader>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}