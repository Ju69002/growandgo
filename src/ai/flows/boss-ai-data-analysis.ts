
'use server';

/**
 * @fileOverview Assistant IA Expert Design pour Grow&Go via Gemini 1.5 Flash.
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
  subCategories: z.array(z.string()).optional().describe('Liste des sous-dossiers logiques à créer pour cette catégorie.'),
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
  model: 'googleai/gemini-1.5-flash',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  system: `Tu es l'Expert Organisation de Grow&Go Studio. Tu accompagnes le Patron dans la gestion de sa structure documentaire.
  
  MISSION : 
  Lorsqu'une catégorie est créée, tu dois impérativement générer une structure de sous-dossiers (subCategories) intelligente.
  
  EXEMPLES DE STRUCTURES :
  - "Juridique" -> ["Statuts & Kbis", "Pièces d'identité Dirigeants", "Contrats & Baux", "Attestations"].
  - "Marketing" -> ["Identité Visuelle", "Réseaux Sociaux", "Campagnes Pub", "Presse"].
  - "Technique" -> ["Plans", "Devis Fournisseurs", "Certifications", "Sécurité"].
  
  RÈGLES CRITIQUES :
  1. AUTONOMIE ICONE : Choisis l'icône la plus adaptée (juridique, travail, rh, finance, admin, default).
  2. SOUS-DOSSIERS : Propose entre 3 et 5 sous-dossiers pertinents par catégorie.
  3. OPTIMISATION : Si deux thèmes sont proches, rassemble-les dans un seul sous-dossier (ex: "Statuts" et "Kbis" deviennent "Statuts & Kbis").
  4. DESIGN : Garde un ton professionnel et encourageant.
  5. LANGUE : Réponds exclusivement en français.`,
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
