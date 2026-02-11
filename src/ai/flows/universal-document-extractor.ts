
'use server';

/**
 * @fileOverview Moteur d'extraction universel Grow&Go V2.
 * Utilise Gemini 1.5 Pro pour l'OCR intégral et le parsing de données.
 * Gère le double classement (Métier + Client).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UniversalExtractorInputSchema = z.object({
  fileUrl: z.string().describe("Data URI du document."),
  fileName: z.string().describe("Nom original du fichier."),
  fileType: z.string().describe("MIME type du fichier."),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })),
});

const UniversalExtractorOutputSchema = z.object({
  documentTitle: z.string().describe("Titre propre pour le document."),
  clientName: z.string().describe("Nom du client identifié dans le document."),
  suggestedCategoryId: z.string().describe("ID de la catégorie métier la plus adaptée."),
  suggestedSubCategory: z.string().describe("Nom du sous-dossier suggéré."),
  extractedData: z.record(z.any()).describe("Toutes les données textuelles et numériques extraites."),
  confidenceScore: z.number().describe("Indice de confiance OCR (0 à 100). Pour Excel/CSV, renvoyer 100."),
  summary: z.string().describe("Résumé flash du contenu."),
  isNewClient: z.boolean().describe("Indique si ce client semble nouveau pour l'entreprise."),
});

export async function universalDocumentExtractor(input: z.infer<typeof UniversalExtractorInputSchema>) {
  return universalDocumentExtractorFlow(input);
}

const extractorPrompt = ai.definePrompt({
  name: 'universalExtractorPrompt',
  model: 'googleai/gemini-1.5-pro',
  input: { schema: UniversalExtractorInputSchema },
  output: { schema: UniversalExtractorOutputSchema },
  prompt: `Tu es le Cerveau de Grow&Go V2.
  
  MISSION : Analyse ce document ({{fileType}}) nommé "{{fileName}}" : {{media url=fileUrl}}
  
  STRUCTURE ACTUELLE :
  {{#each availableCategories}}
  - {{label}} (ID: {{id}}) > Sous-dossiers : {{#each subCategories}}"{{this}}" {{/each}}
  {{/each}}
  
  CONSIGNES :
  1. EXTRACTION TOTALE : Récupère tous les montants, dates, noms et références.
  2. CLASSEMENT MÉTIER : Trouve la catégorie la plus logique.
  3. IDENTIFICATION CLIENT : Extrais le nom de l'entité cliente (ex: "Société X", "M. Dupont").
  4. SCORE DE CONFIANCE : 
     - Si c'est un Excel/CSV (text/csv ou application/vnd.openxmlformats-officedocument.spreadsheetml.sheet), le score est obligatoirement 100.
     - Si c'est un PDF/Image, évalue la lisibilité de 0 à 100.
  
  Réponds uniquement en JSON valide.`,
});

const universalDocumentExtractorFlow = ai.defineFlow(
  {
    name: 'universalDocumentExtractorFlow',
    inputSchema: UniversalExtractorInputSchema,
    outputSchema: UniversalExtractorOutputSchema,
  },
  async input => {
    const {output} = await extractorPrompt(input);
    if (!output) throw new Error("Échec de l'analyse Gemini Pro.");
    return output;
  }
);
