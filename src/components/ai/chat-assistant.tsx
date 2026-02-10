
'use client';

import * as React from 'react';
import { X, Send, Bot, Loader2, Check, Ban, AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, normalizeId } from '@/lib/utils';
import { bossAiDataAnalysis } from '@/ai/flows/boss-ai-data-analysis';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { User } from '@/lib/types';

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
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: "Bonjour ! Je suis votre assistant GROW&GO. Quel nouveau dossier souhaitez-vous ajouter à votre espace ?" }
  ]);
  const [input, setInput] = React.useState('');
  const [newSubCat, setNewSubCat] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<any | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId ? normalizeId(profile.companyId) : null;
  const isAdminOrPatron = profile?.role === 'admin' || profile?.role === 'patron';

  React.useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      if (isAdminOrPatron) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "Prêt ! Quel dossier souhaitez-vous configurer dans votre espace ?" }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "Désolé, seul l'administrateur ou le dirigeant peut modifier la structure de l'espace." }
        ]);
      }
    };

    window.addEventListener('open-chat-category-creation', handleOpenChat);
    return () => window.removeEventListener('open-chat-category-creation', handleOpenChat);
  }, [isAdminOrPatron]);

  const handleAddSubCat = () => {
    if (!newSubCat.trim() || !pendingAction) return;
    const updatedAction = {
      ...pendingAction,
      subCategories: [...(pendingAction.subCategories || []), newSubCat.trim()]
    };
    setPendingAction(updatedAction);
    setNewSubCat('');
  };

  const handleRemoveSubCat = (index: number) => {
    if (!pendingAction) return;
    const updatedSubs = [...(pendingAction.subCategories || [])];
    updatedSubs.splice(index, 1);
    setPendingAction({
      ...pendingAction,
      subCategories: updatedSubs
    });
  };

  const executeAction = (action: any) => {
    if (!db || !companyId || !isAdminOrPatron) return;

    const { type, categoryId, label, icon, subCategories } = action;
    const targetId = normalizeId(label || categoryId || '');

    if (!targetId) return;

    try {
      if (type === 'create_category' && label) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        setDocumentNonBlocking(ref, {
          id: targetId,
          label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'custom',
          aiInstructions: `Analyse spécialisée pour le dossier ${label}.`,
          companyId,
          icon: icon || 'default',
          subCategories: subCategories || []
        }, { merge: true });
      } else if (type === 'delete_category') {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        deleteDocumentNonBlocking(ref);
      } else if (type === 'rename_category' && label) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        updateDocumentNonBlocking(ref, { label });
      }

      setMessages(prev => [...prev, { role: 'assistant', content: `C'est fait ! Le dossier "${label}" est maintenant disponible.` }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Erreur : ${error.message}`,
        isError: true 
      }]);
    }
    setPendingAction(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !companyId) return;

    if (!isAdminOrPatron) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Action réservée à l'administrateur ou au dirigeant de l'espace." }]);
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
        content: result.analysisResult || "Dossier prêt. Souhaitez-vous l'ajouter ?" 
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Je n'ai pas pu traiter votre demande. Précisez le nom du dossier." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-110 border-2 border-white/20"
        >
          <Bot className="h-6 w-6 text-white" />
        </Button>
      ) : (
        <Card className="w-[350px] sm:w-[380px] h-[550px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5 rounded-[2rem] bg-white">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-[2rem] p-5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold uppercase tracking-tighter">Assistant IA</CardTitle>
            </div>
            <X className="h-5 w-5 cursor-pointer hover:opacity-80" onClick={() => setIsOpen(false)} />
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden bg-background">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn( 
                      m.role === 'user' ? "bg-primary text-primary-foreground" : 
                      m.isError ? "bg-destructive/10 text-destructive border-destructive/20 border" : "bg-muted border",
                      "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm font-medium flex gap-2"
                    )}>
                      {m.isError && <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {pendingAction && !isLoading && (
                  <div className="flex justify-start">
                    <div className="flex flex-col gap-3 p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl w-[90%]">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Configuration de l'espace</p>
                      
                      <div className="flex flex-wrap gap-1">
                        {(pendingAction.subCategories || []).map((sub: string, idx: number) => (
                          <span key={idx} className="text-[8px] bg-white px-2 py-1 rounded-lg border border-primary/10 font-bold uppercase flex items-center gap-1.5 shadow-sm">
                            {sub}
                            <X className="w-2.5 h-2.5 cursor-pointer hover:text-destructive transition-colors" onClick={() => handleRemoveSubCat(idx)} />
                          </span>
                        ))}
                      </div>

                      <div className="flex gap-1">
                        <Input 
                          placeholder="Sous-dossier..." 
                          value={newSubCat}
                          onChange={(e) => setNewSubCat(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddSubCat()}
                          className="h-8 text-[9px] font-bold uppercase rounded-lg border-primary/10"
                        />
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={handleAddSubCat}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" onClick={() => executeAction(pendingAction)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-9 rounded-xl font-bold">
                          <Check className="w-4 h-4 mr-2" />
                          Appliquer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingAction(null)} className="h-9 rounded-xl font-bold">
                          <Ban className="w-4 h-4 mr-2" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-2xl italic">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-4 border-t rounded-b-[2rem] bg-white">
            <div className="flex w-full items-center gap-2">
              <Input
                placeholder={!isAdminOrPatron ? "Accès restreint" : (pendingAction ? "Ajustez vos dossiers..." : "Ex: Nouveau dossier Technique")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || !!pendingAction || !isAdminOrPatron}
                className="flex-1 rounded-xl h-11 bg-muted/30 border-none font-medium"
              />
              <Button size="icon" className="rounded-xl h-11 w-11 bg-primary" onClick={handleSend} disabled={isLoading || !input.trim() || !!pendingAction || !isAdminOrPatron}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
