/**
 * Intelligent Search Service
 * Uses AI to interpret natural language search queries and provide structured search recommendations
 */

import { AIService } from "@/services/ai/core/AIService";
import { logger } from "@/services/logger/LoggerService";
import {
  SearchContextBuilder,
  type UserSearchContext,
} from "./SearchContextBuilder";
import {
  SearchInterpretationSchema,
  type SearchInterpretation,
} from "@/utils/validation/searchSchemas";

export type InterpretationStreamItem =
  | { type: "partial"; data: Partial<SearchInterpretation> }
  | { type: "final"; data: SearchInterpretation };

const SEARCH_SYSTEM_PROMPT = `You are UniArr Search Assistant, an expert at understanding media search queries.

You have extensive knowledge about:
- Movies, TV shows, anime, and other media
- Genre classifications and themes
- Media release dates and production information
- Quality/resolution standards (4K, 1080p, 720p, etc.)
- Language and subtitle preferences
- Media service capabilities (Jellyseerr, Sonarr, Radarr)

When analyzing search queries:
1. Identify the types of media being searched (anime, series, movie)
2. Extract genres and themes from the query
3. Detect quality and language preferences
4. Identify year/season information if mentioned
5. Recommend which services are best for this search
6. Flag any potential issues (quality not available, storage constraints, etc.)
7. Provide a confidence score (0-1) for your interpretation

Be precise and helpful. If interpretation is uncertain, set lower confidence.
Always recommend services based on what's available.`;

/**
 * Service for interpreting natural language search queries with AI
 */
export class IntelligentSearchService {
  private static instance: IntelligentSearchService;
  private aiService = AIService.getInstance();
  private contextBuilder = SearchContextBuilder.getInstance();

  private constructor() {}

  static getInstance(): IntelligentSearchService {
    if (!IntelligentSearchService.instance) {
      IntelligentSearchService.instance = new IntelligentSearchService();
    }
    return IntelligentSearchService.instance;
  }

  /**
   * Interpret a search query using AI (non-streaming, fast)
   * Best for quick interpretations of simple queries
   *
   * @param query The user's search query
   * @returns Structured search interpretation
   */
  async interpretQuery(query: string): Promise<SearchInterpretation> {
    try {
      if (!query || query.trim().length < 2) {
        return this.createEmptyInterpretation(query);
      }

      // Build context for better interpretations
      const context = await this.contextBuilder.buildContext();

      // Generate the interpretation
      const { object } = await this.aiService.generateObject(
        SearchInterpretationSchema,
        this.buildSearchPrompt(query, context),
        SEARCH_SYSTEM_PROMPT,
      );

      logger.debug("Query interpreted", {
        query,
        mediaTypes: object.mediaTypes,
        confidence: object.confidence,
      });

      return object;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      // Log detailed error for debugging
      logger.error("Failed to interpret query", {
        query,
        error: errorMessage,
        errorName,
        fullError: error instanceof Error ? error : String(error),
      });

      // Return a fallback interpretation
      return this.createFallbackInterpretation(query);
    }
  }

