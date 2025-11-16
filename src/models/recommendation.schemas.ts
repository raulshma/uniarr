import { z } from "zod";

/**
 * Schema for recommendation metadata
 */
export const RecommendationMetadataSchema = z.object({
  genres: z.array(z.string()).describe("List of genres for the content"),
  rating: z.number().min(0).max(10).describe("Content rating (0-10 scale)"),
  popularity: z
    .number()
    .min(0)
    .max(100)
    .describe("Popularity score (0-100 scale)"),
  posterUrl: z
    .string()
    .url()
    .optional()
    .describe("URL to the content poster image"),
  overview: z.string().optional().describe("Brief overview of the content"),
});

export type RecommendationMetadata = z.infer<
  typeof RecommendationMetadataSchema
>;

/**
 * Schema for content availability information
 */
export const AvailabilitySchema = z.object({
  inLibrary: z
    .boolean()
    .describe("Whether the content is already in the user's library"),
  inQueue: z.boolean().describe("Whether the content is in the download queue"),
  availableServices: z
    .array(z.enum(["sonarr", "radarr", "jellyseerr"]))
    .describe("Services that can be used to add this content"),
});

export type Availability = z.infer<typeof AvailabilitySchema>;

/**
 * Schema for individual recommendation
 */
export const RecommendationSchema = z.object({
  id: z
    .string()
    .optional()
    .describe("Unique identifier for the recommendation"),
  title: z.string().min(1).describe("Title of the recommended content"),
  type: z.enum(["series", "movie", "anime"]).describe("Type of media content"),
  year: z
    .number()
    .int()
    .min(1900)
    .max(2100)
    .optional()
    .describe("Release year of the content"),
  matchScore: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Match score indicating how well this matches user preferences (0-100)",
    ),
  reasonsForMatch: z
    .array(z.string())
    .min(2)
    .describe(
      "At least two reasons explaining why this content matches user preferences",
    ),
  whereToWatch: z
    .string()
    .describe("Information about where to watch or obtain this content"),
  similarToWatched: z
    .array(z.string())
    .min(1)
    .describe(
      "List of content from user's watch history that this is similar to",
    ),
  metadata: RecommendationMetadataSchema.describe(
    "Detailed metadata about the content",
  ),
  availability: AvailabilitySchema.optional().describe(
    "Availability information (populated after generation)",
  ),
  isHiddenGem: z
    .boolean()
    .describe("Whether this is a lesser-known quality content (hidden gem)"),
});

export type Recommendation = z.infer<typeof RecommendationSchema>;

/**
 * Schema for AI-generated recommendation response
 */
export const RecommendationResponseSchema = z.object({
  recommendations: z
    .array(RecommendationSchema)
    .min(1)
    .max(10)
    .describe("List of personalized recommendations (1-10 items)"),
});

export type RecommendationResponse = z.infer<
  typeof RecommendationResponseSchema
>;

/**
 * Schema for user feedback events
 */
export const FeedbackEventSchema = z.object({
  id: z.string().describe("Unique identifier for the feedback event"),
  userId: z.string().describe("User who provided the feedback"),
  recommendationId: z.string().describe("ID of the recommendation being rated"),
  recommendation: RecommendationSchema.describe(
    "Full recommendation object that was rated",
  ),
  feedback: z
    .enum(["accepted", "rejected"])
    .describe("Whether the user accepted or rejected the recommendation"),
  reason: z.string().optional().describe("Optional reason for the feedback"),
  timestamp: z.date().describe("When the feedback was provided"),
  contextSnapshot: z
    .object({
      watchHistoryCount: z
        .number()
        .describe("Number of items in watch history at time of feedback"),
      favoriteGenres: z
        .array(z.string())
        .describe("User's favorite genres at time of feedback"),
      recentWatches: z
        .array(z.string())
        .describe("Recent watched content titles"),
    })
    .describe("Snapshot of user context when feedback was provided"),
});

export type FeedbackEvent = z.infer<typeof FeedbackEventSchema>;

/**
 * Schema for learned feedback patterns
 */
export const FeedbackPatternSchema = z.object({
  factor: z
    .string()
    .describe("The factor being tracked (e.g., 'genre:action', 'rating:high')"),
  acceptanceRate: z
    .number()
    .min(0)
    .max(1)
    .describe("Rate of acceptance for this factor (0-1)"),
  sampleSize: z
    .number()
    .int()
    .min(0)
    .describe("Number of feedback events for this factor"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence level in this pattern (0-1)"),
  lastUpdated: z
    .date()
    .optional()
    .describe("When this pattern was last updated"),
});

export type FeedbackPattern = z.infer<typeof FeedbackPatternSchema>;
