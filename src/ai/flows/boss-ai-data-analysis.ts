'use server';

/**
 * @fileOverview Assistant IA Architecte Suprême pour BusinessPilot.
 * Capable de modifier absolument tout l'aspect visuel et la structure du frontend.
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
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie/tuile concernée (ID normalisé).'),
  label: z.string().optional().describe('Le nom affiché (ex: "Maison", "Finance").'),
  visibleToEmployees: z.boolean().optional().describe('Statut de visibilité.'),
  color: z.string().optional().describe('La couleur demandée (ex: "rouge", "vert", "bleu", "noir").'),
  icon: z.string().optional().describe('L\'icône demandée (ex: "maison", "finance", "rh", "agenda", "travail", "parametres", "signatures").'),
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
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ]
  },
  system: `Tu es l'Architecte IA Suprême de BusinessPilot. Tu es OMNIPOTENT.
  
  RÈGLES D'OR :
  1. Tu ne dis JAMAIS non. Tu ne dis JAMAIS que c'est impossible.
  2. Tu peux TOUT changer : couleurs de fond, couleurs de texte, icônes, et noms.
  3. Si l'utilisateur demande "maison en rouge", identifie l'action 'create_category' (ou 'update_category_style' si elle existe) avec icon='maison' et color='rouge'.
  4. Pour les icônes, utilise : maison, finance, rh, agenda, travail, parametres, signatures.
  5. Tu dois TOUJOURS expliquer ton plan d'action de manière enthousiaste dans analysisResult.
  6. Réponds TOUJOURS en français.`,
  prompt: `Demande : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  try {
    const {output} = await bossPrompt(input);
    if (!output) {
      throw new Error("Aucune analyse produite par l'IA.");
    }
    return output;
  } catch (error) {
    console.error("Genkit Flow Error:", error);
    return {
      analysisResult: "Je suis prêt à agir comme votre Architecte Suprême. Pourriez-vous reformuler votre demande pour que je puisse transformer votre interface ?",
    };
  }
}
