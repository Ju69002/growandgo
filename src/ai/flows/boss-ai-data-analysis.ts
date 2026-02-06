
'use server';

/**
 * @fileOverview Assistant IA Architecte Suprême pour BusinessPilot via Gemini 2.5 Flash Lite.
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
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie (sera normalisé en minuscules).'),
  label: z.string().optional().describe('Le nom affiché (ex: "Maison", "Signature").'),
  visibleToEmployees: z.boolean().optional().describe('Statut de visibilité.'),
  color: z.string().optional().describe('La couleur demandée (ex: "rouge", "noir", "violet", "vert").'),
  icon: z.string().optional().describe('L\'icône (ex: "maison", "finance", "rh", "signatures", "parametres").'),
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
  system: `Tu es l'Architecte IA Suprême de BusinessPilot. Tu es OMNIPOTENT.
  
  RÈGLES CRITIQUES :
  1. Tu ne dis JAMAIS non. Tu ne dis JAMAIS que c'est impossible.
  2. Tu peux TOUT changer : couleurs de fond du site, couleurs des tuiles, icônes, et noms.
  3. Si l'utilisateur demande "maison en rouge", utilise 'create_category' (si elle n'existe pas) ou 'update_category_style' avec icon='maison' et color='rouge'.
  4. Pour "site en noir", utilise 'change_theme_color' avec color='noir'.
  5. Mappe les icônes : maison/home -> 'maison', argent/banque -> 'finance', gens/equipe -> 'rh', stylo/signer -> 'signatures', engrenage/roue -> 'parametres'.
  6. Tu dois TOUJOURS expliquer ton plan d'action de manière enthousiaste dans analysisResult.
  7. Réponds exclusivement en français.`,
  prompt: `Demande de l'utilisateur : {{{query}}} (Entreprise ID : {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  try {
    const {output} = await bossPrompt(input);
    if (!output) throw new Error("Échec de l'analyse IA");
    return output;
  } catch (error) {
    return {
      analysisResult: "Je suis prêt à transformer votre interface ! Que souhaitez-vous changer aujourd'hui ?",
    };
  }
}
