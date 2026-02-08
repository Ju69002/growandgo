'use client';

import * as React from 'react';
import { X, Send, Bot, Loader2, Check, Ban, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
    { role: 'assistant', content: 'Bonjour ! Je suis votre Expert Organisation Grow&Go. Quel dossier souhaitez-vous que je crée pour votre équipe ?' }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<any | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId;
  const isPatron = profile?.role === 'admin' || profile?.role === 'super_admin';

  React.useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      if (isPatron) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "Je suis prêt ! Quel nom souhaitez-vous donner à ce nouveau dossier ?" }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "Désolé, seul le Patron peut ajouter de nouvelles catégories au studio." }
        ]);
      }
    };

    window.addEventListener('open-chat-category-creation', handleOpenChat);
    return () => window.removeEventListener('open-chat-category-creation', handleOpenChat);
  }, [isPatron]);

  const executeAction = (action: any) => {
    if (!db || !companyId || !isPatron) return;

    const { type, categoryId, label, icon, subCategories } = action;
    const rawId = label || categoryId || '';
    const targetId = rawId.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');

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

      setMessages(prev => [...prev, { role: 'assistant', content: `C'est fait ! Le dossier "${label}" a été créé avec ses sous-dossiers.` }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Erreur technique : ${error.message}`,
        isError: true 
      }]);
    }
    setPendingAction(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !companyId) return;

    if (!isPatron) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Seul le Patron peut modifier la structure du studio." }]);
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
        content: result.analysisResult || "Plan établi. Souhaitez-vous valider ?" 
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Je n'ai pas pu analyser votre demande. Réessayez avec un nom de dossier clair." 
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
        <Card className="w-[350px] sm:w-[380px] h-[500px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5 rounded-[2rem] bg-white">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-[2rem] p-5 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold uppercase tracking-tighter">Assistant Studio IA</CardTitle>
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
                    <div className="flex flex-col gap-2 p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-2xl max-w-[85%]">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Confirmation Action</p>
                      {pendingAction.subCategories && pendingAction.subCategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {pendingAction.subCategories.map((sub: string) => (
                            <span key={sub} className="text-[8px] bg-white px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase">{sub}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => executeAction(pendingAction)} className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-full font-bold px-4">
                          <Check className="w-4 h-4 mr-1" />
                          Appliquer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingAction(null)} className="h-8 rounded-full font-bold px-4">
                          <Ban className="w-4 h-4 mr-1" />
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
                placeholder={!isPatron ? "Accès réservé au Patron" : (pendingAction ? "Action en attente..." : "Ex: Créer dossier Juridique")}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || !!pendingAction || !isPatron}
                className="flex-1 rounded-xl h-11 bg-muted/30 border-none"
              />
              <Button size="icon" className="rounded-xl h-11 w-11 bg-primary" onClick={handleSend} disabled={isLoading || !input.trim() || !!pendingAction || !isPatron}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
