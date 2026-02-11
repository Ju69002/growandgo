
'use server';

/**
 * @fileOverview Moteur d'extraction universel Grow&Go V2.
 * Debug : Nettoyage Base64 & Transparence d'erreurs techniques.
 * Optimisé pour Gemini 2.5 Flash Lite pour la rapidité et la stabilité.
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
  model: 'googleai/gemini-2.5-flash-lite',
  input: { schema: UniversalExtractorInputSchema },
  output: { schema: UniversalExtractorOutputSchema },
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
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
      // 1. NETTOYAGE STRICT DU BASE64 (Correction Debug)
      const fileUrlParts = input.fileUrl.split(',');
      const base64Data = fileUrlParts[1] || fileUrlParts[0];
      const mimeType = input.fileType || (fileUrlParts[0].match(/:(.*?);/)?.[1]) || 'application/octet-stream';
      
      // Reconstruction propre du Data URI pour Gemini (Genkit {{media}} nécessite le schéma complet)
      finalInput.fileUrl = `data:${mimeType};base64,${base64Data}`;
      finalInput.fileType = mimeType;

      const buffer = Buffer.from(base64Data, 'base64');

      // 2. DÉTECTION DU MEILLEUR OUTIL
      const isSpreadsheet = mimeType.includes('spreadsheet') || 
                            mimeType.includes('excel') || 
                            mimeType.includes('csv') ||
                            input.fileName.toLowerCase().endsWith('.xlsx') ||
                            input.fileName.toLowerCase().endsWith('.csv');

      const isText = mimeType.includes('text/') || 
                     mimeType.includes('json') ||
                     input.fileName.toLowerCase().endsWith('.txt') ||
                     input.fileName.toLowerCase().endsWith('.log');

      if (isSpreadsheet) {
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          finalInput.rawData = XLSX.utils.sheet_to_csv(worksheet);
        } catch (parseError: any) {
          console.warn("Échec parsing XLSX, repli sur Vision IA:", parseError.message);
        }
      } else if (isText) {
        finalInput.rawData = buffer.toString('utf-8');
      }

      // 3. APPEL API AVEC GESTION D'ERREUR RÉELLE (Mode Debug)
      const {output} = await extractorPrompt(finalInput);
      if (!output) throw new Error("L'API Gemini n'a pas pu générer de données structurées. Le contenu est peut-être trop complexe ou a été bloqué par les filtres de sécurité.");
      
      return output;
    } catch (e: any) {
      console.error("[DEBUG] Universal Extractor Technical Error:", e);
      // On propage l'erreur technique exacte pour l'affichage en interface
      throw new Error(e.message || "Erreur technique lors de l'extraction.");
    }
  }
);
