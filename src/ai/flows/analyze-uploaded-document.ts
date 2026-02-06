'use server';

/**
 * @fileOverview Flux pour analyser les documents téléchargés via Gemini Vision/OCR.
 * Lit le contenu du document et suggère le meilleur emplacement de rangement (Dossier > Sous-dossier).
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  fileUrl: z.string().describe("Le contenu du document sous forme de Data URI (doit inclure le type MIME et l'encodage Base64)."),
  currentCategoryId: z.string().describe('Le contexte de la catégorie actuelle.'),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })).describe('Liste de toutes les catégories et sous-dossiers disponibles dans l\'entreprise.'),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const AnalyzeUploadedDocumentOutputSchema = z.object({
  name: z.string().describe('Un titre professionnel et clair extrait du document.'),
  suggestedCategoryId: z.string().describe('L\'identifiant de la catégorie principale la plus appropriée.'),
  suggestedCategoryLabel: z.string().describe('Le nom de la catégorie suggérée.'),
  suggestedSubCategory: z.string().describe('Le sous-dossier le plus adapté au contenu.'),
  extractedData: z.record(z.any()).describe('Données clés extraites (dates, montants, numéros de référence, noms).'),
  summary: z.string().describe('Un court résumé du document et pourquoi il a été classé ici.'),
  reasoning: z.string().describe('Explication rapide de la logique de classement choisie.'),
});
export type AnalyzeUploadedDocumentOutput = z.infer<typeof AnalyzeUploadedDocumentOutputSchema>;

export async function analyzeUploadedDocument(
  input: AnalyzeUploadedDocumentInput
): Promise<AnalyzeUploadedDocumentOutput> {
  return analyzeUploadedDocumentFlow(input);
}

const analyzeDocumentPrompt = ai.definePrompt({
  name: 'analyzeDocumentPrompt',
  input: {
    schema: AnalyzeUploadedDocumentInputSchema,
  },
  output: {
    schema: AnalyzeUploadedDocumentOutputSchema,
  },
  prompt: `Tu es l'Expert Documentaliste IA de BusinessPilot.
  
  TON OBJECTIF :
  Analyser le document fourni : {{media url=fileUrl}}
  Tu dois utiliser tes capacités de vision/OCR pour lire le contenu textuel et comprendre de quoi il s'agit précisément.
  
  CONTEXTE ACTUEL : Tu es dans le dossier "{{{currentCategoryId}}}".
  
  DOSSIERS ET SOUS-SECTIONS DISPONIBLES :
  {{#each availableCategories}}
  - Catégorie : {{label}} (ID: {{id}})
    Sous-dossiers : {{#each subCategories}} "{{this}}" {{/each}}
  {{/each}}
  
  INSTRUCTIONS :
  1. Extrais un titre clair (ex: "Facture EDF Mars 2024", "Contrat de Travail - Jean Dupont").
  2. Identifie la meilleure Catégorie parmi la liste. Si c'est une facture, c'est "Finance". Si c'est lié au personnel, c'est "RH".
  3. Choisis le sous-dossier le plus précis. Si aucun ne correspond parfaitement, suggère le plus proche.
  4. Extrais les métadonnées (Dates, Montants TTC/HT, IBAN, SIREN, etc.) dans extractedData.
  5. Explique ton raisonnement brièvement.
  
  Réponds uniquement au format JSON structuré.`,
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
      console.error("Genkit Analysis Error:", e);
      throw e;
    }
  }
);
