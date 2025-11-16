/**
 * CacheInvalidationService
 *
 * Manages cache invalidation logic for recommendation caching.
 * Handles multiple invalidation triggers:
 * - Time-based (24 hours default)
 * - Watch history changes (3+ new items)
 * - Manual refresh requests
 * - Significant feedback pattern changes (10+ events with new patterns)
 */

import { RecommendationCache } from "./RecommendationCache";
import type {
  UserContext,
  FeedbackPattern,
} from "@/models/recommendation.types";
import type { FeedbackEvent } from "@/models/recommendation.schemas";

interface InvalidationMetadata {
  userId: string;
  lastWatchHistoryCount: number;
  lastFeedbackPatternHash: string;
  lastInvalidationTime: Date;
}

export class CacheInvalidationService {
  private static instance: CacheInvalidationService;
  private cache: RecommendationCache;
  private metadataCache: Map<string, InvalidationMetadata> = new Map();
  private readonly METADATA_KEY_PREFIX = "cache_invalidation_metadata:";

  private constructor() {
    this.cache = RecommendationCache.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): CacheInvalidationService {
    if (!CacheInvalidationService.instance) {
      CacheInvalidationService.instance = new CacheInvalidationService();
    }
    return CacheInvalidationService.instance;
  }

  /**
   * Check if cache should be invalidated based on age (24 hours default)
   * @param userId - User ID to check
   * @returns True if cache should be invalidated due to age
   */
  async shouldInvalidateByAge(userId: string): Promise<boolean> {
    try {
      const age = await this.cache.getAge(userId);

      if (age === null) {
        return false; // No cache exists
      }

      const config = this.cache.getConfig();
      const shouldInvalidate = age > config.maxAge;

      if (shouldInvalidate) {
        console.info(
          "[CacheInvalidationService] Cache invalidation triggered by age",
          {
            userId,
            age,
            maxAge: config.maxAge,
          },
        );
      }

      return shouldInvalidate;
    } catch (error) {
      console.error(
        "[CacheInvalidationService] Failed to check age-based invalidation",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
    }
  }

  /**
   * Check if cache should be invalidated based on watch history changes
   * @param userId - User ID to check
   * @param currentWatchHistoryCount - Current number of items in watch history
   * @returns True if cache should be invalidated due to watch history changes
   */
  async shouldInvalidateByWatchHistory(
    userId: string,
    currentWatchHistoryCount: number,
  ): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(userId);

      if (!metadata) {
        // First time checking, store current count
        await this.updateMetadata(userId, {
          lastWatchHistoryCount: currentWatchHistoryCount,
        });
        return false;
      }

      const config = this.cache.getConfig();
      const changeCount =
        currentWatchHistoryCount - metadata.lastWatchHistoryCount;
      const shouldInvalidate = changeCount >= config.minWatchHistoryChanges;

      if (shouldInvalidate) {
        console.info(
          "[CacheInvalidationService] Cache invalidation triggered by watch history",
          {
            userId,
            previousCount: metadata.lastWatchHistoryCount,
            currentCount: currentWatchHistoryCount,
            changeCount,
            threshold: config.minWatchHistoryChanges,
          },
        );

        // Update metadata after invalidation
        await this.updateMetadata(userId, {
          lastWatchHistoryCount: currentWatchHistoryCount,
        });
      }

      return shouldInvalidate;
    } catch (error) {
      console.error(
        "[CacheInvalidationService] Failed to check watch history invalidation",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
    }
  }

