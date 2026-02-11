
'use server';

/**
 * @fileOverview Moteur d'extraction universel Grow&Go V2 avec Contexte Structurel.
 * Optimisé pour Gemini 2.5 Flash Lite.
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
  })).describe("Structure actuelle des dossiers de l'entreprise."),
  rawData: z.string().optional().describe("Données textuelles extraites programmatiquement."),
});

const UniversalExtractorOutputSchema = z.object({
  documentTitle: z.string().describe("Titre propre pour le document."),
  clientName: z.string().describe("Nom du client identifié dans le document."),
  suggestedCategoryId: z.string().describe("ID ou Label de la catégorie métier la plus adaptée."),
  suggestedSubCategory: z.string().describe("Nom du sous-dossier suggéré."),
  extractedData: z.record(z.any()).describe("Données textuelles et numériques extraites."),
  confidenceScore: z.number().describe("Indice de confiance (0 à 100)."),
  summary: z.string().describe("Résumé flash du contenu."),
  isNewClient: z.boolean().describe("Indique si ce client semble nouveau."),
});

export type UniversalExtractorOutput = z.infer<typeof UniversalExtractorOutputSchema>;

export async function universalDocumentExtractor(input: z.infer<typeof UniversalExtractorInputSchema>): Promise<UniversalExtractorOutput> {
  return universalDocumentExtractorFlow(input);
}

const extractorPrompt = ai.definePrompt({
  name: 'universalExtractorPrompt',
  model: 'googleai/gemini-2.5-flash-lite',
  input: { schema: UniversalExtractorInputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `Tu es le Cerveau d'Archivage de Grow&Go V2.
  
  CONTEXTE ACTUEL (Dossiers existants) :
  {{#each availableCategories}}
  - {{label}} (ID: {{id}}) > Sous-dossiers : {{#each subCategories}}"{{this}}" {{/each}}
  {{/each}}

  MISSION : Analyse ce document "{{fileName}}" et décide de son rangement.
  
  {{#if rawData}}
  DONNÉES FIABLES (Parsing) :
  {{{rawData}}}
  {{else}}
  VISION IA : Analyse visuelle du média joint : {{media url=fileUrl}}
  {{/if}}
  
  RÈGLES DE CLASSEMENT :
  1. PRIORITÉ ABSOLUE : Utilise un dossier EXISTANT (label ou ID) si le document correspond sémantiquement.
  2. CRÉATION : Si aucun dossier ne convient, suggère un nom PERTINENT et COURT (ex: "Logistique").
  3. CLIENT : Identifie l'entité cliente ou le fournisseur principal.
  4. EXTRACTION : Récupère les montants, dates, SIREN et références.
  
  RÉPONSE JSON UNIQUEMENT (SANS MARKDOWN) :
  {
    "documentTitle": "string",
    "clientName": "string",
    "suggestedCategoryId": "id_ou_label_existant_ou_nouveau",
    "suggestedSubCategory": "nom_sous_dossier_existant_ou_nouveau",
    "extractedData": { ... },
    "confidenceScore": 100,
    "summary": "string",
    "isNewClient": false
  }`,
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
      const fileUrlParts = input.fileUrl.split(',');
      const base64Data = fileUrlParts[1] || fileUrlParts[0];
      const mimeType = input.fileType || (fileUrlParts[0].match(/:(.*?);/)?.[1]) || 'application/octet-stream';
      
      finalInput.fileUrl = `data:${mimeType};base64,${base64Data}`;
      finalInput.fileType = mimeType;

      const buffer = Buffer.from(base64Data, 'base64');

      const isSpreadsheet = mimeType.includes('spreadsheet') || 
                            mimeType.includes('excel') || 
                            mimeType.includes('csv') ||
                            input.fileName.toLowerCase().endsWith('.xlsx') ||
                            input.fileName.toLowerCase().endsWith('.csv');

      if (isSpreadsheet) {
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          finalInput.rawData = XLSX.utils.sheet_to_csv(worksheet);
        } catch (parseError) {
          // Fallback to Vision
        }
      }

      const response = await extractorPrompt(finalInput);
      let text = response.text;
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(text);
        return {
          documentTitle: parsed.documentTitle || input.fileName,
          clientName: parsed.clientName || "Client Inconnu",
          suggestedCategoryId: parsed.suggestedCategoryId || "admin",
          suggestedSubCategory: parsed.suggestedSubCategory || "Général",
          extractedData: parsed.extractedData || {},
          confidenceScore: Number(parsed.confidenceScore) || 50,
          summary: parsed.summary || "Analysé par le Cerveau V2.",
          isNewClient: !!parsed.isNewClient
        };
      } catch (jsonError) {
        throw new Error("Erreur de parsing JSON IA.");
      }
    } catch (e: any) {
      throw new Error(e.message || "Erreur technique lors de l'extraction.");
    }
  }
);
