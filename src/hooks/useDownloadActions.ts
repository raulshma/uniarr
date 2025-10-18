import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useDownloadService } from "@/services/download";
import { logger } from "@/services/logger/LoggerService";
import type { ServiceConfig } from "@/models/service.types";

/**
 * Download action types
 */
export type DownloadAction =
  | "pause"
  | "resume"
  | "cancel"
  | "retry"
  | "remove"
  | "clear";

/**
 * Download action options
 */
export interface DownloadActionOptions {
  /** Whether to show confirmation dialogs */
  confirmDestructive?: boolean;
  /** Whether to trigger haptic feedback */
  haptics?: boolean;
}

/**
 * Hook for managing download actions
 */
export const useDownloadActions = () => {
  const {
    isReady,
    getManager,
    startDownload: serviceStartDownload,
  } = useDownloadService();

  /**
   * Start a new download
   */
  const startDownload = useCallback(
    async (
      serviceConfig: ServiceConfig,
      contentId: string,
      quality?: string,
      options?: DownloadActionOptions,
    ) => {
      if (!isReady) {
        throw new Error("Download manager not available");
      }

      try {
        const downloadId = await serviceStartDownload(
          serviceConfig,
          contentId,
          quality,
        );

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        logger.info("Download started via actions", {
          downloadId,
          service: serviceConfig.name,
          contentId,
        });

        return downloadId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to start download via actions", {
          serviceId: serviceConfig.id,
          contentId,
          error: message,
        });

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        throw error;
      }
    },
    [isReady, serviceStartDownload],
  );

  /**
   * Pause a download
   */
  const pauseDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      if (!isReady) {
        throw new Error("Download manager not available");
      }

      try {
        const downloadManager = getManager();
        if (!downloadManager) {
          throw new Error("Download manager not available");
        }

        await downloadManager.pauseDownload(downloadId);

        if (options?.haptics !== false) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        logger.info("Download paused", { downloadId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to pause download", {
          downloadId,
          error: message,
        });

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        throw error;
      }
    },
    [isReady, getManager],
  );

  /**
   * Resume a download
   */
  const resumeDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      if (!isReady) {
        throw new Error("Download manager not available");
      }

      try {
        const downloadManager = getManager();
        if (!downloadManager) {
          throw new Error("Download manager not available");
        }

        await downloadManager.resumeDownload(downloadId);

        if (options?.haptics !== false) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        logger.info("Download resumed", { downloadId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to resume download", {
          downloadId,
          error: message,
        });

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        throw error;
      }
    },
    [isReady, getManager],
  );

  /**
   * Cancel a download
   */
  const cancelDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performCancel = async () => {
        if (!isReady) {
          throw new Error("Download manager not available");
        }

        try {
          const downloadManager = getManager();
          if (!downloadManager) {
            throw new Error("Download manager not available");
          }

          await downloadManager.cancelDownload(downloadId);

          if (options?.haptics !== false) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }

          logger.info("Download cancelled", { downloadId });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to cancel download", {
            downloadId,
            error: message,
          });

          if (options?.haptics !== false) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }

          throw error;
        }
      };

      if (confirmDestructive) {
        Alert.alert(
          "Cancel Download",
          "Are you sure you want to cancel this download? Any progress will be lost.",
          [
            {
              text: "Keep",
              style: "cancel",
            },
            {
              text: "Cancel",
              style: "destructive",
              onPress: performCancel,
            },
          ],
        );
      } else {
        await performCancel();
      }
    },
    [isReady, getManager],
  );

  /**
   * Retry a failed download
   */
  const retryDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      if (!isReady) {
        throw new Error("Download manager not available");
      }

      try {
        const downloadManager = getManager();
        if (!downloadManager) {
          throw new Error("Download manager not available");
        }

        await downloadManager.retryDownload(downloadId);

        if (options?.haptics !== false) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        logger.info("Download retry started", { downloadId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to retry download", {
          downloadId,
          error: message,
        });

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        throw error;
      }
    },
    [isReady, getManager],
  );

  /**
   * Remove a download from history (completed downloads only)
   */
  const removeDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performRemove = async () => {
        if (!isReady) {
          throw new Error("Download manager not available");
        }

        try {
          const downloadManager = getManager();
          if (!downloadManager) {
            throw new Error("Download manager not available");
          }

          // This would need to be implemented in DownloadManager
          // await downloadManager.removeDownload(downloadId);

          if (options?.haptics !== false) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }

          logger.info("Download removed from history", { downloadId });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to remove download", {
            downloadId,
            error: message,
          });

          if (options?.haptics !== false) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }

          throw error;
        }
      };

      if (confirmDestructive) {
        Alert.alert(
          "Remove Download",
          "Are you sure you want to remove this download from your history?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Remove",
              style: "destructive",
              onPress: performRemove,
            },
          ],
        );
      } else {
        await performRemove();
      }
    },
    [isReady, getManager],
  );

  /**
   * Clear all completed downloads
   */
  const clearCompletedDownloads = useCallback(
    async (options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performClear = async () => {
        if (!isReady) {
          throw new Error("Download manager not available");
        }

        try {
          const downloadManager = getManager();
          if (!downloadManager) {
            throw new Error("Download manager not available");
          }

          await downloadManager.clearCompletedDownloads();

          if (options?.haptics !== false) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }

          logger.info("Completed downloads cleared");
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error("Failed to clear completed downloads", {
            error: message,
          });

          if (options?.haptics !== false) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }

          throw error;
        }
      };

      if (confirmDestructive) {
        Alert.alert(
          "Clear Completed Downloads",
          "Are you sure you want to remove all completed downloads from your history?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Clear",
              style: "destructive",
              onPress: performClear,
            },
          ],
        );
      } else {
        await performClear();
      }
    },
    [isReady, getManager],
  );

  /**
   * Perform a generic download action
   */
  const performDownloadAction = useCallback(
    async (
      action: DownloadAction,
      downloadId: string,
      options?: DownloadActionOptions,
    ) => {
      switch (action) {
        case "pause":
          return pauseDownload(downloadId, options);
        case "resume":
          return resumeDownload(downloadId, options);
        case "cancel":
          return cancelDownload(downloadId, options);
        case "retry":
          return retryDownload(downloadId, options);
        case "remove":
          return removeDownload(downloadId, options);
        case "clear":
          return clearCompletedDownloads(options);
        default:
          throw new Error(`Unknown download action: ${action}`);
      }
    },
    [
      pauseDownload,
      resumeDownload,
      cancelDownload,
      retryDownload,
      removeDownload,
      clearCompletedDownloads,
    ],
  );

  return {
    startDownload,
    pauseDownload,
    resumeDownload,
    cancelDownload,
    retryDownload,
    removeDownload,
    clearCompletedDownloads,
    performDownloadAction,
  };
};
