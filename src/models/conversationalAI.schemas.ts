import { z } from "zod";

/**
 * Schema for structured conversational AI responses
 * Enables streaming of partial responses with progressive updates
 */
export const assistantResponseSchema = z.object({
  /**
   * The main response text to the user
   */
  response: z.string().describe("The assistant's response to the user message"),

  /**
   * Optional follow-up question to deepen the conversation
   */
  followUp: z
    .string()
    .optional()
    .describe("An optional follow-up question to continue the conversation"),

  /**
   * Optional actionable suggestions or recommendations
   */
  suggestions: z
    .array(z.string())
    .optional()
    .describe("Optional suggestions or recommendations based on the response"),

  /**
   * Confidence level of the response (low/medium/high)
   */
  confidence: z
    .enum(["low", "medium", "high"])
    .optional()
    .describe("Confidence level of the response"),
});

export type AssistantResponse = z.infer<typeof assistantResponseSchema>;

/**
 * Schema for error responses when structured generation fails
 */
export const assistantErrorResponseSchema = z.object({
  response: z.string().describe("User-friendly error message"),
  confidence: z.literal("low"),
  followUp: z.undefined().optional(),
  suggestions: z.undefined().optional(),
});

export type AssistantErrorResponse = z.infer<
  typeof assistantErrorResponseSchema
>;
