'use server';

/**
 * @fileOverview Assistant IA pour les propriétaires d'entreprise avec outils de gestion.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossAiDataAnalysisInputSchema = z.object({
  query: z.string().describe('La requête du propriétaire.'),
  companyId: z.string().describe('L\'identifiant de l\'entreprise.'),
  context: z.string().optional().describe('Contexte additionnel sur les données.'),
});
export type BossAiDataAnalysisInput = z.infer<typeof BossAiDataAnalysisInputSchema>;

const BossAiDataAnalysisOutputSchema = z.object({
  analysisResult: z.string().describe('Le résultat court de l\'opération.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

// Tool to manage categories
const manageCategoryTool = ai.defineTool(
  {
    name: 'manageCategory',
    description: 'Crée, renomme ou modifie la visibilité d\'une catégorie (tuile).',
    inputSchema: z.object({
      action: z.enum(['create', 'rename', 'toggleVisibility', 'delete']),
      categoryId: z.string().optional(),
      label: z.string().optional(),
      visibleToEmployees: z.boolean().optional(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    // This is a server-side signal, the client will pick this up or we return instructions
    return `Action ${input.action} programmée pour la catégorie ${input.label || input.categoryId}`;
  }
);

// Tool to manage documents (sub-folders/files)
const manageDocumentTool = ai.defineTool(
  {
    name: 'manageDocument',
    description: 'Ajoute ou supprime un document (sous-dossier) dans une catégorie.',
    inputSchema: z.object({
      action: z.enum(['add', 'delete']),
      documentId: z.string().optional(),
      categoryId: z.string(),
      name: z.string().optional(),
    }),
    outputSchema: z.string(),
  },
  async (input) => {
    return `Action ${input.action} programmée pour le document dans ${input.categoryId}`;
  }
);

const prompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  tools: [manageCategoryTool, manageDocumentTool],
  system: `Tu es l'assistant BusinessPilot.
  Tes réponses doivent être EXTRÊMEMENT CONCISES. 
  Si l'utilisateur te demande une action technique (créer, supprimer, renommer), utilise les outils fournis.
  Une fois l'outil appelé, réponds TOUJOURS exactement : "Tâche effectuée !".
  Ne fais jamais de longs paragraphes.
  Toutes les nouvelles tuiles créées doivent être vides par défaut.`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await prompt(input);
  return output!;
}
