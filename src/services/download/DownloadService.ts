import { DownloadManager } from "./DownloadManager";
import { useDownloadStore } from "@/store/downloadStore";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import type { ServiceConfig } from "@/models/service.types";
import type {
  DownloadItem,
  DownloadManagerOptions,
  DownloadEvent,
} from "@/models/download.types";
import { useState, useEffect } from "react";
import * as FileSystemLegacy from "expo-file-system/legacy";

/**
 * Global download service instance
 */
class DownloadService {
  private static instance: DownloadService | null = null;
  private downloadManager: DownloadManager | null = null;
  private isInitialized = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /**
   * Subscribe to initialization changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Initialize the download service
   */
  async initialize(options?: DownloadManagerOptions): Promise<void> {
    if (this.isInitialized) {
      logger.warn("Download service already initialized");
      return;
    }

    try {
      // Create event handler for download manager events
      const onEvent = (event: DownloadEvent) => {
        this.handleDownloadEvent(event);
      };

      // Create download manager with event handler
      this.downloadManager = new DownloadManager({
        ...options,
        onEvent,
      });

      // Connect to store for real-time updates
      this.connectToStore();

      this.isInitialized = true;
      logger.info("Download service initialized successfully");

      // Notify all subscribers
      this.notifyListeners();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to initialize download service", { error: message });
      throw new Error(`Download service initialization failed: ${message}`);
    }
  }

  /**
   * Get the download manager instance
   */
  getManager(): DownloadManager | null {
    return this.downloadManager;
  }

  /**
   * Check if the service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.downloadManager !== null;
  }

  /**
   * Start a download for content
   */
  async startDownload(
    serviceConfig: ServiceConfig,
    contentId: string,
    quality?: string,
    episodeIds?: string[],
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    try {
      const connectorManager = ConnectorManager.getInstance();
      const downloadConnector = connectorManager.getDownloadConnector(
        serviceConfig.id,
      );

      if (!downloadConnector) {
        throw new Error(
          `Service ${serviceConfig.name} does not support downloads`,
        );
      }

      // Check download capability
      const capability = await downloadConnector.canDownload(contentId);
      if (!capability.canDownload) {
        throw new Error(
          capability.restrictions?.join(", ") || "Cannot download this content",
        );
      }

      // If episodeIds are provided, create a download for each episode
      if (episodeIds && episodeIds.length > 0) {
        const downloadIds: string[] = [];

        for (const episodeId of episodeIds) {
          try {
            const downloadInfo = await downloadConnector.getDownloadInfo(
              episodeId,
              quality,
            );
            const metadata =
              await downloadConnector.getContentMetadata(episodeId);

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
                localPath: this.generateDownloadPath(downloadInfo.fileName),
                fileName: downloadInfo.fileName,
                mimeType: downloadInfo.mimeType,
                size: downloadInfo.size,
                checksum: downloadInfo.checksum,
              },
            };

            const downloadId =
              await this.downloadManager!.addDownload(downloadItem);
            downloadIds.push(downloadId);
          } catch (error) {
            logger.warn("Failed to queue episode download", {
              episodeId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (downloadIds.length === 0) {
          throw new Error("Failed to queue any episode downloads");
        }

        logger.info("Batch episode downloads started via service", {
          downloadIds,
          count: downloadIds.length,
          service: serviceConfig.name,
        });

        const firstDownloadId = downloadIds[0];
        if (!firstDownloadId) {
          throw new Error("Failed to get first download ID");
        }
        return firstDownloadId;
      }

      // Single content download (not a series)
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
          localPath: this.generateDownloadPath(downloadInfo.fileName),
          fileName: downloadInfo.fileName,
          mimeType: downloadInfo.mimeType,
          size: downloadInfo.size,
          checksum: downloadInfo.checksum,
        },
      };

      const downloadId = await this.downloadManager!.addDownload(downloadItem);
      logger.info("Download started via service", {
        downloadId,
        title: metadata.title,
        service: serviceConfig.name,
      });

      return downloadId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Failed to start download via service", {
        serviceId: serviceConfig.id,
        contentId,
        error: message,
      });
      throw error;
    }
  }

  /**
   * Pause a download
   */
  async pauseDownload(downloadId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    await this.downloadManager!.pauseDownload(downloadId);
  }

  /**
   * Resume a download
   */
  async resumeDownload(downloadId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    await this.downloadManager!.resumeDownload(downloadId);
  }

  /**
   * Cancel a download
   */
  async cancelDownload(downloadId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    await this.downloadManager!.cancelDownload(downloadId);
  }

  /**
   * Retry a failed download
   */
  async retryDownload(downloadId: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    await this.downloadManager!.retryDownload(downloadId);
  }

  /**
   * Clear completed downloads
   */
  async clearCompletedDownloads(): Promise<void> {
    if (!this.isReady()) {
      throw new Error("Download service not initialized");
    }

    await this.downloadManager!.clearCompletedDownloads();
  }

  /**
   * Get download statistics
   */
  getStats() {
    if (!this.isReady()) {
      return {
        totalDownloads: 0,
        activeDownloads: 0,
        completedDownloads: 0,
        failedDownloads: 0,
        totalBytesDownloaded: 0,
        currentDownloadSpeed: 0,
        storageUsed: 0,
        storageAvailable: 0,
      };
    }

    return this.downloadManager!.getStats();
  }

  /**
   * Get all downloads
   */
  getAllDownloads(): DownloadItem[] {
    if (!this.isReady()) {
      return [];
    }

    return this.downloadManager!.getAllDownloads();
  }

  /**
   * Get active downloads
   */
  getActiveDownloads(): DownloadItem[] {
    if (!this.isReady()) {
      return [];
    }

    return this.downloadManager!.getActiveDownloads();
  }

  /**
   * Cleanup the download service
   */
  async cleanup(): Promise<void> {
    if (this.downloadManager) {
      await this.downloadManager.cleanup();
      this.downloadManager = null;
    }
    this.isInitialized = false;
    logger.info("Download service cleaned up");

    // Notify all subscribers
    this.notifyListeners();
  }

  /**
   * Handle download manager events and sync with store
   */
  private handleDownloadEvent(event: DownloadEvent): void {
    const store = useDownloadStore.getState();

    try {
      switch (event.type) {
        case "queueUpdated":
          logger.debug("Queue updated", { queueSize: event.queueSize });
          break;

        case "downloadProgress": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            const existing = store.getDownloadById(event.downloadId);

            if (!existing) {
              store.updateDownload(event.downloadId, download);
            } else {
              store.updateDownloadProgress(event.downloadId, download.state);
            }
          }
          break;
        }

        case "downloadCompleted": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            store.updateDownload(event.downloadId, download);
            logger.info("Download completed - store synced", {
              downloadId: event.downloadId,
            });
          }
          break;
        }

        case "downloadFailed": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            store.updateDownload(event.downloadId, download);
            logger.warn("Download failed - store synced", {
              downloadId: event.downloadId,
            });
          }
          break;
        }

        case "downloadPaused": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            store.updateDownload(event.downloadId, download);
          }
          break;
        }

        case "downloadResumed": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            store.updateDownload(event.downloadId, download);
          }
          break;
        }

        case "downloadCancelled": {
          store.removeDownload(event.downloadId);
          break;
        }

        case "downloadRetrying": {
          const download = this.downloadManager?.getDownload(event.downloadId);
          if (download) {
            store.updateDownload(event.downloadId, download);
          }
          break;
        }

        default:
          break;
      }
    } catch (error) {
      logger.error("Error handling download event", {
        eventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Connect download manager to Zustand store
   */
  private connectToStore(): void {
    if (!this.downloadManager) return;

    // Set download manager reference in store
    useDownloadStore.getState().setDownloadManager(this.downloadManager);

    // Sync existing downloads from manager to store
    const downloads = this.downloadManager.getAllDownloads();
    for (const download of downloads) {
      useDownloadStore.getState().updateDownload(download.id, download);
    }

    logger.debug("Download manager connected to store", {
      downloadCount: downloads.length,
    });
  }

  /**
   * Generate download path for a file
   */
  private generateDownloadPath(fileName: string): string {
    // Sanitize filename for file system
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-_]/g, "_");

    // Get absolute path from document or cache directory
    const baseDir =
      FileSystemLegacy.cacheDirectory ||
      FileSystemLegacy.documentDirectory ||
      "";

    if (!baseDir) {
      logger.error("No valid file system directory available");
      throw new Error(
        "Cannot generate download path: no file system directory available",
      );
    }

    const downloadsDir = `${baseDir}downloads/`;
    return `${downloadsDir}${sanitizedName}`;
  }
}

