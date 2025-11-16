/**
 * RecommendationCache Service
 *
 * Manages caching of AI-generated recommendations using MMKV storage.
 * Implements cache validation based on age and context hash to ensure
 * recommendations stay relevant as user preferences evolve.
 *
 * Cache invalidation triggers:
 * - Age exceeds 24 hours (configurable)
 * - Context hash changes (user preferences/history changed)
 * - Manual invalidation request
 * - Significant feedback pattern changes
 */

import { StorageBackendManager } from "@/services/storage/MMKVStorage";
import type { CacheEntry, UserContext } from "@/models/recommendation.types";
import { useSettingsStore } from "@/store/settingsStore";

interface CacheConfig {
  /** Maximum cache age in milliseconds (default: 24 hours) */
  maxAge: number;
  /** Minimum watch history changes to invalidate cache (default: 3) */
  minWatchHistoryChanges: number;
  /** Minimum feedback events to trigger pattern-based invalidation (default: 10) */
  minFeedbackEventsForInvalidation: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  minWatchHistoryChanges: 3,
  minFeedbackEventsForInvalidation: 10,
};

export class RecommendationCache {
  private static instance: RecommendationCache;
  private storage = StorageBackendManager.getInstance();
  private config: CacheConfig;
  private readonly CACHE_KEY_PREFIX = "recommendation_cache:";
  private readonly VERSION = "1.0";

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance of RecommendationCache
   */
  static getInstance(config?: Partial<CacheConfig>): RecommendationCache {
    if (!RecommendationCache.instance) {
      RecommendationCache.instance = new RecommendationCache(config);
    }
    return RecommendationCache.instance;
  }

