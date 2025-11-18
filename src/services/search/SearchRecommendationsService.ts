/**
 * Search Recommendations Service
 * Generates personalized content recommendations based on user profile
 */

import { z } from "zod";
import { AIService } from "@/services/ai/core/AIService";
import { useSettingsStore } from "@/store/settingsStore";
import { useConversationalAIConfigStore } from "@/store/conversationalAIConfigStore";
import { logger } from "@/services/logger/LoggerService";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import {
  SearchContextBuilder,
  type UserSearchContext,
} from "./SearchContextBuilder";

export interface RecommendationItem {
  type: "trending" | "similar" | "gaps" | "seasonal" | "genre" | "completion";
  title: string;
  reason: string;
  mediaType: "anime" | "series" | "movie";
  estimatedMatchScore: number; // 0-100
}

export interface RecommendationResult {
  recommendations: RecommendationItem[];
}

const RECOMMENDATION_SCHEMA = z.object({
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
        .describe("Match score 0-100 based on user preferences"),
    }),
  ),
});

const RECOMMENDATION_SYSTEM_PROMPT = `You are UniArr Recommendation Engine, an expert at suggesting media content.

Your role is to:
1. Suggest content the user might not have discovered yet
2. Identify gaps in their collection (missing seasons, related shows, etc.)
3. Recommend trending content relevant to their interests
4. Suggest content that matches their preferred genres
5. Recommend seasonal content (holiday specials, spring anime, etc.)
6. Help them complete series they've started

Always provide:
- Clear, helpful reasons for each recommendation
- Match scores as INTEGERS between 0-100 (e.g., 45, 87, 92) based on user preferences
- A mix of different recommendation types
- Focus on content NOT already in their library

Consider the user's:
- Watch history and preferences
- Favorite genres
- Disliked genres
- Quality preferences
- Language preferences
- Available services`;

/**
 * Service for generating personalized search recommendations
 */
export class SearchRecommendationsService {
  private static instance: SearchRecommendationsService;
  private aiService = AIService.getInstance();
  private contextBuilder = SearchContextBuilder.getInstance();

  // Cache with 24-hour TTL (persisted to storage)
  private cachedRecommendations: RecommendationResult | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CACHE_STORAGE_KEY = "SearchRecommendationsService:cache";
  private readonly CACHE_TIMESTAMP_KEY =
    "SearchRecommendationsService:cacheTimestamp";
  private cacheLoaded = false;
  private originalProvider: string | null = null;

