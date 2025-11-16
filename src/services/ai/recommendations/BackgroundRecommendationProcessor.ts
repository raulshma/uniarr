/**
 * Background Recommendation Processor
 *
 * Handles background processing of recommendations during idle time.
 * Uses Expo BackgroundFetch to schedule periodic updates every 24 hours.
 *
 * Features:
 * - Precompute recommendations during idle time
 * - Schedule background updates every 24 hours
 * - Non-blocking UI operations
 * - Graceful error handling
 */

import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";
import { ContentRecommendationService } from "./ContentRecommendationService";
import { logger } from "@/services/logger/LoggerService";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";
import { useSettingsStore } from "@/store/settingsStore";

const BACKGROUND_FETCH_TASK = "background-recommendation-update";
const LAST_UPDATE_KEY = "recommendation:last_background_update";
const UPDATE_INTERVAL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Background processor for precomputing recommendations
 */
export class BackgroundRecommendationProcessor {
  private static instance: BackgroundRecommendationProcessor;
  private recommendationService: ContentRecommendationService;
  private storage: StorageBackendManager;
  private isRegistered: boolean = false;

  private constructor() {
    this.recommendationService = ContentRecommendationService.getInstance();
    this.storage = StorageBackendManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BackgroundRecommendationProcessor {
    if (!BackgroundRecommendationProcessor.instance) {
      BackgroundRecommendationProcessor.instance =
        new BackgroundRecommendationProcessor();
    }
    return BackgroundRecommendationProcessor.instance;
  }

  /**
   * Register background task for recommendation updates
   */
  async registerBackgroundTask(): Promise<void> {
    try {
      // Check if background updates are enabled in settings
      const settingsStore = useSettingsStore.getState();
      if (!settingsStore.recommendationBackgroundUpdatesEnabled) {
        void logger.info(
          "Background recommendation updates disabled in settings",
        );
        return;
      }

      // Check if task is already registered
      const isTaskRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_FETCH_TASK,
      );

      if (isTaskRegistered) {
        void logger.info("Background recommendation task already registered");
        this.isRegistered = true;
        return;
      }

      // Define the background task
      TaskManager.defineTask(
        BACKGROUND_FETCH_TASK,
        async (): Promise<BackgroundFetch.BackgroundFetchResult> => {
          try {
            void logger.info("Background recommendation update started");

            // Precompute recommendations for active users
            await this.precomputeRecommendations();

            // Update last update timestamp
            await this.updateLastUpdateTimestamp();

            void logger.info("Background recommendation update completed");

            return BackgroundFetch.BackgroundFetchResult.NewData;
          } catch (error) {
            void logger.error("Background recommendation update failed", {
              error: error instanceof Error ? error.message : String(error),
            });

            return BackgroundFetch.BackgroundFetchResult.Failed;
          }
        },
      );

      // Register the background fetch task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
        minimumInterval: UPDATE_INTERVAL, // 24 hours
        stopOnTerminate: false, // Continue after app termination
        startOnBoot: true, // Start on device boot
      });

      this.isRegistered = true;

      void logger.info("Background recommendation task registered", {
        interval: UPDATE_INTERVAL,
      });
    } catch (error) {
      void logger.error("Failed to register background task", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unregister background task
   */
  async unregisterBackgroundTask(): Promise<void> {
    try {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
      this.isRegistered = false;

      void logger.info("Background recommendation task unregistered");
    } catch (error) {
      void logger.error("Failed to unregister background task", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if background task is registered
   */
  isBackgroundTaskRegistered(): boolean {
    return this.isRegistered;
  }

  /**
   * Get status of background fetch
   */
  async getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
    try {
      const status = await BackgroundFetch.getStatusAsync();
      return status ?? BackgroundFetch.BackgroundFetchStatus.Denied;
    } catch (error) {
      void logger.error("Failed to get background fetch status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return BackgroundFetch.BackgroundFetchStatus.Denied;
    }
  }

  /**
   * Get last background update timestamp
   */
  async getLastUpdateTimestamp(): Promise<Date | null> {
    try {
      const adapter = this.storage.getAdapter();
      const timestamp = await adapter.getItem(LAST_UPDATE_KEY);

      if (!timestamp) {
        return null;
      }

      return new Date(parseInt(timestamp, 10));
    } catch (error) {
      void logger.error("Failed to get last update timestamp", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Manually trigger background update (for testing or user-initiated refresh)
   */
  async triggerManualUpdate(userId: string): Promise<void> {
    try {
      void logger.info("Manual background update triggered", {
        userId,
      });

      await this.precomputeRecommendationsForUser(userId);

      void logger.info("Manual background update completed", {
        userId,
      });
    } catch (error) {
      void logger.error("Manual background update failed", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Precompute recommendations for all active users
   * This runs in the background and should not block the UI
   */
  private async precomputeRecommendations(): Promise<void> {
    try {
      // Get list of active users (users with cached recommendations)
      const activeUsers = await this.getActiveUsers();

      void logger.info("Precomputing recommendations for active users", {
        count: activeUsers.length,
      });

      // Process users sequentially to avoid overwhelming the system
      for (const userId of activeUsers) {
        try {
          await this.precomputeRecommendationsForUser(userId);
        } catch (error) {
          // Log error but continue with other users
          void logger.warn("Failed to precompute for user, continuing", {
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      void logger.info("Precomputation completed for all users");
    } catch (error) {
      void logger.error("Failed to precompute recommendations", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Precompute recommendations for a specific user
   */
  private async precomputeRecommendationsForUser(
    userId: string,
  ): Promise<void> {
    try {
      void logger.debug("Precomputing recommendations for user", { userId });

      // Check if service is offline
      if (this.recommendationService.isOffline()) {
        void logger.debug("Skipping precomputation - offline", { userId });
        return;
      }

      // Check cache staleness
      const staleness =
        await this.recommendationService.checkCacheStaleness(userId);

      // Only precompute if cache is stale or doesn't exist
      if (staleness.shouldRefresh || staleness.cacheAge === null) {
        void logger.debug("Cache is stale, generating fresh recommendations", {
          userId,
          cacheAge: staleness.cacheAge,
        });

        // Generate fresh recommendations (this will cache them)
        await this.recommendationService.getRecommendations({
          userId,
          forceRefresh: true,
        });

        void logger.debug("Recommendations precomputed successfully", {
          userId,
        });
      } else {
        void logger.debug("Cache is still fresh, skipping precomputation", {
          userId,
          cacheAge: staleness.cacheAge,
        });
      }
    } catch (error) {
      void logger.error("Failed to precompute recommendations for user", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get list of active users (users with cached recommendations)
   */
  private async getActiveUsers(): Promise<string[]> {
    try {
      const adapter = this.storage.getAdapter();
      const allKeys = await adapter.getAllKeys();

      // Filter keys that match recommendation cache pattern
      const cacheKeys = allKeys.filter((key) =>
        key.startsWith("recommendation_cache:"),
      );

      // Extract user IDs from cache keys
      const userIds = cacheKeys.map((key) =>
        key.replace("recommendation_cache:", ""),
      );

      return userIds;
    } catch (error) {
      void logger.error("Failed to get active users", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update last update timestamp
   */
  private async updateLastUpdateTimestamp(): Promise<void> {
    try {
      const adapter = this.storage.getAdapter();
      await adapter.setItem(LAST_UPDATE_KEY, Date.now().toString());
    } catch (error) {
      void logger.error("Failed to update last update timestamp", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default BackgroundRecommendationProcessor;
