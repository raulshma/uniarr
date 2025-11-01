import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { useOfflineSync } from "./useOfflineSync";
import { useNetworkStatus } from "./useNetworkStatus";
import { useHaptics } from "./useHaptics";
import { mutationQueueService } from "@/services/storage/MutationQueueService";
import { logger } from "@/services/logger/LoggerService";

export interface OfflineActionOptions {
  /**
   * Whether to show user feedback when action is queued
   * @default true
   */
  showFeedback?: boolean;
  /**
   * Custom feedback message
   */
  feedbackMessage?: string;
  /**
   * Whether to queue the action when offline
   * @default true
   */
  queueWhenOffline?: boolean;
  /**
   * Maximum retry attempts
   * @default 3
   */
  maxRetries?: number;
}

export interface OfflineActionResult {
  /**
   * Whether the action was executed immediately
   */
  executedImmediately: boolean;
  /**
   * Whether the action was queued for later
   */
  queued: boolean;
  /**
   * Whether the action failed
   */
  failed: boolean;
  /**
   * Error message if failed
   */
  error?: string;
}

/**
 * Hook for performing offline-aware actions
 * Provides intelligent handling of actions when device is offline
 */
export const useOfflineAwareActions = () => {
  const { isOnline, queueMutationForOffline } = useOfflineSync();
  const {
    isConnected,
    isInternetReachable,
    type: networkType,
  } = useNetworkStatus();
  const { onError, onSuccess } = useHaptics();
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update queued count
  useEffect(() => {
    const updateQueuedCount = async () => {
      try {
        const mutations = await mutationQueueService.getPendingMutations();
        setQueuedCount(mutations.length);
      } catch (error) {
        void logger.debug("Failed to get queued mutations count", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    updateQueuedCount();

    // Set up periodic updates
    const interval = setInterval(updateQueuedCount, 5000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Execute an action with offline support
   */
  const executeAction = useCallback(
    async (
      action: () => Promise<any>,
      options: OfflineActionOptions = {},
    ): Promise<OfflineActionResult> => {
      const {
        showFeedback = true,
        feedbackMessage,
        queueWhenOffline = true,
      } = options;

      // If online, execute immediately
      if (isOnline) {
        try {
          await action();
          if (showFeedback) {
            onSuccess();
          }
          return {
            executedImmediately: true,
            queued: false,
            failed: false,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          if (showFeedback) {
            onError();
          }

          // If execution failed and queueing is enabled, queue for retry
          if (queueWhenOffline) {
            await queueMutationForOffline({
              mutationFn: action,
              queryKey: ["offline-action"],
              variables: {},
            });

            if (showFeedback) {
              Alert.alert(
                "Action Queued",
                feedbackMessage ||
                  "The action failed and has been queued to retry when you're back online.",
              );
            }

            return {
              executedImmediately: false,
              queued: true,
              failed: false,
              error: errorMessage,
            };
          }

          return {
            executedImmediately: false,
            queued: false,
            failed: true,
            error: errorMessage,
          };
        }
      }

      // If offline and queueing is enabled, queue the action
      if (queueWhenOffline) {
        try {
          await queueMutationForOffline({
            mutationFn: action,
            queryKey: ["offline-action"],
            variables: {},
          });

          if (showFeedback) {
            Alert.alert(
              "Action Queued",
              feedbackMessage ||
                "You're offline. This action has been queued and will execute when you're back online.",
            );
          }

          onError(); // Haptic feedback for offline state

          return {
            executedImmediately: false,
            queued: true,
            failed: false,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          return {
            executedImmediately: false,
            queued: false,
            failed: true,
            error: errorMessage,
          };
        }
      }

      // Offline and queuing disabled
      if (showFeedback) {
        Alert.alert(
          "Offline",
          feedbackMessage ||
            "You're offline. Please connect to the internet to perform this action.",
        );
      }

      onError();

      return {
        executedImmediately: false,
        queued: false,
        failed: false,
      };
    },
    [isOnline, queueMutationForOffline, onError, onSuccess],
  );

  /**
   * Check if an action can be performed
   */
  const canPerformAction = useCallback(
    (requireInternet = false): boolean => {
      if (requireInternet) {
        return isOnline === true; // Only allow when we explicitly know we're online
      }
      return Boolean(isConnected); // Allow local actions if device is connected to any network
    },
    [isOnline, isConnected],
  );

  /**
   * Get offline status information
   */
  const getOfflineStatus = useCallback(
    () => ({
      isOnline,
      isConnected,
      isInternetReachable,
      networkType,
      queuedCount,
      isSyncing,
    }),
    [
      isOnline,
      isConnected,
      isInternetReachable,
      networkType,
      queuedCount,
      isSyncing,
    ],
  );

  /**
   * Force sync of queued actions
   */
  const forceSync = useCallback(async () => {
    if (isOnline) {
      setIsSyncing(true);
      try {
        // This would trigger the sync process
        // The actual sync logic is in useOfflineSync
      } finally {
        setIsSyncing(false);
      }
    }
  }, [isOnline]);

  return {
    isOnline,
    isConnected,
    networkType,
    queuedCount,
    isSyncing,
    executeAction,
    canPerformAction,
    getOfflineStatus,
    forceSync,
  };
};
