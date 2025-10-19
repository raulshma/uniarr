/**
 * Hook for managing downloaded file actions
 * Provides methods to open, delete, and manage downloaded files
 */

import { useState, useCallback } from "react";
import type { DownloadItem } from "@/models/download.types";
import { downloadedContentActionsService } from "@/services/download/DownloadedContentActions";
import type { VideoPlayerOption } from "@/utils/fileOperations.utils";
import { useDownloadStore } from "@/store/downloadStore";
import { alert } from "@/services/dialogService";

/**
 * State for file action operations
 */
export interface FileActionState {
  /** Whether an operation is in progress */
  isLoading: boolean;
  /** Error message if operation failed */
  error: string | null;
  /** Success message if operation succeeded */
  success: string | null;
}

/**
 * Hook for file action operations
 */
export const useDownloadedFileActions = () => {
  const [state, setState] = useState<FileActionState>({
    isLoading: false,
    error: null,
    success: null,
  });

  // Get download store actions
  const removeDownload = useDownloadStore((state) => state.removeDownload);

  /**
   * Delete a downloaded file and remove from store
   */
  const deleteFile = useCallback(
    async (download: DownloadItem): Promise<boolean> => {
      setState({ isLoading: true, error: null, success: null });

      // Show confirmation dialog
      let confirmed = false;
      await new Promise<void>((resolve) => {
        alert(
          "Delete Downloaded File",
          `Are you sure you want to permanently delete "${download.content.title}"? This action cannot be undone.`,
          [
            {
              text: "Cancel",
              onPress: () => {
                confirmed = false;
                resolve();
              },
              style: "cancel",
            },
            {
              text: "Delete",
              onPress: () => {
                confirmed = true;
                resolve();
              },
              style: "destructive",
            },
          ],
          { onDismiss: resolve },
        );
      });

      if (!confirmed) {
        setState({ isLoading: false, error: null, success: null });
        return false;
      }

      try {
        const result =
          await downloadedContentActionsService.deleteDownloadedFile(download);

        if (result.success) {
          // Remove from download store
          removeDownload(download.id);

          setState({
            isLoading: false,
            error: null,
            success: `"${download.content.title}" deleted successfully`,
          });

          return true;
        } else {
          setState({
            isLoading: false,
            error: result.error || "Failed to delete file",
            success: null,
          });

          return false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({
          isLoading: false,
          error: message,
          success: null,
        });

        return false;
      }
    },
    [removeDownload],
  );

  /**
   * Open a downloaded file with a video player
   */
  const openFile = useCallback(
    async (
      download: DownloadItem,
      playerOption?: VideoPlayerOption,
    ): Promise<boolean> => {
      setState({ isLoading: true, error: null, success: null });

      try {
        const result = await downloadedContentActionsService.openDownloadedFile(
          download,
          playerOption,
        );

        if (result.success) {
          setState({
            isLoading: false,
            error: null,
            success: `Opening "${download.content.title}"...`,
          });

          return true;
        } else {
          setState({
            isLoading: false,
            error: result.error || "Failed to open file",
            success: null,
          });

          return false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({
          isLoading: false,
          error: message,
          success: null,
        });

        return false;
      }
    },
    [],
  );

  /**
   * Share a downloaded file
   */
  const shareFile = useCallback(
    async (download: DownloadItem): Promise<boolean> => {
      setState({ isLoading: true, error: null, success: null });

      try {
        const result =
          await downloadedContentActionsService.shareDownloadedFile(download);

        if (result.success) {
          setState({
            isLoading: false,
            error: null,
            success: `Sharing "${download.content.title}"...`,
          });

          return true;
        } else {
          setState({
            isLoading: false,
            error: result.error || "Failed to share file",
            success: null,
          });

          return false;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setState({
          isLoading: false,
          error: message,
          success: null,
        });

        return false;
      }
    },
    [],
  );

  /**
   * Check if a download file still exists
   */
  const checkFileExists = useCallback(
    async (download: DownloadItem): Promise<boolean> => {
      return await downloadedContentActionsService.downloadFileExists(download);
    },
    [],
  );

  /**
   * Get available video players for current platform
   */
  const getAvailableVideoPlayers = useCallback(
    (): readonly VideoPlayerOption[] =>
      downloadedContentActionsService.getAvailableVideoPlayers(),
    [],
  );

  /**
   * Get file information (size, modification time)
   */
  const getFileInfo = useCallback(
    async (
      download: DownloadItem,
    ): Promise<{ size: number; modTime: number } | null> =>
      downloadedContentActionsService.getDownloadFileInfo(download),
    [],
  );

  /**
   * Check if download is a video file
   */
  const isVideoFile = useCallback(
    (download: DownloadItem): boolean =>
      downloadedContentActionsService.isVideoFile(download),
    [],
  );

  /**
   * Clear messages
   */
  const clearMessages = useCallback(() => {
    setState({ isLoading: false, error: null, success: null });
  }, []);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    success: state.success,

    // Actions
    deleteFile,
    openFile,
    shareFile,
    checkFileExists,
    getAvailableVideoPlayers,
    getFileInfo,
    isVideoFile,
    clearMessages,
  };
};
