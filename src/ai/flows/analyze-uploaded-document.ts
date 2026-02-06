'use server';

/**
 * @fileOverview Flux pour analyser les documents via Gemini 1.5 Flash.
 * Effectue une analyse OCR pour identifier la catégorie, le sous-dossier et l'importance.
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
  name: z.string().describe('Titre clair extrait du document par OCR.'),
  suggestedCategoryId: z.string().describe('ID de la catégorie principale la plus adaptée.'),
  suggestedCategoryLabel: z.string().describe('Nom de la catégorie choisie.'),
  suggestedSubCategory: z.string().describe('Nom du sous-dossier suggéré.'),
  isNewSubCategory: z.boolean().describe('Indique si ce sous-dossier doit être créé car inexistant et important.'),
  extractedData: z.object({
    date: z.string().describe('Date extraite du document.'),
    montant: z.string().describe('Montant total TTC identifié.'),
    emetteur: z.string().describe('Nom de l\'émetteur ou fournisseur.'),
    reference: z.string().describe('Numéro de référence ou de facture.'),
  }).describe('Données structurées extraites.'),
  summary: z.string().describe('Résumé très court du document.'),
  reasoning: z.string().describe('Justification du choix de rangement.'),
});
export type AnalyzeUploadedDocumentOutput = z.infer<typeof AnalyzeUploadedDocumentOutputSchema>;

export async function analyzeUploadedDocument(
  input: AnalyzeUploadedDocumentInput
): Promise<AnalyzeUploadedDocumentOutput> {
  return analyzeUploadedDocumentFlow(input);
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {
    schema: AnalyzeUploadedDocumentInputSchema,
  },
  output: {
    schema: AnalyzeUploadedDocumentOutputSchema,
  },
  prompt: `Tu es l'Expert Documentaliste de BusinessPilot.
  
  MISSION : Analyse ce document par vision OCR : {{media url=fileUrl}}
  
  STRUCTURE ACTUELLE :
  {{#each availableCategories}}
  - {{label}} (ID: {{id}}) > Sous-dossiers : {{#each subCategories}}"{{this}}" {{/each}}
  {{/each}}
  
  CONSIGNES :
  1. Identifie précisément le TITRE et l'EMETTEUR du document.
  2. Choisis la catégorie la plus logique (Finance, RH, Admin, etc.).
  3. REGLE DE CLASSEMENT : 
     - Si un sous-dossier existant correspond, utilise-le.
     - SINON, si c'est un document important, suggère un nouveau nom de sous-dossier et mets 'isNewSubCategory' à true.
  4. Extrais les données structurées (Date, Montant, Emetteur, Référence).
  
  Réponds uniquement en JSON valide.`,
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
