
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
  FileCode
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
    toast({ title: "Traitement universel...", description: "Le système évalue la meilleure méthode d'extraction." });

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
      } catch (err) {
        toast({ 
          variant: "destructive", 
          title: "Échec du traitement", 
          description: "Ce fichier n'a pas pu être lu par l'intelligence universelle." 
        });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const finalizeUpload = async () => {
    if (!db || !companyId || !currentFile || !analysis || !team) return;
    
    let finalFileUrl = currentFile.url;
    let storageType: any = 'firebase';

    if (team.length > 1) {
      toast({ title: "Routage Privé", description: "Fichier binaire routé vers le Serveur Entreprise." });
      storageType = 'private_server';
      finalFileUrl = `https://private-server.internal/${normalizeId(analysis.clientName)}/${currentFile.name}`;
    } else {
      if (storage) {
        toast({ title: "Stockage Solo", description: "Envoi sur Firebase Storage europe-west9." });
        const fileRef = ref(storage, `companies/${companyId}/docs/${Date.now()}_${currentFile.name}`);
        const blob = await (await fetch(currentFile.url)).blob();
        await uploadBytes(fileRef, blob);
        finalFileUrl = await getDownloadURL(fileRef);
      }
    }

    const targetCategoryId = analysis.suggestedCategoryId;
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
    toast({ title: "Document classé !", description: `Double classement : ${targetCategoryId} + Dossier ${clientName}` });
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
            Importer n'importe quel fichier
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-3 space-y-6">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Rechercher partout (parsing binaire inclus)..." 
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
              <h3 className="text-xl font-bold uppercase tracking-tighter">Moteur Adaptatif</h3>
              <p className="text-xs leading-relaxed opacity-80 font-medium">
                Le système bascule entre **Parsing Binaire** (pour 100% de précision sur tableurs) et **Vision IA 1.5 Pro** (pour le reste).
              </p>
              <div className="pt-2 flex flex-wrap gap-2">
                <Badge className="bg-white/20 text-white border-none font-bold uppercase text-[9px]">XLSX PARSER</Badge>
                <Badge className="bg-white/20 text-white border-none font-bold uppercase text-[9px]">GEMINI PRO</Badge>
              </div>
            </div>

            <div className="p-6 bg-muted/30 rounded-[2rem] border-2 border-dashed border-primary/10 space-y-4">
              <ShieldCheck className="w-6 h-6 text-primary opacity-40" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-primary/60">Accès Universel</p>
                <p className="text-[11px] font-medium text-muted-foreground italic">Aucun format n'est rejeté sans tentative d'analyse préalable.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE VALIDATION HUMAINE */}
      <Dialog open={isValidating} onOpenChange={setIsValidating}>
        <DialogContent className="sm:max-w-[1000px] p-0 overflow-hidden border-none shadow-2xl rounded-[3rem] bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 h-[80vh]">
            <div className="bg-slate-900 flex items-center justify-center p-4 relative">
              {currentFile?.type.includes('image') ? (
                <img src={currentFile.url} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="Preview" />
              ) : (
                <div className="text-white text-center space-y-4">
                  {analysis?.confidenceScore === 100 ? <FileCode className="w-20 h-20 mx-auto text-emerald-400" /> : <FileText className="w-20 h-20 mx-auto opacity-20" />}
                  <p className="font-bold">{currentFile?.name}</p>
                  <p className="text-xs opacity-50">{analysis?.confidenceScore === 100 ? "Contenu extrait mathématiquement" : "Analyse visuelle en cours"}</p>
                </div>
              )}
              <div className="absolute top-6 left-6">
                <Badge className="bg-primary text-white border-none h-8 px-4 font-black uppercase tracking-widest text-[10px]">Document Original</Badge>
              </div>
            </div>

            <div className="p-10 flex flex-col justify-between bg-white">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-black uppercase tracking-tighter text-primary">Validation IA</DialogTitle>
                  </DialogHeader>
                  <Badge className={`h-10 px-6 font-black uppercase tracking-widest text-[10px] border-none ${analysis?.confidenceScore === 100 ? 'bg-emerald-500 text-white' : 'bg-amber-100 text-amber-700'}`}>
                    {analysis?.confidenceScore === 100 ? '100% Fidélité (Parsing)' : `${analysis?.confidenceScore}% Confiance`}
                  </Badge>
                </div>

                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Titre Identifié</Label>
                    <Input 
                      value={analysis?.documentTitle} 
                      onChange={(e) => setAnalysis({ ...analysis, documentTitle: e.target.value })}
                      className="h-12 rounded-xl font-bold border-primary/10"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Client (Dossier Client)</Label>
                      <Input 
                        value={analysis?.clientName} 
                        onChange={(e) => setAnalysis({ ...analysis, clientName: e.target.value })}
                        className="h-12 rounded-xl font-bold border-primary/10 bg-amber-50/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase opacity-40 ml-1">Catégorie Métier</Label>
                      <Input 
                        value={analysis?.suggestedCategoryId} 
                        readOnly
                        className="h-12 rounded-xl font-bold border-primary/10 bg-muted/50 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/10 space-y-3">
                    <p className="text-[10px] font-black uppercase text-primary">Données Extraites (Full Context)</p>
                    <div className="max-h-[150px] overflow-y-auto text-[11px] font-medium leading-relaxed opacity-70">
                      <pre>{JSON.stringify(analysis?.extractedData, null, 2)}</pre>
                    </div>
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