  /**
   * Handle manual refresh request (always invalidates)
   * @param userId - User ID to invalidate cache for
   */
  async invalidateManually(userId: string): Promise<void> {
    try {
      await this.cache.invalidate(userId);

      console.info("[CacheInvalidationService] Cache manually invalidated", {
        userId,
      });

      // Update metadata
      await this.updateMetadata(userId, {
        lastInvalidationTime: new Date(),
      });
    } catch (error) {
      console.error(
        "[CacheInvalidationService] Failed to manually invalidate cache",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      throw error;
    }
  }

  /**
   * Check if cache should be invalidated based on feedback pattern changes
   * @param userId - User ID to check
   * @param currentFeedbackPatterns - Current feedback patterns
   * @param recentFeedbackEvents - Recent feedback events (for counting)
   * @returns True if cache should be invalidated due to significant pattern changes
   */
  async shouldInvalidateByFeedbackPatterns(
    userId: string,
    currentFeedbackPatterns: FeedbackPattern[],
    recentFeedbackEvents: FeedbackEvent[],
  ): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(userId);
      const config = this.cache.getConfig();

      // Check if we have enough recent feedback events
      if (
        recentFeedbackEvents.length < config.minFeedbackEventsForInvalidation
      ) {
        return false;
      }

      // Generate hash of current patterns
      const currentPatternHash = this.hashFeedbackPatterns(
        currentFeedbackPatterns,
      );

      if (!metadata || !metadata.lastFeedbackPatternHash) {
        // First time checking, store current hash
        await this.updateMetadata(userId, {
          lastFeedbackPatternHash: currentPatternHash,
        });
        return false;
      }

      // Check if patterns have changed significantly
      const hasSignificantChange =
        metadata.lastFeedbackPatternHash !== currentPatternHash;

      if (hasSignificantChange) {
        // Verify that the change is actually significant by checking pattern differences
        const isSignificant = this.hasSignificantPatternChange(
          currentFeedbackPatterns,
          recentFeedbackEvents,
        );

        if (isSignificant) {
          console.info(
            "[CacheInvalidationService] Cache invalidation triggered by feedback patterns",
            {
              userId,
              feedbackEventCount: recentFeedbackEvents.length,
              patternCount: currentFeedbackPatterns.length,
            },
          );

          // Update metadata after invalidation
          await this.updateMetadata(userId, {
            lastFeedbackPatternHash: currentPatternHash,
          });

          return true;
        }
      }

      return false;
    } catch (error) {
      console.error(
        "[CacheInvalidationService] Failed to check feedback pattern invalidation",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
    }
  }

  /**
   * Comprehensive check for all invalidation conditions
   * @param userId - User ID to check
   * @param context - Current user context
   * @param recentFeedbackEvents - Recent feedback events
   * @returns True if cache should be invalidated for any reason
   */
  async shouldInvalidate(
    userId: string,
    context: UserContext,
    recentFeedbackEvents: FeedbackEvent[] = [],
  ): Promise<boolean> {
    try {
      // Check age-based invalidation
      if (await this.shouldInvalidateByAge(userId)) {
        await this.cache.invalidate(userId);
        return true;
      }

      // Check watch history changes
      if (
        await this.shouldInvalidateByWatchHistory(
          userId,
          context.watchHistory.length,
        )
      ) {
        await this.cache.invalidate(userId);
        return true;
      }

      // Check feedback pattern changes
      if (
        await this.shouldInvalidateByFeedbackPatterns(
          userId,
          context.feedbackPatterns,
          recentFeedbackEvents,
        )
      ) {
        await this.cache.invalidate(userId);
        return true;
      }

      return false;
    } catch (error) {
      console.error(
        "[CacheInvalidationService] Failed to check invalidation conditions",
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return false;
    }
  }

  /**
   * Reset invalidation metadata for a user
   * @param userId - User ID to reset
   */
  async resetMetadata(userId: string): Promise<void> {
    try {
      this.metadataCache.delete(userId);
      console.debug("[CacheInvalidationService] Metadata reset", { userId });
    } catch (error) {
      console.error("[CacheInvalidationService] Failed to reset metadata", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Private helper methods

  private async getMetadata(
    userId: string,
  ): Promise<InvalidationMetadata | null> {
    // Check in-memory cache first
    if (this.metadataCache.has(userId)) {
      return this.metadataCache.get(userId)!;
    }

    // For now, return null - in a full implementation, we'd persist this
    return null;
  }

  private async updateMetadata(
    userId: string,
    updates: Partial<InvalidationMetadata>,
  ): Promise<void> {
    const existing = this.metadataCache.get(userId) || {
      userId,
      lastWatchHistoryCount: 0,
      lastFeedbackPatternHash: "",
      lastInvalidationTime: new Date(),
    };

    const updated = { ...existing, ...updates };
    this.metadataCache.set(userId, updated);
  }

  private hashFeedbackPatterns(patterns: FeedbackPattern[]): string {
    // Create a stable hash of significant patterns
    const significantPatterns = patterns
      .filter((p) => p.sampleSize >= 5) // Only consider patterns with enough data
      .map((p) => ({
        factor: p.factor,
        acceptanceRate: Math.round(p.acceptanceRate * 100) / 100, // Round to 2 decimals
        sampleSize: p.sampleSize,
      }))
      .sort((a, b) => a.factor.localeCompare(b.factor));

    const patternString = JSON.stringify(significantPatterns);
    return this.simpleHash(patternString);
  }

  private hasSignificantPatternChange(
    patterns: FeedbackPattern[],
    recentEvents: FeedbackEvent[],
  ): boolean {
    // Check if there are new patterns with sufficient sample size
    const newSignificantPatterns = patterns.filter(
      (p) => p.sampleSize >= 10 && p.confidence > 0.6,
    );

    // If we have new significant patterns and recent feedback, consider it significant
    return newSignificantPatterns.length > 0 && recentEvents.length >= 10;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export default CacheInvalidationService;
