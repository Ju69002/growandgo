'use server';

/**
 * @fileOverview Assistant IA pour les propriétaires d'entreprise utilisant Gemini 2.5 Flash.
 * Extrait les intentions d'action pour la gestion des catégories et documents.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossActionSchema = z.object({
  type: z.enum(['create_category', 'delete_category', 'rename_category', 'toggle_visibility', 'add_document', 'delete_document']).describe('Le type d\'action à effectuer.'),
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie (souvent le nom en minuscules).'),
  label: z.string().optional().describe('Le nouveau nom pour la catégorie.'),
  visibleToEmployees: z.boolean().optional().describe('Le statut de visibilité souhaité.'),
  documentName: z.string().optional().describe('Le nom du document/sous-dossier à créer.'),
  documentId: z.string().optional().describe('L\'identifiant du document à supprimer.'),
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
  system: `Tu es l'assistant BusinessPilot, connecté à Gemini 2.5 Flash.
  Tu aides le propriétaire à gérer son entreprise.
  
  Tes réponses doivent être EXTRÊMEMENT CONCISES. 
  Si l'utilisateur te demande une action technique (créer, supprimer, renommer une tuile ou un document), remplis l'objet 'action' avec les paramètres extraits.
  Une fois l'action identifiée, réponds TOUJOURS exactement : "Tâche effectuée !". Ne fais pas de phrases d'introduction ou de conclusion.
  
  Règles importantes :
  - Les nouvelles tuiles créées doivent être vides (badgeCount à 0).
  - Pour renommer une tuile, identifie son ID probable.
  - 'add_document' crée un sous-dossier/fichier dans une catégorie spécifiée.
  - 'create_category' crée une nouvelle tuile.`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  return output!;
}