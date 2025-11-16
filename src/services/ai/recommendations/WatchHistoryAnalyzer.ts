import type { WatchHistoryItem } from "@/models/recommendation.types";
import { logger } from "@/services/logger/LoggerService";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";

const ANALYTICS_CACHE_KEY = "recommendation:watch_history_analytics";

/**
 * Aggregated statistics from watch history analysis
 */
export interface WatchHistoryAnalytics {
  /** Favorite genres based on watch frequency and ratings */
  favoriteGenres: { genre: string; count: number; avgRating: number }[];
  /** Average rating per genre */
  averageRatingsByGenre: Record<string, number>;
  /** Completion rates by content type */
  completionRates: {
    series: number;
    movie: number;
    anime: number;
    overall: number;
  };
  /** Viewing patterns */
  viewingPatterns: {
    preferredContentLength: "short" | "medium" | "long";
    bingeWatchingBehavior: boolean;
    seasonalTrends: Record<string, number>;
  };
  /** When the analytics were last calculated */
  lastUpdated: Date;
}

/**
 * Service for analyzing watch history and identifying patterns
 */
export class WatchHistoryAnalyzer {
  private static instance: WatchHistoryAnalyzer | null = null;
  private storage: StorageBackendManager;

  private constructor() {
    this.storage = StorageBackendManager.getInstance();
  }

  static getInstance(): WatchHistoryAnalyzer {
    if (!WatchHistoryAnalyzer.instance) {
      WatchHistoryAnalyzer.instance = new WatchHistoryAnalyzer();
    }
    return WatchHistoryAnalyzer.instance;
  }

  /**
   * Analyze watch history and calculate aggregate statistics
   */
  async analyzeWatchHistory(
    userId: string,
    watchHistory: WatchHistoryItem[],
  ): Promise<WatchHistoryAnalytics> {
    try {
      void logger.debug("Analyzing watch history", {
        userId,
        itemCount: watchHistory.length,
      });

      // Calculate favorite genres
      const favoriteGenres = this.calculateFavoriteGenres(watchHistory);

      // Calculate average ratings per genre
      const averageRatingsByGenre =
        this.calculateAverageRatingsByGenre(watchHistory);

      // Calculate completion rates
      const completionRates = this.calculateCompletionRates(watchHistory);

      // Identify viewing patterns
      const viewingPatterns = this.identifyViewingPatterns(watchHistory);

      const analytics: WatchHistoryAnalytics = {
        favoriteGenres,
        averageRatingsByGenre,
        completionRates,
        viewingPatterns,
        lastUpdated: new Date(),
      };

      // Cache the analytics
      await this.cacheAnalytics(userId, analytics);

      void logger.debug("Watch history analysis complete", {
        userId,
        favoriteGenresCount: favoriteGenres.length,
        overallCompletionRate: completionRates.overall,
      });

      return analytics;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void logger.error("Failed to analyze watch history", {
        userId,
        error: message,
      });
      throw new Error(`Failed to analyze watch history: ${message}`);
    }
  }

