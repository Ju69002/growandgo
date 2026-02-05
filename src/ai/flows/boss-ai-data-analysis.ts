'use server';

/**
 * @fileOverview AI-powered data analysis assistant for business owners.
 *
 * - bossAiDataAnalysis - A function that provides AI assistance for synthesizing business data, drafting emails, and analyzing financial data.
 * - BossAiDataAnalysisInput - The input type for the bossAiDataAnalysis function.
 * - BossAiDataAnalysisOutput - The return type for the bossAiDataAnalysis function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossAiDataAnalysisInputSchema = z.object({
  query: z.string().describe('The query or request from the business owner.'),
  companyData: z.string().describe('The business data for analysis.'),
});
export type BossAiDataAnalysisInput = z.infer<typeof BossAiDataAnalysisInputSchema>;

const BossAiDataAnalysisOutputSchema = z.object({
  analysisResult: z.string().describe('The AI analysis result.'),
});
export type BossAiDataAnalysisOutput = z.infer<typeof BossAiDataAnalysisOutputSchema>;

export async function bossAiDataAnalysis(input: BossAiDataAnalysisInput): Promise<BossAiDataAnalysisOutput> {
  return bossAiDataAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bossAiDataAnalysisPrompt',
  input: {schema: BossAiDataAnalysisInputSchema},
  output: {schema: BossAiDataAnalysisOutputSchema},
  prompt: `You are an AI assistant for business owners. Your role is to synthesize business data, draft emails, and analyze financial data to support business decisions. You have total read access, including budget information. 

User Query: {{{query}}}

Business Data: {{{companyData}}}

Analyze the data and provide a comprehensive result. Focus on summarizing the data, drafting emails, and analyzing treasury, etc. Return the result in {{outputFormat}}.
`,
});

const bossAiDataAnalysisFlow = ai.defineFlow(
  {
    name: 'bossAiDataAnalysisFlow',
    inputSchema: BossAiDataAnalysisInputSchema,
    outputSchema: BossAiDataAnalysisOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
