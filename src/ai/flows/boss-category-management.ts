'use server';

/**
 * @fileOverview Genkit flow for the BossArchitect role to manage categories.
 *
 * - bossCategoryManagement -  The main function to manage categories for BossArchitect role.
 * - BossCategoryManagementInput - The input type for the bossCategoryManagement function.
 * - BossCategoryManagementOutput - The return type for the bossCategoryManagement function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const BossCategoryManagementInputSchema = z.object({
  action: z.enum(['rename', 'changeVisibility']).describe('The action to perform on the category.'),
  categoryId: z.string().describe('The ID of the category to manage.'),
  newName: z.string().optional().describe('The new name for the category (required for rename action).'),
  visibleToEmployees: z
    .boolean()
    .optional()
    .describe('The new visibility status for employees (required for changeVisibility action).'),
});
export type BossCategoryManagementInput = z.infer<typeof BossCategoryManagementInputSchema>;

const BossCategoryManagementOutputSchema = z.object({
  success: z.boolean().describe('Indicates if the category management was successful.'),
  message: z.string().describe('A message indicating the result of the operation.'),
});
export type BossCategoryManagementOutput = z.infer<typeof BossCategoryManagementOutputSchema>;

export async function bossCategoryManagement(
  input: BossCategoryManagementInput
): Promise<BossCategoryManagementOutput> {
  return bossCategoryManagementFlow(input);
}

const prompt = ai.definePrompt({
  name: 'bossCategoryManagementPrompt',
  input: {schema: BossCategoryManagementInputSchema},
  output: {schema: BossCategoryManagementOutputSchema},
  prompt: `You are an AI assistant helping a business owner (BossArchitect) manage categories in their application.

The BossArchitect can rename categories or change their visibility to employees.

If the requested action is to rename a category, rename it to the provided newName.
If the requested action is to change the visibility of a category, change the visibleToEmployees property accordingly.

If the user asks to create new smart categories or modify the ai_instructions, strictly refuse and inform them that only the Super Admin can perform this action.

Consider these cases:
1.  Renaming "Finance" category to "Accounting" category.
2.  Changing the visibility of the "Admin" category to true.
3.  Attempting to modify ai_instructions - Refuse and redirect to Super Admin.
4.  Attempting to create a new smart category - Refuse and redirect to Super Admin.


Action: {{{action}}}
Category ID: {{{categoryId}}}
New Name: {{{newName}}}
Visible to Employees: {{{visibleToEmployees}}}

Respond with a JSON object:
{
  "success": true or false,
  "message": "A success or error message."
}`,
});

const bossCategoryManagementFlow = ai.defineFlow(
  {
    name: 'bossCategoryManagementFlow',
    inputSchema: BossCategoryManagementInputSchema,
    outputSchema: BossCategoryManagementOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
