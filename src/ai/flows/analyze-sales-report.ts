'use server';

/**
 * @fileOverview Sales report analysis AI flow.
 * This file defines a Genkit flow that analyzes an image of a sales report
 * and extracts structured data from it.
 *
 * - analyzeSalesReport - The main function to call the flow.
 * - SalesReportInput - The input type for the flow (an image data URI).
 * - SalesReportOutput - The output type for the flow (structured sales data).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Schema for the individual items in the sales report
const SalesReportItemSchema = z.object({
    productName: z.string().describe('The name of the product sold.'),
    quantity: z.number().describe('The quantity of the product sold.'),
    totalPrice: z.number().optional().describe('The total price for this product line (quantity * unit price).'),
});
export type SalesReportItem = z.infer<typeof SalesReportItemSchema>;

const PaymentBreakdownItemSchema = z.object({
  method: z.string().describe('The name of the payment method (e.g., "Nakit", "Kredi Kartı").'),
  amount: z.number().describe('The total amount for that payment method.'),
});
export type PaymentBreakdownItem = z.infer<typeof PaymentBreakdownItemSchema>;

// Schema for the input of the AI flow
const SalesReportInputSchema = z.object({
  reportImage: z
    .string()
    .describe(
      "A photo of a sales report, provided as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type SalesReportInput = z.infer<typeof SalesReportInputSchema>;

// Schema for the output of the AI flow
const SalesReportOutputSchema = z.object({
  items: z.array(SalesReportItemSchema).describe('A list of all products found in the sales report.'),
  paymentBreakdown: z.array(PaymentBreakdownItemSchema).describe('An array of objects, where each object represents a payment method and its corresponding total amount.'),
});
export type SalesReportOutput = z.infer<typeof SalesReportOutputSchema>;

/**
 * Standardizes and merges payment breakdown items from an AI analysis.
 * @param breakdown The raw payment breakdown from the AI.
 * @returns A cleaned and aggregated list of payment breakdown items.
 */
const standardizePaymentBreakdown = (breakdown: PaymentBreakdownItem[]): PaymentBreakdownItem[] => {
    const standardMap: { [key: string]: string[] } = {
        'Nakit': ['nakit', 'nakıt', 'nkt'],
        'Kredi Kartı': ['kredi', 'k.karti', 'kk', 'visa', 'mastercard', 'k.kartı', 'kredi karti'],
        'Yemek Kartı': ['yemek', 'y.karti', 'y.kartı', 'sodexo', 'ticket', 'multinet', 'setcard'],
        'Ödenmez': ['odenmez', 'ödenmez'],
    };

    const aggregated: { [key: string]: number } = {};

    breakdown.forEach(item => {
        const rawMethod = item.method.toLowerCase().replace(/[^a-z0-9]/gi, '');
        let standardMethod = 'Diğer'; // Default category

        for (const key in standardMap) {
            if (standardMap[key].some(alias => rawMethod.includes(alias))) {
                standardMethod = key;
                break;
            }
        }
        
        // If it's still 'Diğer', use the original but capitalized name
        if (standardMethod === 'Diğer') {
             standardMethod = item.method.charAt(0).toUpperCase() + item.method.slice(1);
        }

        if (aggregated[standardMethod]) {
            aggregated[standardMethod] += item.amount;
        } else {
            aggregated[standardMethod] = item.amount;
        }
    });

    return Object.entries(aggregated).map(([method, amount]) => ({
        method,
        amount,
    }));
};


/**
 * Public function to trigger the sales report analysis flow.
 * @param input The sales report image as a data URI.
 * @returns A promise that resolves to the structured sales data.
 */
export async function analyzeSalesReport(input: SalesReportInput): Promise<SalesReportOutput> {
  return analyzeSalesReportFlow(input);
}

// Define the prompt for the AI model
const salesReportPrompt = ai.definePrompt({
  name: 'salesReportPrompt',
  input: { schema: SalesReportInputSchema },
  output: { schema: SalesReportOutputSchema },
  prompt: `You are an expert data extraction assistant for restaurants.
Your task is to analyze the provided image of a sales report (like a Z-report from a cash register) and extract the sales data.

Analyze the following image:
{{media url=reportImage}}

1.  **Extract a list of all items sold.** For each item, provide the product name, the quantity sold, and the total price for that line if available.
2.  **Extract the payment breakdown.** Identify all payment methods (e.g., Nakit, Kredi Kartı, Yemek Kartı) and the total amount collected for each. Structure this as an array of objects, where each object has a "method" and an "amount" property.

Ignore any taxes, discounts, or total summary lines that are not part of the payment breakdown. Focus only on the individual product sale lines and the final payment methods section.
Return the data in the specified JSON format. If a product name is unclear, make a reasonable guess. If a value is not present, omit it.
`,
});

// Define the Genkit flow
const analyzeSalesReportFlow = ai.defineFlow(
  {
    name: 'analyzeSalesReportFlow',
    inputSchema: SalesReportInputSchema,
    outputSchema: SalesReportOutputSchema,
  },
  async (input) => {
    const { output } = await salesReportPrompt(input);
    if (!output) {
      throw new Error('AI model did not return a valid output.');
    }

    // Standardize the payment breakdown after getting the result
    const standardizedPaymentBreakdown = standardizePaymentBreakdown(output.paymentBreakdown);

    return {
        ...output,
        paymentBreakdown: standardizedPaymentBreakdown,
    };
  }
);
