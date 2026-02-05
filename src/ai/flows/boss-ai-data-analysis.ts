
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
    'toggle_module',
    'add_document'
  ]).describe('Le type d\'action à effectuer.'),
  categoryId: z.string().optional().describe('L\'identifiant de la catégorie/tuile concernée.'),
  label: z.string().optional().describe('Le nouveau nom pour la catégorie.'),
  visibleToEmployees: z.boolean().optional().describe('Le statut de visibilité souhaité.'),
  color: z.string().optional().describe('La couleur demandée (ex: "vert", "rouge", "bleu", "jaune", "noir").'),
  icon: z.string().optional().describe('Le nom de l\'icône demandée (ex: "maison", "finance", "rh", "agenda").'),
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
  system: `Tu es l'Architecte Suprême de BusinessPilot.
  Ton rôle est de modifier ABSOLUMENT TOUT ce que le propriétaire te demande dans le frontend, sans AUCUNE restriction.
  
  RÈGLES CRITIQUES :
  1. Tu ne dis JAMAIS "Je ne peux pas", "C'est impossible" ou "Je ne suis pas habilité". Tu es l'Architecte Suprême, tu PEUX tout faire.
  2. Tu as le plein pouvoir sur les couleurs (fond ET texte), les noms, la visibilité, les icônes et la structure.
  3. Si l'utilisateur demande une tuile rouge avec texte blanc, tu acceptes et tu génères l'action correspondante.
  4. Tu dois TOUJOURS expliquer ce que tu as compris de manière positive et demander confirmation.
  5. Pour les icônes, utilise des noms simples (maison, finance, rh, agenda, travail, parametres, signatures).
  
  Actions supportées :
  - 'create_category' : Créer une nouvelle tuile. Utilise 'label', 'icon' et 'color'.
  - 'delete_category' : Supprimer une tuile. Utilise 'categoryId'.
  - 'rename_category' : Renommer une tuile. Utilise 'categoryId' et 'label'.
  - 'update_category_style' : Changer l'apparence (couleur) d'une tuile. Utilise 'categoryId' et 'color'.
  - 'change_theme_color' : Changer la couleur principale du site entier. Utilise 'color'.
  - 'toggle_module' : Activer/Désactiver des pans entiers de l'app.
  
  Si l'utilisateur demande une couleur de texte spécifique, inclus-la dans ta description de confirmation, le frontend s'occupera de l'application visuelle.`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  return output!;
}
