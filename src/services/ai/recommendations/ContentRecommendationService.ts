/**
 * Content Recommendation Service
 *
 * Core service for generating AI-powered content recommendations.
 * Implements cache-first strategy, feedback tracking, and content gap identification.
 *
 * Features:
 * - Cache-first recommendation retrieval
 * - AI-powered recommendation generation
 * - User feedback tracking and learning
 * - Content gap identification
 * - Availability checking across services
 */

import { AIService } from "@/services/ai/core/AIService";
import { RecommendationCache } from "./RecommendationCache";
import { RecommendationContextBuilder } from "./RecommendationContextBuilder";
import { RecommendationLearningService } from "./RecommendationLearningService";
import { RateLimiter } from "./RateLimiter";
import { PerformanceMonitor } from "./PerformanceMonitor";
import { logger } from "@/services/logger/LoggerService";
import { useSettingsStore } from "@/store/settingsStore";
import {
  RecommendationResponseSchema,
  type Recommendation,
} from "@/models/recommendation.schemas";
import type {
  RecommendationRequest,
  RecommendationResponseData,
  UserContext,
} from "@/models/recommendation.types";
import {
  AIServiceError,
  RecommendationError,
  ContextBuildError,
  isAIServiceError,
  isContextBuildError,
  isRateLimitError,
} from "./errors";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import NetInfo from "@react-native-community/netinfo";

/**
 * Main service for content recommendations
 */
export class ContentRecommendationService {
  private static instance: ContentRecommendationService;
  private aiService: AIService;
  private cache: RecommendationCache;
  private contextBuilder: RecommendationContextBuilder;
  private learningService: RecommendationLearningService;
  private rateLimiter: RateLimiter;
  private performanceMonitor: PerformanceMonitor;
  private retryScheduler: Map<string, NodeJS.Timeout> = new Map();
  private isOfflineMode: boolean = false;

