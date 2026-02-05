'use server';

/**
 * @fileOverview Provides an AI assistant for employees with access to technical and administrative documents.
 *
 * - employeeAiAssistance - A function that provides AI assistance to employees.
 * - EmployeeAiAssistanceInput - The input type for the employeeAiAssistance function.
 * - EmployeeAiAssistanceOutput - The return type for the employeeAiAssistance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EmployeeAiAssistanceInputSchema = z.object({
  query: z.string().describe('The query from the employee.'),
  companyId: z.string().describe('The ID of the company the employee belongs to.'),
});
export type EmployeeAiAssistanceInput = z.infer<typeof EmployeeAiAssistanceInputSchema>;

const EmployeeAiAssistanceOutputSchema = z.object({
  response: z.string().describe('The AI assistant response.'),
});
export type EmployeeAiAssistanceOutput = z.infer<typeof EmployeeAiAssistanceOutputSchema>;

export async function employeeAiAssistance(input: EmployeeAiAssistanceInput): Promise<EmployeeAiAssistanceOutput> {
  return employeeAiAssistanceFlow(input);
}

const employeeAiAssistancePrompt = ai.definePrompt({
  name: 'employeeAiAssistancePrompt',
  input: {schema: EmployeeAiAssistanceInputSchema},
  output: {schema: EmployeeAiAssistanceOutputSchema},
  system: `You are an AI assistant helping employees organize their work. You have access to technical and administrative documents.
   You cannot provide any financial information.  Answer the following query: {{{query}}}`,
});

const employeeAiAssistanceFlow = ai.defineFlow(
  {
    name: 'employeeAiAssistanceFlow',
    inputSchema: EmployeeAiAssistanceInputSchema,
    outputSchema: EmployeeAiAssistanceOutputSchema,
  },
  async input => {
    const {output} = await employeeAiAssistancePrompt(input);
    return output!;
  }
);