  /**
   * Retrieve cached recommendations for a user
   * @param userId - User ID to retrieve cache for
   * @returns Cached entry or null if not found or invalid
   */
  async get(userId: string): Promise<CacheEntry | null> {
    try {
      const key = this.getCacheKey(userId);
      const adapter = this.storage.getAdapter();
      const cached = await adapter.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry = JSON.parse(cached, this.dateReviver);

      // Validate cache version
      if (entry.version !== this.VERSION) {
        console.info(
          "[RecommendationCache] Cache version mismatch, invalidating",
          {
            userId,
            cachedVersion: entry.version,
            currentVersion: this.VERSION,
          },
        );
        await this.invalidate(userId);
        return null;
      }

      return entry;
    } catch (error) {
      console.error("[RecommendationCache] Failed to retrieve cache", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Store recommendations in cache
   * @param entry - Cache entry to store
   */
  async set(entry: CacheEntry): Promise<void> {
    try {
      const key = this.getCacheKey(entry.userId);
      const adapter = this.storage.getAdapter();

      // Ensure version is set
      const entryWithVersion: CacheEntry = {
        ...entry,
        version: this.VERSION,
      };

      await adapter.setItem(key, JSON.stringify(entryWithVersion));

      console.debug("[RecommendationCache] Cache stored successfully", {
        userId: entry.userId,
        recommendationCount: entry.recommendations.length,
        contextHash: entry.contextHash,
      });
    } catch (error) {
      console.error("[RecommendationCache] Failed to store cache", {
        userId: entry.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clear cached recommendations for a user
   * @param userId - User ID to invalidate cache for
   */
  async invalidate(userId: string): Promise<void> {
    try {
      const key = this.getCacheKey(userId);
      const adapter = this.storage.getAdapter();
      await adapter.removeItem(key);

      console.debug("[RecommendationCache] Cache invalidated", { userId });
    } catch (error) {
      console.error("[RecommendationCache] Failed to invalidate cache", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if cached recommendations are valid
   * @param userId - User ID to check
   * @param currentContextHash - Hash of current user context
   * @returns True if cache is valid, false otherwise
   */
  async isValid(userId: string, currentContextHash: string): Promise<boolean> {
    try {
      const entry = await this.get(userId);

      if (!entry) {
        return false;
      }

      // Get cache duration from settings store
      const settingsStore = useSettingsStore.getState();
      const cacheDurationMs =
        settingsStore.recommendationCacheDurationHours * 60 * 60 * 1000;

      // Check age
      const age = this.getAgeFromEntry(entry);
      if (age > cacheDurationMs) {
        console.debug("[RecommendationCache] Cache expired due to age", {
          userId,
          age,
          maxAge: cacheDurationMs,
        });
        return false;
      }

      // Check context hash
      if (entry.contextHash !== currentContextHash) {
        console.debug(
          "[RecommendationCache] Cache invalid due to context change",
          {
            userId,
            cachedHash: entry.contextHash,
            currentHash: currentContextHash,
          },
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("[RecommendationCache] Failed to validate cache", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get age of cached recommendations in milliseconds
   * @param userId - User ID to check
   * @returns Age in milliseconds or null if no cache exists
   */
  async getAge(userId: string): Promise<number | null> {
    try {
      const entry = await this.get(userId);

      if (!entry) {
        return null;
      }

      return this.getAgeFromEntry(entry);
    } catch (error) {
      console.error("[RecommendationCache] Failed to get cache age", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Generate hash from user context for cache validation
   * @param context - User context to hash
   * @returns Hash string
   */
  generateContextHash(context: UserContext): string {
    try {
      // Create a stable representation of the context
      const contextData = {
        watchHistoryCount: context.watchHistory.length,
        watchHistoryTitles: context.watchHistory
          .slice(0, 20) // Only hash recent 20 items
          .map((item) => `${item.title}:${item.year}`)
          .sort(),
        favoriteGenres: [...context.preferences.favoriteGenres].sort(),
        dislikedGenres: [...context.preferences.dislikedGenres].sort(),
        contentRatingLimit: context.preferences.contentRatingLimit,
        preferredContentLength: context.preferences.preferredContentLength,
        languagePreference: context.preferences.languagePreference,
        feedbackPatternCount: context.feedbackPatterns.length,
        // Include significant feedback patterns
        significantPatterns: context.feedbackPatterns
          .filter((p) => p.sampleSize >= 5)
          .map((p) => `${p.factor}:${p.acceptanceRate.toFixed(2)}`)
          .sort(),
      };

      const contextString = JSON.stringify(contextData);
      return this.hashString(contextString);
    } catch (error) {
      console.error("[RecommendationCache] Failed to generate context hash", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Return a timestamp-based hash as fallback to force regeneration
      return this.hashString(Date.now().toString());
    }
  }

  /**
   * Check if cache should be invalidated based on watch history changes
   * @param userId - User ID to check
   * @param newWatchHistoryCount - Current watch history count
   * @returns True if cache should be invalidated
   */
  async shouldInvalidateForWatchHistory(
    userId: string,
    newWatchHistoryCount: number,
  ): Promise<boolean> {
    try {
      const entry = await this.get(userId);

      if (!entry) {
        return false; // No cache to invalidate
      }

      // Extract watch history count from context hash metadata
      // This is a simplified check - in practice, we'd store this separately
      // For now, we'll rely on context hash changes to detect this
      return false;
    } catch (error) {
      console.error(
        "[RecommendationCache] Failed to check watch history invalidation",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
    }
  }

  /**
   * Update cache configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    console.debug("[RecommendationCache] Configuration updated", {
      config: this.config,
    });
  }

  /**
   * Get current cache configuration
   */
  getConfig(): Readonly<CacheConfig> {
    return { ...this.config };
  }

  /**
   * Clear all recommendation caches (for all users)
   */
  async clearAll(): Promise<void> {
    try {
      const adapter = this.storage.getAdapter();
      const allKeys = await adapter.getAllKeys();
      const cacheKeys = allKeys.filter((key) =>
        key.startsWith(this.CACHE_KEY_PREFIX),
      );

      await Promise.all(cacheKeys.map((key) => adapter.removeItem(key)));

      console.info("[RecommendationCache] All caches cleared", {
        count: cacheKeys.length,
      });
    } catch (error) {
      console.error("[RecommendationCache] Failed to clear all caches", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // Private helper methods

  private getCacheKey(userId: string): string {
    return `${this.CACHE_KEY_PREFIX}${userId}`;
  }

  private getAgeFromEntry(entry: CacheEntry): number {
    return Date.now() - entry.generatedAt.getTime();
  }

  private hashString(str: string): string {
    // Simple hash function for React Native compatibility
    // Using a basic implementation that works across platforms
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private dateReviver(key: string, value: any): any {
    // Revive Date objects from JSON
    if (typeof value === "string") {
      const datePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
      if (datePattern.test(value)) {
        return new Date(value);
      }
    }
    return value;
  }
}

export default RecommendationCache;
