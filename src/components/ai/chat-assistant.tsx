'use client';

import * as React from 'react';
import { MessageSquare, X, Send, Bot, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { bossAiDataAnalysis } from '@/ai/flows/boss-ai-data-analysis';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export function ChatAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useUser();
  const db = useFirestore();
  
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre assistant BusinessPilot. Comment puis-je vous aider ?' }
  ]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    const handleOpenCreation = () => {
      setIsOpen(true);
      setInput("Crée une nouvelle catégorie nommée ");
    };
    window.addEventListener('open-chat-category-creation', handleOpenCreation);
    return () => window.removeEventListener('open-chat-category-creation', handleOpenCreation);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      if (currentInput.toLowerCase().includes('crée') && (currentInput.toLowerCase().includes('catégorie') || currentInput.toLowerCase().includes('tuile'))) {
        const nameMatch = currentInput.match(/(?:nommée|appelée|nom|est)\s+['"]?([^.'"]+)['"]?/i);
        const categoryName = nameMatch ? nameMatch[1].trim() : 'Nouvelle Catégorie';
        
        const companyId = 'default-company';
        const categoriesRef = collection(db, 'companies', companyId, 'categories');
        
        addDocumentNonBlocking(categoriesRef, {
          label: categoryName,
          badge_count: 0,
          visible_to_employees: false,
          type: 'custom',
          ai_instructions: 'Analyse les documents pour cette nouvelle catégorie.',
          companyId: companyId
        });

        setMessages(prev => [...prev, { role: 'assistant', content: "Tâche effectuée ! La tuile vide a été créée." }]);
      } else {
        const result = await bossAiDataAnalysis({
          query: currentInput,
          companyData: "Données synthétisées : Opérations normales."
        });
        setMessages(prev => [...prev, { role: 'assistant', content: result.analysisResult }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Une erreur est survenue." }]);
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
          <Sparkles className="h-6 w-6" />
        </Button>
      ) : (
        <Card className="w-[380px] h-[500px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Assistant IA</CardTitle>
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
                    <div className="bg-muted p-3 rounded-2xl text-sm animate-pulse italic">
                      ...
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
