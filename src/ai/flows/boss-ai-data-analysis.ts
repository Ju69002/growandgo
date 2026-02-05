'use server';

/**
 * @fileOverview Assistant IA pour les propriétaires d'entreprise utilisant Gemini 2.5 Flash.
 * Identifie les actions et demande confirmation avant exécution.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossActionSchema = z.object({
  type: z.enum([
    'create_category', 
    'delete_category', 
    'rename_category', 
    'toggle_visibility', 
    'add_document', 
    'delete_document',
    'change_theme_color',
    'toggle_module'
  ]).describe('Le type d\'action à effectuer.'),
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie.'),
  label: z.string().optional().describe('Le nouveau nom pour la catégorie.'),
  visibleToEmployees: z.boolean().optional().describe('Le statut de visibilité souhaité.'),
  documentName: z.string().optional().describe('Le nom du document.'),
  documentId: z.string().optional().describe('L\'identifiant du document.'),
  color: z.string().optional().describe('La couleur demandée (ex: "bleu", "rouge", ou code HSL/Hex).'),
  moduleName: z.string().optional().describe('Le nom du module (rh, finance, etc.).'),
  enabled: z.boolean().optional().describe('Si le module doit être activé ou non.'),
});

const BossAiDataAnalysisInputSchema = z.object({
  query: z.string().describe('La requête du propriétaire.'),
  companyId: z.string().describe('L\'identifiant de l\'entreprise.'),
});
export type BossAiDataAnalysisInput = z.infer<typeof BossAiDataAnalysisInputSchema>;

const BossAiDataAnalysisOutputSchema = z.object({
  analysisResult: z.string().describe('L\'explication de ce qui va être fait, demandant confirmation.'),
  action: BossActionSchema.optional().describe('L\'action structurée identifiée par l\'IA.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

const bossPrompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  system: `Tu es l'assistant BusinessPilot Architecte.
  Ton rôle est d'aider le propriétaire à gérer la structure et l'aspect visuel de son entreprise.
  
  RÈGLE CRUCIALE : Tu ne dois JAMAIS dire que l'action est faite. Tu dois TOUJOURS expliquer ce que tu as compris et demander si l'utilisateur veut que tu procèdes.
  
  Exemple de réponse : "J'ai compris que vous souhaitiez changer la couleur du site en vert forêt. Voulez-vous que je mette à jour le thème ?"
  
  Actions supportées :
  - 'create_category' : Créer une nouvelle tuile (vide par défaut).
  - 'delete_category' : Supprimer une tuile existante.
  - 'rename_category' : Renommer une tuile.
  - 'change_theme_color' : Changer la couleur principale (convertis les noms de couleurs en HSL ex: bleu -> 231 48% 48%).
  - 'toggle_module' : Activer/Désactiver RH ou Finance.
  
  Sois poli, professionnel et demande TOUJOURS validation.`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  return output!;
}
