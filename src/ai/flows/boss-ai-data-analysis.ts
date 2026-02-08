'use server';

/**
 * @fileOverview Assistant IA Expert Design pour Grow&Go via Gemini 2.5 Flash Lite.
 * Gère les transformations structurelles et le choix des icônes en Mode Patron.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossActionSchema = z.object({
  type: z.enum([
    'create_category', 
    'delete_category', 
    'rename_category', 
    'toggle_visibility', 
    'toggle_module'
  ]).describe('Le type d\'action à effectuer.'),
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie.'),
  label: z.string().optional().describe('Le nom affiché (ex: "Juridique", "Marketing").'),
  visibleToEmployees: z.boolean().optional().describe('Statut de visibilité.'),
  icon: z.string().optional().describe('L\'icône suggérée (ex: "juridique", "travail", "finance", "rh", "admin").'),
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
  system: `Tu es l'Expert Organisation de Grow&Go Studio. Tu accompagnes le Patron dans la création de ses dossiers.
  
  RÈGLES CRITIQUES :
  1. Tu es AUTONOME pour le choix de l'icône. Choisis l'icône la plus adaptée au nom du dossier.
  2. Mappe les icônes de manière logique : 
     - "Juridique", "Contrats", "Légal" -> icône 'juridique'.
     - "Travaux", "Chantier", "Technique" -> icône 'travail'.
     - "Marketing", "Communication" -> icône 'default'.
     - "RH", "Équipe", "Salariés" -> icône 'rh'.
     - "Factures", "Compta", "Argent" -> icône 'finance'.
  3. Ne parle plus de couleurs de tuiles, le design doit rester sobre et uniforme.
  4. Explique pourquoi tu as choisi cette icône dans analysisResult.
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
      analysisResult: "Je suis prêt à organiser votre studio ! Quel nouveau dossier souhaitez-vous créer ?",
    };
  }
}