  private constructor() {
    this.aiService = AIService.getInstance();
    this.cache = RecommendationCache.getInstance();
    this.contextBuilder = RecommendationContextBuilder.getInstance();
    this.learningService = RecommendationLearningService.getInstance();
    this.rateLimiter = RateLimiter.getInstance();
    this.performanceMonitor = PerformanceMonitor.getInstance();
    this.initializeNetworkMonitoring();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ContentRecommendationService {
    if (!ContentRecommendationService.instance) {
      ContentRecommendationService.instance =
        new ContentRecommendationService();
    }
    return ContentRecommendationService.instance;
  }

  /**
   * Initialize network monitoring for offline mode detection
   */
  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = this.isOfflineMode;
      this.isOfflineMode = !state.isConnected || !state.isInternetReachable;

      if (wasOffline && !this.isOfflineMode) {
        void logger.info("Network reconnected, exiting offline mode");
      } else if (!wasOffline && this.isOfflineMode) {
        void logger.info("Network disconnected, entering offline mode");
      }
    });

    // Check initial state
    NetInfo.fetch().then((state) => {
      this.isOfflineMode = !state.isConnected || !state.isInternetReachable;
      if (this.isOfflineMode) {
        void logger.info("Starting in offline mode");
      }
    });
  }

  /**
   * Check if service is in offline mode
   */
  public isOffline(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Get recommendations with cache-first strategy
   *
   * @param request - Recommendation request parameters
   * @returns Recommendation response with recommendations and metadata
   */
  async getRecommendations(
    request: RecommendationRequest,
  ): Promise<RecommendationResponseData> {
    // Get preferences from settings store
    const settingsStore = useSettingsStore.getState();
    const { recommendationLimit, recommendationIncludeHiddenGems } =
      settingsStore;

    const {
      userId,
      limit = recommendationLimit,
      includeHiddenGems = recommendationIncludeHiddenGems,
      forceRefresh = false,
    } = request;

    // Start overall performance timer
    const overallTimerId = this.performanceMonitor.startTimer(
      `getRecommendations_${userId}`,
    );

    try {
      void logger.info("Getting recommendations", {
        userId,
        limit,
        forceRefresh,
        isOffline: this.isOfflineMode,
      });

      // If offline, return cached recommendations immediately
      if (this.isOfflineMode && !forceRefresh) {
        const result = await this.handleOfflineRequest(userId);
        await this.performanceMonitor.stopTimer(
          overallTimerId,
          "cacheHit",
          userId,
          { offline: true },
        );
        return result;
      }

      // Build current context with error handling
      let context: UserContext;
      let contextHash: string;

      try {
        const contextTimerId = this.performanceMonitor.startTimer(
          `buildContext_${userId}`,
        );
        context = await this.contextBuilder.buildContext(userId);
        contextHash = this.cache.generateContextHash(context);
        await this.performanceMonitor.stopTimer(
          contextTimerId,
          "contextBuilding",
          userId,
          {
            watchHistoryCount: context.watchHistory.length,
            libraryItemsCount: context.libraryStats.totalItems,
          },
        );
      } catch (error) {
        // Context build failure - try to use partial context or cached data
        void logger.warn("Context build failed, attempting fallback", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });

        if (isContextBuildError(error)) {
          // Try to get cached recommendations
          const cached = await this.getCachedRecommendations(userId);
          if (cached) {
            await this.performanceMonitor.stopTimer(
              overallTimerId,
              "cacheHit",
              userId,
              { fallback: true },
            );
            return cached;
          }
        }

        throw new ContextBuildError(
          "Failed to build recommendation context and no cache available",
          { userId },
        );
      }

      // Check cache if not forcing refresh
      if (!forceRefresh) {
        try {
          const cacheCheckTimerId = this.performanceMonitor.startTimer(
            `cacheCheck_${userId}`,
          );
          const isValid = await this.cache.isValid(userId, contextHash);
          if (isValid) {
            const cached = await this.cache.get(userId);
            if (cached) {
              const cacheAge = await this.cache.getAge(userId);
              const duration = await this.performanceMonitor.stopTimer(
                cacheCheckTimerId,
                "cacheHit",
                userId,
                { cacheAge },
              );

              void logger.info("Returning cached recommendations", {
                userId,
                cacheAge,
                responseTime: duration,
              });

              await this.performanceMonitor.stopTimer(
                overallTimerId,
                "cacheHit",
                userId,
                { cacheAge },
              );

              return {
                recommendations: cached.recommendations,
                generatedAt: cached.generatedAt,
                cacheAge: cacheAge || undefined,
                context: {
                  watchHistoryCount: context.watchHistory.length,
                  favoriteGenres: context.preferences.favoriteGenres,
                  analysisVersion: cached.version,
                },
              };
            }
          }
        } catch (error) {
          // Cache read failure - log and continue with fresh generation
          void logger.warn("Cache read failed, generating fresh", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Get list of items the user explicitly rejected (not interested)
      let notInterestedTitles: string[] = [];
      try {
        const rejected =
          await this.learningService.getRejectedRecommendations(userId);
        notInterestedTitles = rejected.map((r) => r.recommendation.title);
      } catch (error) {
        void logger.debug("Failed to fetch rejected recommendations", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Generate fresh recommendations with error handling
      let recommendations: RecommendationResponseData["recommendations"];

      try {
        void logger.info("Generating fresh recommendations", { userId });
        const genTimerId = this.performanceMonitor.startTimer(
          `generateRecommendations_${userId}`,
        );
        recommendations = await this.generateRecommendations(
          context,
          limit,
          includeHiddenGems,
          notInterestedTitles,
        );
        await this.performanceMonitor.stopTimer(
          genTimerId,
          "freshGeneration",
          userId,
          { count: recommendations.length },
        );
      } catch (error) {
        // AI service failure - return cached recommendations if available
        if (isAIServiceError(error)) {
          void logger.error("AI service failed, attempting cache fallback", {
            userId,
            error: error.message,
          });

          const cached = await this.getCachedRecommendations(userId);
          if (cached) {
            await this.performanceMonitor.stopTimer(
              overallTimerId,
              "cacheHit",
              userId,
              { fallback: true, error: "ai_service_error" },
            );
            return cached;
          }
        }

        // Rate limit error - return cache and schedule retry
        if (isRateLimitError(error)) {
          void logger.warn("Rate limit exceeded, returning cache", {
            userId,
            resetAt: error.resetAt,
          });

          const cached = await this.getCachedRecommendations(userId);
          if (cached) {
            // Schedule retry after rate limit resets
            this.scheduleRetry(userId, error.resetAt || Date.now() + 60000);
            await this.performanceMonitor.stopTimer(
              overallTimerId,
              "cacheHit",
              userId,
              { fallback: true, error: "rate_limit" },
            );
            return cached;
          }
        }

        throw error;
      }

      // Enrich with availability information (non-blocking)
      const enrichedRecommendations =
        await this.enrichWithAvailability(recommendations);

      // Cache the results with error handling
      try {
        await this.cache.set({
          userId,
          recommendations: enrichedRecommendations,
          generatedAt: new Date(),
          contextHash,
          version: "1.0",
        });
      } catch (error) {
        // Cache write failure - log but don't fail the request
        void logger.error("Failed to cache recommendations", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      const totalDuration = await this.performanceMonitor.stopTimer(
        overallTimerId,
        "freshGeneration",
        userId,
        { count: enrichedRecommendations.length },
      );

      void logger.info("Fresh recommendations generated", {
        userId,
        count: enrichedRecommendations.length,
        totalDuration,
      });

      return {
        recommendations: enrichedRecommendations,
        generatedAt: new Date(),
        context: {
          watchHistoryCount: context.watchHistory.length,
          favoriteGenres: context.preferences.favoriteGenres,
          analysisVersion: "1.0",
        },
      };
    } catch (error) {
      void logger.error("Failed to get recommendations", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Final fallback - try to return any cached recommendations
      try {
        const cached = await this.getCachedRecommendations(userId);
        if (cached) {
          void logger.warn("Returning stale cache as final fallback", {
            userId,
          });
          await this.performanceMonitor.stopTimer(
            overallTimerId,
            "cacheHit",
            userId,
            { fallback: true, stale: true },
          );
          return cached;
        }
      } catch (cacheError) {
        void logger.error("Cache fallback also failed", {
          userId,
          error:
            cacheError instanceof Error
              ? cacheError.message
              : String(cacheError),
        });
      }

      // No cache available, throw the original error
      throw error;
    }
  }

  /**
   * Handle offline request by returning cached recommendations
   */
  private async handleOfflineRequest(
    userId: string,
  ): Promise<RecommendationResponseData> {
    void logger.info("Handling offline request", { userId });

    const cached = await this.cache.get(userId);
    if (!cached) {
      throw new RecommendationError(
        "No cached recommendations available offline. Please connect to the internet to generate recommendations.",
        "OFFLINE_NO_CACHE",
        false,
      );
    }

    const cacheAge = await this.cache.getAge(userId);

    return {
      recommendations: cached.recommendations,
      generatedAt: cached.generatedAt,
      cacheAge: cacheAge || undefined,
      context: {
        watchHistoryCount: 0,
        favoriteGenres: [],
        analysisVersion: cached.version,
      },
      isOffline: true,
    };
  }

  /**
   * Get cached recommendations with proper error handling
   */
  private async getCachedRecommendations(
    userId: string,
  ): Promise<RecommendationResponseData | null> {
    try {
      const cached = await this.cache.get(userId);
      if (!cached) {
        return null;
      }

      const cacheAge = await this.cache.getAge(userId);

      // Filter cached recommendations against user 'not interested' entries
      let filteredRecommendations = cached.recommendations;
      try {
        const rejected =
          await this.learningService.getRejectedRecommendations(userId);
        const rejectedTitles = rejected.map((r) => r.recommendation.title);
        filteredRecommendations = filteredRecommendations.filter(
          (r) => !rejectedTitles.includes(r.title),
        );
      } catch (error) {
        void logger.debug(
          "Failed to fetch rejected recommendations for offline filter",
          {
            userId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }

      return {
        recommendations: filteredRecommendations,
        generatedAt: cached.generatedAt,
        cacheAge: cacheAge || undefined,
        context: {
          watchHistoryCount: 0,
          favoriteGenres: [],
          analysisVersion: cached.version,
        },
      };
    } catch (error) {
      void logger.error("Failed to retrieve cached recommendations", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Schedule a retry for recommendation generation
   */
  private scheduleRetry(userId: string, retryAt: number): void {
    // Clear any existing retry
    const existing = this.retryScheduler.get(userId);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = Math.max(0, retryAt - Date.now());

    void logger.info("Scheduling recommendation retry", {
      userId,
      delayMs: delay,
    });

    const timeout = setTimeout(() => {
      void logger.info("Executing scheduled retry", { userId });
      this.getRecommendations({ userId, forceRefresh: true }).catch((error) => {
        void logger.error("Scheduled retry failed", {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      this.retryScheduler.delete(userId);
    }, delay);

    this.retryScheduler.set(userId, timeout);
  }

  /**
   * Refresh recommendations, bypassing cache
   *
   * @param userId - User ID
   * @returns Fresh recommendation response
   */
  async refreshRecommendations(
    userId: string,
  ): Promise<RecommendationResponseData> {
    void logger.info("Refreshing recommendations", { userId });

    // Invalidate cache first
    await this.cache.invalidate(userId);

    // Generate fresh recommendations
    return this.getRecommendations({
      userId,
      forceRefresh: true,
    });
  }

  /**
   * Record user feedback on a recommendation
   *
   * @param userId - User ID
   * @param recommendationId - ID of the recommendation
   * @param feedback - Whether user accepted or rejected
   * @param reason - Optional reason for feedback
   */
  async recordFeedback(
    userId: string,
    recommendationId: string,
    feedback: "accepted" | "rejected",
    reason?: string,
    // Optional full recommendation object to avoid requiring cache
    recommendationObj?: Recommendation,
  ): Promise<void> {
    try {
      void logger.info("Recording recommendation feedback", {
        userId,
        recommendationId,
        feedback,
      });

      // Use the provided recommendation object or lookup in cache
      let recommendation: Recommendation | undefined = recommendationObj;
      if (!recommendation) {
        const cached = await this.cache.get(userId);
        if (!cached) {
          throw new RecommendationError(
            "Cannot record feedback: no cached recommendations found",
            "NO_CACHE",
          );
        }

        recommendation = cached.recommendations.find(
          (r) => r.id === recommendationId,
        );
        if (!recommendation) {
          throw new RecommendationError(
            "Cannot record feedback: recommendation not found",
            "NOT_FOUND",
          );
        }
      }

      // Build current context
      const context = await this.contextBuilder.buildContext(userId);

      // Record feedback
      await this.learningService.recordFeedback(
        userId,
        recommendationId,
        recommendation,
        feedback,
        context,
        reason,
      );

      // Check if cache should be invalidated
      const shouldInvalidate = await this.learningService.shouldInvalidateCache(
        userId,
        {
          id: `feedback_${Date.now()}`,
          userId,
          recommendationId,
          recommendation,
          feedback,
          reason,
          timestamp: new Date(),
          contextSnapshot: {
            watchHistoryCount: context.watchHistory.length,
            favoriteGenres: context.preferences.favoriteGenres,
            recentWatches: context.watchHistory
              .slice(0, 5)
              .map((item) => item.title),
          },
        },
      );

      if (shouldInvalidate) {
        void logger.info("Invalidating cache due to feedback patterns", {
          userId,
        });
        await this.cache.invalidate(userId);
      }

      void logger.info("Feedback recorded successfully", {
        userId,
        recommendationId,
      });
    } catch (error) {
      void logger.error("Failed to record feedback", {
        userId,
        recommendationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Identify content gaps in user's library
   *
   * @param userId - User ID
   * @returns List of recommended content to fill gaps
   */
  async getContentGaps(userId: string): Promise<Recommendation[]> {
    try {
      void logger.info("Identifying content gaps", { userId });

      // Check if offline
      if (this.isOfflineMode) {
        throw new RecommendationError(
          "Content gap identification requires an internet connection",
          "OFFLINE_FEATURE_UNAVAILABLE",
          false,
        );
      }

      // Build context
      const context = await this.contextBuilder.buildContext(userId);

      // Generate content gap recommendations
      const gaps = await this.generateContentGaps(context);

      void logger.info("Content gaps identified", {
        userId,
        count: gaps.length,
      });

      return gaps;
    } catch (error) {
      void logger.error("Failed to identify content gaps", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if cache is stale and should be refreshed
   * @param userId - User ID to check
   * @returns Object with staleness info and recommendation to refresh
   */
  async checkCacheStaleness(userId: string): Promise<{
    isStale: boolean;
    cacheAge: number | null;
    shouldRefresh: boolean;
  }> {
    try {
      const cacheAge = await this.cache.getAge(userId);

      if (cacheAge === null) {
        return {
          isStale: false,
          cacheAge: null,
          shouldRefresh: false,
        };
      }

      const maxAge = this.cache.getConfig().maxAge;
      const isStale = cacheAge > maxAge;

      return {
        isStale,
        cacheAge,
        shouldRefresh: isStale,
      };
    } catch (error) {
      void logger.error("Failed to check cache staleness", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isStale: false,
        cacheAge: null,
        shouldRefresh: false,
      };
    }
  }

  /**
   * Check if network-dependent actions should be disabled
   * @returns True if actions requiring network should be disabled
   */
  shouldDisableNetworkActions(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Add series to Sonarr
   * @param recommendation - Recommendation to add
   * @param options - Optional configuration for adding series
   * @returns Success status with message
   */
  async addToSonarr(
    recommendation: Recommendation,
    options?: {
      qualityProfileId?: number;
      rootFolderPath?: string;
      monitored?: boolean;
      searchOnAdd?: boolean;
    },
  ): Promise<{ success: boolean; message: string; error?: string }> {
    if (this.isOfflineMode) {
      return {
        success: false,
        message: "Cannot add content while offline",
        error: "OFFLINE_ACTION_DISABLED",
      };
    }

    try {
      void logger.info("Adding series to Sonarr", {
        title: recommendation.title,
        type: recommendation.type,
      });

      const connectorManager = ConnectorManager.getInstance();
      const sonarrConnectors = connectorManager.getConnectorsByType("sonarr");

      if (sonarrConnectors.length === 0) {
        return {
          success: false,
          message: "No Sonarr service configured",
          error: "SERVICE_NOT_CONFIGURED",
        };
      }

      const connector = sonarrConnectors[0] as SonarrConnector;

      // Get quality profiles and root folders
      const [qualityProfiles, rootFolders] = await Promise.all([
        connector.getQualityProfiles(),
        connector.getRootFolders(),
      ]);

      if (qualityProfiles.length === 0 || rootFolders.length === 0) {
        return {
          success: false,
          message:
            "Sonarr not properly configured (missing quality profiles or root folders)",
          error: "SERVICE_MISCONFIGURED",
        };
      }

      // Use provided options or defaults
      const qualityProfileId =
        options?.qualityProfileId || qualityProfiles[0]!.id;
      const rootFolderPath = options?.rootFolderPath || rootFolders[0]!.path;
      const monitored = options?.monitored ?? true;
      const searchOnAdd = options?.searchOnAdd ?? true;

      // Search for the series first to get the proper metadata
      const searchResults = await connector.search(recommendation.title);

      if (searchResults.length === 0) {
        return {
          success: false,
          message: `Series "${recommendation.title}" not found in Sonarr lookup`,
          error: "SERIES_NOT_FOUND",
        };
      }

      // Find best match (exact title match or first result)
      const match =
        searchResults.find(
          (s) => s.title.toLowerCase() === recommendation.title.toLowerCase(),
        ) || searchResults[0]!;

      // Add the series
      await connector.add({
        title: match.title,
        titleSlug: match.titleSlug || "",
        tvdbId: match.tvdbId,
        qualityProfileId,
        rootFolderPath,
        monitored,
        searchNow: searchOnAdd,
      });

      void logger.info("Series added to Sonarr successfully", {
        title: recommendation.title,
      });

      return {
        success: true,
        message: `Successfully added "${recommendation.title}" to Sonarr`,
      };
    } catch (error) {
      void logger.error("Failed to add series to Sonarr", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Failed to add "${recommendation.title}" to Sonarr`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add movie to Radarr
   * @param recommendation - Recommendation to add
   * @param options - Optional configuration for adding movie
   * @returns Success status with message
   */
  async addToRadarr(
    recommendation: Recommendation,
    options?: {
      qualityProfileId?: number;
      rootFolderPath?: string;
      monitored?: boolean;
      searchOnAdd?: boolean;
      minimumAvailability?: string;
    },
  ): Promise<{ success: boolean; message: string; error?: string }> {
    if (this.isOfflineMode) {
      return {
        success: false,
        message: "Cannot add content while offline",
        error: "OFFLINE_ACTION_DISABLED",
      };
    }

    try {
      void logger.info("Adding movie to Radarr", {
        title: recommendation.title,
        year: recommendation.year,
      });

      const connectorManager = ConnectorManager.getInstance();
      const radarrConnectors = connectorManager.getConnectorsByType("radarr");

      if (radarrConnectors.length === 0) {
        return {
          success: false,
          message: "No Radarr service configured",
          error: "SERVICE_NOT_CONFIGURED",
        };
      }

      const connector = radarrConnectors[0] as RadarrConnector;

      // Get quality profiles and root folders
      const [qualityProfiles, rootFolders] = await Promise.all([
        connector.getQualityProfiles(),
        connector.getRootFolders(),
      ]);

      if (qualityProfiles.length === 0 || rootFolders.length === 0) {
        return {
          success: false,
          message:
            "Radarr not properly configured (missing quality profiles or root folders)",
          error: "SERVICE_MISCONFIGURED",
        };
      }

      // Use provided options or defaults
      const qualityProfileId =
        options?.qualityProfileId || qualityProfiles[0]!.id;
      const rootFolderPath = options?.rootFolderPath || rootFolders[0]!.path;
      const monitored = options?.monitored ?? true;
      const searchOnAdd = options?.searchOnAdd ?? true;
      const minimumAvailability = options?.minimumAvailability || "announced";

      // Search for the movie first to get the proper metadata
      const searchQuery = recommendation.year
        ? `${recommendation.title} ${recommendation.year}`
        : recommendation.title;
      const searchResults = await connector.search(searchQuery);

      if (searchResults.length === 0) {
        return {
          success: false,
          message: `Movie "${recommendation.title}" not found in Radarr lookup`,
          error: "MOVIE_NOT_FOUND",
        };
      }

      // Find best match (exact title and year match or first result)
      const match =
        searchResults.find(
          (m) =>
            m.title.toLowerCase() === recommendation.title.toLowerCase() &&
            (!recommendation.year || m.year === recommendation.year),
        ) || searchResults[0]!;

      // Add the movie
      await connector.add({
        title: match.title,
        titleSlug: match.titleSlug || "",
        tmdbId: match.tmdbId || 0,
        year: match.year,
        qualityProfileId,
        rootFolderPath,
        monitored,
        searchOnAdd,
        minimumAvailability,
      });

      void logger.info("Movie added to Radarr successfully", {
        title: recommendation.title,
      });

      return {
        success: true,
        message: `Successfully added "${recommendation.title}" to Radarr`,
      };
    } catch (error) {
      void logger.error("Failed to add movie to Radarr", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Failed to add "${recommendation.title}" to Radarr`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add content to Jellyseerr (unified request system)
   * @param recommendation - Recommendation to add
   * @param options - Optional configuration for the request
   * @returns Success status with message
   */
  async addToJellyseerr(
    recommendation: Recommendation,
    options?: {
      is4k?: boolean;
      serverId?: number;
      profileId?: number;
      rootFolder?: string;
      seasons?: number[] | "all";
    },
  ): Promise<{ success: boolean; message: string; error?: string }> {
    if (this.isOfflineMode) {
      return {
        success: false,
        message: "Cannot add content while offline",
        error: "OFFLINE_ACTION_DISABLED",
      };
    }

    try {
      void logger.info("Adding content to Jellyseerr", {
        title: recommendation.title,
        type: recommendation.type,
      });

      const connectorManager = ConnectorManager.getInstance();
      const jellyseerrConnectors =
        connectorManager.getConnectorsByType("jellyseerr");

      if (jellyseerrConnectors.length === 0) {
        return {
          success: false,
          message: "No Jellyseerr service configured",
          error: "SERVICE_NOT_CONFIGURED",
        };
      }

      const connector = jellyseerrConnectors[0] as any; // JellyseerrConnector

      // Determine media type
      const mediaType = recommendation.type === "movie" ? "movie" : "tv";

      // Search for the content to get the proper media ID
      const searchResults = await connector.search(recommendation.title);

      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          message: `Content "${recommendation.title}" not found in Jellyseerr`,
          error: "CONTENT_NOT_FOUND",
        };
      }

      // Find best match
      const match =
        searchResults.find(
          (r: any) =>
            r.mediaType === mediaType &&
            ((r.title || r.name || "").toLowerCase() ===
              recommendation.title.toLowerCase() ||
              (r.originalTitle || r.originalName || "").toLowerCase() ===
                recommendation.title.toLowerCase()),
        ) ||
        searchResults.find((r: any) => r.mediaType === mediaType) ||
        searchResults[0];

      if (!match || !match.id) {
        return {
          success: false,
          message: `Could not find valid media ID for "${recommendation.title}"`,
          error: "INVALID_MEDIA_ID",
        };
      }

      // Create the request
      const requestPayload: any = {
        mediaId: match.id,
        mediaType,
        is4k: options?.is4k ?? false,
      };

      if (options?.serverId) {
        requestPayload.serverId = options.serverId;
      }

      if (options?.profileId) {
        requestPayload.profileId = options.profileId;
      }

      if (options?.rootFolder) {
        requestPayload.rootFolder = options.rootFolder;
      }

      // For TV shows, handle seasons
      if (mediaType === "tv") {
        requestPayload.seasons = options?.seasons || "all";
      }

      await connector.createRequest(requestPayload);

      void logger.info("Content requested via Jellyseerr successfully", {
        title: recommendation.title,
      });

      return {
        success: true,
        message: `Successfully requested "${recommendation.title}" via Jellyseerr`,
      };
    } catch (error) {
      void logger.error("Failed to add content to Jellyseerr", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Failed to request "${recommendation.title}" via Jellyseerr`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get Jellyfin URL for viewing content
   * @param recommendation - Recommendation to view
   * @returns URL to view content in Jellyfin, or null if not available
   */
  async viewInJellyfin(recommendation: Recommendation): Promise<{
    success: boolean;
    url?: string;
    message: string;
    error?: string;
  }> {
    if (this.isOfflineMode) {
      return {
        success: false,
        message: "Cannot view content while offline",
        error: "OFFLINE_ACTION_DISABLED",
      };
    }

    try {
      void logger.info("Getting Jellyfin URL for content", {
        title: recommendation.title,
      });

      const connectorManager = ConnectorManager.getInstance();
      const jellyfinConnectors =
        connectorManager.getConnectorsByType("jellyfin");

      if (jellyfinConnectors.length === 0) {
        return {
          success: false,
          message: "No Jellyfin service configured",
          error: "SERVICE_NOT_CONFIGURED",
        };
      }

      const connector = jellyfinConnectors[0] as JellyfinConnector;

      // Search for the content in Jellyfin
      const searchResults = await connector.search(recommendation.title);

      if (!searchResults || searchResults.length === 0) {
        return {
          success: false,
          message: `"${recommendation.title}" not found in Jellyfin library`,
          error: "CONTENT_NOT_IN_LIBRARY",
        };
      }

      // Find best match
      const match =
        searchResults.find(
          (item) =>
            item.Name?.toLowerCase() === recommendation.title.toLowerCase() &&
            (!recommendation.year ||
              item.ProductionYear === recommendation.year),
        ) || searchResults[0];

      if (!match || !match.Id) {
        return {
          success: false,
          message: `Could not find valid item ID for "${recommendation.title}"`,
          error: "INVALID_ITEM_ID",
        };
      }

      // Construct Jellyfin web URL
      const baseUrl = connector["config"].url.replace(/\/$/, "");
      const url = `${baseUrl}/web/index.html#!/details?id=${match.Id}&serverId=${match.ServerId || ""}`;

      void logger.info("Jellyfin URL generated successfully", {
        title: recommendation.title,
        url,
      });

      return {
        success: true,
        url,
        message: `Found "${recommendation.title}" in Jellyfin`,
      };
    } catch (error) {
      void logger.error("Failed to get Jellyfin URL", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        message: `Failed to locate "${recommendation.title}" in Jellyfin`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add content to service (Sonarr/Radarr/Jellyseerr)
   * @param recommendation - Recommendation to add
   * @param service - Service to add to
   * @throws Error if offline or service unavailable
   * @deprecated Use addToSonarr, addToRadarr, or addToJellyseerr instead
   */
  async addToService(
    recommendation: Recommendation,
    service: "sonarr" | "radarr" | "jellyseerr",
  ): Promise<void> {
    const result = await (service === "sonarr"
      ? this.addToSonarr(recommendation)
      : service === "radarr"
        ? this.addToRadarr(recommendation)
        : this.addToJellyseerr(recommendation));

    if (!result.success) {
      throw new RecommendationError(
        result.message,
        result.error || "SERVICE_ERROR",
        false,
      );
    }
  }

  /**
   * Check availability of content (requires network)
   * @param recommendation - Recommendation to check
   * @throws Error if offline
   */
  async checkContentAvailability(recommendation: Recommendation): Promise<{
    inLibrary: boolean;
    inQueue: boolean;
    availableServices: ("sonarr" | "radarr" | "jellyseerr")[];
  }> {
    if (this.isOfflineMode) {
      throw new RecommendationError(
        "Cannot check availability while offline",
        "OFFLINE_ACTION_DISABLED",
        false,
      );
    }

    return await this.checkAvailability(recommendation);
  }

  /**
   * Get rate limit statistics for a user
   * @param userId - User ID
   * @returns Rate limit statistics
   */
  getRateLimitStats(userId: string): {
    requestsInLastMinute: number;
    requestsInLastHour: number;
    remainingMinute: number;
    remainingHour: number;
    isRateLimited: boolean;
    resetAt: number | null;
  } {
    return this.rateLimiter.getStats(userId);
  }

  /**
   * Get performance statistics
   * @param timeWindowMs - Time window to analyze (default: last 24 hours)
   * @returns Performance statistics for all operations
   */
  async getPerformanceStats(timeWindowMs?: number): Promise<Map<string, any>> {
    return this.performanceMonitor.getAllStats(timeWindowMs);
  }

  /**
   * Log performance summary
   * @param timeWindowMs - Time window to analyze (default: last 24 hours)
   */
  async logPerformanceSummary(timeWindowMs?: number): Promise<void> {
    return this.performanceMonitor.logPerformanceSummary(timeWindowMs);
  }

  // Private helper methods

  /**
   * Generate recommendations using AI
   */
  private async generateRecommendations(
    context: UserContext,
    limit: number,
    includeHiddenGems: boolean,
    notInterestedTitles: string[] = [],
  ): Promise<RecommendationResponseData["recommendations"]> {
    const userId = context.watchHistory[0]?.title || "user";

    try {
      // Check rate limit before making AI request
      await this.rateLimiter.checkRateLimit(userId);

      // Format context for prompt
      const contextPrompt = this.contextBuilder.formatContextForPrompt(context);

      // Get learned weights
      const weights = await this.learningService.getAdjustedWeights(userId);

      // Build prompt
      const prompt = this.buildRecommendationPrompt(
        contextPrompt,
        limit,
        includeHiddenGems,
        context,
        weights,
        notInterestedTitles,
      );

      const systemPrompt = this.buildSystemPrompt();

      // Get AI settings
      const settingsStore = useSettingsStore.getState();
      const {
        recommendationProvider,
        recommendationModel,
        recommendationKeyId,
      } = settingsStore;

      // Call AI service with retry logic
      void logger.debug("Calling AI service for recommendations", {
        provider: recommendationProvider,
        model: recommendationModel,
      });
      const result = await this.callAIWithRetry(
        userId,
        RecommendationResponseSchema,
        prompt,
        systemPrompt,
        {
          provider: recommendationProvider,
          model: recommendationModel,
          keyId: recommendationKeyId,
        },
      );

      // Add IDs to recommendations
      const recommendations = (result.object as any).recommendations.map(
        (rec: any, index: number) => ({
          ...rec,
          id: `rec_${Date.now()}_${index}`,
        }),
      );

      void logger.info("AI recommendations generated", {
        count: recommendations.length,
      });

      // Filter out any items the user explicitly marked not interested
      const filtered = recommendations.filter(
        (r: Recommendation) =>
          !notInterestedTitles.some(
            (title) => title.toLowerCase() === r.title.toLowerCase(),
          ),
      );

      if (filtered.length !== recommendations.length) {
        void logger.info("Filtered out not-interested recommendations", {
          userId,
          removed: recommendations.length - filtered.length,
        });
      }

      return filtered;
    } catch (error) {
      // If rate limited, throw specific error
      if (isRateLimitError(error)) {
        throw error;
      }

      void logger.error("Failed to generate recommendations", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AIServiceError(
        `Failed to generate recommendations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Call AI service with exponential backoff retry logic
   */
  private async callAIWithRetry(
    userId: string,
    schema: any,
    prompt: string,
    systemPrompt: string,
    options?: {
      provider?: string;
      model?: string;
      keyId?: string;
    },
    attempt: number = 0,
  ): Promise<any> {
    const maxAttempts = 3;

    try {
      return await this.aiService.generateObject(
        schema,
        prompt,
        systemPrompt,
        options,
      );
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        const backoffDelay = this.rateLimiter.getBackoffDelay(userId);

        void logger.warn("AI request failed, retrying with backoff", {
          userId,
          attempt: attempt + 1,
          maxAttempts,
          backoffDelay,
          error: error instanceof Error ? error.message : String(error),
        });

        // Wait for backoff delay
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));

        // Retry
        return this.callAIWithRetry(
          userId,
          schema,
          prompt,
          systemPrompt,
          options,
          attempt + 1,
        );
      }

      // Max attempts reached
      throw error;
    }
  }

  /**
   * Generate content gap recommendations
   */
  private async generateContentGaps(
    context: UserContext,
  ): Promise<Recommendation[]> {
    const userId = context.watchHistory[0]?.title || "user";

    try {
      // Check rate limit
      await this.rateLimiter.checkRateLimit(userId);

      const contextPrompt = this.contextBuilder.formatContextForPrompt(context);
      const prompt = this.buildContentGapPrompt(contextPrompt, context);
      const systemPrompt = this.buildSystemPrompt();

      // Get AI settings
      const settingsStore = useSettingsStore.getState();
      const {
        recommendationProvider,
        recommendationModel,
        recommendationKeyId,
      } = settingsStore;

      const result = await this.callAIWithRetry(
        userId,
        RecommendationResponseSchema,
        prompt,
        systemPrompt,
        {
          provider: recommendationProvider,
          model: recommendationModel,
          keyId: recommendationKeyId,
        },
      );

      // Add IDs to recommendations
      const gaps = (result.object as any).recommendations.map(
        (rec: any, index: number) => ({
          ...rec,
          id: `gap_${Date.now()}_${index}`,
        }),
      );

      return gaps;
    } catch (error) {
      // If rate limited, throw specific error
      if (isRateLimitError(error)) {
        throw error;
      }

      void logger.error("Failed to generate content gaps", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AIServiceError(
        `Failed to generate content gaps: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Enrich recommendations with availability information and poster URLs
   */
  private async enrichWithAvailability(
    recommendations: RecommendationResponseData["recommendations"],
  ): Promise<RecommendationResponseData["recommendations"]> {
    const enriched = await Promise.all(
      recommendations.map(async (rec) => {
        const [availability, posterUrl] = await Promise.all([
          this.checkAvailability(rec),
          this.fetchPosterUrl(rec),
        ]);

        return {
          ...rec,
          metadata: {
            ...rec.metadata,
            posterUrl: posterUrl || rec.metadata.posterUrl,
          },
          availability,
        };
      }),
    );

    return enriched;
  }

  /**
   * Fetch poster URL from TMDb or fallback to other services
   */
  private async fetchPosterUrl(
    recommendation: Recommendation,
  ): Promise<string | undefined> {
    try {
      // 1. Try TMDb first
      const { getTmdbConnector } = await import(
        "@/services/tmdb/TmdbConnectorProvider"
      );
      const tmdbConnector = await getTmdbConnector();

      if (tmdbConnector) {
        // Search for the content using searchMulti
        const searchQuery = recommendation.year
          ? `${recommendation.title} ${recommendation.year}`
          : recommendation.title;

        const timeout = new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), 10_000),
        );

        const searchPromise = tmdbConnector.searchMulti({
          query: searchQuery,
          page: 1,
        });
        const searchResponse = await Promise.race([searchPromise, timeout]);

        if (
          searchResponse &&
          searchResponse.results &&
          searchResponse.results.length > 0
        ) {
          // Find best match - filter by media type first
          const mediaTypeFilter =
            recommendation.type === "movie" ? "movie" : "tv";
          const filteredResults = searchResponse.results.filter(
            (item: any) => item.media_type === mediaTypeFilter,
          );

          const resultsToSearch =
            filteredResults.length > 0
              ? filteredResults
              : searchResponse.results;

          const match =
            resultsToSearch.find((item: any) => {
              const itemTitle = item.title || item.name || "";
              const itemYear = item.release_date
                ? parseInt(item.release_date.slice(0, 4), 10)
                : item.first_air_date
                  ? parseInt(item.first_air_date.slice(0, 4), 10)
                  : null;

              const titleMatch =
                itemTitle.toLowerCase() === recommendation.title.toLowerCase();
              const yearMatch =
                !recommendation.year || itemYear === recommendation.year;

              return titleMatch && yearMatch;
            }) || resultsToSearch[0];

          // Build poster URL
          const posterPath = match?.poster_path;
          if (posterPath) {
            return `https://image.tmdb.org/t/p/w500${posterPath}`;
          }
        }
      } else {
        void logger.debug(
          "No TMDb connector configured, skipping TMDB search",
          {
            title: recommendation.title,
          },
        );
      }

      // 2. Fallback to Sonarr/Radarr if TMDB failed or wasn't configured
      const connectorManager = ConnectorManager.getInstance();

      if (recommendation.type === "series" || recommendation.type === "anime") {
        const sonarrConnectors = connectorManager.getConnectorsByType("sonarr");
        for (const conn of sonarrConnectors) {
          try {
            const sonarr = conn as SonarrConnector;
            // Use a short timeout for the search
            const searchTimeout = new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 2000),
            );
            const searchPromise = sonarr.search(recommendation.title);
            const results = await Promise.race([searchPromise, searchTimeout]);

            if (results && results.length > 0) {
              const match = results.find(
                (s) =>
                  s.title.toLowerCase() === recommendation.title.toLowerCase(),
              );
              if (match?.posterUrl) return match.posterUrl;
              // If no exact match, try the first one if it looks reasonable?
              // Maybe risky. Let's stick to exact title match for now.
              if (results[0]?.posterUrl) return results[0].posterUrl;
            }
          } catch (e) {
            void logger.debug("Sonarr fallback search failed", {
              title: recommendation.title,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      } else if (recommendation.type === "movie") {
        const radarrConnectors = connectorManager.getConnectorsByType("radarr");
        for (const conn of radarrConnectors) {
          try {
            const radarr = conn as RadarrConnector;
            const searchTimeout = new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 2000),
            );
            const searchPromise = radarr.search(recommendation.title);
            const results = await Promise.race([searchPromise, searchTimeout]);

            if (results && results.length > 0) {
              const match = results.find(
                (m) =>
                  m.title.toLowerCase() ===
                    recommendation.title.toLowerCase() &&
                  (!recommendation.year || m.year === recommendation.year),
              );
              if (match?.posterUrl) return match.posterUrl;
              if (results[0]?.posterUrl) return results[0].posterUrl;
            }
          } catch (e) {
            void logger.debug("Radarr fallback search failed", {
              title: recommendation.title,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      return undefined;
    } catch (error) {
      void logger.debug("Failed to fetch poster URL", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Check availability of content across services
   */
  private async checkAvailability(recommendation: Recommendation): Promise<{
    inLibrary: boolean;
    inQueue: boolean;
    availableServices: ("sonarr" | "radarr" | "jellyseerr")[];
  }> {
    const availability = {
      inLibrary: false,
      inQueue: false,
      availableServices: [] as ("sonarr" | "radarr" | "jellyseerr")[],
    };

    try {
      const connectorManager = ConnectorManager.getInstance();

      // Check Jellyfin library
      const jellyfinConnectors =
        connectorManager.getConnectorsByType("jellyfin");
      if (jellyfinConnectors.length > 0) {
        const connector = jellyfinConnectors[0] as JellyfinConnector;
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 2000),
        );

        try {
          const searchPromise = connector.search(recommendation.title);
          const results = (await Promise.race([
            searchPromise,
            timeout,
          ])) as any[];

          if (results && results.length > 0) {
            availability.inLibrary = true;
          }
        } catch {
          void logger.debug("Jellyfin availability check failed", {
            title: recommendation.title,
          });
        }
      }

      // Check Sonarr for series
      if (recommendation.type === "series" || recommendation.type === "anime") {
        const sonarrConnectors = connectorManager.getConnectorsByType("sonarr");
        if (sonarrConnectors.length > 0) {
          availability.availableServices.push("sonarr");

          // Check if in queue
          const connector = sonarrConnectors[0] as SonarrConnector;
          try {
            const timeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 2000),
            );
            const queuePromise = connector.getQueue();
            const queue = (await Promise.race([queuePromise, timeout])) as any;

            if (queue && Array.isArray(queue.records)) {
              availability.inQueue = queue.records.some(
                (item: any) =>
                  item.title?.toLowerCase() ===
                  recommendation.title.toLowerCase(),
              );
            }
          } catch {
            void logger.debug("Sonarr queue check failed", {
              title: recommendation.title,
            });
          }
        }
      }

      // Check Radarr for movies
      if (recommendation.type === "movie") {
        const radarrConnectors = connectorManager.getConnectorsByType("radarr");
        if (radarrConnectors.length > 0) {
          availability.availableServices.push("radarr");

          // Check if in queue
          const connector = radarrConnectors[0] as RadarrConnector;
          try {
            const timeout = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 2000),
            );
            const queuePromise = connector.getQueue();
            const queue = (await Promise.race([queuePromise, timeout])) as any;

            if (queue && Array.isArray(queue.records)) {
              availability.inQueue = queue.records.some(
                (item: any) =>
                  item.title?.toLowerCase() ===
                  recommendation.title.toLowerCase(),
              );
            }
          } catch {
            void logger.debug("Radarr queue check failed", {
              title: recommendation.title,
            });
          }
        }
      }

      // Check for Jellyseerr
      const jellyseerrConnectors =
        connectorManager.getConnectorsByType("jellyseerr");
      if (jellyseerrConnectors.length > 0) {
        availability.availableServices.push("jellyseerr");
      }
    } catch (error) {
      void logger.warn("Availability check failed", {
        title: recommendation.title,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return availability;
  }

  /**
   * Build recommendation prompt
   */
  private buildRecommendationPrompt(
    contextPrompt: string,
    limit: number,
    includeHiddenGems: boolean,
    context: UserContext,
    weights: any,
    notInterestedTitles: string[] = [],
  ): string {
    const libraryTitles = context.watchHistory
      .map((item) => item.title)
      .join(", ");

    const dislikedGenres = context.preferences.dislikedGenres.join(", ");
    const contentRatingLimit =
      context.preferences.contentRatingLimit || "No limit";

    return `Generate personalized content recommendations for this user.

${contextPrompt}

REQUIREMENTS:
1. Generate ${limit} recommendations (3-10)
${includeHiddenGems ? '2. Include at least one "hidden gem" (popularity < 70th percentile, rating > 7.5)' : ""}
3. Provide match scores (0-100) based on:
   - Genre overlap (weight: ${weights.genreWeight.toFixed(0)}%)
   - Theme similarity (weight: ${weights.themeWeight.toFixed(0)}%)
   - Rating patterns (weight: ${weights.ratingWeight.toFixed(0)}%)
   - Content freshness (weight: ${weights.freshnessWeight.toFixed(0)}%)
   - Popularity (weight: ${weights.popularityWeight.toFixed(0)}%)
4. Explain each recommendation with specific references to watched content
5. Ensure variety across genres while respecting preferences
6. Consider content freshness (prefer recent releases when appropriate)

EXCLUSIONS:
- Do not recommend content already in library: ${libraryTitles || "None"}
- Avoid disliked genres: ${dislikedGenres || "None"}
- Respect content rating limit: ${contentRatingLimit}
${
  notInterestedTitles.length > 0
    ? `- Do not recommend items the user marked not interested: ${notInterestedTitles.join(", ")}`
    : ""
}

Provide recommendations in the specified JSON schema.`;
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(): string {
    return `You are an expert media recommendation engine for UniArr, a self-hosted media management platform.

Your role is to analyze user viewing patterns and generate highly personalized recommendations that:
- Match the user's demonstrated preferences
- Introduce variety without straying too far from their taste
- Explain reasoning clearly with specific examples
- Balance popular content with hidden gems
- Consider practical factors (availability, storage, quality)

When analyzing watch history:
- Pay attention to completion rates (completed shows indicate strong interest)
- Consider rating patterns (what they rate highly vs. what they drop)
- Identify theme preferences beyond just genres
- Notice viewing patterns (binge-watching, seasonal preferences)

When generating recommendations:
- Be specific in explanations (reference actual watched content)
- Provide match scores that reflect true compatibility
- Identify hidden gems that genuinely match their taste
- Consider the user's library constraints and preferences

Always output valid JSON matching the provided schema.`;
  }

  /**
   * Build content gap prompt
   */
  private buildContentGapPrompt(
    contextPrompt: string,
    context: UserContext,
  ): string {
    const libraryTitles = context.watchHistory
      .map((item) => item.title)
      .join(", ");

    return `Identify content gaps in this user's library.

${contextPrompt}

CURRENT LIBRARY:
${libraryTitles || "No library content"}

Identify 5-10 popular or critically acclaimed items that:
1. Match the user's favorite genres
2. Have ratings above 8.0
3. Are NOT in their current library
4. Would fill notable gaps in their collection
5. Are available through their configured services

Explain why each gap is significant and how it relates to their existing library.

Provide recommendations in the specified JSON schema.`;
  }
}

export default ContentRecommendationService;
