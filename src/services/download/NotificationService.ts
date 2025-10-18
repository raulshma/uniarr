import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { DownloadEvent, DownloadItem } from "@/models/download.types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Download notification service
 */
export class DownloadNotificationService {
  private static instance: DownloadNotificationService | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DownloadNotificationService {
    if (!DownloadNotificationService.instance) {
      DownloadNotificationService.instance = new DownloadNotificationService();
    }
    return DownloadNotificationService.instance;
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Notification service already initialized");
      return;
    }

    try {
      // Request notification permissions
      await this.requestPermissions();

      // Set up notification handler
      await this.setupNotificationHandler();

      this.isInitialized = true;
      logger.info("Download notification service initialized");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to initialize notification service", {
        error: message,
      });
      throw new Error(`Notification service initialization failed: ${message}`);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<void> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        logger.warn("Notification permissions not granted", { status });
        // Don't throw an error, just log it
      } else {
        logger.info("Notification permissions granted");
      }
    } catch (error) {
      logger.error("Failed to request notification permissions", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set up notification handler
   */
  private async setupNotificationHandler(): Promise<void> {
    try {
      await Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    } catch (error) {
      logger.error("Failed to setup notification handler", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle download events and show appropriate notifications
   */
  async handleDownloadEvent(
    event: DownloadEvent,
    download: DownloadItem,
  ): Promise<void> {
    if (!this.isInitialized) {
      logger.debug(
        "Notification service not initialized, skipping notification",
      );
      return;
    }

    try {
      switch (event.type) {
        case "downloadStarted":
          await this.showDownloadStartedNotification(download);
          break;
        case "downloadCompleted":
          await this.showDownloadCompletedNotification(
            download,
            event.localPath,
          );
          break;
        case "downloadFailed":
          await this.showDownloadFailedNotification(download, event.error);
          break;
        case "downloadPaused":
          await this.showDownloadPausedNotification(download);
          break;
        case "downloadResumed":
          await this.showDownloadResumedNotification(download);
          break;
        default:
          // Other events don't need notifications
          break;
      }
    } catch (error) {
      logger.error("Failed to handle download notification", {
        eventType: event.type,
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show download started notification
   */
  private async showDownloadStartedNotification(
    download: DownloadItem,
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Download Started",
          body: download.content.title,
          data: { downloadId: download.id, type: "downloadStarted" },
        },
        trigger: null,
      });

      logger.debug("Download started notification shown", {
        downloadId: download.id,
        title: download.content.title,
      });
    } catch (error) {
      logger.error("Failed to show download started notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show download completed notification
   */
  private async showDownloadCompletedNotification(
    download: DownloadItem,
    localPath: string,
  ): Promise<void> {
    try {
      const fileSize = download.download.size
        ? this.formatBytes(download.download.size)
        : "Unknown size";

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Download Completed",
          body: `${download.content.title} (${fileSize})`,
          data: {
            downloadId: download.id,
            type: "downloadCompleted",
            localPath,
          },
        },
        trigger: null,
      });

      // Update app badge if supported
      await this.updateBadge();

      logger.debug("Download completed notification shown", {
        downloadId: download.id,
        title: download.content.title,
        size: fileSize,
      });
    } catch (error) {
      logger.error("Failed to show download completed notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show download failed notification
   */
  private async showDownloadFailedNotification(
    download: DownloadItem,
    error: string,
  ): Promise<void> {
    try {
      const canRetry = download.state.retryCount < download.state.maxRetries;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Download Failed",
          body: `${download.content.title}${canRetry ? " (Tap to retry)" : ""}`,
          data: {
            downloadId: download.id,
            type: "downloadFailed",
            error,
            canRetry,
          },
        },
        trigger: null,
      });

      logger.debug("Download failed notification shown", {
        downloadId: download.id,
        title: download.content.title,
        error,
        canRetry,
      });
    } catch (error) {
      logger.error("Failed to show download failed notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show download paused notification
   */
  private async showDownloadPausedNotification(
    download: DownloadItem,
  ): Promise<void> {
    try {
      // Only show pause notification for long-running downloads
      if (download.state.bytesDownloaded > 10 * 1024 * 1024) {
        // > 10MB
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Download Paused",
            body: download.content.title,
            data: { downloadId: download.id, type: "downloadPaused" },
          },
          trigger: null,
        });
      }
    } catch (error) {
      logger.error("Failed to show download paused notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show download resumed notification
   */
  private async showDownloadResumedNotification(
    download: DownloadItem,
  ): Promise<void> {
    try {
      // Only show resume notification for previously paused downloads
      // This is typically not needed as the UI already shows the state change
    } catch (error) {
      logger.error("Failed to show download resumed notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show batch download summary notification
   */
  async showBatchSummaryNotification(
    completed: number,
    failed: number,
    totalDuration: number,
  ): Promise<void> {
    try {
      if (completed === 0 && failed === 0) {
        return;
      }

      let title = "Batch Download Summary";
      let body = "";

      if (completed > 0 && failed === 0) {
        body = `${completed} download${completed === 1 ? "" : "s"} completed`;
      } else if (completed === 0 && failed > 0) {
        body = `${failed} download${failed === 1 ? "" : "s"} failed`;
      } else {
        body = `${completed} completed, ${failed} failed`;
      }

      if (totalDuration > 0) {
        body += ` (${this.formatDuration(totalDuration)})`;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: "batchSummary", completed, failed, totalDuration },
        },
        trigger: null,
      });

      logger.debug("Batch summary notification shown", {
        completed,
        failed,
        totalDuration,
      });
    } catch (error) {
      logger.error("Failed to show batch summary notification", {
        completed,
        failed,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Show storage warning notification
   */
  async showStorageWarningNotification(
    usage: number,
    limit: number,
  ): Promise<void> {
    try {
      const percentage = (usage / limit) * 100;

      if (percentage > 90) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Storage Almost Full",
            body: `Downloads are using ${percentage.toFixed(1)}% of allocated storage`,
            data: { type: "storageWarning", usage, limit, percentage },
            priority: Notifications.AndroidNotificationPriority.HIGH,
          },
          trigger: null,
        });
      } else if (percentage > 80) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Storage Warning",
            body: `Downloads are using ${percentage.toFixed(1)}% of allocated storage`,
            data: { type: "storageWarning", usage, limit, percentage },
          },
          trigger: null,
        });
      }
    } catch (error) {
      logger.error("Failed to show storage warning notification", {
        usage,
        limit,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cancel all download notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.dismissAllNotificationsAsync();
      logger.debug("All download notifications cancelled");
    } catch (error) {
      logger.error("Failed to cancel all notifications", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cancel specific notification
   */
  async cancelNotification(identifier: string): Promise<void> {
    try {
      await Notifications.dismissNotificationAsync(identifier);
      logger.debug("Notification cancelled", { identifier });
    } catch (error) {
      logger.error("Failed to cancel notification", {
        identifier,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update app badge (iOS only)
   */
  private async updateBadge(): Promise<void> {
    try {
      if (Platform.OS === "ios") {
        // On iOS, the badge is updated automatically by the notification system
        // You can also manually set it if needed
        await Notifications.setBadgeCountAsync(0);
      }
    } catch (error) {
      logger.error("Failed to update badge", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Format duration to human readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Check if notifications are enabled
   */
  async checkNotificationPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === "granted";
    } catch (error) {
      logger.error("Failed to check notification permissions", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Cleanup the notification service
   */
  async cleanup(): Promise<void> {
    try {
      await this.cancelAllNotifications();
      this.isInitialized = false;
      logger.info("Download notification service cleaned up");
    } catch (error) {
      logger.error("Failed to cleanup notification service", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default DownloadNotificationService;
