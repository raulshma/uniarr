import { z } from "zod";

/**
 * Search interpretation schema with detailed descriptions for AI understanding
 */
export const SearchInterpretationSchema = z
  .object({
    mediaTypes: z
      .array(z.enum(["anime", "series", "movie"]))
      .describe("Types of media being searched for (anime, series, or movie)"),

    genres: z
      .array(z.string())
      .default([])
      .describe("Identified genres and themes from the search query"),

    keywords: z
      .array(z.string())
      .default([])
      .describe("Key search terms extracted from the query"),

    yearRange: z
      .object({
        start: z.number().describe("Start year"),
        end: z.number().describe("End year"),
      })
      .optional()
      .describe("Year range if specified in the query"),

    qualityPreference: z
      .string()
      .optional()
      .describe("Quality preference (4K, 1080p, 720p, etc)"),

    languagePreference: z
      .string()
      .optional()
      .describe("Preferred language for subtitles or dubbing"),

    filters: z
      .object({
        isCompleted: z
          .boolean()
          .optional()
          .describe("Filter for completed series"),
        minRating: z.number().optional().describe("Minimum rating threshold"),
        minEpisodes: z.number().optional().describe("Minimum episode count"),
      })
      .optional()
      .describe("Additional filters to apply"),

    recommendedServices: z
      .array(z.enum(["jellyseerr", "sonarr", "radarr"]))
      .default([])
      .describe("Services to search (jellyseerr, sonarr, or radarr)"),

    searchWarnings: z
      .array(z.string())
      .default([])
      .describe(
        "Any warnings about the search (e.g., quality not available, storage issues)",
      ),

    confidence: z
      .number()
      .min(0)
      .max(1)
      .default(0.5)
      .describe("Confidence in interpretation (0-1 scale)"),
  })
  .strict();

export type SearchInterpretation = z.infer<typeof SearchInterpretationSchema>;

/**
 * Recommendation schema for suggested content
 */
export const SearchRecommendationSchema = z.object({
  recommendations: z.array(
    z.object({
      type: z
        .enum([
          "trending",
          "similar",
          "gaps",
          "seasonal",
          "genre",
          "completion",
        ])
        .describe("Type of recommendation"),

      title: z.string().describe("Title of the recommended content"),

      reason: z.string().describe("Why this was recommended"),

      mediaType: z.enum(["anime", "series", "movie"]).describe("Type of media"),

      estimatedMatchScore: z
        .number()
        .min(0)
        .max(100)
        .transform((score) => {
          // Normalize 0-1 range to 0-100 if needed
          return score <= 1 ? Math.round(score * 100) : Math.round(score);
        })
        .describe("Match score (0-100)"),
    }),
  ),
});

export type SearchRecommendation = z.infer<typeof SearchRecommendationSchema>;

/**
 * Validation schemas for AI provider setup
 */
export const AIKeyInputSchema = z.object({
  apiKey: z.string().min(20).describe("The API key for the AI provider"),

  provider: z
    .enum(["google", "openai", "anthropic"])
    .describe("The AI provider"),

  isDefault: z
    .boolean()
    .optional()
    .describe("Whether this should be the default provider"),
});

export type AIKeyInput = z.infer<typeof AIKeyInputSchema>;
