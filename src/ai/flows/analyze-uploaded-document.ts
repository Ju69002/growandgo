'use server';

/**
 * @fileOverview Flux pour analyser les documents via Gemini 1.5 Pro.
 * Identifie la catégorie, le sous-dossier et suggère la création de nouveaux dossiers si nécessaire.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  fileUrl: z.string().describe("Le contenu du document sous forme de Data URI (Base64)."),
  currentCategoryId: z.string().describe('ID de la catégorie actuelle.'),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })).describe('Structure actuelle des dossiers.'),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const AnalyzeUploadedDocumentOutputSchema = z.object({
  name: z.string().describe('Titre clair extrait du document.'),
  suggestedCategoryId: z.string().describe('ID de la catégorie principale.'),
  suggestedCategoryLabel: z.string().describe('Nom de la catégorie.'),
  suggestedSubCategory: z.string().describe('Nom du sous-dossier suggéré.'),
  isNewSubCategory: z.boolean().describe('Indique si ce sous-dossier doit être créé car inexistant.'),
  extractedData: z.object({
    date: z.string().describe('Date du document'),
    montant: z.string().describe('Montant si applicable'),
    emetteur: z.string().describe('Émetteur du document'),
    reference: z.string().describe('Référence ou numéro'),
  }),
  summary: z.string().describe('Résumé très court du contenu.'),
  reasoning: z.string().describe('Pourquoi ce classement ?'),
});
export type AnalyzeUploadedDocumentOutput = z.infer<typeof AnalyzeUploadedDocumentOutputSchema>;

export async function analyzeUploadedDocument(
  input: AnalyzeUploadedDocumentInput
): Promise<AnalyzeUploadedDocumentOutput> {
  return analyzeUploadedDocumentFlow(input);
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  model: 'googleai/gemini-1.5-pro',
  input: {
    schema: AnalyzeUploadedDocumentInputSchema,
  },
  output: {
    schema: AnalyzeUploadedDocumentOutputSchema,
  },
  prompt: `Tu es l'Expert Documentaliste de BusinessPilot.
  
  ANALYSE CE DOCUMENT : {{media url=fileUrl}}
  
  STRUCTURE ACTUELLE :
  {{#each availableCategories}}
  - {{label}} (ID: {{id}}) > Sous-dossiers: {{#each subCategories}}"{{this}}" {{/each}}
  {{/each}}
  
  MISSION :
  1. Lis le document par OCR/Vision.
  2. Trouve la catégorie et le sous-dossier le plus adapté.
  3. SI aucun sous-dossier existant ne convient ET que le document est important (ex: nouveau type de contrat, nouvelle taxe, etc.), suggère un NOUVEAU nom de sous-dossier pertinent et mets isNewSubCategory à true.
  4. Extrais les données clés (Date, Montant, Émetteur, Référence).
  
  Réponds en JSON uniquement.`,
});

const analyzeUploadedDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedDocumentFlow',
    inputSchema: AnalyzeUploadedDocumentInputSchema,
    outputSchema: AnalyzeUploadedDocumentOutputSchema,
  },
  async input => {
    try {
      const {output} = await analyzeDocumentPrompt(input);
      if (!output) throw new Error("L'IA n'a pas pu analyser le document.");
      return output;
    } catch (e) {
      console.error("Gemini Flow Error:", e);
      throw e;
    }
  }
);
