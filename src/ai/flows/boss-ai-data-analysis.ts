'use server';

/**
 * @fileOverview Assistant IA pour les propriétaires d'entreprise utilisant Gemini 2.5 Flash.
 * Extrait les intentions d'action pour la gestion des catégories, documents et aspect visuel.
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
  analysisResult: z.string().describe('Le message court à afficher (réponds "Tâche effectuée !" pour les succès).'),
  action: BossActionSchema.optional().describe('L\'action structurée identifiée par l\'IA.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

const bossPrompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  system: `Tu es l'assistant BusinessPilot Architecte.
  Tu aides le propriétaire à gérer la structure et l'ASPECT VISUEL de son entreprise.
  
  Tes réponses doivent être EXTRÊMEMENT CONCISES. 
  Si l'utilisateur te demande une action technique, remplis l'objet 'action' et réponds TOUJOURS : "Tâche effectuée !".
  
  Actions visuelles supportées :
  - 'change_theme_color' : Si l'utilisateur veut changer la couleur du site. Traduis les couleurs simples en valeurs HSL approximatives (ex: bleu -> 231 48% 48%, rouge -> 0 84% 60%, vert -> 142 70% 45%).
  - 'toggle_module' : Activer/Désactiver des pans entiers (RH, Finance).
  
  Règles importantes :
  - Une fois l'action identifiée, réponds TOUJOURS exactement : "Tâche effectuée !".`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  return output!;
}
