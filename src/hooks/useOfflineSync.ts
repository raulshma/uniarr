import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useNetworkStatus } from "./useNetworkStatus";
import { mutationQueueService } from "@/services/storage/MutationQueueService";
import { logger } from "@/services/logger/LoggerService";

interface OfflineSyncOptions {
  maxRetries?: number;
  retryDelay?: number;
}

export const useOfflineSync = (options: OfflineSyncOptions = {}) => {
  const { maxRetries = 3 } = options;
  const queryClient = useQueryClient();
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const isOnlineRef = useRef(false);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Initialize mutation queue service
    mutationQueueService.initialize();
  }, []);

  const processMutation = useCallback(
    async (queuedMutation: any) => {
      const { id, mutationFn, queryKey, retryCount } = queuedMutation;

      try {
        await logger.info("Executing queued mutation", {
          location: "useOfflineSync.processMutation",
          mutationId: id,
          queryKey: JSON.stringify(queryKey),
          retryCount,
        });

        // Execute the mutation
        await mutationFn();

        // Remove from queue on success
        await mutationQueueService.removeMutation(id);

        // Invalidate related queries
        if (queryKey && (queryKey as readonly unknown[]).length > 0) {
          queryClient.invalidateQueries({ queryKey });
        }

        await logger.info("Queued mutation executed successfully", {
          location: "useOfflineSync.processMutation",
          mutationId: id,
        });
      } catch (error) {
        await logger.error("Failed to execute queued mutation", {
          location: "useOfflineSync.processMutation",
          mutationId: id,
          retryCount,
          error: error instanceof Error ? error.message : String(error),
        });

        // Increment retry count and remove if max retries exceeded
        if (retryCount >= maxRetries - 1) {
          await mutationQueueService.removeMutation(id);
          await logger.warn("Removed mutation after max retries", {
            location: "useOfflineSync.processMutation",
            mutationId: id,
            maxRetries,
          });
        } else {
          await mutationQueueService.incrementRetryCount(id);
        }

        throw error;
      }
    },
    [queryClient, maxRetries],
  );

  const processQueuedMutations = useCallback(async () => {
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    mutationQueueService.setProcessingQueue(true);

    try {
      await logger.info(
        "Processing queued mutations after coming back online",
        {
          location: "useOfflineSync.processQueuedMutations",
        },
      );

      const pendingMutations = await mutationQueueService.getPendingMutations();

      if (pendingMutations.length === 0) {
        isProcessingRef.current = false;
        mutationQueueService.setProcessingQueue(false);
        return;
      }

      await logger.info(`Found ${pendingMutations.length} pending mutations`, {
        location: "useOfflineSync.processQueuedMutations",
        count: pendingMutations.length,
      });

      // Process mutations in parallel but limit concurrency
      const concurrencyLimit = 3;
      for (let i = 0; i < pendingMutations.length; i += concurrencyLimit) {
        const batch = pendingMutations.slice(i, i + concurrencyLimit);
        await Promise.all(batch.map(processMutation));
      }

      await logger.info("Finished processing all queued mutations", {
        location: "useOfflineSync.processQueuedMutations",
      });
    } catch (error) {
      await logger.error("Error processing queued mutations", {
        location: "useOfflineSync.processQueuedMutations",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isProcessingRef.current = false;
      mutationQueueService.setProcessingQueue(false);
    }
  }, [processMutation]);

  useEffect(() => {
    const wasOnline = isOnlineRef.current;
    const isNowOnline = isConnected === true && isInternetReachable === true;

    // Update online status
    isOnlineRef.current = isNowOnline;

    if (!wasOnline && isNowOnline && !isProcessingRef.current) {
      // Just came back online, process queued mutations
      processQueuedMutations();
    }
  }, [isConnected, isInternetReachable, processQueuedMutations]);

  const queueMutationForOffline = async (mutationOptions: {
    mutationFn: () => Promise<unknown>;
    queryKey: readonly unknown[];
    variables?: unknown;
  }) => {
    const { mutationFn, queryKey, variables } = mutationOptions;

    await mutationQueueService.addMutation({
      mutationFn,
      queryKey,
      variables,
      maxRetries,
    });

    await logger.info("Mutation queued for offline execution", {
      location: "useOfflineSync.queueMutationForOffline",
      queryKey: JSON.stringify(queryKey),
    });
  };

  return {
    isOnline: isConnected && isInternetReachable,
    queueMutationForOffline,
    processQueuedMutations,
  };
};
