'use server';

/**
 * @fileOverview Assistant IA Expert Design pour Grow&Go via Gemini 2.5 Flash Lite.
 * Gère les transformations visuelles et structurelles en Mode Patron.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossActionSchema = z.object({
  type: z.enum([
    'create_category', 
    'delete_category', 
    'rename_category', 
    'toggle_visibility', 
    'update_category_style',
    'change_theme_color',
    'toggle_module'
  ]).describe('Le type d\'action à effectuer.'),
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie.'),
  label: z.string().optional().describe('Le nom affiché (ex: "Maison", "Signature").'),
  visibleToEmployees: z.boolean().optional().describe('Statut de visibilité.'),
  color: z.string().optional().describe('La couleur demandée ou suggérée (ex: "bleu", "vert", "orange").'),
  icon: z.string().optional().describe('L\'icône suggérée (ex: "maison", "finance", "rh", "signatures", "travail").'),
  moduleName: z.string().optional().describe('Le nom du module concerné.'),
  enabled: z.boolean().optional().describe('Activation/Désactivation.'),
});

const BossAiDataAnalysisInputSchema = z.object({
  query: z.string().describe('La requête du propriétaire.'),
  companyId: z.string().describe('L\'identifiant de l\'entreprise.'),
});
export type BossAiDataAnalysisInput = z.infer<typeof BossAiDataAnalysisInputSchema>;

const BossAiDataAnalysisOutputSchema = z.object({
  analysisResult: z.string().describe('L\'explication enthousiaste de ce qui va être fait.'),
  action: BossActionSchema.optional().describe('L\'action structurée à exécuter.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

const bossPrompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  model: 'googleai/gemini-2.5-flash-lite',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  system: `Tu es l'Expert Design IA de Grow&Go Studio. Tu accompagnes le Patron dans la personnalisation de son espace.
  
  RÈGLES CRITIQUES :
  1. Tu ne dis JAMAIS non. Tu agis toujours en faveur du design demandé.
  2. Tu es AUTONOME : si le patron demande de créer un dossier (ex: "Juridique") sans préciser de couleur ou d'icône, tu DOIS les déterminer toi-même de manière cohérente.
  3. Mappe les icônes de manière logique : 
     - "Juridique" -> icône 'admin' ou 'signatures', couleur 'bleu' ou 'sombre'.
     - "Marketing" -> icône 'default', couleur 'orange' ou 'rose'.
     - "Travaux" -> icône 'travail', couleur 'jaune'.
  4. Tu dois TOUJOURS expliquer ton plan de transformation (quelle icône et couleur tu as choisi et pourquoi) dans analysisResult.
  5. Réponds exclusivement en français.`,
  prompt: `Demande du patron : {{{query}}} (Entreprise ID : {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  try {
    const {output} = await bossPrompt(input);
    if (!output) throw new Error("Échec de l'analyse IA");
    return output;
  } catch (error) {
    return {
      analysisResult: "Je suis prêt à transformer votre studio Grow&Go ! Que souhaitez-vous changer dans votre interface ?",
    };
  }
}
