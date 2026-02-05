'use client';

import * as React from 'react';
import { X, Send, Bot, Sparkles, Loader2, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { bossAiDataAnalysis } from '@/ai/flows/boss-ai-data-analysis';
import { useUser, useFirestore, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useDoc, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import { User } from '@/lib/types';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  action?: any;
};

export function ChatAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useUser();
  const db = useFirestore();
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre Architecte IA. Je peux modifier absolument tout l\'aspect visuel de votre site. Que souhaitez-vous changer ?' }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<any | null>(null);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId || 'default-company';

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const executeAction = (action: any) => {
    if (!db || !companyId || !companyRef) return;

    const { type, categoryId, label, visibleToEmployees, color, moduleName, enabled } = action;
    
    try {
      if (type === 'create_category' && label) {
        const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const ref = doc(db, 'companies', companyId, 'categories', id);
        setDocumentNonBlocking(ref, {
          id,
          label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'custom',
          aiInstructions: `Analyse pour la catégorie ${label}.`,
          companyId
        }, { merge: true });
      } else if (type === 'delete_category' && categoryId) {
        const ref = doc(db, 'companies', companyId, 'categories', categoryId);
        deleteDocumentNonBlocking(ref);
      } else if (type === 'rename_category' && categoryId && label) {
        const ref = doc(db, 'companies', companyId, 'categories', categoryId);
        updateDocumentNonBlocking(ref, { label });
      } else if (type === 'update_category_style' && categoryId && color) {
        const ref = doc(db, 'companies', companyId, 'categories', categoryId);
        // On convertit les noms simples en classes ou HSL si besoin
        let finalColor = color;
        if (color.toLowerCase() === 'vert') finalColor = 'bg-emerald-500 text-white';
        if (color.toLowerCase() === 'rouge') finalColor = 'bg-rose-500 text-white';
        if (color.toLowerCase() === 'bleu') finalColor = 'bg-sky-500 text-white';
        
        updateDocumentNonBlocking(ref, { color: finalColor });
      } else if (type === 'change_theme_color' && color) {
        updateDocumentNonBlocking(companyRef, { primaryColor: color });
      } else if (type === 'toggle_module' && moduleName) {
        const key = moduleName.toLowerCase() === 'rh' ? 'showRh' : 'showFinance';
        updateDocumentNonBlocking(companyRef, { [`modulesConfig.${key}`]: enabled ?? true });
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Tâche effectuée !" 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue lors de l'exécution." }]);
    }
    setPendingAction(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !companyId) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
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
        content: result.analysisResult || "Je n'ai pas bien compris, pouvez-vous reformuler ?" 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur est survenue." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setMessages(prev => [...prev, { role: 'assistant', content: "Action annulée. Je reste à votre écoute !" }]);
    setPendingAction(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="h-14 w-14 rounded-full shadow-xl bg-primary hover:bg-primary/90 transition-transform hover:scale-110"
        >
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      ) : (
        <Card className="w-[350px] sm:w-[380px] h-[500px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Architecte IA</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden bg-background">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm",
                      m.role === 'user' 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-muted text-foreground rounded-tl-none border"
                    )}>
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {pendingAction && !isLoading && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-left-2">
                    <div className="flex flex-col gap-2 p-3 bg-muted/50 border rounded-2xl rounded-tl-none max-w-[85%]">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Validation requise</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => executeAction(pendingAction)} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                          <Check className="w-4 h-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8">
                          <Ban className="w-4 h-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted p-3 rounded-2xl text-sm italic">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="p-3 border-t bg-card">
            <div className="flex w-full items-center gap-2">
              <Input
                placeholder={pendingAction ? "Veuillez confirmer ci-dessus..." : "Ex: Mets la tuile RH en vert..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || !!pendingAction}
                className="flex-1 bg-muted/50 border-none focus-visible:ring-primary"
              />
              <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim() || !!pendingAction}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
