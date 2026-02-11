
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
import { doc, collection, query, orderBy } from 'firebase/firestore';
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
  Building2,
  ArrowRight,
  Info,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { universalDocumentExtractor, UniversalExtractorOutput } from '@/ai/flows/universal-document-extractor';
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
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UniversalExtractorOutput | null>(null);

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
  const { data: categories } = useCollection<Category>(categoriesQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'documents'), orderBy('createdAt', 'desc'));
  }, [db, companyId]);
  const { data: documents, isLoading: isDocsLoading } = useCollection<BusinessDocument>(docsQuery);

  // Nettoyage de l'URL Blob pour éviter les fuites mémoire
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId || !categories) return;

    setIsUploading(true);
    toast({ title: "Analyse Sémantique...", description: "Compréhension du document en cours." });

    // Créer une URL Blob pour l'aperçu sécurisé (évite les erreurs sandbox)
    const blobUrl = URL.createObjectURL(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(blobUrl);

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
        toast({ variant: "destructive", title: "Échec de l'analyse", description: err.message });
        URL.revokeObjectURL(blobUrl);
        setPreviewUrl(null);
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const finalizeUpload = async () => {
    if (!db || !companyId || !currentFile || !analysis || !categories) return;
    
    let finalFileUrl = currentFile.url;
    if (storage) {
      const fileRef = ref(storage, `companies/${companyId}/docs/${Date.now()}_${currentFile.name}`);
      const blob = await (await fetch(currentFile.url)).blob();
      await uploadBytes(fileRef, blob);
      finalFileUrl = await getDownloadURL(fileRef);
    }

    const selectedCategoryLabel = analysis.category;
    const existingCategory = categories.find(c => c.label === selectedCategoryLabel || c.id === normalizeId(selectedCategoryLabel));
    const targetCategoryId = existingCategory?.id || normalizeId(selectedCategoryLabel);

    if (!existingCategory) {
      const newCatRef = doc(db, 'companies', companyId, 'categories', targetCategoryId);
      setDocumentNonBlocking(newCatRef, {
        id: targetCategoryId,
        label: selectedCategoryLabel,
        type: 'custom',
        visibleToEmployees: true,
        companyId: companyId,
        icon: 'default',
        subCategories: [analysis.subcategory],
        badgeCount: 0
      }, { merge: true });
    } else {
      const currentSubs = existingCategory.subCategories || [];
      if (!currentSubs.includes(analysis.subcategory)) {
        const catRef = doc(db, 'companies', companyId, 'categories', existingCategory.id);
        setDocumentNonBlocking(catRef, {
          subCategories: [...currentSubs, analysis.subcategory]
        }, { merge: true });
      }
    }

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

    const docsRef = collection(db, 'companies', companyId, 'documents');
    addDocumentNonBlocking(docsRef, {
      name: analysis.documentTitle,
      categoryId: targetCategoryId,
      subCategory: analysis.subcategory,
      clientName: clientName,
      clientId: clientId,
      issuerEntity: analysis.issuerEntity,
      documentDate: analysis.documentDate,
      status: 'archived',
      confidenceScore: analysis.confidenceScore,
      isDataParsed: analysis.confidenceScore === 100,
      extractedData: analysis.metadata,
      summary_flash: analysis.summary_flash,
      fileUrl: finalFileUrl,
      storageType: 'firebase',
      createdAt: new Date().toISOString(),
      companyId: companyId
    });

    setIsValidating(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    toast({ title: "Document archivé avec succès !" });
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
            <p className="text-muted-foreground font-medium italic">Intelligence Sémantique & Auto-Archivage (Analyse Contextuelle).</p>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isUploading}
            className="rounded-full h-16 px-10 bg-primary hover:scale-105 transition-all shadow-2xl gap-3 text-lg font-bold"
          >
            {isUploading ? <Loader2 className="animate-spin w-6 h-6" /> : <FileUp className="w-6 h-6" />}
            Scanner un document
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Rechercher un document par nom, client ou contenu..." 
                className="pl-12 h-14 rounded-2xl bg-white border-none shadow-xl text-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-primary/5">
              <div className="p-8 border-b bg-muted/10 flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest text-xs flex items-center gap-2">
                  <History className="w-4 h-4" /> Espace de Stockage Actif
                </h3>
                <Badge variant="outline" className="font-bold">{documents?.length || 0} Archivés</Badge>
              </div>
              
              {isDocsLoading ? (
                <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-primary opacity-20" /></div>
              ) : documents?.length === 0 ? (
                <div className="p-20 text-center text-muted-foreground italic">Aucun document dans cet espace.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">
                      <tr>
                        <th className="px-8 py-4 text-left">Document</th>
                        <th className="px-6 py-4 text-left">Sujet / Client</th>
                        <th className="px-6 py-4 text-left">Classement</th>
                        <th className="px-6 py-4 text-center">Fidélité</th>
                        <th className="px-8 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary/5">
                      {documents?.filter(d => 
                        d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        d.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        d.summary_flash?.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map(doc => (
                        <tr key={doc.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/5 rounded-lg text-primary">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="flex flex-col max-w-[200px]">
                                <span className="font-bold text-sm text-primary truncate">{doc.name}</span>
                                <span className="text-[9px] text-muted-foreground font-medium uppercase">{new Date(doc.createdAt).toLocaleDateString()} • {doc.issuerEntity}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-bold uppercase text-[9px]">{doc.clientName}</Badge>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-primary opacity-70 uppercase">{doc.categoryId}</span>
                              <span className="text-[9px] text-muted-foreground">{doc.subCategory}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <Badge className={doc.confidenceScore === 100 ? "bg-emerald-500" : "bg-primary/10 text-primary border-none text-[9px]"}>
                              {doc.confidenceScore}% {doc.isDataParsed ? "(PARSING)" : "(VISION)"}
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
              <h3 className="text-xl font-bold uppercase tracking-tighter">Auto-Organisation</h3>
              <p className="text-xs leading-relaxed opacity-80 font-medium">
                Le Cerveau V2 privilégie vos 6 piliers métier pour maintenir un espace propre sans intervention manuelle.
              </p>
            </div>

            <div className="p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10 space-y-4">
              <ShieldCheck className="w-6 h-6 text-primary opacity-40" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-primary/60">Analyse Sémantique</p>
                <p className="text-[11px] font-medium text-muted-foreground italic">Compréhension contextuelle des rôles (Sujet vs Émetteur).</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isValidating} onOpenChange={(open) => {
        setIsValidating(open);
        if (!open && previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="sm:max-w-[1100px] p-0 overflow-hidden border-none shadow-2xl rounded-[3rem] bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[90vh]">
            {/* Colonne Gauche : Viewer Universel */}
            <div className="bg-slate-950 flex flex-col relative overflow-hidden">
              <div className="flex-1 w-full h-full">
                {currentFile?.type === 'application/pdf' && previewUrl ? (
                  <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none bg-white" title="PDF Viewer" />
                ) : currentFile?.type.includes('image') && previewUrl ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Preview" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white gap-4 opacity-30">
                    <FileText className="w-24 h-24" />
                    <p className="font-bold">{currentFile?.name}</p>
                  </div>
                )}
              </div>
              <div className="absolute top-6 left-6 flex gap-2">
                <Badge className="bg-primary text-white border-none h-8 px-4 font-black uppercase tracking-widest text-[10px]">Contrôle Visuel</Badge>
                <Badge className="bg-white/10 text-white border-none h-8 px-4 font-black uppercase tracking-widest text-[10px] backdrop-blur-md">
                  {analysis?.confidenceScore}% Fidélité
                </Badge>
              </div>
              {/* Bouton de secours pour l'ouverture externe */}
              <div className="absolute bottom-6 right-6">
                <Button variant="secondary" size="sm" className="rounded-full shadow-lg gap-2" asChild>
                  <a href={previewUrl || '#'} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir l'original
                  </a>
                </Button>
              </div>
            </div>

            {/* Colonne Droite : Formulaire IA */}
            <div className="flex flex-col bg-white overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-10 space-y-10">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Intelligence Archivage V2</DialogTitle>
                  </DialogHeader>

                  {/* Résumé Flash - Priorité */}
                  <div className="p-6 bg-primary/5 rounded-[2rem] border-2 border-dashed border-primary/10 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Zap className="w-4 h-4" />
                      <p className="text-[10px] font-black uppercase tracking-widest">Résumé Flash</p>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-primary/80 italic">"{analysis?.summary_flash}"</p>
                  </div>

                  <div className="grid gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Titre de l'archive</Label>
                      <Input 
                        value={analysis?.documentTitle} 
                        onChange={(e) => setAnalysis(a => a ? { ...a, documentTitle: e.target.value } : null)}
                        className="h-12 rounded-xl font-bold border-primary/10 text-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40 ml-1 flex items-center gap-2">
                          <Building2 className="w-3 h-3" /> Sujet / Client
                        </Label>
                        <Input 
                          value={analysis?.clientName} 
                          onChange={(e) => setAnalysis(a => a ? { ...a, clientName: e.target.value } : null)}
                          className="h-12 rounded-xl font-bold border-primary/10 bg-amber-50/30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Émetteur / Contrepartie</Label>
                        <Input 
                          value={analysis?.issuerEntity} 
                          onChange={(e) => setAnalysis(a => a ? { ...a, issuerEntity: e.target.value } : null)}
                          className="h-12 rounded-xl font-bold border-primary/10"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Catégorie Métier (Pilier)</Label>
                        <Select 
                          value={analysis?.category} 
                          onValueChange={(v) => setAnalysis(a => a ? { ...a, category: v } : null)}
                        >
                          <SelectTrigger className="h-12 rounded-xl font-bold border-primary/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {['Commercial', 'Communication', 'Finances', 'Fournisseurs', 'Juridique', 'RH'].map(cat => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                            <SelectItem value="Autre">+ Autre...</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Sous-dossier</Label>
                        <Input 
                          value={analysis?.subcategory} 
                          onChange={(e) => setAnalysis(a => a ? { ...a, subcategory: e.target.value } : null)}
                          className="h-12 rounded-xl font-bold border-primary/10"
                        />
                      </div>
                    </div>

                    {/* Métadonnées Dynamiques */}
                    <div className="space-y-4 pt-4 border-t border-dashed">
                      <p className="text-[10px] font-black uppercase opacity-40 flex items-center gap-2">
                        <Info className="w-3 h-3" /> Données identifiées à la carte
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {analysis && Object.entries(analysis.metadata).map(([key, val]) => (
                          <div key={key} className="space-y-1">
                            <Label className="text-[9px] font-black uppercase opacity-30 ml-1">{key.replace(/_/g, ' ')}</Label>
                            <Input 
                              value={String(val)} 
                              onChange={(e) => setAnalysis(a => a ? { ...a, metadata: { ...a.metadata, [key]: e.target.value } } : null)}
                              className="h-10 rounded-xl font-bold text-xs bg-muted/20 border-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-8 border-t bg-muted/10 gap-4">
                <Button variant="ghost" onClick={() => {
                  setIsValidating(false);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                }} className="rounded-full h-14 px-8 font-bold">Annuler</Button>
                <Button onClick={finalizeUpload} className="rounded-full h-14 px-12 bg-primary font-black uppercase tracking-widest text-sm shadow-xl flex-1">
                  Confirmer & Archiver
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
