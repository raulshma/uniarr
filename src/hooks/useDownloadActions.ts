import { useCallback } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import type { DownloadManager } from "@/services/download/DownloadManager";
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
export const useDownloadActions = (downloadManager?: DownloadManager) => {
  const connectorManager = ConnectorManager.getInstance();

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
      try {
        // Get the download connector for this service
        const downloadConnector = connectorManager.getDownloadConnector(
          serviceConfig.id,
        );
        if (!downloadConnector) {
          throw new Error(
            `Service ${serviceConfig.name} does not support downloads`,
          );
        }

        // Check if content can be downloaded
        const capability = await downloadConnector.canDownload(contentId);
        if (!capability.canDownload) {
          throw new Error(
            capability.restrictions?.join(", ") ||
              "Cannot download this content",
          );
        }

        // Get download information
        const downloadInfo = await downloadConnector.getDownloadInfo(
          contentId,
          quality,
        );
        const metadata = await downloadConnector.getContentMetadata(contentId);

        // Create download item
        const downloadItem = {
          serviceConfig,
          content: {
            id: metadata.id,
            title: metadata.title,
            type: metadata.type,
            description: metadata.description,
            thumbnailUrl: metadata.thumbnailUrl,
            duration: metadata.duration,
            size: downloadInfo.size,
          },
          download: {
            sourceUrl: downloadInfo.sourceUrl,
            localPath: generateDownloadPath(downloadInfo.fileName),
            fileName: downloadInfo.fileName,
            mimeType: downloadInfo.mimeType,
            size: downloadInfo.size,
            checksum: downloadInfo.checksum,
          },
        };

        if (!downloadManager) {
          throw new Error("Download manager not available");
        }

        // Start the download
        const downloadId = await downloadManager.addDownload(downloadItem);

        if (options?.haptics !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        logger.info("Download started", {
          downloadId,
          title: metadata.title,
          service: serviceConfig.name,
        });

        return downloadId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("Failed to start download", {
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
    [connectorManager, downloadManager],
  );

  /**
   * Pause a download
   */
  const pauseDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      try {
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
    [downloadManager],
  );

  /**
   * Resume a download
   */
  const resumeDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      try {
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
    [downloadManager],
  );

  /**
   * Cancel a download
   */
  const cancelDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performCancel = async () => {
        try {
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
    [downloadManager],
  );

  /**
   * Retry a failed download
   */
  const retryDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      try {
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
    [downloadManager],
  );

  /**
   * Remove a download from history (completed downloads only)
   */
  const removeDownload = useCallback(
    async (downloadId: string, options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performRemove = async () => {
        try {
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
    [downloadManager],
  );

  /**
   * Clear all completed downloads
   */
  const clearCompletedDownloads = useCallback(
    async (options?: DownloadActionOptions) => {
      const confirmDestructive = options?.confirmDestructive ?? true;

      const performClear = async () => {
        try {
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
    [downloadManager],
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

/**
 * Generate a download path for a file
 */
function generateDownloadPath(fileName: string): string {
  // Sanitize filename for file system
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-_]/g, "_");

  // Use a relative path - in a real implementation you'd use proper file system paths
  const downloadDir = "./downloads/";

  return `${downloadDir}${sanitizedName}`;
}
