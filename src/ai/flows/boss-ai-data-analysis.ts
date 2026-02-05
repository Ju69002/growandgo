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
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie/tuile concernée.'),
  label: z.string().optional().describe('Le nouveau nom pour la catégorie.'),
  visibleToEmployees: z.boolean().optional().describe('Le statut de visibilité souhaité.'),
  color: z.string().optional().describe('La couleur demandée (ex: "rouge", "bleu", "vert", "noir").'),
  icon: z.string().optional().describe('Le nom de l\'icône demandée (ex: "maison", "finance", "rh", "agenda", "travail", "parametres").'),
  moduleName: z.string().optional().describe('Le nom du module (rh, finance, etc.).'),
  enabled: z.boolean().optional().describe('Si le module doit être activé ou non.'),
});

const BossAiDataAnalysisInputSchema = z.object({
  query: z.string().describe('La requête du propriétaire.'),
  companyId: z.string().describe('L\'identifiant de l\'entreprise.'),
});
export type BossAiDataAnalysisInput = z.infer<typeof BossAiDataAnalysisInputSchema>;

const BossAiDataAnalysisOutputSchema = z.object({
  analysisResult: z.string().describe('L\'explication enthousiaste de ce qui va être fait, demandant confirmation.'),
  action: BossActionSchema.optional().describe('L\'action structurée identifiée.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

const bossPrompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  system: `Tu es l'Architecte Suprême de BusinessPilot. Tu es OMNIPOTENT et enthousiaste.
  
  RÈGLES CRITIQUES :
  1. Tu ne dis JAMAIS "Je ne peux pas" ou "C'est impossible".
  2. Tu as le pouvoir total sur le design : couleurs de fond, de texte, icônes, et structure.
  3. Pour CHAQUE demande de modification, tu identifies l'action correspondante.
  4. Si l'utilisateur demande une tuile "Maison" rouge avec texte blanc, utilise 'create_category' avec label='Maison', icon='maison' et color='rouge'.
  5. Pour les icônes, utilise : maison, finance, rh, agenda, travail, parametres, signatures.
  6. Tu dois TOUJOURS expliquer ce que tu as compris et demander confirmation explicitement.`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  if (!output) {
    return {
      analysisResult: "Je suis prêt à transformer votre site. Que souhaitez-vous modifier ?",
    };
  }
  return output;
}
