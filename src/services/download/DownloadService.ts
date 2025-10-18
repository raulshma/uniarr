import { DownloadManager } from "./DownloadManager";
import { useDownloadStore } from "@/store/downloadStore";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";
import type { ServiceConfig } from "@/models/service.types";
import type {
  DownloadItem,
  DownloadManagerOptions,
} from "@/models/download.types";

/**
 * Global download service instance
 */
class DownloadService {
  private static instance: DownloadService | null = null;
  private downloadManager: DownloadManager | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
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
      // Create download manager
      this.downloadManager = new DownloadManager(options);

      // Connect to store for real-time updates
      this.connectToStore();

      this.isInitialized = true;
      logger.info("Download service initialized successfully");
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
  }

  /**
   * Connect download manager to Zustand store
   */
  private connectToStore(): void {
    if (!this.downloadManager) return;

    // The DownloadManager was already initialized with event handlers in the constructor
    // No additional setup needed here

    // Initial connection
    useDownloadStore.getState().setDownloadManager(this.downloadManager);

    logger.debug("Download manager connected to store");
  }

  /**
   * Generate download path for a file
   */
  private generateDownloadPath(fileName: string): string {
    // Sanitize filename for file system
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-_]/g, "_");
    return `./downloads/${sanitizedName}`;
  }
}

/**
 * Convenience hook for accessing the download service
 */
export const useDownloadService = () => {
  const service = DownloadService.getInstance();

  return {
    service,
    isReady: service.isReady(),
    getManager: () => service.getManager(),
    startDownload: (
      serviceConfig: ServiceConfig,
      contentId: string,
      quality?: string,
    ) => service.startDownload(serviceConfig, contentId, quality),
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
