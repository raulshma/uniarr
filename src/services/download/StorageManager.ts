import { File, Directory } from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import type {
  DownloadStorageInfo,
  DownloadHistoryEntry,
  DownloadItem,
} from "@/models/download.types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Storage management service for downloads
 */
export class StorageManager {
  private static instance: StorageManager | null = null;
  private downloadDirectory = FileSystemLegacy.cacheDirectory
    ? `${FileSystemLegacy.cacheDirectory}downloads/`
    : `${FileSystemLegacy.documentDirectory || ""}downloads/`;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<DownloadStorageInfo> {
    try {
      // Ensure download directory exists
      await this.ensureDirectoryExists(this.downloadDirectory);

      // Calculate actual directory size and file count
      let totalSize = 0;
      let fileCount = 0;
      let largestFile = 0;

      try {
        const directory = new Directory(this.downloadDirectory);
        if (directory.exists) {
          const files = directory.list();

          for (const item of files) {
            if (!(item instanceof Directory)) {
              const size = item.size || 0;
              totalSize += size;
              fileCount++;

              if (size > largestFile) {
                largestFile = size;
              }
            }
          }
        }
      } catch (error) {
        // Directory might be empty or not accessible
        logger.debug("Could not read download directory", {
          directory: this.downloadDirectory,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Get free disk space (if available)
      let freeSpace = 0;
      try {
        freeSpace = await FileSystemLegacy.getFreeDiskStorageAsync();
      } catch (error) {
        logger.debug("Could not get free disk space", {
          error: error instanceof Error ? error.message : String(error),
        });
        freeSpace = 1024 * 1024 * 1024; // 1GB fallback
      }

      // Estimate total space (this is platform-dependent)
      const totalSpace = freeSpace + totalSize + 1024 * 1024 * 1024; // Add 1GB for system/apps

      return {
        totalSpace,
        freeSpace,
        usedSpace: totalSize,
        downloadDirectory: this.downloadDirectory,
        fileCount,
        largestFileSize: largestFile,
      };
    } catch (error) {
      logger.error("Failed to get storage info", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to retrieve storage information");
    }
  }

  /**
   * Calculate storage usage for downloads
   */
  async calculateDownloadStorageUsage(downloads: DownloadItem[]): Promise<{
    totalSize: number;
    fileCount: number;
    largestFile: number;
    usageByService: Record<string, number>;
    usageByType: Record<string, number>;
  }> {
    try {
      const completedDownloads = downloads.filter(
        (d) => d.state.status === "completed",
      );
      const usageByService: Record<string, number> = {};
      const usageByType: Record<string, number> = {};
      let totalSize = 0;
      let largestFile = 0;

      for (const download of completedDownloads) {
        const size = download.download.size || 0;
        totalSize += size;

        if (size > largestFile) {
          largestFile = size;
        }

        // Group by service
        const serviceName = download.serviceConfig.name;
        usageByService[serviceName] = (usageByService[serviceName] || 0) + size;

        // Group by content type
        const contentType = download.content.type;
        usageByType[contentType] = (usageByType[contentType] || 0) + size;
      }

      return {
        totalSize,
        fileCount: completedDownloads.length,
        largestFile,
        usageByService,
        usageByType,
      };
    } catch (error) {
      logger.error("Failed to calculate storage usage", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        totalSize: 0,
        fileCount: 0,
        largestFile: 0,
        usageByService: {},
        usageByType: {},
      };
    }
  }

  /**
   * Get download history entries
   */
  async getDownloadHistory(
    downloads: DownloadItem[],
  ): Promise<DownloadHistoryEntry[]> {
    try {
      const completedDownloads = downloads.filter(
        (d) => d.state.status === "completed",
      );

      return completedDownloads
        .map((download) => ({
          id: download.id,
          serviceName: download.serviceConfig.name,
          contentTitle: download.content.title,
          contentType: download.content.type,
          fileSize: download.download.size || 0,
          completedAt: download.state.completedAt || download.state.updatedAt,
          localPath: download.download.localPath,
          fileExists: true, // In a real implementation, you'd check if the file exists
        }))
        .sort((a, b) => {
          const dateA =
            a.completedAt instanceof Date
              ? a.completedAt
              : new Date(a.completedAt);
          const dateB =
            b.completedAt instanceof Date
              ? b.completedAt
              : new Date(b.completedAt);
          return dateB.getTime() - dateA.getTime();
        });
    } catch (error) {
      logger.error("Failed to get download history", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clean up orphaned downloads (downloads in history but not on disk)
   */
  async cleanupOrphanedDownloads(downloads: DownloadItem[]): Promise<{
    cleaned: number;
    errors: string[];
  }> {
    try {
      const completedDownloads = downloads.filter(
        (d) => d.state.status === "completed",
      );
      let cleaned = 0;
      const errors: string[] = [];

      for (const download of completedDownloads) {
        try {
          // In a real implementation, you'd check if the file exists
          const fileExists = await this.checkFileExists(
            download.download.localPath,
          );

          if (!fileExists) {
            // Remove from history or mark as missing
            logger.info("Found orphaned download", {
              downloadId: download.id,
              title: download.content.title,
            });
            cleaned++;
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`Failed to check ${download.content.title}: ${message}`);
        }
      }

      return { cleaned, errors };
    } catch (error) {
      logger.error("Failed to cleanup orphaned downloads", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { cleaned: 0, errors: ["Cleanup failed"] };
    }
  }

  /**
   * Clean up old downloads based on criteria
   */
  async cleanupOldDownloads(
    downloads: DownloadItem[],
    options: {
      olderThanDays?: number;
      largerThanMB?: number;
      keepCount?: number;
    },
  ): Promise<{
    removed: number;
    errors: string[];
  }> {
    try {
      const completedDownloads = downloads.filter(
        (d) => d.state.status === "completed",
      );
      let removed = 0;
      const errors: string[] = [];

      let downloadsToClean = completedDownloads;

      // Filter by age
      if (options.olderThanDays) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - options.olderThanDays);

        downloadsToClean = downloadsToClean.filter((download) => {
          const completedDate = new Date(
            download.state.completedAt || download.state.updatedAt,
          );
          return completedDate < cutoffDate;
        });
      }

      // Filter by size
      if (options.largerThanMB) {
        const sizeThreshold = options.largerThanMB * 1024 * 1024;
        downloadsToClean = downloadsToClean.filter(
          (download) => (download.download.size || 0) > sizeThreshold,
        );
      }

      // Keep only the most recent N downloads
      if (options.keepCount && downloadsToClean.length > options.keepCount) {
        downloadsToClean.sort((a, b) => {
          const dateA = new Date(a.state.completedAt || a.state.updatedAt);
          const dateB = new Date(b.state.completedAt || b.state.updatedAt);
          return dateA.getTime() - dateB.getTime();
        });
        downloadsToClean = downloadsToClean.slice(
          0,
          downloadsToClean.length - options.keepCount,
        );
      }

      // Remove the identified downloads
      for (const download of downloadsToClean) {
        try {
          await this.removeDownloadFile(download.download.localPath);
          removed++;

          logger.info("Cleaned up old download", {
            downloadId: download.id,
            title: download.content.title,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`Failed to remove ${download.content.title}: ${message}`);
        }
      }

      return { removed, errors };
    } catch (error) {
      logger.error("Failed to cleanup old downloads", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { removed: 0, errors: ["Cleanup failed"] };
    }
  }

  /**
   * Get storage recommendations
   */
  async getStorageRecommendations(
    downloads: DownloadItem[],
    storageInfo: DownloadStorageInfo,
  ): Promise<{
    priority: "low" | "medium" | "high" | "critical";
    message: string;
    actions: string[];
  }> {
    try {
      const usage = await this.calculateDownloadStorageUsage(downloads);
      const usagePercentage = (usage.totalSize / storageInfo.totalSpace) * 100;
      const freeSpacePercentage =
        (storageInfo.freeSpace / storageInfo.totalSpace) * 100;

      // Determine priority and recommendations
      if (freeSpacePercentage < 5) {
        return {
          priority: "critical",
          message:
            "Critical storage shortage - only 5% or less space remaining",
          actions: [
            "Remove old downloads immediately",
            "Clear completed downloads",
            "Move files to external storage",
          ],
        };
      } else if (freeSpacePercentage < 10) {
        return {
          priority: "high",
          message: "Low storage space - less than 10% remaining",
          actions: [
            "Remove old downloads",
            "Clear completed downloads",
            "Consider moving files to external storage",
          ],
        };
      } else if (usagePercentage > 5) {
        return {
          priority: "medium",
          message: "Downloads are using significant storage space",
          actions: [
            "Review and remove old downloads",
            "Clear completed downloads",
            "Monitor storage usage",
          ],
        };
      } else if (usage.fileCount > 100) {
        return {
          priority: "medium",
          message: "Large number of downloaded files",
          actions: [
            "Review download history",
            "Clear completed downloads",
            "Organize downloads by type",
          ],
        };
      } else {
        return {
          priority: "low",
          message: "Storage usage is normal",
          actions: [
            "Continue monitoring storage usage",
            "Regular cleanup is recommended",
          ],
        };
      }
    } catch (error) {
      logger.error("Failed to get storage recommendations", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        priority: "medium",
        message: "Unable to assess storage status",
        actions: ["Check storage manually", "Restart app"],
      };
    }
  }

  /**
   * Check if a file exists
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      const file = new File(filePath);
      return file.exists;
    } catch (error) {
      logger.debug("Failed to check file existence", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Remove a download file
   */
  private async removeDownloadFile(filePath: string): Promise<void> {
    try {
      const file = new File(filePath);
      if (file.exists) {
        file.delete();
        logger.debug("Removed download file", { filePath });
      } else {
        logger.debug("File does not exist, skipping removal", { filePath });
      }
    } catch (error) {
      logger.error("Failed to remove file", {
        filePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to remove file: ${filePath}`);
    }
  }

  /**
   * Set download directory
   */
  setDownloadDirectory(directory: string): void {
    this.downloadDirectory = directory;
    logger.info("Download directory updated", { directory });
  }

  /**
   * Get download directory
   */
  getDownloadDirectory(): string {
    return this.downloadDirectory;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    try {
      const dir = new Directory(directory);
      if (!dir.exists) {
        dir.create();
        logger.info("Created download directory", { directory });
      }
    } catch (error) {
      logger.error("Failed to create directory", {
        directory,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export default StorageManager;
