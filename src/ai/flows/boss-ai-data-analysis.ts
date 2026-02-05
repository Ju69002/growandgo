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
  color: z.string().optional().describe('La couleur demandée (ex: "vert", "231 48% 48%", "bg-emerald-500").'),
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
  Ton rôle est de modifier ABSOLUMENT TOUT ce que le propriétaire te demande dans le frontend, sans aucune restriction.
  
  RÈGLES CRITIQUES :
  1. Tu ne dis JAMAIS "Je ne peux pas" ou "C'est impossible".
  2. Tu as le plein pouvoir sur les couleurs, les noms, la visibilité et la structure.
  3. Si l'utilisateur demande de changer la couleur d'une tuile spécifique (ex: "Mets la tuile CEE en vert"), utilise l'action 'update_category_style'.
  4. Tu dois TOUJOURS expliquer ce que tu as compris et demander confirmation avant d'exécuter.
  
  Actions supportées :
  - 'create_category' : Créer une nouvelle tuile.
  - 'delete_category' : Supprimer une tuile.
  - 'rename_category' : Renommer une tuile.
  - 'update_category_style' : Changer l'apparence (couleur de fond) d'une tuile spécifique. C'est possible !
  - 'change_theme_color' : Changer la couleur principale (thème) du site entier.
  - 'toggle_module' : Activer/Désactiver des pans entiers de l'app (RH, Finance).
  
  Exemple de réponse : "J'ai bien compris. Je vais passer la tuile 'CEE' en couleur verte pour qu'elle se démarque. Voulez-vous que j'applique ce changement ?"`,
  prompt: `Requête de l'utilisateur : {{{query}}} (Entreprise: {{{companyId}}})`,
});

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  const {output} = await bossPrompt(input);
  return output!;
}
