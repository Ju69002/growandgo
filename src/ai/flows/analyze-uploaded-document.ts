'use server';

/**
 * @fileOverview Flow for analyzing uploaded documents using Gemini Vision/OCR.
 * Classifies the document and extracts key data, suggesting the best category and sub-category.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  fileUrl: z.string().describe("The URL or Data URI of the document to analyze. Expected format for Data URI: 'data:<mimetype>;base64,<encoded_data>'."),
  currentCategoryId: z.string().describe('The current category context.'),
  availableCategories: z.array(z.object({
    id: z.string(),
    label: z.string(),
    subCategories: z.array(z.string())
  })).describe('List of all available categories and their sub-folders.'),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const AnalyzeUploadedDocumentOutputSchema = z.object({
  name: z.string().describe('A clean title for the document.'),
  suggestedCategoryId: z.string().describe('The most appropriate main category ID.'),
  suggestedCategoryLabel: z.string().describe('The label of the suggested category.'),
  suggestedSubCategory: z.string().describe('The most appropriate sub-folder for this document.'),
  extractedData: z.record(z.any()).describe('Key data extracted (dates, amounts, reference numbers).'),
  summary: z.string().describe('A brief summary of what the document is.'),
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
  prompt: `You are an expert document analyst for BusinessPilot.
  
  TASK:
  Analyze the provided document image or file: {{media url=fileUrl}}
  
  CURRENT CONTEXT: Category ID "{{{currentCategoryId}}}"
  
  AVAILABLE CATEGORIES & SUB-FOLDERS:
  {{#each availableCategories}}
  - Category: {{label}} (ID: {{id}})
    Sub-folders: {{#each subCategories}} "{{this}}" {{/each}}
  {{/each}}
  
  INSTRUCTIONS:
  1. Extract a professional and clear title for this document.
  2. Determine which main Category (ID) it belongs to from the available list. If it matches a standard category (Finance, RH, Admin, etc.), prioritize it.
  3. Determine which Sub-folder within that category it belongs to.
  4. Extract key data fields (dates, amounts, reference numbers, customer/vendor names).
  5. Provide a one-sentence summary of the document.
  
  Return the result in structured JSON. Be precise and helpful.`,
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
      if (!output) throw new Error("L'IA n'a pas retourné de résultat");
      return output;
    } catch (e) {
      console.error("Genkit Flow Error:", e);
      throw e;
    }
  }
);
