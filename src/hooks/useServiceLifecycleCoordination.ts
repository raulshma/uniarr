import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { webhookService } from "@/services/webhooks/WebhookService";
import { serviceHealthMonitor } from "@/services/notifications/ServiceHealthMonitor";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";

/**
 * Coordinates lifecycle of background services to prevent memory leaks
 *
 * Ensures proper cleanup of:
 * - WebhookService listeners and event queue
 * - ServiceHealthMonitor timers
 * - MMKV storage resources
 *
 * This hook manages services that consume memory and should clean up
 * when app goes to background or unmounts.
 *
 * Should be called once in the root layout alongside other lifecycle hooks.
 */
export const useServiceLifecycleCoordination = (): void => {
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
        // (ApiErrorLogger already has its own lifecycle via useApiErrorLoggerLifecycle)
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
