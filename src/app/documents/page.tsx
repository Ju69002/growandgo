
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase, 
  useCollection,
  useStorage,
  addDocumentNonBlocking,
  setDocumentNonBlocking
} from '@/firebase';
import { doc, collection, query, orderBy, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User, BusinessDocument, Category } from '@/lib/types';
import { 
  FileUp, 
  Loader2, 
  FileText, 
  Search, 
  Eye, 
  Zap, 
  ShieldCheck,
  History,
  FolderSync,
  FileCode,
  FolderPlus,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { universalDocumentExtractor } from '@/ai/flows/universal-document-extractor';
import { normalizeId } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DocumentsCentralHub() {
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;

  const teamQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'users'), where('companyId', '==', companyId), where('isProfile', '==', true));
  }, [db, companyId]);
  const { data: team } = useCollection<User>(teamQuery);

  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, companyId]);
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'documents'), orderBy('createdAt', 'desc'));
  }, [db, companyId]);
  const { data: documents, isLoading: isDocsLoading } = useCollection<BusinessDocument>(docsQuery);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId || !categories) return;

    setIsUploading(true);
    toast({ title: "Traitement universel...", description: "Analyse adaptative en cours." });

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      try {
        const result = await universalDocumentExtractor({
          fileUrl: dataUrl,
          fileName: file.name,
          fileType: file.type || 'application/octet-stream',
          availableCategories: categories.map(c => ({ id: c.id, label: c.label, subCategories: c.subCategories || [] }))
        });

        setCurrentFile({ url: dataUrl, name: file.name, type: file.type });
        setAnalysis(result);
        setIsValidating(true);
      } catch (err: any) {
        toast({ 
          variant: "destructive", 
          title: "Échec du traitement", 
          description: `Erreur : ${err.message || "Cause technique inconnue."}` 
        });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const finalizeUpload = async () => {
    if (!db || !companyId || !currentFile || !analysis || !team || !categories) return;
    
    let finalFileUrl = currentFile.url;
    let storageType: any = 'firebase';

    if (team.length > 1) {
      storageType = 'private_server';
      finalFileUrl = `https://private-server.internal/${normalizeId(analysis.clientName)}/${currentFile.name}`;
    } else if (storage) {
      const fileRef = ref(storage, `companies/${companyId}/docs/${Date.now()}_${currentFile.name}`);
      const blob = await (await fetch(currentFile.url)).blob();
      await uploadBytes(fileRef, blob);
      finalFileUrl = await getDownloadURL(fileRef);
    }

    const selectedCategoryLabel = analysis.suggestedCategoryId;
    const existingCategory = categories.find(c => c.label === selectedCategoryLabel || c.id === selectedCategoryLabel);
    const targetCategoryId = existingCategory?.id || normalizeId(selectedCategoryLabel);

    // 1. Gérer la catégorie métier
    if (!existingCategory) {
      const newCatRef = doc(db, 'companies', companyId, 'categories', targetCategoryId);
      setDocumentNonBlocking(newCatRef, {
        id: targetCategoryId,
        label: selectedCategoryLabel,
        type: 'custom',
        visibleToEmployees: true,
        companyId: companyId,
        icon: 'default',
        subCategories: [analysis.suggestedSubCategory],
        badgeCount: 0
      }, { merge: true });
    } else {
      const currentSubs = existingCategory.subCategories || [];
      if (!currentSubs.includes(analysis.suggestedSubCategory)) {
        const catRef = doc(db, 'companies', companyId, 'categories', existingCategory.id);
        setDocumentNonBlocking(catRef, {
          subCategories: [...currentSubs, analysis.suggestedSubCategory]
        }, { merge: true });
      }
    }

    // 2. Gérer le dossier client
    const clientName = analysis.clientName || "Client Inconnu";
    const clientId = normalizeId(clientName);
    const clientFolderRef = doc(db, 'companies', companyId, 'categories', clientId);
    setDocumentNonBlocking(clientFolderRef, {
      id: clientId,
      label: clientName,
      type: 'custom',
      isClientFolder: true,
      visibleToEmployees: true,
      companyId: companyId,
      icon: 'travail',
      badgeCount: 0
    }, { merge: true });

    // 3. Enregistrer le document
    const docsRef = collection(db, 'companies', companyId, 'documents');
    addDocumentNonBlocking(docsRef, {
      name: analysis.documentTitle || currentFile.name,
      categoryId: targetCategoryId,
      subCategory: analysis.suggestedSubCategory,
      clientName: clientName,
      clientId: clientId,
      status: 'waiting_validation',
      confidenceScore: analysis.confidenceScore,
      isDataParsed: analysis.confidenceScore === 100,
      extractedData: analysis.extractedData,
      fileUrl: finalFileUrl,
      storageType: storageType,
      createdAt: new Date().toISOString(),
      companyId: companyId
    });

    setIsValidating(false);
    toast({ title: "Document classé avec succès !" });
  };

  return (
    <DashboardLayout>
      <input type="file" ref={fileInputRef} className="hidden" accept="*" onChange={handleFileSelect} />
      
      <div className="max-w-7xl mx-auto py-10 px-6 space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tighter text-primary uppercase flex items-center gap-4">
              <FolderSync className="w-12 h-12" />
              Documents V2
            </h1>
            <p className="text-muted-foreground font-medium italic">Accès universel &amp; Intelligence adaptative (Parsing + Vision).</p>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            className="rounded-full h-16 px-10 bg-primary hover:scale-105 transition-all shadow-2xl gap-3 text-lg font-bold"
          >
            {isUploading ? <Loader2 className="animate-spin w-6 h-6" /> : <FileUp className="w-6 h-6" />}
            Importer un fichier
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Rechercher dans l'historique..." 
                className="pl-12 h-14 rounded-2xl bg-white border-none shadow-xl text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-primary/5">
              <div className="p-8 border-b bg-muted/10 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
                  <History className="w-4 h-4" /> Historique de Traitement
                </h3>
                <Badge variant="outline" className="font-bold">{documents?.length || 0} Fichiers</Badge>
              </div>
              
              {isDocsLoading ? (
                <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary opacity-20" /></div>
              ) : documents?.length === 0 ? (
                <div className="p-20 text-center text-muted-foreground italic">Aucun document traité.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">
                      <tr>
                        <th className="px-8 py-4 text-left">Document</th>
                        <th className="px-6 py-4 text-left">Client</th>
                        <th className="px-6 py-4 text-left">Catégorie</th>
                        <th className="px-6 py-4 text-center">Extraction</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {documents?.filter(d => 
                        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        d.clientName?.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(doc => (
                        <tr key={doc.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/5 rounded-lg text-primary">
                                {doc.isDataParsed ? <FileCode className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-primary">{doc.name}</span>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">{new Date(doc.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold uppercase text-[9px]">{doc.clientName || 'Inconnu'}</Badge>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-primary opacity-70 uppercase">{doc.categoryId}</span>
                              <span className="text-[10px] text-muted-foreground">{doc.subCategory}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <Badge className={doc.isDataParsed ? "bg-emerald-500" : "bg-primary/10 text-primary border-none"}>
                              {doc.isDataParsed ? "PARSING (100%)" : `VISION (${doc.confidenceScore}%)`}
                            </Badge>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10" asChild>
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer"><Eye className="w-4 h-4 text-primary" /></a>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary text-white p-8 rounded-[2.5rem] shadow-xl space-y-4">
              <Zap className="w-10 h-10" />
              <h3 className="text-xl font-bold uppercase tracking-tighter">Cerveau d'Archivage</h3>
              <p className="text-xs leading-relaxed opacity-80 font-medium">
                Le système mémorise vos dossiers et privilégie la structure existante pour éviter le désordre.
              </p>
            </div>

            <div className="p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10 space-y-4">
              <ShieldCheck className="w-6 h-6 text-primary opacity-40" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-primary/60">Double Indexation</p>
                <p className="text-[11px] font-medium text-muted-foreground italic">Chaque fichier est trié par Métier ET par Client automatiquement.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isValidating} onOpenChange={setIsValidating}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden border-none shadow-2xl rounded-[3rem] bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[85vh]">
            <div className="bg-slate-900 flex items-center justify-center p-4 relative">
              {currentFile?.type.includes('image') ? (
                <img src={currentFile.url} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Preview" />
              ) : (
                <div className="text-white text-center space-y-4">
                  {analysis?.confidenceScore === 100 ? <FileCode className="w-20 h-20 mx-auto text-emerald-400" /> : <FileText className="w-20 h-20 mx-auto opacity-20" />}
                  <p className="font-bold">{currentFile?.name}</p>
                </div>
              )}
              <div className="absolute top-6 left-6">
                <Badge className="bg-primary text-white border-none h-8 px-4 font-black uppercase tracking-widest text-[10px]">Validation Humaine</Badge>
              </div>
            </div>

            <div className="p-10 flex flex-col justify-between bg-white overflow-y-auto">
              <div className="space-y-8">
                <DialogHeader>
                  <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Cerveau d'Archivage V2</DialogTitle>
                </DialogHeader>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Titre du document</Label>
                    <Input 
                      value={analysis?.documentTitle} 
                      onChange={(e) => setAnalysis({ ...analysis, documentTitle: e.target.value })}
                      className="h-12 rounded-xl font-bold border-primary/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40 ml-1 flex items-center gap-2">
                        <Building2 className="w-3 h-3" /> Nom du Client (Dossier Client)
                      </Label>
                      <Input 
                        value={analysis?.clientName} 
                        onChange={(e) => setAnalysis({ ...analysis, clientName: e.target.value })}
                        className="h-12 rounded-xl font-bold border-primary/10 bg-amber-50/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40 ml-1 flex items-center gap-2">
                        <FolderPlus className="w-3 h-3" /> Catégorie Métier
                      </Label>
                      <Select 
                        value={categories?.some(c => c.label === analysis?.suggestedCategoryId || c.id === analysis?.suggestedCategoryId) ? analysis?.suggestedCategoryId : "new"} 
                        onValueChange={(v) => setAnalysis({ ...analysis, suggestedCategoryId: v === "new" ? analysis?.suggestedCategoryId : v })}
                      >
                        <SelectTrigger className="h-12 rounded-xl font-bold border-primary/10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map(c => (
                            <SelectItem key={c.id} value={c.label}>{c.label}</SelectItem>
                          ))}
                          <SelectItem value="new">+ Nouveau dossier...</SelectItem>
                        </SelectContent>
                      </Select>
                      {!categories?.some(c => c.label === analysis?.suggestedCategoryId) && (
                        <Input 
                          placeholder="Nom de la nouvelle catégorie..."
                          value={analysis?.suggestedCategoryId}
                          onChange={(e) => setAnalysis({ ...analysis, suggestedCategoryId: e.target.value })}
                          className="h-10 rounded-xl font-bold text-xs border-dashed border-primary/30"
                        />
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Sous-dossier (Classement précis)</Label>
                    <Input 
                      value={analysis?.suggestedSubCategory} 
                      onChange={(e) => setAnalysis({ ...analysis, suggestedSubCategory: e.target.value })}
                      placeholder="Ex: Factures, Contrats..."
                      className="h-12 rounded-xl font-bold border-primary/10"
                    />
                  </div>

                  <div className="p-6 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10 space-y-3">
                    <p className="text-[10px] font-black uppercase text-primary">Résumé Flash</p>
                    <p className="text-xs font-medium leading-relaxed opacity-70 italic">"{analysis?.summary}"</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-8 border-t gap-4">
                <Button variant="ghost" onClick={() => setIsValidating(false)} className="rounded-full h-14 px-8 font-bold">Annuler</Button>
                <Button onClick={finalizeUpload} className="rounded-full h-14 px-12 bg-primary font-black uppercase tracking-widest text-sm shadow-xl">
                  Confirmer &amp; Classer
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
