
'use client';

import * as React from 'react';
import { X, Send, Bot, Loader2, Check, Ban, AlertCircle, Plus, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, normalizeId } from '@/lib/utils';
import { bossAiDataAnalysis } from '@/ai/flows/boss-ai-data-analysis';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { User, Category } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  action?: any;
  isError?: boolean;
};

export function ChatAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis le Cerveau Grow&Go V2. Comment puis-je organiser votre espace aujourd'hui ?" }
  ]);
  const [input, setInput] = React.useState('');
  const [newSubCat, setNewSubCat] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<any | null>(null);

  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-chat-category-creation', handleOpen);
    return () => window.removeEventListener('open-chat-category-creation', handleOpen);
  }, []);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId ? normalizeId(profile.companyId) : null;
  
  const categoriesQuery = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return query(collection(db, 'companies', companyId, 'categories'));
  }, [db, companyId]);
  const { data: existingCategories } = useCollection<Category>(categoriesQuery);

  const role = profile?.role;
  const isAuthorized = role === 'admin' || role === 'patron' || role === 'family';

  const handleAddSubCat = () => {
    if (!newSubCat.trim() || !pendingAction) return;
    
    const currentSubs = pendingAction.subCategories || [];
    const isDuplicate = currentSubs.some((s: string) => s.toLowerCase() === newSubCat.trim().toLowerCase());
    
    if (isDuplicate) {
      toast({ variant: "destructive", title: "Doublon", description: "Ce sous-dossier existe déjà." });
      return;
    }

    const updatedAction = {
      ...pendingAction,
      subCategories: [...currentSubs, newSubCat.trim()]
    };
    setPendingAction(updatedAction);
    setNewSubCat('');
  };

  const handleRemoveSubCat = (index: number) => {
    if (!pendingAction) return;
    const updatedSubs = [...(pendingAction.subCategories || [])];
    updatedSubs.splice(index, 1);
    setPendingAction({ ...pendingAction, subCategories: updatedSubs });
  };

  const executeAction = (action: any) => {
    if (!db || !companyId || !isAuthorized) return;

    const { type, label, icon, subCategories } = action;
    const targetId = normalizeId(label || '');

    if (!targetId) return;

    try {
      if (type === 'create_category' && label) {
        if (existingCategories?.some(c => c.id === targetId)) {
          throw new Error("Ce dossier existe déjà dans votre espace.");
        }

        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        setDocumentNonBlocking(ref, {
          id: targetId,
          label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'custom',
          aiInstructions: `Analyse spécialisée Grow&Go V2 pour ${label}.`,
          companyId,
          icon: icon || 'default',
          subCategories: subCategories || []
        }, { merge: true });
      }

      setMessages(prev => [...prev, { role: 'assistant', content: `C'est fait ! La structure pour "${label}" a été déployée avec succès.` }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Erreur : ${error.message}`, isError: true }]);
    }
    setPendingAction(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !companyId) return;

    if (!isAuthorized) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, les collaborateurs ne peuvent pas modifier la structure documentaire." }]);
      setInput('');
      return;
    }

    const currentInput = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setIsLoading(true);

    try {
      const result = await bossAiDataAnalysis({
        query: currentInput,
        companyId: companyId,
      });

      if (result.action) {
        setPendingAction(result.action);
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.analysisResult || "Je suis prêt. Voici ma proposition pour votre espace." 
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Je n'ai pas pu générer la structure. Essayez avec un nom de dossier différent." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="h-16 w-16 rounded-full shadow-2xl bg-primary hover:scale-110 transition-all border-4 border-white/20 animate-in zoom-in"
        >
          <Bot className="h-8 w-8 text-white" />
        </Button>
      ) : (
        <Card className="w-[380px] h-[600px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5 rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground p-6 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl"><Bot className="h-6 w-6" /></div>
              <div className="flex flex-col">
                <CardTitle className="text-lg font-black uppercase tracking-tighter">Grow&Go V2</CardTitle>
                <span className="text-[9px] font-black opacity-50 uppercase tracking-widest">Cerveau Central</span>
              </div>
            </div>
            <X className="h-6 w-6 cursor-pointer hover:opacity-80" onClick={() => setIsOpen(false)} />
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden bg-muted/10">
            <ScrollArea className="h-full p-6">
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn( 
                      m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : 
                      m.isError ? "bg-destructive/10 text-destructive border-destructive/20 border" : "bg-white border rounded-tl-none shadow-sm",
                      "max-w-[90%] p-4 rounded-[1.5rem] text-sm font-bold flex gap-2"
                    )}>
                      {m.isError && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {pendingAction && !isLoading && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-left-4">
                    <div className="flex flex-col gap-4 p-6 bg-white border-2 border-dashed border-primary/20 rounded-[2rem] w-full shadow-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Configuration Intelligente</p>
                        <PieChart className="w-4 h-4 text-primary/30" />
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {(pendingAction.subCategories || []).map((sub: string, idx: number) => (
                          <Badge key={idx} className="bg-primary/5 text-primary border-primary/10 font-bold uppercase text-[9px] h-7 gap-2">
                            {sub}
                            <X className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => handleRemoveSubCat(idx)} />
                          </Badge>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input 
                          placeholder="Ajouter un sous-dossier..." 
                          value={newSubCat}
                          onChange={(e) => setNewSubCat(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddSubCat()}
                          className="h-10 text-[10px] font-bold uppercase rounded-xl border-primary/10"
                        />
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl" onClick={handleAddSubCat}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex gap-3 pt-2">
                        <Button size="sm" onClick={() => executeAction(pendingAction)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-11 rounded-xl font-bold">
                          Déployer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)} className="h-11 rounded-xl font-bold text-muted-foreground">
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start"><div className="bg-white p-4 rounded-2xl shadow-sm italic"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div></div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-6 border-t bg-white">
            <div className="flex w-full items-center gap-3">
              <Input
                placeholder={!isAuthorized ? "Accès Admin uniquement" : "Posez une question sur vos données..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || !!pendingAction || !isAuthorized}
                className="flex-1 rounded-2xl h-12 bg-muted/30 border-none font-bold"
              />
              <Button size="icon" className="rounded-2xl h-12 w-12 bg-primary shadow-lg" onClick={handleSend} disabled={isLoading || !input.trim() || !!pendingAction || !isAuthorized}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
