
'use server';

/**
 * @fileOverview Moteur d'Analyse Sémantique Totale Grow&Go V2.
 * Intelligence Contextuelle Agnostique pour extraction "à la carte" et auto-organisation.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as XLSX from 'xlsx';

const UniversalExtractorInputSchema = z.object({
  fileUrl: z.string().describe("Data URI du document (Base64)."),
  fileName: z.string().describe("Nom original du fichier."),
  fileType: z.string().describe("MIME type du fichier."),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })).describe("Structure actuelle des dossiers métier."),
  rawData: z.string().optional().describe("Données textuelles extraites programmatiquement (XLSX)."),
});

const UniversalExtractorOutputSchema = z.object({
  clientName: z.string().describe("Sujet principal du document (ex: Client ou Patient)."),
  issuerEntity: z.string().describe("Organisme émetteur ou contrepartie."),
  documentDate: z.string().describe("Date du document (YYYY-MM-DD)."),
  category: z.string().describe("Catégorie métier suggérée (Priorité aux 6 Piliers)."),
  subcategory: z.string().describe("Sous-dossier suggéré."),
  metadata: z.record(z.any()).describe("Métadonnées extraites à la carte."),
  summary_flash: z.string().describe("Résumé flash intelligent (Qui, Quoi, Pourquoi)."),
  confidenceScore: z.number().describe("Indice de confiance visuel."),
  documentTitle: z.string().describe("Titre propre et descriptif."),
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
  prompt: `Tu es le Cerveau d'Archivage Grow&Go V2. Tu effectues une analyse sémantique totale.

CONTEXTE ACTUEL :
{{#each availableCategories}}
- {{label}} (ID: {{id}}) > Sous-dossiers : {{#each subCategories}}"{{this}}" {{/each}}
{{/each}}

MISSION :
1. ANALYSE : Détermine la nature exacte (bail, facture, contrat, ordonnance, amende, etc.) : "{{fileName}}".
2. RÔLES : Identifie le "client_name" (sujet principal, ex: la personne facturée) et "issuer_entity" (l'émetteur).
3. EXTRACTION À LA CARTE : Récupère toutes les données critiques (montants, dates, références, SIREN, objets).
4. RANGEMENT PROACTIF :
   - PRIORITÉ ABSOLUE : Utilise les 6 piliers classiques (Commercial, Communication, Finances, Fournisseurs, Juridique, RH).
   - RÉTABLISSEMENT : Si un sous-dossier standard manque, suggère-le impérativement (ex: "Statuts" pour un Kbis).
   - INTELLIGENCE : Si rien ne correspond, crée une paire Catégorie/Sous-dossier logique et courte.

{{#if rawData}}
DONNÉES STRUCTURÉES (Parsing XLSX) :
{{{rawData}}}
{{else}}
VISION IA (Média joint) : {{media url=fileUrl}}
{{/if}}

RÉPONSE JSON UNIQUEMENT (SANS MARKDOWN) :
{
  "clientName": "string",
  "issuerEntity": "string",
  "documentDate": "YYYY-MM-DD",
  "category": "string",
  "subcategory": "string",
  "metadata": { "champ_1": "valeur", "...": "..." },
  "summary_flash": "Résumé flash (Qui, Quoi, Pourquoi).",
  "confidenceScore": 100,
  "documentTitle": "Titre propre"
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
      // Nettoyage Base64 strict
      const fileUrlParts = input.fileUrl.split(',');
      const base64Data = fileUrlParts[1] || fileUrlParts[0];
      const mimeType = input.fileType || (fileUrlParts[0].match(/:(.*?);/)?.[1]) || 'application/octet-stream';
      
      finalInput.fileUrl = `data:${mimeType};base64,${base64Data}`;
      finalInput.fileType = mimeType;

      // Parsing XLSX/CSV direct pour 100% de fidélité
      const isSpreadsheet = mimeType.includes('spreadsheet') || 
                            mimeType.includes('excel') || 
                            mimeType.includes('csv') ||
                            input.fileName.toLowerCase().endsWith('.xlsx') ||
                            input.fileName.toLowerCase().endsWith('.csv');

      if (isSpreadsheet) {
        try {
          const buffer = Buffer.from(base64Data, 'base64');
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          finalInput.rawData = XLSX.utils.sheet_to_csv(worksheet);
        } catch (e) {}
      }

      const response = await extractorPrompt(finalInput);
      let text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();

      try {
        const parsed = JSON.parse(text);
        return {
          clientName: parsed.clientName || "Inconnu",
          issuerEntity: parsed.issuerEntity || "Inconnu",
          documentDate: parsed.documentDate || new Date().toISOString().split('T')[0],
          category: parsed.category || "Administratif",
          subcategory: parsed.subcategory || "Général",
          metadata: parsed.metadata || {},
          summary_flash: parsed.summary_flash || "Document analysé par le Cerveau V2.",
          confidenceScore: isSpreadsheet ? 100 : (Number(parsed.confidenceScore) || 80),
          documentTitle: parsed.documentTitle || input.fileName
        };
      } catch (e) {
        throw new Error("Erreur de formatage JSON IA.");
      }
    } catch (e: any) {
      throw new Error(e.message || "Échec de l'analyse sémantique.");
    }
  }
);