/**
 * Convenience hook for accessing the download service
 */
export const useDownloadService = () => {
  const service = DownloadService.getInstance();
  const [isReady, setIsReady] = useState(() => service.isReady());

  useEffect(() => {
    // Update state immediately
    setIsReady(service.isReady());

    // Subscribe to future changes
    const unsubscribe = service.subscribe(() => {
      setIsReady(service.isReady());
    });

    return unsubscribe;
  }, [service]);

  return {
    service,
    isReady,
    getManager: () => service.getManager(),
    startDownload: (
      serviceConfig: ServiceConfig,
      contentId: string,
      quality?: string,
      episodeIds?: string[],
    ) => service.startDownload(serviceConfig, contentId, quality, episodeIds),
    pauseDownload: (downloadId: string) => service.pauseDownload(downloadId),
    resumeDownload: (downloadId: string) => service.resumeDownload(downloadId),
    cancelDownload: (downloadId: string) => service.cancelDownload(downloadId),
    retryDownload: (downloadId: string) => service.retryDownload(downloadId),
    clearCompletedDownloads: () => service.clearCompletedDownloads(),
    getStats: () => service.getStats(),
    getAllDownloads: () => service.getAllDownloads(),
    getActiveDownloads: () => service.getActiveDownloads(),
  };
};

/**
 * Initialize the download service (call this at app startup)
 */
export const initializeDownloadService = async (
  options?: DownloadManagerOptions,
): Promise<void> => {
  const service = DownloadService.getInstance();
  await service.initialize(options);
};

/**
 * Cleanup the download service (call this at app shutdown)
 */
export const cleanupDownloadService = async (): Promise<void> => {
  const service = DownloadService.getInstance();
  await service.cleanup();
};

export default DownloadService;
