import { File, Directory } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  DownloadItem,
  DownloadManagerOptions,
  DownloadEvent,
  DownloadQueueConfig,
  DownloadStorageInfo,
  DownloadProgressData,
  DownloadResumable,
} from "@/models/download.types";
import { logger } from "@/services/logger/LoggerService";
import { DownloadNotificationService } from "./NotificationService";

/**
 * Utility type to make readonly properties mutable
 */
type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

/**
 * Get a safe download directory path using StorageAccessFramework patterns
 */
function getDownloadDirectory(): string {
  try {
    // Android: Use StorageAccessFramework scoped storage
    if (Platform.OS === "android") {
      // Prefer document directory for user-visible Downloads
      if (FileSystemLegacy.documentDirectory) {
        return `${FileSystemLegacy.documentDirectory}Downloads/`;
      }
      // Fallback to cache directory
      if (FileSystemLegacy.cacheDirectory) {
        return `${FileSystemLegacy.cacheDirectory}downloads/`;
      }
    } else if (Platform.OS === "ios") {
      // iOS: Use document directory which is accessible in Files app and iTunes File Sharing
      if (FileSystemLegacy.documentDirectory) {
        return `${FileSystemLegacy.documentDirectory}Downloads/`;
      }
      // Fallback to cache directory
      if (FileSystemLegacy.cacheDirectory) {
        return `${FileSystemLegacy.cacheDirectory}downloads/`;
      }
    } else {
      // Web or other platforms
      if (FileSystemLegacy.documentDirectory) {
        return `${FileSystemLegacy.documentDirectory}downloads/`;
      }
    }

    // Last resort fallback
    logger.warn("No system directory available, using relative path", {
      platform: Platform.OS,
    });
    return "./downloads/";
  } catch (error) {
    logger.error("Failed to determine download directory", {
      error: error instanceof Error ? error.message : String(error),
      platform: Platform.OS,
    });
    return "./downloads/";
  }
}

/**
 * Default download queue configuration
 */
const DEFAULT_CONFIG: DownloadQueueConfig = {
  maxConcurrentDownloads: 3,
  allowMobileData: false,
  allowBackgroundDownloads: true,
  defaultDownloadDirectory: getDownloadDirectory(),
  maxStorageUsage: 5 * 1024 * 1024 * 1024, // 5GB
};

/**
 * DownloadManager handles all download operations using expo-file-system
 */
export class DownloadManager {
  private readonly downloads: Map<string, DownloadItem> = new Map();
  private readonly downloadQueue: string[] = [];
  private readonly activeDownloads: Set<string> = new Set();
  private readonly downloadTasks: Map<string, DownloadResumable> = new Map();
  private readonly config: DownloadQueueConfig;
  private readonly onEvent?: (event: DownloadEvent) => void;
  private readonly progressUpdateInterval: number;
  private readonly enablePersistence: boolean;
  private progressUpdateTimers: Map<string, NodeJS.Timeout> = new Map();
  private notificationService: DownloadNotificationService;
  private lastProgressUpdate: Map<string, number> = new Map();
  private readonly progressThrottleMs: number = 1000; // Throttle progress updates to once per second

  constructor(options: DownloadManagerOptions = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.queueConfig };
    this.onEvent = options.onEvent;
    this.progressUpdateInterval = options.progressUpdateInterval ?? 1000;
    this.enablePersistence = options.enablePersistence ?? true;

    // Initialize notification service
    this.notificationService = DownloadNotificationService.getInstance();

    // Ensure download directory exists
    this.ensureDownloadDirectory();

    // Setup notifications
    this.setupNotifications();

    // Load saved state if persistence is enabled
    if (this.enablePersistence) {
      void this.loadState();
    }