  private constructor() {
    // Load persisted cache on instantiation
    this.loadPersistedCache().catch((error) => {
      logger.error("Failed to load persisted recommendations cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  static getInstance(): SearchRecommendationsService {
    if (!SearchRecommendationsService.instance) {
      SearchRecommendationsService.instance =
        new SearchRecommendationsService();
    }
    return SearchRecommendationsService.instance;
  }

  /**
   * Load cache from persistent storage
   */
  private async loadPersistedCache(): Promise<void> {
    try {
      const cachedJson = await storageAdapter.getItem(this.CACHE_STORAGE_KEY);
      const timestampJson = await storageAdapter.getItem(
        this.CACHE_TIMESTAMP_KEY,
      );

      if (cachedJson && timestampJson) {
        const recommendations = JSON.parse(cachedJson) as RecommendationResult;
        const timestamp = parseInt(timestampJson, 10);

        // Validate cache is not expired
        const age = Date.now() - timestamp;
        if (age < this.CACHE_TTL_MS) {
          this.cachedRecommendations = recommendations;
          this.cacheTimestamp = timestamp;
          logger.debug("Loaded persisted recommendations cache", {
            ageHours: Math.round(age / 3600000),
            count: recommendations.recommendations.length,
          });
        } else {
          // Cache expired, remove it
          await storageAdapter.removeItem(this.CACHE_STORAGE_KEY);
          await storageAdapter.removeItem(this.CACHE_TIMESTAMP_KEY);
          logger.debug("Persisted cache expired and removed");
        }
      }
    } catch (error) {
      logger.warn("Failed to load persisted cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.cacheLoaded = true;
    }
  }

  /**
   * Save cache to persistent storage
   */
  private async persistCache(): Promise<void> {
    try {
      if (!this.cachedRecommendations || !this.cacheTimestamp) {
        return;
      }
      await storageAdapter.setItem(
        this.CACHE_STORAGE_KEY,
        JSON.stringify(this.cachedRecommendations),
      );
      await storageAdapter.setItem(
        this.CACHE_TIMESTAMP_KEY,
        this.cacheTimestamp.toString(),
      );
      logger.debug("Persisted recommendations cache");
    } catch (error) {
      logger.warn("Failed to persist cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cachedRecommendations || !this.cacheTimestamp) {
      return false;
    }
    const now = Date.now();
    const age = now - this.cacheTimestamp;
    return age < this.CACHE_TTL_MS;
  }

  /**
   * Generate recommendations (non-streaming)
   * Uses 24-hour persistent cache, pass forceRefresh=true to bypass
   *
   * @param forceRefresh - Bypass cache and fetch fresh recommendations
   * @returns Recommendations for the user
   */
  async generateRecommendations(
    forceRefresh: boolean = false,
  ): Promise<RecommendationResult> {
    try {
      // Wait for persisted cache to load on first call
      if (!this.cacheLoaded) {
        await new Promise((resolve) => {
          const checkLoaded = () => {
            if (this.cacheLoaded) {
              resolve(undefined);
            } else {
              setTimeout(checkLoaded, 10);
            }
          };
          checkLoaded();
        });
      }

      // Return cached result if valid and not forced refresh
      if (!forceRefresh && this.isCacheValid()) {
        logger.debug("Returning cached recommendations", {
          ageHours: Math.round((Date.now() - this.cacheTimestamp) / 3600000),
        });
        return this.cachedRecommendations!;
      }

      // Check if AI Recommendations are enabled in settings
      const enableAIRecommendations =
        useSettingsStore.getState().enableAIRecommendations;
      if (!enableAIRecommendations) {
        logger.debug("AI Recommendations are disabled in settings");
        return { recommendations: [] };
      }

      const context = await this.contextBuilder.buildContext();

      // Use custom provider/model if configured for recommendations
      await this.useRecommendationProvider();

      const { object } = await this.aiService.generateObject(
        RECOMMENDATION_SCHEMA,
        this.buildRecommendationPrompt(context),
        RECOMMENDATION_SYSTEM_PROMPT,
      );

      // Restore default provider
      await this.restoreDefaultProvider();

      const normalizedObject = this.normalizeRecommendationResult(object);

      logger.debug("Recommendations generated", {
        count: normalizedObject.recommendations.length,
        types: normalizedObject.recommendations.map((r) => r.type),
        forced: forceRefresh,
      });

      // Cache the result
      this.cachedRecommendations = normalizedObject;
      this.cacheTimestamp = Date.now();

      // Persist cache to storage (fire and forget)
      void this.persistCache();

      return normalizedObject;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to generate recommendations", {
        error: errorMessage,
      });
      return { recommendations: [] };
    }
  }

  /**
   * Stream recommendations with partial updates
   *
   * @yields Partial recommendation updates as they arrive
   */
  async *streamRecommendations() {
    try {
      // Check if AI Recommendations are enabled in settings
      const enableAIRecommendations =
        useSettingsStore.getState().enableAIRecommendations;
      if (!enableAIRecommendations) {
        logger.debug("AI Recommendations are disabled in settings");
        yield { recommendations: [] };
        return;
      }

      const context = await this.contextBuilder.buildContext();

      // Use custom provider/model if configured for recommendations
      await this.useRecommendationProvider();

      const { partialObjectStream } = await this.aiService.streamObject(
        RECOMMENDATION_SCHEMA,
        this.buildRecommendationPrompt(context),
        RECOMMENDATION_SYSTEM_PROMPT,
      );

      // Note: We don't restore here as the stream is still active
      // The caller should handle provider restoration after consuming the stream

      for await (const partial of partialObjectStream) {
        yield this.normalizePartialRecommendations(partial);
      }

      logger.debug("Recommendation stream completed", {
        totalCount: 0,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to stream recommendations", { error: errorMessage });
      yield { recommendations: [] };
    }
  }

  /**
   * Get recommendations for a specific genre
   */
  async getGenreRecommendations(genre: string): Promise<RecommendationResult> {
    try {
      // Check if AI Recommendations are enabled in settings
      const enableAIRecommendations =
        useSettingsStore.getState().enableAIRecommendations;
      if (!enableAIRecommendations) {
        logger.debug("AI Recommendations are disabled in settings");
        return { recommendations: [] };
      }

      const context = await this.contextBuilder.buildContext();

      // Use custom provider/model if configured for recommendations
      await this.useRecommendationProvider();

      const { object } = await this.aiService.generateObject(
        RECOMMENDATION_SCHEMA,
        this.buildGenreRecommendationPrompt(genre, context),
        RECOMMENDATION_SYSTEM_PROMPT,
      );

      // Restore default provider
      await this.restoreDefaultProvider();

      const normalizedObject = this.normalizeRecommendationResult(object);

      logger.debug("Genre recommendations generated", {
        genre,
        count: normalizedObject.recommendations.length,
      });

      return normalizedObject;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to generate genre recommendations", {
        error: errorMessage,
        genre,
      });
      return { recommendations: [] };
    }
  }

  /**
   * Check if recommendations are available (AI configured)
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.aiService.isConfigured();
    } catch {
      return false;
    }
  }

  /**
   * Build recommendation prompt
   */
  private buildRecommendationPrompt(context: UserSearchContext): string {
    const servicesInfo =
      context.availableServices
        .map((s) => `- ${s.name} (${s.type})`)
        .join("\n") || "None configured";

    const genresInfo =
      context.favoriteGenres.length > 0
        ? `Favorite Genres: ${context.favoriteGenres.join(", ")}`
        : "No favorite genres recorded";

    const libraryInfo = `
Library Status:
- Series: ${context.librarySize.series}
- Movies: ${context.librarySize.movies}
- Total: ${context.librarySize.total}`;

    return `Based on this user profile, generate personalized recommendations:

${genresInfo}
${context.dislikedGenres.length > 0 ? `Disliked Genres: ${context.dislikedGenres.join(", ")}` : ""}

${libraryInfo}

Available Services:
${servicesInfo}

${context.qualityPreference ? `Quality Preference: ${context.qualityPreference}` : ""}
${context.languagePreference ? `Language Preference: ${context.languagePreference}` : ""}

Generate 5-10 recommendations that:
1. Match user preferences
2. Are NOT already in their library
3. Include diverse recommendation types
4. Have realistic match scores
5. Include helpful context for why each is recommended`;
  }

  /**
   * Build genre-specific recommendation prompt
   */
  private buildGenreRecommendationPrompt(
    genre: string,
    context: UserSearchContext,
  ): string {
    const servicesInfo =
      context.availableServices
        .map((s) => `- ${s.name} (${s.type})`)
        .join("\n") || "None configured";

    return `Generate recommendations for ${genre} content based on this profile:

User's Current Interests: ${context.favoriteGenres.join(", ") || "General interest"}
Available Services: ${servicesInfo}

Generate 5-8 recommendations for ${genre} that:
1. Are well-reviewed and popular
2. Vary in type (series, movies, anime as available)
3. Include both classics and recent releases
4. Have realistic match scores based on genre preferences
5. Include diverse sub-genres within ${genre}`;
  }

  private normalizeRecommendationResult(
    result: RecommendationResult,
  ): RecommendationResult {
    if (!result?.recommendations) {
      return { recommendations: [] };
    }

    return {
      recommendations: result.recommendations.map((recommendation) => ({
        ...recommendation,
        estimatedMatchScore: this.normalizeScore(
          recommendation?.estimatedMatchScore,
        ),
      })),
    };
  }

  private normalizePartialRecommendations(
    partial: Partial<RecommendationResult>,
  ): Partial<RecommendationResult> {
    if (!partial.recommendations) {
      return partial;
    }

    return {
      ...partial,
      recommendations: partial.recommendations.map((recommendation) => ({
        ...recommendation,
        estimatedMatchScore: this.normalizeScore(
          recommendation?.estimatedMatchScore,
        ),
      })),
    };
  }

  private normalizeScore(score?: number | null): number {
    if (typeof score !== "number" || Number.isNaN(score)) {
      return 0;
    }

    const normalized = score <= 1 ? score * 100 : score;
    const clamped = Math.max(0, Math.min(100, normalized));
    return Math.round(clamped);
  }

  /**
   * Switch to the recommendation-specific provider if configured
   */
  private async useRecommendationProvider(): Promise<void> {
    try {
      const { selectedProvider, selectedModel } =
        useConversationalAIConfigStore.getState();

      if (!selectedProvider || !selectedModel) {
        // No custom provider configured, use default
        return;
      }

      // Import AIProviderManager dynamically to avoid circular dependencies
      const { AIProviderManager } = await import(
        "@/services/ai/core/AIProviderManager"
      );
      const providerManager = AIProviderManager.getInstance();

      // Save current provider
      const currentProvider = providerManager.getActiveProvider();
      this.originalProvider = currentProvider?.provider || null;

      // Switch to recommendation provider
      const success = providerManager.setActiveProvider(
        selectedProvider as any,
      );

      if (success) {
        logger.debug("Switched to recommendation provider", {
          provider: selectedProvider,
          model: selectedModel,
        });
      } else {
        logger.warn("Failed to switch to recommendation provider", {
          provider: selectedProvider,
        });
      }
    } catch (error) {
      logger.error("Error switching to recommendation provider", { error });
    }
  }

  /**
   * Restore the default provider after recommendation generation
   */
  private async restoreDefaultProvider(): Promise<void> {
    try {
      if (!this.originalProvider) {
        return;
      }

      const { AIProviderManager } = await import(
        "@/services/ai/core/AIProviderManager"
      );
      const providerManager = AIProviderManager.getInstance();

      providerManager.setActiveProvider(this.originalProvider as any);
      logger.debug("Restored default provider", {
        provider: this.originalProvider,
      });

      this.originalProvider = null;
    } catch (error) {
      logger.error("Error restoring default provider", { error });
    }
  }
}