  /**
   * Interpret a search query using AI (streaming version)
   * Yields complete interpretation as it arrives for progressive UI updates
   *
   * @param query The user's search query
   * @yields Complete interpretation when available
   */
  async *streamInterpretation(
    query: string,
  ): AsyncGenerator<InterpretationStreamItem, void, unknown> {
    try {
      if (!query || query.trim().length < 2) {
        yield {
          type: "final",
          data: this.createEmptyInterpretation(query),
        };
        return;
      }

      const context = await this.contextBuilder.buildContext();
      const { partialObjectStream, object } = await this.aiService.streamObject(
        SearchInterpretationSchema,
        this.buildSearchPrompt(query, context),
        SEARCH_SYSTEM_PROMPT,
      );

      for await (const partial of partialObjectStream) {
        yield {
          type: "partial",
          data: partial as Partial<SearchInterpretation>,
        };
      }

      const finalResult = await object;
      yield { type: "final", data: finalResult };

      logger.debug("Query interpretation streamed", {
        query,
        confidence: finalResult.confidence,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : "Unknown";

      logger.error("Failed to stream interpretation", {
        query,
        error: errorMessage,
        errorName,
      });

      // Yield fallback on error
      yield {
        type: "final",
        data: this.createFallbackInterpretation(query),
      };
    }
  }

  /**
   * Check if AI search is properly configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const isConfigured = await this.aiService.isConfigured();
      return isConfigured;
    } catch (error) {
      logger.error("Failed to check AI configuration", { error });
      return false;
    }
  }

  /**
   * Get the active AI model information
   */
  getActiveModel() {
    return this.aiService.getActiveModel();
  }

  /**
   * Build a detailed prompt for search interpretation
   */
  private buildSearchPrompt(query: string, context: UserSearchContext): string {
    const servicesInfo = context.availableServices
      .map((s) => `- ${s.name} (${s.type})`)
      .join("\n");

    const libraryInfo = `
The user has the following media library:
- Series/Shows: ${context.librarySize.series}
- Movies: ${context.librarySize.movies}
- Total items: ${context.librarySize.total}`;

    return `Analyze and interpret this search query: "${query}"

Available Services:
${servicesInfo || "None configured"}

${context.librarySize.total > 0 ? libraryInfo : ""}

${context.qualityPreference ? `User's Quality Preference: ${context.qualityPreference}` : ""}
${context.languagePreference ? `User's Language Preference: ${context.languagePreference}` : ""}
${context.favoriteGenres.length > 0 ? `Favorite Genres: ${context.favoriteGenres.join(", ")}` : ""}

Provide a structured interpretation including:
1. Media types (anime, series, movie)
2. Genres and themes
3. Key search terms
4. Year range if specified
5. Quality and language preferences
6. Which services to search
7. Any warnings or considerations
8. Your confidence level (0-1)`;
  }

  /**
   * Create an empty interpretation for invalid queries
   */
  private createEmptyInterpretation(query: string): SearchInterpretation {
    return {
      mediaTypes: ["series", "movie"],
      genres: [],
      keywords: [],
      recommendedServices: [],
      searchWarnings: ["Query too short - please provide more details"],
      confidence: 0,
    };
  }

  /**
   * Create a fallback interpretation when AI fails
   */
  private createFallbackInterpretation(query: string): SearchInterpretation {
    const lowerQuery = query.toLowerCase();

    // Simple keyword extraction
    const keywords = query
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .slice(0, 5);

    // Basic media type detection
    const mediaTypes: SearchInterpretation["mediaTypes"] = [];
    if (/anime|manga/i.test(query)) mediaTypes.push("anime");
    if (/movie|film/i.test(query)) mediaTypes.push("movie");
    if (/series|show|tv|television/i.test(query)) mediaTypes.push("series");

    if (mediaTypes.length === 0) {
      mediaTypes.push("series", "movie");
    }

    // Basic genre detection
    const genrePatterns = [
      { regex: /action/, genre: "action" },
      { regex: /romance/, genre: "romance" },
      { regex: /drama/, genre: "drama" },
      { regex: /comedy|funny/, genre: "comedy" },
      { regex: /horror|scary/, genre: "horror" },
      { regex: /thriller/, genre: "thriller" },
      { regex: /adventure/, genre: "adventure" },
      { regex: /sci.?fi|science.fiction/, genre: "sci-fi" },
    ];

    const genres = genrePatterns
      .filter((p) => p.regex.test(lowerQuery))
      .map((p) => p.genre);

    // Year detection
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    const yearRange = yearMatch
      ? {
          start: parseInt(yearMatch[0]),
          end: parseInt(yearMatch[0]),
        }
      : undefined;

    return {
      mediaTypes,
      genres,
      keywords,
      yearRange,
      recommendedServices: [],
      searchWarnings: [
        "Using offline fallback interpretation - AI service unavailable",
        "Limited accuracy with offline mode",
      ],
      confidence: 0.3,
    };
  }
}