    logger.info("DownloadManager initialized", {
      config: this.config,
      enablePersistence: this.enablePersistence,
    });
  }

  /**
   * Add a new download to the queue
   */
  async addDownload(
    downloadItem: Omit<DownloadItem, "id" | "state">,
  ): Promise<string> {
    const id = this.generateDownloadId();
    const now = new Date();

    const download: DownloadItem = {
      ...downloadItem,
      id,
      state: {
        status: "pending",
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: downloadItem.download.size ?? 0,
        downloadSpeed: 0,
        eta: 0,
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        maxRetries: 3,
        resumable: downloadItem.download.checksum !== undefined || true, // Assume resumable by default
      },
    };

    // Validate download path
    await this.validateDownloadPath(download.download.localPath);

    // Check storage space
    await this.checkStorageSpace(download);

    // Add to downloads map
    this.downloads.set(id, download);
    this.downloadQueue.push(id);

    // Save state if persistence is enabled
    if (this.enablePersistence) {
      await this.saveState();
    }

    // Emit event for the newly added download so the store can capture it
    this.emitEvent(
      {
        type: "downloadProgress",
        downloadId: id,
        progress: 0,
        bytesDownloaded: 0,
        speed: 0,
        eta: 0,
      },
      download,
    );

    this.emitEvent({
      type: "queueUpdated",
      queueSize: this.downloadQueue.length,
    });
    this.processQueue();

    logger.info("Download added to queue", {
      downloadId: id,
      title: download.content.title,
      queueSize: this.downloadQueue.length,
    });

    return id;
  }

  /**
   * Pause a download
   */
  async pauseDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error(`Download not found: ${downloadId}`);
    }

    if (download.state.status !== "downloading") {
      return;
    }

    const task = this.downloadTasks.get(downloadId);
    if (task) {
      try {
        await task.pauseAsync();
      } catch (error) {
        logger.warn("Failed to pause download task", {
          downloadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear progress timer
    const timer = this.progressUpdateTimers.get(downloadId);
    if (timer) {
      clearInterval(timer);
      this.progressUpdateTimers.delete(downloadId);
    }

    // Update download state
    this.updateDownloadState(downloadId, {
      status: "paused",
      downloadSpeed: 0,
      eta: 0,
    });

    this.activeDownloads.delete(downloadId);
    this.processQueue();

    this.emitEvent({ type: "downloadPaused", downloadId }, download);
    logger.info("Download paused", { downloadId });
  }

  /**
   * Resume a download
   */
  async resumeDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error(`Download not found: ${downloadId}`);
    }

    if (download.state.status !== "paused") {
      return;
    }

    this.updateDownloadState(downloadId, {
      status: "downloading",
      updatedAt: new Date(),
    });

    this.activeDownloads.add(downloadId);
    await this.startDownload(download);

    this.emitEvent({ type: "downloadResumed", downloadId }, download);
    logger.info("Download resumed", { downloadId });
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error(`Download not found: ${downloadId}`);
    }

    const task = this.downloadTasks.get(downloadId);
    if (task) {
      try {
        await task.pauseAsync();
      } catch (error) {
        logger.warn("Failed to pause download task during cancellation", {
          downloadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear progress timer
    const timer = this.progressUpdateTimers.get(downloadId);
    if (timer) {
      clearInterval(timer);
      this.progressUpdateTimers.delete(downloadId);
    }

    // Delete partial file
    try {
      const file = new File(download.download.localPath);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      logger.warn("Failed to delete partial download file", {
        downloadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Update state
    this.updateDownloadState(downloadId, {
      status: "cancelled",
      updatedAt: new Date(),
    });

    this.activeDownloads.delete(downloadId);
    this.downloadTasks.delete(downloadId);

    // Remove from queue if pending
    const queueIndex = this.downloadQueue.indexOf(downloadId);
    if (queueIndex !== -1) {
      this.downloadQueue.splice(queueIndex, 1);
    }

    this.processQueue();
    this.emitEvent({ type: "downloadCancelled", downloadId }, download);
    logger.info("Download cancelled", { downloadId });
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId: string): Promise<void> {
    const download = this.downloads.get(downloadId);
    if (!download) {
      throw new Error(`Download not found: ${downloadId}`);
    }

    if (download.state.status !== "failed") {
      return;
    }

    if (download.state.retryCount >= download.state.maxRetries) {
      throw new Error("Maximum retry attempts exceeded");
    }

    // Delete partial file if it exists
    try {
      const file = new File(download.download.localPath);
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      logger.warn("Failed to delete partial download file for retry", {
        downloadId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    this.updateDownloadState(downloadId, {
      status: "retrying",
      retryCount: download.state.retryCount + 1,
      progress: 0,
      bytesDownloaded: 0,
      downloadSpeed: 0,
      eta: 0,
      updatedAt: new Date(),
    });

    // Re-add to queue
    if (!this.downloadQueue.includes(downloadId)) {
      this.downloadQueue.push(downloadId);
    }

    this.emitEvent({
      type: "downloadRetrying",
      downloadId,
      attempt: download.state.retryCount + 1,
    });

    this.processQueue();
    logger.info("Download retry initiated", {
      downloadId,
      attempt: download.state.retryCount + 1,
    });
  }

  /**
   * Get download item by ID
   */
  getDownload(downloadId: string): DownloadItem | undefined {
    return this.downloads.get(downloadId);
  }

  /**
   * Get all downloads
   */
  getAllDownloads(): DownloadItem[] {
    return Array.from(this.downloads.values());
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): DownloadItem[] {
    return Array.from(this.activeDownloads)
      .map((id) => this.downloads.get(id))
      .filter((download): download is DownloadItem => download !== undefined);
  }

  /**
   * Get download statistics
   */
  getStats() {
    const downloads = this.getAllDownloads();
    const activeDownloads = this.getActiveDownloads();

    return {
      totalDownloads: downloads.length,
      activeDownloads: activeDownloads.length,
      completedDownloads: downloads.filter(
        (d) => d.state.status === "completed",
      ).length,
      failedDownloads: downloads.filter((d) => d.state.status === "failed")
        .length,
      totalBytesDownloaded: downloads.reduce(
        (sum, d) => sum + d.state.bytesDownloaded,
        0,
      ),
      currentDownloadSpeed: activeDownloads.reduce(
        (sum, d) => sum + d.state.downloadSpeed,
        0,
      ),
      storageUsed: downloads
        .filter((d) => d.state.status === "completed")
        .reduce((sum, d) => sum + (d.download.size || 0), 0),
      storageAvailable: 0, // Will be calculated in getStorageInfo
    };
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<DownloadStorageInfo> {
    try {
      // Use legacy API for storage info as new API doesn't have direct replacement yet
      const freeSpace = await FileSystemLegacy.getFreeDiskStorageAsync();
      const totalSpace = await FileSystemLegacy.getTotalDiskCapacityAsync();

      // Calculate used space by scanning download directory
      const usedSpace = await this.calculateDownloadDirectorySize();
      const fileCount = await this.countDownloadFiles();

      return {
        totalSpace,
        freeSpace,
        usedSpace,
        downloadDirectory: this.config.defaultDownloadDirectory,
        fileCount,
        largestFileSize: await this.findLargestDownloadedFile(),
      };
    } catch (error) {
      logger.error("Failed to get storage info", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to retrieve storage information");
    }
  }

  /**
   * Clear all completed downloads
   */
  async clearCompletedDownloads(): Promise<void> {
    const completedDownloads = this.getAllDownloads().filter(
      (d) => d.state.status === "completed",
    );

    for (const download of completedDownloads) {
      try {
        const file = new File(download.download.localPath);
        if (file.exists) {
          file.delete();
        }
        this.downloads.delete(download.id);
      } catch (error) {
        logger.warn("Failed to delete completed download file", {
          downloadId: download.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (this.enablePersistence) {
      await this.saveState();
    }

    logger.info("Cleared completed downloads", {
      count: completedDownloads.length,
    });
  }

  /**
   * Process the download queue
   */
  private async processQueue(): Promise<void> {
    while (
      this.activeDownloads.size < this.config.maxConcurrentDownloads &&
      this.downloadQueue.length > 0
    ) {
      const downloadId = this.downloadQueue.shift();
      if (!downloadId) continue;

      const download = this.downloads.get(downloadId);
      if (!download || download.state.status !== "pending") continue;

      this.activeDownloads.add(downloadId);
      await this.startDownload(download);
    }
  }

  /**
   * Start downloading a file
   */
  private async startDownload(download: DownloadItem): Promise<void> {
    try {
      // Create download resumable task using legacy API
      const downloadResumable = FileSystemLegacy.createDownloadResumable(
        download.download.sourceUrl,
        download.download.localPath,
        {},
        this.handleDownloadProgress.bind(this, download.id),
      );

      // Cast to our interface - both are compatible at runtime
      this.downloadTasks.set(
        download.id,
        downloadResumable as unknown as DownloadResumable,
      );

      // Start the download
      let result;
      try {
        result = await downloadResumable.downloadAsync();
      } catch (downloadError) {
        // Handle specific download errors
        const errorMessage =
          downloadError instanceof Error
            ? downloadError.message
            : String(downloadError);

        if (
          errorMessage.includes("network") ||
          errorMessage.includes("connection")
        ) {
          throw new Error(`Network error during download: ${errorMessage}`);
        } else if (
          errorMessage.includes("storage") ||
          errorMessage.includes("space")
        ) {
          throw new Error(`Storage error during download: ${errorMessage}`);
        } else if (
          errorMessage.includes("permission") ||
          errorMessage.includes("access")
        ) {
          throw new Error(`Permission error during download: ${errorMessage}`);
        } else {
          throw new Error(`Download failed: ${errorMessage}`);
        }
      }

      if (result && result.status === 200) {
        // Download completed successfully
        this.handleDownloadCompleted(download.id, result.uri);
      } else {
        throw new Error(
          `Download failed with status: ${result?.status || "unknown"}`,
        );
      }
    } catch (error) {
      this.handleDownloadError(download.id, error);
    }
  }

  /**
   * Handle download progress updates (throttled)
   */
  private handleDownloadProgress(
    downloadId: string,
    data: DownloadProgressData,
  ): void {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    const now = Date.now();
    const lastUpdate = this.lastProgressUpdate.get(downloadId) || 0;

    // Throttle updates to once per second to avoid excessive re-renders
    if (now - lastUpdate < this.progressThrottleMs) {
      return;
    }

    this.lastProgressUpdate.set(downloadId, now);

    // Ensure updatedAt is a Date instance (it might be a string or object from deserialization)
    const lastUpdateTime =
      download.state.updatedAt instanceof Date
        ? download.state.updatedAt
        : new Date(download.state.updatedAt);

    const timeDiff = (now - lastUpdateTime.getTime()) / 1000;
    const bytesDiff = data.totalBytesWritten - download.state.bytesDownloaded;
    const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
    const eta =
      speed > 0 && data.totalBytesExpectedToWrite > 0
        ? (data.totalBytesExpectedToWrite - data.totalBytesWritten) / speed
        : 0;

    const nowDate = new Date(now);

    this.updateDownloadState(downloadId, {
      status: "downloading",
      progress:
        data.totalBytesExpectedToWrite > 0
          ? data.totalBytesWritten / data.totalBytesExpectedToWrite
          : 0,
      bytesDownloaded: data.totalBytesWritten,
      totalBytes: data.totalBytesExpectedToWrite,
      downloadSpeed: speed,
      eta,
      updatedAt: nowDate,
    });

    this.emitEvent({
      type: "downloadProgress",
      downloadId,
      progress:
        data.totalBytesExpectedToWrite > 0
          ? data.totalBytesWritten / data.totalBytesExpectedToWrite
          : 0,
      bytesDownloaded: data.totalBytesWritten,
      speed,
      eta,
    });
  }

  /**
   * Handle download completion
   */
  private handleDownloadCompleted(downloadId: string, localPath: string): void {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    // Clear progress timer and task
    const timer = this.progressUpdateTimers.get(downloadId);
    if (timer) {
      clearInterval(timer);
      this.progressUpdateTimers.delete(downloadId);
    }
    this.downloadTasks.delete(downloadId);
    this.activeDownloads.delete(downloadId);

    // Update state
    this.updateDownloadState(downloadId, {
      status: "completed",
      progress: 1,
      completedAt: new Date(),
      downloadSpeed: 0,
      eta: 0,
      updatedAt: new Date(),
    });

    // Send notification
    this.sendCompletionNotification(download);

    // Process next item in queue
    this.processQueue();

    this.emitEvent(
      {
        type: "downloadCompleted",
        downloadId,
        localPath,
      },
      download,
    );

    logger.info("Download completed", {
      downloadId,
      title: download.content.title,
      localPath,
    });
  }

  /**
   * Handle download errors
   */
  private handleDownloadError(downloadId: string, error: unknown): void {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    // Skip error handling if download is already paused (error is likely from pause operation)
    if (download.state.status === "paused") {
      logger.debug(
        "Download error received but download is already paused, skipping error handling",
        {
          downloadId,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      return;
    }

    // Clear progress timer and task
    const timer = this.progressUpdateTimers.get(downloadId);
    if (timer) {
      clearInterval(timer);
      this.progressUpdateTimers.delete(downloadId);
    }
    this.downloadTasks.delete(downloadId);
    this.activeDownloads.delete(downloadId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const canRetry = download.state.retryCount < download.state.maxRetries;

    // Update state
    this.updateDownloadState(downloadId, {
      status: "failed",
      errorMessage,
      downloadSpeed: 0,
      eta: 0,
      updatedAt: new Date(),
    });

    // Process next item in queue
    this.processQueue();

    this.emitEvent(
      {
        type: "downloadFailed",
        downloadId,
        error: errorMessage,
        canRetry,
      },
      download,
    );

    logger.error("Download failed", {
      downloadId,
      title: download.content.title,
      error: errorMessage,
      canRetry,
    });
  }

  /**
   * Update download state
   */
  private updateDownloadState(
    downloadId: string,
    updates: Partial<DownloadItem["state"]>,
  ): void {
    const download = this.downloads.get(downloadId);
    if (!download) return;

    this.downloads.set(downloadId, {
      ...download,
      state: { ...download.state, ...updates },
    });

    if (this.enablePersistence) {
      // Debounce save state
      void this.saveStateDebounced();
    }
  }

  /**
   * Generate unique download ID
   */
  private generateDownloadId(): string {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Ensure download directory exists
   */
  private async ensureDownloadDirectory(): Promise<void> {
    try {
      const directoryPath = this.config.defaultDownloadDirectory;

      // Validate that we have an absolute path
      if (
        !directoryPath.startsWith("/") &&
        !directoryPath.startsWith("file://")
      ) {
        throw new Error(
          `Download directory path must be absolute, got: ${directoryPath}`,
        );
      }

      const directory = new Directory(directoryPath);
      if (!directory.exists) {
        logger.info("Creating download directory", { directoryPath });
        directory.create();
      } else {
        logger.debug("Download directory already exists", { directoryPath });
      }
    } catch (error) {
      logger.error("Failed to create download directory", {
        directory: this.config.defaultDownloadDirectory,
        error: error instanceof Error ? error.message : String(error),
      });

      // Attempt to create a fallback directory
      try {
        const fallbackDir = FileSystemLegacy.documentDirectory
          ? `${FileSystemLegacy.documentDirectory}downloads_fallback/`
          : null;
        if (fallbackDir) {
          logger.info("Attempting to create fallback download directory", {
            fallbackDir,
          });
          const directory = new Directory(fallbackDir);
          if (!directory.exists) {
            directory.create();
          }
          // Update config to use fallback directory
          // Note: config is readonly, so we cast to mutable for emergency fallback
          const mutableConfig = this.config as Mutable<DownloadQueueConfig>;
          mutableConfig.defaultDownloadDirectory = fallbackDir;
          logger.info("Fallback download directory created successfully", {
            fallbackDir,
          });
        }
      } catch (fallbackError) {
        logger.error("Failed to create fallback directory", {
          error:
            fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError),
        });
      }
    }
  }

  /**
   * Validate download path
   */
  private async validateDownloadPath(localPath: string): Promise<void> {
    try {
      if (!localPath || typeof localPath !== "string") {
        throw new Error("Download path is invalid or empty");
      }

      const parentDir = localPath.substring(0, localPath.lastIndexOf("/"));
      if (!parentDir) {
        throw new Error("Invalid download path - no parent directory");
      }

      const directory = new Directory(parentDir);

      if (!directory.exists) {
        try {
          directory.create();
          logger.debug("Created parent directory for download", { parentDir });
        } catch (mkdirError) {
          const errorMessage =
            mkdirError instanceof Error
              ? mkdirError.message
              : String(mkdirError);
          throw new Error(`Failed to create parent directory: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Download path validation failed", {
        localPath,
        error: errorMessage,
      });
      throw new Error(`Invalid download path: ${localPath} - ${errorMessage}`);
    }
  }

  /**
   * Check storage space before download
   */
  private async checkStorageSpace(download: DownloadItem): Promise<void> {
    try {
      let freeSpace = 0;
      try {
        freeSpace = await FileSystemLegacy.getFreeDiskStorageAsync();
      } catch (error) {
        logger.warn("Could not get free disk storage space", {
          error: error instanceof Error ? error.message : String(error),
        });
        // Use a conservative estimate
        freeSpace = 1024 * 1024 * 1024; // 1GB fallback
      }

      const requiredSpace = download.download.size ?? 100 * 1024 * 1024; // Default 100MB

      if (freeSpace < requiredSpace) {
        throw new Error(
          `Insufficient storage space. Required: ${this.formatBytes(requiredSpace)}, Available: ${this.formatBytes(freeSpace)}`,
        );
      }

      // Additional safety margin (10% of required space)
      const safetyMargin = requiredSpace * 0.1;
      if (freeSpace < requiredSpace + safetyMargin) {
        logger.warn("Low storage space - proceeding with caution", {
          requiredSpace: this.formatBytes(requiredSpace),
          availableSpace: this.formatBytes(freeSpace),
          safetyMargin: this.formatBytes(safetyMargin),
        });
      }

      // Check against configured limit
      const currentUsage = await this.calculateDownloadDirectorySize();
      if (currentUsage + requiredSpace > this.config.maxStorageUsage) {
        this.emitEvent({
          type: "storageWarning",
          usage: currentUsage,
          limit: this.config.maxStorageUsage,
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to check storage space");
    }
  }

  /**
   * Calculate download directory size
   */
  private async calculateDownloadDirectorySize(): Promise<number> {
    try {
      let totalSize = 0;

      try {
        const directory = new Directory(this.config.defaultDownloadDirectory);
        if (directory.exists) {
          const files = directory.list();

          for (const item of files) {
            if (!(item instanceof Directory)) {
              totalSize += item.size || 0;
            }
          }
        }
      } catch (error) {
        logger.debug("Could not calculate directory size", {
          directory: this.config.defaultDownloadDirectory,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return totalSize;
    } catch (error) {
      logger.error("Failed to calculate download directory size", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Count downloaded files
   */
  private async countDownloadFiles(): Promise<number> {
    try {
      let fileCount = 0;

      try {
        const directory = new Directory(this.config.defaultDownloadDirectory);
        if (directory.exists) {
          const files = directory.list();

          for (const item of files) {
            if (!(item instanceof Directory)) {
              fileCount++;
            }
          }
        }
      } catch (error) {
        logger.debug("Could not count download files", {
          directory: this.config.defaultDownloadDirectory,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return fileCount;
    } catch (error) {
      logger.error("Failed to count download files", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Find largest downloaded file
   */
  private async findLargestDownloadedFile(): Promise<number> {
    try {
      let largestFile = 0;

      try {
        const directory = new Directory(this.config.defaultDownloadDirectory);
        if (directory.exists) {
          const files = directory.list();

          for (const item of files) {
            if (!(item instanceof Directory)) {
              const size = item.size || 0;
              if (size > largestFile) {
                largestFile = size;
              }
            }
          }
        }
      } catch (error) {
        logger.debug("Could not find largest downloaded file", {
          directory: this.config.defaultDownloadDirectory,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      return largestFile;
    } catch (error) {
      logger.error("Failed to find largest downloaded file", {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Setup notifications
   */
  private async setupNotifications(): Promise<void> {
    try {
      await this.notificationService.initialize();
      logger.debug("Download notification service setup completed");
    } catch (error) {
      logger.warn("Failed to setup notifications", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send completion notification
   */
  private async sendCompletionNotification(
    download: DownloadItem,
  ): Promise<void> {
    try {
      if (this.notificationService) {
        await this.notificationService.handleDownloadEvent(
          {
            type: "downloadCompleted",
            downloadId: download.id,
            localPath: download.download.localPath,
          },
          download,
        );
      }
    } catch (error) {
      logger.warn("Failed to send completion notification", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Emit download event
   */
  private emitEvent(event: DownloadEvent, download?: DownloadItem): void {
    if (this.onEvent) {
      try {
        this.onEvent(event);
      } catch (error) {
        logger.error("Error in download event handler", {
          event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Handle notifications for specific events
    if (download) {
      void this.notificationService.handleDownloadEvent(event, download);
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
   * Save download state to persistent storage
   */
  private async saveState(): Promise<void> {
    if (!this.enablePersistence) return;

    try {
      const state = {
        downloads: Array.from(this.downloads.entries()),
        downloadQueue: this.downloadQueue,
        activeDownloads: Array.from(this.activeDownloads),
        config: this.config,
      };

      await AsyncStorage.setItem("downloadManagerState", JSON.stringify(state));
      logger.debug("Download state saved to storage", {
        downloadCount: this.downloads.size,
        queueSize: this.downloadQueue.length,
      });
    } catch (error) {
      logger.error("Failed to save download state", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Debounced version of saveState
   */
  private saveStateDebounced = (() => {
    let timeoutId: NodeJS.Timeout | null = null;

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        void this.saveState();
        timeoutId = null;
      }, 1000);
    };
  })();

  /**
   * Load saved download state from persistent storage
   */
  private async loadState(): Promise<void> {
    if (!this.enablePersistence) return;

    try {
      const savedState = await AsyncStorage.getItem("downloadManagerState");
      if (!savedState) return;

      const state = JSON.parse(savedState);

      // Restore downloads
      if (state.downloads && Array.isArray(state.downloads)) {
        this.downloads.clear();
        for (const [key, value] of state.downloads) {
          this.downloads.set(key, value);
        }
      }

      // Restore queue
      if (state.downloadQueue && Array.isArray(state.downloadQueue)) {
        this.downloadQueue.splice(
          0,
          this.downloadQueue.length,
          ...state.downloadQueue,
        );
      }

      // Restore active downloads
      if (state.activeDownloads && Array.isArray(state.activeDownloads)) {
        this.activeDownloads.clear();
        for (const item of state.activeDownloads) {
          this.activeDownloads.add(item);
        }
      }

      logger.info("Download state restored from storage", {
        downloadCount: this.downloads.size,
        queueSize: this.downloadQueue.length,
        activeCount: this.activeDownloads.size,
      });

      // Validate and cleanup orphaned downloads
      await this.validateRestoredDownloads();
    } catch (error) {
      logger.error("Failed to load download state", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Validate and cleanup restored downloads
   */
  private async validateRestoredDownloads(): Promise<void> {
    try {
      const downloadsToValidate = Array.from(this.downloads.values());

      for (const download of downloadsToValidate) {
        // Check if file still exists for completed downloads
        if (download.state.status === "completed") {
          try {
            const file = new File(download.download.localPath);
            if (!file.exists) {
              // Mark as failed if file doesn't exist
              this.updateDownloadState(download.id, {
                status: "failed",
                updatedAt: new Date(),
              });
              logger.warn("Restored download marked as failed - file missing", {
                downloadId: download.id,
                filePath: download.download.localPath,
              });
            }
          } catch (error) {
            logger.debug("Could not validate restored download file", {
              downloadId: download.id,
              filePath: download.download.localPath,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Reset active downloads that were interrupted
        if (download.state.status === "downloading") {
          this.activeDownloads.delete(download.id);
          this.updateDownloadState(download.id, {
            status: "paused",
            updatedAt: new Date(),
          });
          logger.info("Restored active download marked as paused", {
            downloadId: download.id,
          });
        }
      }
    } catch (error) {
      logger.error("Failed to validate restored downloads", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Cleanup method to be called when the manager is no longer needed
   */
  async cleanup(): Promise<void> {
    // Cancel all active downloads
    for (const downloadId of this.activeDownloads) {
      try {
        await this.cancelDownload(downloadId);
      } catch (error) {
        logger.warn("Failed to cancel download during cleanup", {
          downloadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Clear all timers
    for (const timer of this.progressUpdateTimers.values()) {
      clearInterval(timer);
    }
    this.progressUpdateTimers.clear();

    // Save final state
    if (this.enablePersistence) {
      await this.saveState();
    }

    logger.info("DownloadManager cleaned up");
  }
}
