'use client';

import * as React from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, Loader2 } from 'lucide-react';
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
};

export function ChatAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useUser();
  const db = useFirestore();
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre assistant BusinessPilot propulsé par Gemini. Comment puis-je vous aider ?' }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const userProfileRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useDoc<User>(userProfileRef);
  const companyId = profile?.companyId || 'default-company';

  React.useEffect(() => {
    const handleOpenCreation = () => {
      setIsOpen(true);
      setInput("Crée une nouvelle tuile nommée ");
    };
    window.addEventListener('open-chat-category-creation', handleOpenCreation);
    return () => window.removeEventListener('open-chat-category-creation', handleOpenCreation);
  }, []);

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
        const { type, categoryId, label, visibleToEmployees, documentName, documentId } = result.action;
        
        // Exécution de l'action demandée par Gemini
        if (type === 'create_category' && label) {
          const id = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const ref = doc(db, 'companies', companyId, 'categories', id);
          setDocumentNonBlocking(ref, {
            id,
            label,
            badgeCount: 0,
            visibleToEmployees: false,
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
        } else if (type === 'toggle_visibility' && categoryId) {
          const ref = doc(db, 'companies', companyId, 'categories', categoryId);
          updateDocumentNonBlocking(ref, { visibleToEmployees: visibleToEmployees ?? true });
        } else if (type === 'add_document' && categoryId && documentName) {
          const ref = collection(db, 'companies', companyId, 'documents');
          addDocumentNonBlocking(ref, {
            name: documentName,
            categoryId,
            projectColumn: 'budget',
            status: 'pending_analysis',
            extractedData: {},
            fileUrl: 'https://picsum.photos/seed/doc/200/300',
            createdAt: new Date().toLocaleDateString(),
            companyId
          });
        } else if (type === 'delete_document' && documentId) {
          const ref = doc(db, 'companies', companyId, 'documents', documentId);
          deleteDocumentNonBlocking(ref);
        }
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: result.analysisResult || "Tâche effectuée !" 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Une erreur est survenue lors de l'analyse." }]);
    } finally {
      setIsLoading(false);
    }
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
        <Card className="w-[380px] h-[500px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Assistant Gemini</CardTitle>
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
                placeholder="Ex: Crée la tuile 'Archives'..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-muted/50 border-none focus-visible:ring-primary"
              />
              <Button size="icon" onClick={handleSend} disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
