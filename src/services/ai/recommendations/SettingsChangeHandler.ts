/**
 * Settings Change Handler
 *
 * Monitors recommendation settings changes and invalidates cache when
 * significant changes occur (excluded genres, content rating limit).
 */

import { useSettingsStore } from "@/store/settingsStore";
import { RecommendationCache } from "./RecommendationCache";
import { logger } from "@/services/logger/LoggerService";

export class SettingsChangeHandler {
  private static instance: SettingsChangeHandler;
  private cache: RecommendationCache;
  private previousExcludedGenres: string[] = [];
  private previousContentRatingLimit?: string;
  private unsubscribe?: () => void;

  private constructor() {
    this.cache = RecommendationCache.getInstance();
    this.initializeSettings();
  }

  static getInstance(): SettingsChangeHandler {
    if (!SettingsChangeHandler.instance) {
      SettingsChangeHandler.instance = new SettingsChangeHandler();
    }
    return SettingsChangeHandler.instance;
  }

  /**
   * Initialize settings tracking
   */
  private initializeSettings(): void {
    const state = useSettingsStore.getState();
    this.previousExcludedGenres = [...state.recommendationExcludedGenres];
    this.previousContentRatingLimit = state.recommendationContentRatingLimit;
  }

  /**
   * Start monitoring settings changes
   */
  startMonitoring(): void {
    if (this.unsubscribe) {
      void logger.warn("Settings change handler already monitoring");
      return;
    }

    this.unsubscribe = useSettingsStore.subscribe((state, prevState) => {
      this.handleSettingsChange(state, prevState);
    });

    void logger.info("Settings change handler started monitoring");
  }

  /**
   * Stop monitoring settings changes
   */
  stopMonitoring(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
      void logger.info("Settings change handler stopped monitoring");
    }
  }

  /**
   * Handle settings changes and invalidate cache if needed
   */
  private handleSettingsChange(
    state: ReturnType<typeof useSettingsStore.getState>,
    prevState: ReturnType<typeof useSettingsStore.getState>,
  ): void {
    const {
      recommendationExcludedGenres,
      recommendationContentRatingLimit,
      recommendationCacheDurationHours,
    } = state;

    let shouldInvalidate = false;
    const changes: string[] = [];

    // Check if excluded genres changed
    if (
      JSON.stringify(recommendationExcludedGenres) !==
      JSON.stringify(this.previousExcludedGenres)
    ) {
      shouldInvalidate = true;
      changes.push("excluded genres");
      this.previousExcludedGenres = [...recommendationExcludedGenres];
    }

    // Check if content rating limit changed
    if (recommendationContentRatingLimit !== this.previousContentRatingLimit) {
      shouldInvalidate = true;
      changes.push("content rating limit");
      this.previousContentRatingLimit = recommendationContentRatingLimit;
    }

    // Check if cache duration changed (no invalidation needed, just log)
    if (
      prevState.recommendationCacheDurationHours !==
      recommendationCacheDurationHours
    ) {
      void logger.info("Cache duration setting changed", {
        oldValue: prevState.recommendationCacheDurationHours,
        newValue: recommendationCacheDurationHours,
      });
    }

    // Invalidate cache if significant changes detected
    if (shouldInvalidate) {
      void logger.info("Significant recommendation settings changed", {
        changes,
      });
      void this.invalidateAllCaches();
    }
  }

  /**
   * Invalidate all recommendation caches
   * Note: In a real implementation, we'd need to track all user IDs
   * For now, we'll just log the intent
   */
  private async invalidateAllCaches(): Promise<void> {
    try {
      // In a production implementation, we would:
      // 1. Track all user IDs that have cached recommendations
      // 2. Invalidate each user's cache
      // For now, we'll just log the intent
      void logger.info("Cache invalidation triggered due to settings change", {
        note: "Individual user caches will be invalidated on next request",
      });

      // The cache will be automatically invalidated on next request
      // because the context hash will be different due to changed preferences
    } catch (error) {
      void logger.error("Failed to invalidate caches", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
