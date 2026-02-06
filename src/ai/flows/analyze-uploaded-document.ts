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
  extractedData: z.object({
    date: z.string().describe('Date d\'émission du document (ex: 12/05/2024)'),
    montant: z.string().describe('Montant total TTC si présent (ex: 150.50 €)'),
    emetteur: z.string().describe('Nom de l\'entreprise ou personne émettrice'),
    reference: z.string().describe('Numéro de facture, de contrat ou de dossier'),
  }).describe('Données clés extraites du document via OCR.'),
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
  Analyser avec une précision absolue le document fourni : {{media url=fileUrl}}
  Tu dois utiliser tes capacités de vision/OCR pour lire TOUT le texte et comprendre la nature exacte de la pièce.
  
  DOSSIERS ET SOUS-SECTIONS DISPONIBLES DANS L'ENTREPRISE :
  {{#each availableCategories}}
  - Catégorie : {{label}} (ID: {{id}})
    Sous-dossiers possibles : {{#each subCategories}} "{{this}}" {{/each}}
  {{/each}}
  
  INSTRUCTIONS DE CLASSEMENT :
  1. Si c'est une facture fournisseur, bilan ou relevé -> Catégorie "Finance".
  2. Si c'est un contrat de travail, fiche de paie ou mutuelle -> Catégorie "RH".
  3. Si c'est un KBIS, bail ou assurance -> Catégorie "Administration".
  4. Extrais les données clés comme : Date d'émission, Montant TTC, Nom de l'émetteur, Numéro de référence.
  
  SOIS PRÉCIS : Choisis le sous-dossier le plus spécifique parmi ceux listés. Si aucun ne correspond exactement, prends le plus proche.
  
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
