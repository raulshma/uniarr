/**
 * Service for managing downloaded content actions
 * Provides methods to open, delete, and manage downloaded files
 */

import type { DownloadItem } from "@/models/download.types";
import * as FileOps from "@/utils/fileOperations.utils";
import { logger } from "@/services/logger/LoggerService";

/**
 * Result of a file operation
 */
export interface FileOperationResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
  /** Data returned by the operation (if applicable) */
  data?: unknown;
}

/**
 * Service for managing downloaded content
 */
export class DownloadedContentActionsService {
  private static instance: DownloadedContentActionsService | null = null;

  private constructor() {}

  static getInstance(): DownloadedContentActionsService {
    if (!DownloadedContentActionsService.instance) {
      DownloadedContentActionsService.instance =
        new DownloadedContentActionsService();
    }
    return DownloadedContentActionsService.instance;
  }

  /**
   * Delete a downloaded file
   * @param download - The download item to delete
   * @returns Promise with operation result
   */
  async deleteDownloadedFile(
    download: DownloadItem,
  ): Promise<FileOperationResult> {
    try {
      const filePath = download.download.localPath;

      if (!filePath) {
        return {
          success: false,
          error: "File path is empty",
        };
      }

      logger.info("Deleting downloaded file", {
        downloadId: download.id,
        filePath,
        title: download.content.title,
      });

      // Check if file exists before attempting delete
      const exists = await FileOps.fileExists(filePath);
      if (!exists) {
        logger.warn("File does not exist when attempting delete", {
          downloadId: download.id,
          filePath,
        });
        return {
          success: false,
          error: "File no longer exists",
        };
      }

      // Attempt to delete
      const deleted = await FileOps.deleteFile(filePath);

      if (deleted) {
        logger.info("Downloaded file deleted successfully", {
          downloadId: download.id,
          filePath,
          title: download.content.title,
        });

        return {
          success: true,
          data: {
            downloadId: download.id,
            filePath,
            title: download.content.title,
          },
        };
      } else {
        return {
          success: false,
          error: "Failed to delete file",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Error deleting downloaded file", {
        downloadId: download.id,
        error: message,
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Open a downloaded file with a video player
   * @param download - The download item to open
   * @param playerOption - Optional specific player to use (Android only)
   * @returns Promise with operation result
   */
  async openDownloadedFile(
    download: DownloadItem,
    playerOption?: FileOps.VideoPlayerOption,
  ): Promise<FileOperationResult> {
    try {
      const filePath = download.download.localPath;

      if (!filePath) {
        return {
          success: false,
          error: "File path is empty",
        };
      }

      // Check if this is a video file
      if (!FileOps.isVideoFile(filePath)) {
        return {
          success: false,
          error: "File is not a video file",
        };
      }

      logger.info("Opening downloaded file", {
        downloadId: download.id,
        filePath,
        title: download.content.title,
        player: playerOption?.label,
      });

      // Check if file exists
      const exists = await FileOps.fileExists(filePath);
      if (!exists) {
        logger.warn("File does not exist when attempting to open", {
          downloadId: download.id,
          filePath,
        });
        return {
          success: false,
          error: "File no longer exists",
        };
      }

      // Open the file
      const opened = await FileOps.openFileWithPlayer(filePath, playerOption);

      if (opened) {
        logger.info("Downloaded file opened successfully", {
          downloadId: download.id,
          filePath,
          title: download.content.title,
          player: playerOption?.label || "system",
        });

        return {
          success: true,
          data: {
            downloadId: download.id,
            filePath,
            title: download.content.title,
            player: playerOption?.label || "system",
          },
        };
      } else {
        return {
          success: false,
          error: "Failed to open file",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Error opening downloaded file", {
        downloadId: download.id,
        error: message,
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Get available video player options for the current platform
   * @returns Array of available video player options
   */
  getAvailableVideoPlayers(): readonly FileOps.VideoPlayerOption[] {
    return FileOps.getAvailableVideoPlayers();
  }

  /**
   * Share a downloaded file
   * @param download - The download item to share
   * @returns Promise with operation result
   */
  async shareDownloadedFile(
    download: DownloadItem,
  ): Promise<FileOperationResult> {
    try {
      const filePath = download.download.localPath;

      if (!filePath) {
        return {
          success: false,
          error: "File path is empty",
        };
      }

      logger.info("Sharing downloaded file", {
        downloadId: download.id,
        filePath,
        title: download.content.title,
      });

      // Check if file exists
      const exists = await FileOps.fileExists(filePath);
      if (!exists) {
        logger.warn("File does not exist when attempting to share", {
          downloadId: download.id,
          filePath,
        });
        return {
          success: false,
          error: "File no longer exists",
        };
      }

      // Share the file
      const shared = await FileOps.shareFile(filePath, download.content.title);

      if (shared) {
        logger.info("Downloaded file shared successfully", {
          downloadId: download.id,
          filePath,
          title: download.content.title,
        });

        return {
          success: true,
          data: {
            downloadId: download.id,
            filePath,
            title: download.content.title,
          },
        };
      } else {
        return {
          success: false,
          error: "Failed to share file",
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Error sharing downloaded file", {
        downloadId: download.id,
        error: message,
      });

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * Check if a downloaded file still exists
   * @param download - The download item to check
   * @returns Promise with boolean result
   */
  async downloadFileExists(download: DownloadItem): Promise<boolean> {
    try {
      const filePath = download.download.localPath;
      if (!filePath) {
        return false;
      }

      return await FileOps.fileExists(filePath);
    } catch (error) {
      logger.debug("Error checking if download file exists", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get file information for a download
   * @param download - The download item
   * @returns Promise with file information (size, modification time) or null
   */
  async getDownloadFileInfo(
    download: DownloadItem,
  ): Promise<{ size: number; modTime: number } | null> {
    try {
      const filePath = download.download.localPath;
      if (!filePath) {
        return null;
      }

      return await FileOps.getFileInfo(filePath);
    } catch (error) {
      logger.debug("Error getting download file info", {
        downloadId: download.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get the filename for a download
   * @param download - The download item
   * @returns The filename
   */
  getDownloadFileName(download: DownloadItem): string {
    return FileOps.getFileName(download.download.localPath);
  }

  /**
   * Check if download is a video file
   * @param download - The download item
   * @returns True if file is a video, false otherwise
   */
  isVideoFile(download: DownloadItem): boolean {
    return FileOps.isVideoFile(download.download.localPath);
  }

  /**
   * Check if download is a subtitle file
   * @param download - The download item
   * @returns True if file is a subtitle, false otherwise
   */
  isSubtitleFile(download: DownloadItem): boolean {
    return FileOps.isSubtitleFile(download.download.localPath);
  }
}

// Export singleton instance
export const downloadedContentActionsService =
  DownloadedContentActionsService.getInstance();
