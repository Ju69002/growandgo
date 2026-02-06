'use server';

/**
 * @fileOverview Flow for analyzing uploaded documents using Gemini Vision/OCR.
 * Classifies the document and extracts key data.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  fileUrl: z.string().describe('The URL or Data URI of the document to analyze.'),
  categoryId: z.string().describe('The current category context.'),
  availableSubCategories: z.array(z.string()).describe('List of available sub-folders in this category.'),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const AnalyzeUploadedDocumentOutputSchema = z.object({
  name: z.string().describe('A clean title for the document.'),
  suggestedSubCategory: z.string().describe('The most appropriate sub-folder for this document.'),
  extractedData: z.record(z.any()).describe('Key data extracted (dates, amounts, reference numbers).'),
  confidence: z.number().describe('Confidence score from 0 to 1.'),
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
  Analyze the document at this URL: {{{fileUrl}}}
  
  Category context: {{{categoryId}}}
  Available sub-folders: {{#each availableSubCategories}} "{{this}}" {{/each}}
  
  TASK:
  1. Extract a professional title for this document.
  2. Classify it into ONE of the available sub-folders. If unsure, pick the most logical one.
  3. Extract key data fields like dates, amounts, VAT, or contract names.
  
  Return the result in structured JSON.`,
});

const analyzeUploadedDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedDocumentFlow',
    inputSchema: AnalyzeUploadedDocumentInputSchema,
    outputSchema: AnalyzeUploadedDocumentOutputSchema,
  },
  async input => {
    const {output} = await analyzeDocumentPrompt(input);
    if (!output) throw new Error("Analyse IA échouée");
    return output;
  }
);
