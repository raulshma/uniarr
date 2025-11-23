import type {
  UserContext,
  WatchHistoryItem,
  LibraryStatistics,
  UserPreferences,
} from "@/models/recommendation.types";
import type { FeedbackPattern } from "@/models/recommendation.schemas";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { JellyfinConnector } from "@/connectors/implementations/JellyfinConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import { logger } from "@/services/logger/LoggerService";
import { ContextBuildError } from "./errors";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";
import { useSettingsStore } from "@/store/settingsStore";

const FEEDBACK_PATTERNS_KEY = "recommendation:feedback_patterns";
const WATCH_HISTORY_LIMIT = 100;

/**
 * Service responsible for building user context for recommendation generation.
 * Aggregates data from multiple sources (Jellyfin, Sonarr, Radarr, settings).
 */
export class RecommendationContextBuilder {
  private static instance: RecommendationContextBuilder | null = null;
  private storage: StorageBackendManager;

  private constructor() {
    this.storage = StorageBackendManager.getInstance();
  }

  static getInstance(): RecommendationContextBuilder {
    if (!RecommendationContextBuilder.instance) {
      RecommendationContextBuilder.instance =
        new RecommendationContextBuilder();
    }
    return RecommendationContextBuilder.instance;
  }

  /**
   * Build complete user context by aggregating data from all sources
   * Optimized with parallel fetching and timeout handling
   */
  async buildContext(userId: string): Promise<UserContext> {
    try {
      const startTime = Date.now();
      void logger.debug("Building recommendation context", { userId });

      // Fetch data from all sources in parallel with timeout handling
      const [watchHistory, libraryStats, preferences, feedbackPatterns] =
        await Promise.allSettled([
          this.getWatchHistory(userId),
          this.getLibraryStatisticsWithTimeout(userId),
          this.getUserPreferences(userId),
          this.getFeedbackPatterns(userId),
        ]);

      // Extract successful results or use defaults
      const context: UserContext = {
        watchHistory:
          watchHistory.status === "fulfilled" ? watchHistory.value : [],
        libraryStats:
          libraryStats.status === "fulfilled"
            ? libraryStats.value
            : this.getDefaultLibraryStats(),
        preferences:
          preferences.status === "fulfilled"
            ? preferences.value
            : this.getDefaultPreferences(),
        feedbackPatterns:
          feedbackPatterns.status === "fulfilled" ? feedbackPatterns.value : [],
      };

      // Log warnings for any failures
      if (watchHistory.status === "rejected") {
        void logger.warn("Failed to fetch watch history", {
          userId,
          error: watchHistory.reason,
        });
      }
      if (libraryStats.status === "rejected") {
        void logger.warn("Failed to fetch library statistics", {
          userId,
          error: libraryStats.reason,
        });
      }
      if (preferences.status === "rejected") {
        void logger.warn("Failed to fetch user preferences", {
          userId,
          error: preferences.reason,
        });
      }
      if (feedbackPatterns.status === "rejected") {
        void logger.warn("Failed to fetch feedback patterns", {
          userId,
          error: feedbackPatterns.reason,
        });
      }

      const buildTime = Date.now() - startTime;
      void logger.debug("Context built successfully", {
        userId,
        watchHistoryCount: context.watchHistory.length,
        libraryItemsCount: context.libraryStats.totalItems,
        feedbackPatternsCount: context.feedbackPatterns.length,
        buildTimeMs: buildTime,
      });

      return context;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to build recommendation context", {
        userId,
        error: message,
      });
      throw new ContextBuildError(
        `Failed to build recommendation context: ${message}`,
      );
    }
  }

  /**
   * Fetch watch history from Jellyfin connector
   * Limited to most recent 100 items for performance
   */
  async getWatchHistory(
    userId: string,
    limit: number = WATCH_HISTORY_LIMIT,
  ): Promise<WatchHistoryItem[]> {
    try {
      const connectorManager = ConnectorManager.getInstance();

      // Ensure connectors are loaded from storage before accessing them
      let jellyfinConnectors = connectorManager.getConnectorsByType("jellyfin");

      if (jellyfinConnectors.length === 0) {
        void logger.debug(
          "No Jellyfin connectors in memory, loading saved services",
        );
        await connectorManager.loadSavedServices();
        jellyfinConnectors = connectorManager.getConnectorsByType("jellyfin");
      }

      if (jellyfinConnectors.length === 0) {
        void logger.warn("No Jellyfin connector found for watch history");
        return [];
      }

      // Use the first Jellyfin connector
      const connector = jellyfinConnectors[0] as JellyfinConnector;

      // Get resume items (in-progress) and latest items (recently watched)
      const [resumeItems, latestItems] = await Promise.all([
        connector.getResumeItems(Math.floor(limit / 2)),
        connector.getLatestItems("", Math.floor(limit / 2)),
      ]);

      // Map Jellyfin items to WatchHistoryItem format
      const watchHistory: WatchHistoryItem[] = [];

      // Process resume items
      for (const item of resumeItems) {
        watchHistory.push({
          title: item.Name || "Unknown",
          year: item.ProductionYear || new Date().getFullYear(),
          type: this.mapJellyfinTypeToMediaType(item.Type),
          rating: item.CommunityRating ?? undefined,
          genres: item.Genres || [],
          completionStatus: "in-progress",
          watchDate: new Date(item.UserData?.LastPlayedDate || Date.now()),
        });
      }

      // Process latest items
      for (const item of latestItems) {
        watchHistory.push({
          title: item.Name || "Unknown",
          year: item.ProductionYear || new Date().getFullYear(),
          type: this.mapJellyfinTypeToMediaType(item.Type),
          rating: item.CommunityRating ?? undefined,
          genres: item.Genres || [],
          completionStatus: item.UserData?.Played ? "completed" : "in-progress",
          watchDate: new Date(item.DateCreated || Date.now()),
        });
      }

      // Sort by watch date (most recent first) and limit
      watchHistory.sort(
        (a, b) => b.watchDate.getTime() - a.watchDate.getTime(),
      );
      const limitedHistory = watchHistory.slice(0, limit);

      void logger.debug("Watch history fetched", {
        userId,
        count: limitedHistory.length,
      });

      return limitedHistory;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to fetch watch history", {
        userId,
        error: message,
      });
      throw new Error(`Failed to fetch watch history: ${message}`);
    }
  }

  /**
   * Aggregate library statistics from Sonarr and Radarr connectors with timeout
   */
  private async getLibraryStatisticsWithTimeout(
    userId: string,
  ): Promise<LibraryStatistics> {
    const timeout = new Promise<LibraryStatistics>((_, reject) =>
      setTimeout(
        () => reject(new Error("Library statistics fetch timeout")),
        2000,
      ),
    );

    return Promise.race([this.getLibraryStatistics(userId), timeout]);
  }

  /**
   * Aggregate library statistics from Sonarr and Radarr connectors
   * Optimized with parallel fetching for multiple services
   */
  async getLibraryStatistics(userId: string): Promise<LibraryStatistics> {
    try {
      const startTime = Date.now();
      const connectorManager = ConnectorManager.getInstance();

      // Ensure connectors are loaded from storage before accessing them
      let sonarrConnectors = connectorManager.getConnectorsByType("sonarr");
      let radarrConnectors = connectorManager.getConnectorsByType("radarr");

      if (sonarrConnectors.length === 0 && radarrConnectors.length === 0) {
        void logger.debug(
          "No media connectors in memory, loading saved services",
        );
        await connectorManager.loadSavedServices();
        sonarrConnectors = connectorManager.getConnectorsByType("sonarr");
        radarrConnectors = connectorManager.getConnectorsByType("radarr");
      }

      let totalItems = 0;
      const genreDistribution: Record<string, number> = {};
      let totalRating = 0;
      let ratedItemsCount = 0;
      let totalStorageUsed = 0;
      let totalStorageAvailable = 0;
      const qualityProfiles: string[] = [];

      // Fetch from all connectors in parallel with individual timeouts
      const sonarrPromises = sonarrConnectors.map((connector) =>
        this.fetchSonarrDataWithTimeout(connector as SonarrConnector),
      );
      const radarrPromises = radarrConnectors.map((connector) =>
        this.fetchRadarrDataWithTimeout(connector as RadarrConnector),
      );

      const [sonarrResults, radarrResults] = await Promise.all([
        Promise.allSettled(sonarrPromises),
        Promise.allSettled(radarrPromises),
      ]);

      // Process Sonarr results
      for (const result of sonarrResults) {
        if (result.status === "fulfilled" && result.value) {
          const { series } = result.value;
          totalItems += series.length;

          for (const show of series) {
            // Count genres
            if (show.genres) {
              for (const genre of show.genres) {
                genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
              }
            }

            // Track quality profiles
            if (show.qualityProfileId) {
              qualityProfiles.push(`Profile ${show.qualityProfileId}`);
            }

            // Aggregate storage
            if (show.totalSizeOnDiskMB) {
              totalStorageUsed += show.totalSizeOnDiskMB * 1024 * 1024;
            }
          }
        } else if (result.status === "rejected") {
          void logger.warn("Failed to fetch series from Sonarr connector", {
            error: result.reason,
          });
        }
      }

      // Process Radarr results
      for (const result of radarrResults) {
        if (result.status === "fulfilled" && result.value) {
          const { movies } = result.value;
          totalItems += movies.length;

          for (const movie of movies) {
            // Count genres
            if (movie.genres) {
              for (const genre of movie.genres) {
                genreDistribution[genre] = (genreDistribution[genre] || 0) + 1;
              }
            }

            // Aggregate ratings
            if (movie.ratings?.value) {
              totalRating += movie.ratings.value;
              ratedItemsCount++;
            }

            // Track quality profiles
            if (movie.qualityProfileId) {
              qualityProfiles.push(`Profile ${movie.qualityProfileId}`);
            }

            // Aggregate storage
            if (movie.statistics?.sizeOnDisk) {
              totalStorageUsed += movie.statistics.sizeOnDisk;
            }
          }
        } else if (result.status === "rejected") {
          void logger.warn("Failed to fetch movies from Radarr connector", {
            error: result.reason,
          });
        }
      }

      // Calculate average rating
      const averageRating =
        ratedItemsCount > 0 ? totalRating / ratedItemsCount : 0;

      // Determine most common quality preference
      const qualityPreference = this.getMostCommonQuality(qualityProfiles);

      // Estimate available storage
      totalStorageAvailable = Math.max(
        totalStorageUsed * 0.5,
        100 * 1024 * 1024 * 1024,
      );

      const stats: LibraryStatistics = {
        totalItems,
        genreDistribution,
        averageRating,
        qualityPreference,
        storageUsed: totalStorageUsed,
        storageAvailable: totalStorageAvailable,
      };

      const fetchTime = Date.now() - startTime;
      void logger.debug("Library statistics aggregated", {
        userId,
        totalItems,
        genreCount: Object.keys(genreDistribution).length,
        averageRating,
        fetchTimeMs: fetchTime,
      });

      return stats;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to aggregate library statistics", {
        userId,
        error: message,
      });
      throw new Error(`Failed to aggregate library statistics: ${message}`);
    }
  }

  /**
   * Fetch Sonarr data with timeout
   */
  private async fetchSonarrDataWithTimeout(
    connector: SonarrConnector,
  ): Promise<{ series: any[] }> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Sonarr fetch timeout")), 2000),
    );

    const fetchPromise = connector.getSeries().then((series) => ({ series }));

    return Promise.race([fetchPromise, timeout]);
  }

  /**
   * Fetch Radarr data with timeout
   */
  private async fetchRadarrDataWithTimeout(
    connector: RadarrConnector,
  ): Promise<{ movies: any[] }> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Radarr fetch timeout")), 2000),
    );

    const fetchPromise = connector.getMovies().then((movies) => ({ movies }));

    return Promise.race([fetchPromise, timeout]);
  }

  /**
   * Fetch user preferences from settings store
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    try {
      // Get preferences from settings store
      const settingsStore = useSettingsStore.getState();
      const { recommendationExcludedGenres, recommendationContentRatingLimit } =
        settingsStore;

      const preferences: UserPreferences = {
        favoriteGenres: [],
        dislikedGenres: recommendationExcludedGenres,
        preferredContentLength: "medium",
        languagePreference: "en",
        contentRatingLimit: recommendationContentRatingLimit,
      };

      void logger.debug("User preferences fetched", {
        userId,
        excludedGenres: recommendationExcludedGenres.length,
        contentRatingLimit: recommendationContentRatingLimit,
      });

      return preferences;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to fetch user preferences", {
        userId,
        error: message,
      });
      throw new Error(`Failed to fetch user preferences: ${message}`);
    }
  }

  /**
   * Retrieve learned feedback patterns from storage
   */
  async getFeedbackPatterns(userId: string): Promise<FeedbackPattern[]> {
    try {
      const key = `${FEEDBACK_PATTERNS_KEY}:${userId}`;
      const adapter = this.storage.getAdapter();
      const stored = await adapter.getItem(key);

      if (!stored) {
        return [];
      }

      const patterns = JSON.parse(stored) as FeedbackPattern[];

      void logger.debug("Feedback patterns retrieved", {
        userId,
        count: patterns.length,
      });

      return patterns;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to retrieve feedback patterns", {
        userId,
        error: message,
      });
      return [];
    }
  }

  /**
   * Format user context into a prompt string for AI
   */
  formatContextForPrompt(context: UserContext): string {
    const { watchHistory, libraryStats, preferences, feedbackPatterns } =
      context;

    // Format watch history
    const watchHistoryText = watchHistory
      .slice(0, 30) // Limit to 30 most recent for prompt
      .map(
        (item) =>
          `- ${item.title} (${item.year}) [${item.type}] - ${item.completionStatus} - Rating: ${item.rating || "N/A"} - Genres: ${item.genres.join(", ")}`,
      )
      .join("\n");

    // Format genre distribution
    const topGenres = Object.entries(libraryStats.genreDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([genre, count]) => `${genre} (${count})`)
      .join(", ");

    // Format feedback patterns
    const feedbackText =
      feedbackPatterns.length > 0
        ? feedbackPatterns
            .filter((p) => p.sampleSize >= 5) // Only include patterns with sufficient data
            .map(
              (p) =>
                `- ${p.factor}: ${(p.acceptanceRate * 100).toFixed(0)}% acceptance (${p.sampleSize} samples, ${(p.confidence * 100).toFixed(0)}% confidence)`,
            )
            .join("\n")
        : "No learned patterns yet";

    const prompt = `
USER PROFILE:

Watch History (last ${watchHistory.length} items):
${watchHistoryText || "No watch history available"}

LIBRARY STATISTICS:
- Total Items: ${libraryStats.totalItems}
- Top Genres: ${topGenres || "No genres available"}
- Average Rating: ${libraryStats.averageRating.toFixed(1)}/10
- Quality Preference: ${libraryStats.qualityPreference}
- Storage Used: ${(libraryStats.storageUsed / (1024 * 1024 * 1024)).toFixed(1)}GB
- Storage Available: ${(libraryStats.storageAvailable / (1024 * 1024 * 1024)).toFixed(1)}GB

USER PREFERENCES:
- Favorite Genres: ${preferences.favoriteGenres.join(", ") || "Not specified"}
- Disliked Genres: ${preferences.dislikedGenres.join(", ") || "None"}
- Preferred Content Length: ${preferences.preferredContentLength}
- Language Preference: ${preferences.languagePreference}
- Content Rating Limit: ${preferences.contentRatingLimit || "No limit"}

LEARNED PREFERENCES (from feedback):
${feedbackText}
`.trim();

    return prompt;
  }

  // Helper methods

  private mapJellyfinTypeToMediaType(
    type: string | undefined,
  ): "series" | "movie" | "anime" {
    if (!type) return "movie";

    const lowerType = type.toLowerCase();
    if (lowerType.includes("series") || lowerType.includes("episode")) {
      return "series";
    }
    if (lowerType.includes("anime")) {
      return "anime";
    }
    return "movie";
  }

  private getMostCommonQuality(profiles: string[]): string {
    if (profiles.length === 0) return "1080p";

    const counts: Record<string, number> = {};
    for (const profile of profiles) {
      counts[profile] = (counts[profile] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
    return sorted[0]?.[0] || "1080p";
  }

  private getDefaultLibraryStats(): LibraryStatistics {
    return {
      totalItems: 0,
      genreDistribution: {},
      averageRating: 0,
      qualityPreference: "1080p",
      storageUsed: 0,
      storageAvailable: 100 * 1024 * 1024 * 1024, // 100GB
    };
  }

  private getDefaultPreferences(): UserPreferences {
    return {
      favoriteGenres: [],
      dislikedGenres: [],
      preferredContentLength: "medium",
      languagePreference: "en",
      contentRatingLimit: undefined,
    };
  }
}
