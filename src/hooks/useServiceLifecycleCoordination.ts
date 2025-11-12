import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { webhookService } from "@/services/webhooks/WebhookService";
import { serviceHealthMonitor } from "@/services/notifications/ServiceHealthMonitor";
import { quietHoursService } from "@/services/notifications/QuietHoursService";
import { healthCheckService } from "@/services/bookmarks/HealthCheckService";
import { imageCacheService } from "@/services/image/ImageCacheService";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";
import { AIProviderManager } from "@/services/ai/core/AIProviderManager";

/**
 * Coordinates lifecycle of background services to prevent memory leaks
 *
 * Ensures proper initialization and cleanup of:
 * - AIProviderManager (loads stored AI provider configurations)
 * - WebhookService listeners and event queue
 * - ServiceHealthMonitor timers
 * - QuietHoursService pending flush timers
 * - HealthCheckService active health checks
 * - ImageCacheService memory and prefetch queue
 * - MMKV storage resources
 *
 * This hook manages services that consume memory and should clean up
 * when app goes to background or unmounts.
 *
 * Should be called once in the root layout alongside other lifecycle hooks.
 */
export const useServiceLifecycleCoordination = (): void => {
  // Initialize AI provider manager on first mount
  useEffect(() => {
    const initializeAIProviders = async () => {
      try {
        const providerManager = AIProviderManager.getInstance();
        await providerManager.initialize();
      } catch (error) {
        console.warn(
          "[ServiceLifecycleCoordination] Error initializing AI providers",
          error,
        );
      }
    };

    initializeAIProviders();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (status: AppStateStatus) => {
      if (status === "background" || status === "inactive") {
        // App going to background - gracefully stop resource-intensive services
        try {
          // Stop health monitor polling to save battery and memory
          serviceHealthMonitor.stop();
        } catch (error) {
          console.warn(
            "[ServiceLifecycleCoordination] Error stopping health monitor",
            error,
          );
        }
      } else if (status === "active") {
        // App coming to foreground - services typically auto-start as needed
        // (ApiLogger already has its own lifecycle via useApiLoggerLifecycle)
        try {
          // Optionally restart health monitor if needed by settings
          // This is managed separately by the notification system
        } catch (error) {
          console.warn(
            "[ServiceLifecycleCoordination] Error starting health monitor",
            error,
          );
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    // Cleanup on hook unmount - final teardown
    return () => {
      subscription.remove();

      // Final cleanup of all services
      try {
        // Stop all timers and listeners
        serviceHealthMonitor.stop();

        // Destroy webhook service resources (listeners, cleanup timer)
        webhookService.destroy();

        // Destroy quiet hours service resources (pending flush timers)
        quietHoursService.destroy();

        // Destroy health check service resources (active checks)
        healthCheckService.destroy();

        // Destroy image cache service resources (memory cache, prefetch queue)
        imageCacheService.destroy();

        // Destroy storage backend resources
        const storageManager = StorageBackendManager.getInstance();
        storageManager.destroy();
      } catch (error) {
        console.warn(
          "[ServiceLifecycleCoordination] Error during final cleanup",
          error,
        );
      }
    };
  }, []);
};
