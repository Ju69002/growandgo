
'use server';

/**
 * @fileOverview Moteur d'extraction universel Grow&Go V2.
 * Architecture Adaptative : Alterne entre Parsing Mathématique (XLSX/CSV) 
 * et Analyse IA (Gemini 1.5 Pro) pour garantir la meilleure fidélité.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as XLSX from 'xlsx';

const UniversalExtractorInputSchema = z.object({
  fileUrl: z.string().describe("Data URI du document."),
  fileName: z.string().describe("Nom original du fichier."),
  fileType: z.string().describe("MIME type du fichier."),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })),
  rawData: z.string().optional().describe("Données textuelles extraites programmatiquement."),
});

const UniversalExtractorOutputSchema = z.object({
  documentTitle: z.string().describe("Titre propre pour le document."),
  clientName: z.string().describe("Nom du client identifié dans le document."),
  suggestedCategoryId: z.string().describe("ID de la catégorie métier la plus adaptée."),
  suggestedSubCategory: z.string().describe("Nom du sous-dossier suggéré."),
  extractedData: z.record(z.any()).describe("Toutes les données textuelles et numériques extraites."),
  confidenceScore: z.number().describe("Indice de confiance (0 à 100). Pour Excel/CSV/Parsing, renvoyer 100."),
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
  
  MISSION : Analyse ce document nommé "{{fileName}}" (Type: {{fileType}}).
  
  SOURCE DE DONNÉES :
  {{#if rawData}}
  PRIORITÉ HAUTE : Les données suivantes ont été extraites par parsing mathématique (100% fiables). Utilise-les exclusivement pour les montants et le contenu :
  {{{rawData}}}
  {{else}}
  VISION IA : Analyse visuelle du média joint : {{media url=fileUrl}}
  {{/if}}
  
  STRUCTURE ACTUELLE :
  {{#each availableCategories}}
  - {{label}} (ID: {{id}}) > Sous-dossiers : {{#each subCategories}}"{{this}}" {{/each}}
  {{/each}}
  
  CONSIGNES :
  1. EXTRACTION TOTALE : Récupère tous les montants, dates, noms, SIREN et références sans exception.
  2. CLASSEMENT MÉTIER : Trouve la catégorie la plus logique.
  3. IDENTIFICATION CLIENT : Extrais le nom de l'entité cliente (ex: "Société X", "M. Dupont").
  4. SCORE DE CONFIANCE : 
     - Si 'rawData' est présent, le score est obligatoirement 100.
     - Sinon, évalue la lisibilité visuelle de 0 à 100.
  
  Réponds uniquement en JSON valide.`,
});

const universalDocumentExtractorFlow = ai.defineFlow(
  {
    name: 'universalDocumentExtractorFlow',
    inputSchema: UniversalExtractorInputSchema,
    outputSchema: UniversalExtractorOutputSchema,
  },
  async input => {
    let finalInput = { ...input };

    try {
      // DÉTECTION DU MEILLEUR OUTIL : Parsing Mathématique pour les tableurs/textes
      const base64Data = input.fileUrl.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');

      const isSpreadsheet = input.fileType.includes('spreadsheet') || 
                            input.fileType.includes('excel') || 
                            input.fileType.includes('csv') ||
                            input.fileName.endsWith('.xlsx') ||
                            input.fileName.endsWith('.csv');

      const isText = input.fileType.includes('text/') || 
                     input.fileType.includes('json') ||
                     input.fileName.endsWith('.txt') ||
                     input.fileName.endsWith('.log');

      if (isSpreadsheet) {
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          finalInput.rawData = XLSX.utils.sheet_to_csv(worksheet);
        } catch (parseError) {
          console.warn("Échec parsing XLSX, repli sur Vision IA");
        }
      } else if (isText) {
        finalInput.rawData = buffer.toString('utf-8');
      }

      const {output} = await extractorPrompt(finalInput);
      if (!output) throw new Error("Échec de l'analyse Gemini Pro.");
      
      return output;
    } catch (e) {
      console.error("Universal Extractor Error:", e);
      throw e;
    }
  }
);
