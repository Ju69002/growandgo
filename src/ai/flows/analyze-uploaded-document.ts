'use server';

/**
 * @fileOverview Flow for analyzing uploaded documents using Vertex AI and category-specific instructions.
 *
 * - analyzeUploadedDocument - Analyzes a document using Vertex AI and updates Firestore.
 * - AnalyzeUploadedDocumentInput - The input type for the analyzeUploadedDocument function.
 * - AnalyzeUploadedDocumentOutput - The return type for the analyzeUploadedDocument function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeUploadedDocumentInputSchema = z.object({
  documentId: z.string().describe('The ID of the document to analyze.'),
  categoryId: z.string().describe('The ID of the category the document belongs to.'),
  fileUrl: z.string().describe('The URL of the file in Firebase Storage.'),
});
export type AnalyzeUploadedDocumentInput = z.infer<typeof AnalyzeUploadedDocumentInputSchema>;

const AnalyzeUploadedDocumentOutputSchema = z.object({
  extractedData: z.record(z.any()).describe('The extracted data from the document.'),
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
    schema: z.object({
      fileUrl: z.string().describe('The URL of the file to analyze.'),
      aiInstructions: z.string().describe('The AI instructions for analyzing the document.'),
    }),
  },
  output: {
    schema: AnalyzeUploadedDocumentOutputSchema,
  },
  prompt: `Analyze the document at the following URL: {{{fileUrl}}}.\n\n` +
    `Use the following instructions to extract data: {{{aiInstructions}}}.\n\n` +
    `Return the extracted data in JSON format.`,
});

const analyzeUploadedDocumentFlow = ai.defineFlow(
  {
    name: 'analyzeUploadedDocumentFlow',
    inputSchema: AnalyzeUploadedDocumentInputSchema,
    outputSchema: AnalyzeUploadedDocumentOutputSchema,
  },
  async input => {
    // Fetch the category to get the ai_instructions
    const category = await fetchCategory(input.categoryId);
    if (!category?.ai_instructions) {
      throw new Error(
        `AI instructions not found for category ID: ${input.categoryId}`
      );
    }

    const {output} = await analyzeDocumentPrompt({
      fileUrl: input.fileUrl,
      aiInstructions: category.ai_instructions,
    });

    // Update the document in Firestore with the extracted data and status
    await updateDocument(
      input.documentId,
      output!.extractedData,
      'waiting_verification'
    );

    return output!;
  }
);

async function fetchCategory(categoryId: string): Promise<{
  ai_instructions?: string;
} | null> {
  // TODO: Implement fetching the category from Firestore
  // This is a placeholder implementation.
  console.log(`Fetching category with ID: ${categoryId}`);
  return {ai_instructions: 'Placeholder instructions'}; // Replace with actual Firestore fetch
}

async function updateDocument(
  documentId: string,
  extractedData: any,
  status: string
): Promise<void> {
  // TODO: Implement updating the document in Firestore
  // This is a placeholder implementation.
  console.log(
    `Updating document with ID: ${documentId}, extractedData: ${JSON.stringify(
      extractedData
    )}, status: ${status}`
  );
}