  /**
   * Get cached analytics if available and recent
   */
  async getCachedAnalytics(
    userId: string,
  ): Promise<WatchHistoryAnalytics | null> {
    try {
      const key = `${ANALYTICS_CACHE_KEY}:${userId}`;
      const adapter = this.storage.getAdapter();
      const stored = await adapter.getItem(key);

      if (!stored) {
        return null;
      }

      const analytics = JSON.parse(stored) as WatchHistoryAnalytics;

      // Check if cache is still fresh (less than 24 hours old)
      const cacheAge = Date.now() - new Date(analytics.lastUpdated).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge > maxAge) {
        void logger.debug("Cached analytics expired", { userId, cacheAge });
        return null;
      }

      return analytics;
    } catch (error) {
      void logger.warn("Failed to retrieve cached analytics", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Calculate favorite genres based on watch frequency and ratings
   */
  private calculateFavoriteGenres(
    watchHistory: WatchHistoryItem[],
  ): { genre: string; count: number; avgRating: number }[] {
    const genreStats: Record<
      string,
      { count: number; totalRating: number; ratedCount: number }
    > = {};

    // Aggregate genre statistics
    for (const item of watchHistory) {
      if (!item.genres || item.genres.length === 0) continue;

      for (const genre of item.genres) {
        if (!genreStats[genre]) {
          genreStats[genre] = { count: 0, totalRating: 0, ratedCount: 0 };
        }

        genreStats[genre].count++;

        if (item.rating !== undefined) {
          genreStats[genre].totalRating += item.rating;
          genreStats[genre].ratedCount++;
        }
      }
    }

    // Calculate average ratings and sort by count
    const favoriteGenres = Object.entries(genreStats)
      .map(([genre, stats]) => ({
        genre,
        count: stats.count,
        avgRating:
          stats.ratedCount > 0 ? stats.totalRating / stats.ratedCount : 0,
      }))
      .sort((a, b) => {
        // Sort by count first, then by average rating
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return b.avgRating - a.avgRating;
      })
      .slice(0, 10); // Top 10 genres

    return favoriteGenres;
  }

  /**
   * Calculate average ratings per genre
   */
  private calculateAverageRatingsByGenre(
    watchHistory: WatchHistoryItem[],
  ): Record<string, number> {
    const genreRatings: Record<string, { total: number; count: number }> = {};

    for (const item of watchHistory) {
      if (!item.genres || item.genres.length === 0 || !item.rating) continue;

      for (const genre of item.genres) {
        if (!genreRatings[genre]) {
          genreRatings[genre] = { total: 0, count: 0 };
        }

        genreRatings[genre].total += item.rating;
        genreRatings[genre].count++;
      }
    }

    const averageRatings: Record<string, number> = {};
    for (const [genre, stats] of Object.entries(genreRatings)) {
      averageRatings[genre] = stats.count > 0 ? stats.total / stats.count : 0;
    }

    return averageRatings;
  }

  /**
   * Calculate completion rates by content type
   */
  private calculateCompletionRates(watchHistory: WatchHistoryItem[]): {
    series: number;
    movie: number;
    anime: number;
    overall: number;
  } {
    const stats = {
      series: { completed: 0, total: 0 },
      movie: { completed: 0, total: 0 },
      anime: { completed: 0, total: 0 },
    };

    for (const item of watchHistory) {
      const type = item.type;
      stats[type].total++;

      if (item.completionStatus === "completed") {
        stats[type].completed++;
      }
    }

    const totalCompleted =
      stats.series.completed + stats.movie.completed + stats.anime.completed;
    const totalItems =
      stats.series.total + stats.movie.total + stats.anime.total;

    return {
      series:
        stats.series.total > 0
          ? stats.series.completed / stats.series.total
          : 0,
      movie:
        stats.movie.total > 0 ? stats.movie.completed / stats.movie.total : 0,
      anime:
        stats.anime.total > 0 ? stats.anime.completed / stats.anime.total : 0,
      overall: totalItems > 0 ? totalCompleted / totalItems : 0,
    };
  }

  /**
   * Identify viewing patterns from watch history
   */
  private identifyViewingPatterns(watchHistory: WatchHistoryItem[]): {
    preferredContentLength: "short" | "medium" | "long";
    bingeWatchingBehavior: boolean;
    seasonalTrends: Record<string, number>;
  } {
    // Determine preferred content length based on series vs movies
    const seriesCount = watchHistory.filter(
      (item) => item.type === "series" || item.type === "anime",
    ).length;
    const movieCount = watchHistory.filter(
      (item) => item.type === "movie",
    ).length;

    let preferredContentLength: "short" | "medium" | "long" = "medium";
    if (movieCount > seriesCount * 2) {
      preferredContentLength = "short"; // Prefers movies (shorter content)
    } else if (seriesCount > movieCount * 2) {
      preferredContentLength = "long"; // Prefers series (longer content)
    }

    // Detect binge-watching behavior
    // If user watches multiple items in a short time period, they're a binge watcher
    const bingeWatchingBehavior = this.detectBingeWatching(watchHistory);

    // Analyze seasonal trends
    const seasonalTrends = this.analyzeSeasonalTrends(watchHistory);

    return {
      preferredContentLength,
      bingeWatchingBehavior,
      seasonalTrends,
    };
  }

  /**
   * Detect if user exhibits binge-watching behavior
   */
  private detectBingeWatching(watchHistory: WatchHistoryItem[]): boolean {
    if (watchHistory.length < 5) return false;

    // Sort by watch date
    const sorted = [...watchHistory].sort(
      (a, b) => b.watchDate.getTime() - a.watchDate.getTime(),
    );

    // Check if user watched 3+ items within a 24-hour period
    let bingeCount = 0;
    for (let i = 0; i < sorted.length - 2; i++) {
      const item1 = sorted[i];
      const item3 = sorted[i + 2];
      if (!item1 || !item3) continue;

      const timeDiff = item1.watchDate.getTime() - item3.watchDate.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      if (hoursDiff <= 24) {
        bingeCount++;
      }
    }

    // If more than 20% of watch sessions are binge sessions, mark as binge watcher
    return bingeCount > watchHistory.length * 0.2;
  }

  /**
   * Analyze seasonal viewing trends
   */
  private analyzeSeasonalTrends(
    watchHistory: WatchHistoryItem[],
  ): Record<string, number> {
    const seasonCounts: Record<string, number> = {
      winter: 0,
      spring: 0,
      summer: 0,
      fall: 0,
    };

    for (const item of watchHistory) {
      const month = item.watchDate.getMonth(); // 0-11
      let season: string = "fall"; // Default to fall

      if (month >= 11 || month <= 1) {
        season = "winter";
      } else if (month >= 2 && month <= 4) {
        season = "spring";
      } else if (month >= 5 && month <= 7) {
        season = "summer";
      } else {
        season = "fall";
      }

      const currentCount = seasonCounts[season] ?? 0;
      seasonCounts[season] = currentCount + 1;
    }

    return seasonCounts;
  }

  /**
   * Cache analytics to storage
   */
  private async cacheAnalytics(
    userId: string,
    analytics: WatchHistoryAnalytics,
  ): Promise<void> {
    try {
      const key = `${ANALYTICS_CACHE_KEY}:${userId}`;
      const adapter = this.storage.getAdapter();
      await adapter.setItem(key, JSON.stringify(analytics));

      void logger.debug("Analytics cached", { userId });
    } catch (error) {
      void logger.warn("Failed to cache analytics", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
