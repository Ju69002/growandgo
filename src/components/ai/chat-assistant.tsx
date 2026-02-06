
'use client';

import * as React from 'react';
import { X, Send, Bot, Sparkles, Loader2, Check, Ban } from 'lucide-react';
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
};

const THEME_COLOR_MAP: Record<string, { primary: string; background: string; foreground: string }> = {
  'noir': { primary: '0 0% 100%', background: '222 47% 11%', foreground: '210 40% 98%' },
  'blanc': { primary: '157 44% 21%', background: '43 38% 96%', foreground: '157 44% 11%' },
  'rouge': { primary: '0 84% 60%', background: '43 38% 96%', foreground: '157 44% 11%' },
  'vert': { primary: '142 76% 36%', background: '43 38% 96%', foreground: '157 44% 11%' },
  'bleu': { primary: '221 83% 53%', background: '43 38% 96%', foreground: '157 44% 11%' },
  'jaune': { primary: '47 95% 55%', background: '43 38% 96%', foreground: '157 44% 11%' },
  'violet': { primary: '262 83% 58%', background: '43 38% 96%', foreground: '157 44% 11%' },
};

const getColorStyle = (color?: string) => {
  if (!color) return undefined;
  const c = color.toLowerCase();
  if (c === 'rouge') return 'bg-red-600 text-white shadow-lg';
  if (c === 'vert') return 'bg-emerald-600 text-white shadow-lg';
  if (c === 'bleu') return 'bg-blue-600 text-white shadow-lg';
  if (c === 'jaune') return 'bg-amber-400 text-amber-950 shadow-lg';
  if (c === 'noir') return 'bg-slate-900 text-white shadow-lg';
  if (c === 'violet' || c === 'pourpre') return 'bg-purple-600 text-white shadow-lg';
  if (c === 'orange') return 'bg-orange-500 text-white shadow-lg';
  return undefined;
};

export function ChatAssistant() {
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useUser();
  const db = useFirestore();
  const [messages, setMessages] = React.useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis l\'Architecte Suprême de Grow&Go. Je peux transformer votre interface selon vos désirs. Que souhaitez-vous changer ?' }
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
  const adminMode = profile?.adminMode || false;

  const companyRef = useMemoFirebase(() => {
    if (!db || !companyId) return null;
    return doc(db, 'companies', companyId);
  }, [db, companyId]);

  const executeAction = (action: any) => {
    if (!db || !companyId || !companyRef || !adminMode) return;

    const { type, categoryId, label, color, icon, moduleName, enabled } = action;
    const rawId = categoryId || label || '';
    const targetId = rawId.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');

    try {
      if (type === 'create_category' && label) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        setDocumentNonBlocking(ref, {
          id: targetId,
          label,
          badgeCount: 0,
          visibleToEmployees: true,
          type: 'custom',
          aiInstructions: `Analyse spécialisée pour Grow&Go - ${label}.`,
          companyId,
          color: getColorStyle(color),
          icon: icon || 'maison'
        }, { merge: true });
      } else if (type === 'delete_category' && targetId) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        deleteDocumentNonBlocking(ref);
      } else if (type === 'rename_category' && targetId && label) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        updateDocumentNonBlocking(ref, { label });
      } else if (type === 'update_category_style' && targetId && color) {
        const ref = doc(db, 'companies', companyId, 'categories', targetId);
        updateDocumentNonBlocking(ref, { color: getColorStyle(color) });
      } else if (type === 'change_theme_color' && color) {
        const theme = THEME_COLOR_MAP[color.toLowerCase()] || THEME_COLOR_MAP['blanc'];
        updateDocumentNonBlocking(companyRef, { 
          primaryColor: theme.primary,
          backgroundColor: theme.background,
          foregroundColor: theme.foreground
        });
      } else if (type === 'toggle_module' && moduleName) {
        const key = moduleName.toLowerCase() === 'rh' ? 'showRh' : 'showFinance';
        updateDocumentNonBlocking(companyRef, { [`modulesConfig.${key}`]: enabled ?? true });
      }

      setMessages(prev => [...prev, { role: 'assistant', content: "C'est fait ! La transformation Grow&Go a été appliquée." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur technique a empêché l'application." }]);
    }
    setPendingAction(null);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !db || !companyId) return;

    const currentInput = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: currentInput }]);
    setIsLoading(true);

    if (!adminMode) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: "Désolé, je ne suis pas habilité à faire ça car le Mode Architecte est désactivé." 
      }]);
      setIsLoading(false);
      return;
    }

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
        content: result.analysisResult || "Plan établi pour Grow&Go. Souhaitez-vous que j'agisse ?" 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Je suis prêt. Pourriez-vous préciser votre demande de design ?" }]);
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
          <Sparkles className="h-6 w-6 text-white" />
        </Button>
      ) : (
        <Card className="w-[350px] sm:w-[380px] h-[500px] flex flex-col shadow-2xl border-none animate-in slide-in-from-bottom-5">
          <CardHeader className="bg-primary text-primary-foreground rounded-t-xl p-4 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Architecte Grow&Go</CardTitle>
            </div>
            <X className="h-5 w-5 cursor-pointer hover:opacity-80" onClick={() => setIsOpen(false)} />
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden bg-background">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn( m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted border",
                      "max-w-[85%] p-3 rounded-2xl text-sm shadow-sm font-medium"
                    )}>
                      {m.content}
                    </div>
                  </div>
                ))}
                
                {pendingAction && !isLoading && (
                  <div className="flex justify-start">
                    <div className="flex flex-col gap-2 p-3 bg-primary/5 border rounded-2xl max-w-[85%]">
                      <p className="text-xs font-bold text-primary uppercase">Validation Grow&Go</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => executeAction(pendingAction)} className="bg-emerald-600 hover:bg-emerald-700 h-8">
                          <Check className="w-4 h-4 mr-1" />
                          Confirmer
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setPendingAction(null)} className="h-8">
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
          <CardFooter className="p-3 border-t">
            <div className="flex w-full items-center gap-2">
              <Input
                placeholder={pendingAction ? "Action en attente..." : "Ex: maison en vert..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || !!pendingAction}
                className="flex-1"
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
