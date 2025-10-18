import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DownloadManager } from "@/services/download/DownloadManager";
import type {
  DownloadItem,
  DownloadManagerState,
  DownloadStats,
  DownloadQueueConfig,
} from "@/models/download.types";
import { logger } from "@/services/logger/LoggerService";

// Export shallow equality helper for consumers
export { shallow } from "zustand/shallow";

/**
 * Download store state interface
 */
interface DownloadStoreState extends DownloadManagerState {
  // Actions
  setDownloadManager: (manager: DownloadManager | null) => void;
  updateDownload: (downloadId: string, download: DownloadItem) => void;
  removeDownload: (downloadId: string) => void;
  updateConfig: (config: Partial<DownloadQueueConfig>) => void;
  updateStats: (stats: Partial<DownloadStats>) => void;
  clearCompletedDownloads: () => void;
  resetStore: () => void;

  // Computed selectors
  getDownloadById: (downloadId: string) => DownloadItem | undefined;
  getDownloadsByStatus: (
    status: DownloadItem["state"]["status"],
  ) => DownloadItem[];
  getActiveDownloadsCount: () => number;
  getPendingDownloadsCount: () => number;
  getCompletedDownloadsCount: () => number;
  getFailedDownloadsCount: () => number;
}

/**
 * Create the download store
 */
export const useDownloadStore = create<DownloadStoreState>()(
  persist(
    (set, get) => ({
      // Initial state
      downloads: new Map(),
      downloadQueue: [],
      activeDownloads: new Set(),
      config: {
        maxConcurrentDownloads: 3,
        allowMobileData: false,
        allowBackgroundDownloads: true,
        defaultDownloadDirectory: "./downloads/",
        maxStorageUsage: 5 * 1024 * 1024 * 1024, // 5GB
      },
      stats: {
        totalDownloads: 0,
        activeDownloads: 0,
        completedDownloads: 0,
        failedDownloads: 0,
        totalBytesDownloaded: 0,
        currentDownloadSpeed: 0,
        storageUsed: 0,
        storageAvailable: 0,
      },

      // Actions
      setDownloadManager: (manager) => {
        // This is mainly for type safety - the actual manager lives in the service layer
        logger.debug("Download manager reference updated");
      },

      updateDownload: (downloadId, download) => {
        set((state) => {
          const newDownloads = new Map(state.downloads);
          newDownloads.set(downloadId, download);

          // Update active downloads set based on download status
          const newActiveDownloads = new Set(state.activeDownloads);
          if (download.state.status === "downloading") {
            newActiveDownloads.add(downloadId);
          } else {
            newActiveDownloads.delete(downloadId);
          }

          // Recalculate stats
          const allDownloads = Array.from(newDownloads.values());
          const activeDownloads = allDownloads.filter(
            (d) => d.state.status === "downloading",
          );

          return {
            downloads: newDownloads,
            activeDownloads: newActiveDownloads,
            stats: {
              ...state.stats,
              totalDownloads: allDownloads.length,
              activeDownloads: activeDownloads.length,
              completedDownloads: allDownloads.filter(
                (d) => d.state.status === "completed",
              ).length,
              failedDownloads: allDownloads.filter(
                (d) => d.state.status === "failed",
              ).length,
              totalBytesDownloaded: allDownloads.reduce(
                (sum, d) => sum + d.state.bytesDownloaded,
                0,
              ),
              currentDownloadSpeed: activeDownloads.reduce(
                (sum, d) => sum + d.state.downloadSpeed,
                0,
              ),
            },
          };
        });
      },

      removeDownload: (downloadId) => {
        set((state) => {
          const newDownloads = new Map(state.downloads);
          newDownloads.delete(downloadId);

          const newActiveDownloads = new Set(state.activeDownloads);
          newActiveDownloads.delete(downloadId);

          const newQueue = state.downloadQueue.filter(
            (id) => id !== downloadId,
          );

          // Recalculate stats
          const allDownloads = Array.from(newDownloads.values());
          const activeDownloads = allDownloads.filter(
            (d) => d.state.status === "downloading",
          );

          return {
            downloads: newDownloads,
            downloadQueue: newQueue,
            activeDownloads: newActiveDownloads,
            stats: {
              ...state.stats,
              totalDownloads: allDownloads.length,
              activeDownloads: activeDownloads.length,
              completedDownloads: allDownloads.filter(
                (d) => d.state.status === "completed",
              ).length,
              failedDownloads: allDownloads.filter(
                (d) => d.state.status === "failed",
              ).length,
              totalBytesDownloaded: allDownloads.reduce(
                (sum, d) => sum + d.state.bytesDownloaded,
                0,
              ),
              currentDownloadSpeed: activeDownloads.reduce(
                (sum, d) => sum + d.state.downloadSpeed,
                0,
              ),
            },
          };
        });
      },

      updateConfig: (configUpdates) => {
        set((state) => ({
          config: { ...state.config, ...configUpdates },
        }));
      },

      updateStats: (statsUpdates) => {
        set((state) => ({
          stats: { ...state.stats, ...statsUpdates },
        }));
      },

      clearCompletedDownloads: () => {
        set((state) => {
          const newDownloads = new Map<string, DownloadItem>();

          // Keep all downloads except completed ones
          for (const [id, download] of state.downloads) {
            if (download.state.status !== "completed") {
              newDownloads.set(id, download);
            }
          }

          // Recalculate stats
          const allDownloads = Array.from(newDownloads.values());
          const activeDownloads = allDownloads.filter(
            (d) => d.state.status === "downloading",
          );

          return {
            downloads: newDownloads,
            stats: {
              ...state.stats,
              totalDownloads: allDownloads.length,
              activeDownloads: activeDownloads.length,
              completedDownloads: 0,
              totalBytesDownloaded: allDownloads.reduce(
                (sum, d) => sum + d.state.bytesDownloaded,
                0,
              ),
              currentDownloadSpeed: activeDownloads.reduce(
                (sum, d) => sum + d.state.downloadSpeed,
                0,
              ),
            },
          };
        });
      },

      resetStore: () => {
        set({
          downloads: new Map(),
          downloadQueue: [],
          activeDownloads: new Set(),
          stats: {
            totalDownloads: 0,
            activeDownloads: 0,
            completedDownloads: 0,
            failedDownloads: 0,
            totalBytesDownloaded: 0,
            currentDownloadSpeed: 0,
            storageUsed: 0,
            storageAvailable: 0,
          },
        });
      },

      // Computed selectors
      getDownloadById: (downloadId) => {
        return get().downloads.get(downloadId);
      },

      getDownloadsByStatus: (status) => {
        const downloads = get().downloads;
        return Array.from(downloads.values()).filter(
          (d) => d.state.status === status,
        );
      },

      getActiveDownloadsCount: () => {
        return get().stats.activeDownloads;
      },

      getPendingDownloadsCount: () => {
        return (
          get().downloads.size -
          get().stats.activeDownloads -
          get().stats.completedDownloads -
          get().stats.failedDownloads
        );
      },

      getCompletedDownloadsCount: () => {
        return get().stats.completedDownloads;
      },

      getFailedDownloadsCount: () => {
        return get().stats.failedDownloads;
      },
    }),
    {
      name: "download-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist specific parts of the state
      partialize: (state) => ({
        config: state.config,
        // Note: We don't persist downloads themselves as they're managed by DownloadManager
        // We only persist the configuration and completed downloads for history
        downloads: Object.fromEntries(
          Array.from(state.downloads.entries()).filter(
            ([_, download]) => download.state.status === "completed",
          ),
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.info("Download store rehydrated", {
            downloadsCount: state.downloads.size,
            completedDownloads: state.stats.completedDownloads,
          });
        }
      },
    },
  ),
);

// Selectors for optimized component usage
export const selectDownloads = (
  state: DownloadStoreState,
): Map<string, DownloadItem> => state.downloads;
export const selectDownloadQueue = (
  state: DownloadStoreState,
): readonly string[] => state.downloadQueue;
export const selectActiveDownloads = (state: DownloadStoreState): Set<string> =>
  state.activeDownloads;
export const selectConfig = (state: DownloadStoreState): DownloadQueueConfig =>
  state.config;
export const selectStats = (state: DownloadStoreState): DownloadStats =>
  state.stats;

// Computed selectors
export const selectDownloadsArray = (
  state: DownloadStoreState,
): DownloadItem[] => Array.from(state.downloads.values());
export const selectActiveDownloadsArray = (
  state: DownloadStoreState,
): DownloadItem[] =>
  Array.from(state.activeDownloads)
    .map((id) => state.downloads.get(id))
    .filter((download): download is DownloadItem => download !== undefined);
export const selectCompletedDownloadsArray = (
  state: DownloadStoreState,
): DownloadItem[] =>
  Array.from(state.downloads.values()).filter(
    (download) => download.state.status === "completed",
  );
export const selectFailedDownloadsArray = (
  state: DownloadStoreState,
): DownloadItem[] =>
  Array.from(state.downloads.values()).filter(
    (download) => download.state.status === "failed",
  );

// Status-based selectors
export const selectDownloadsByStatus =
  (status: DownloadItem["state"]["status"]) =>
  (state: DownloadStoreState): DownloadItem[] =>
    Array.from(state.downloads.values()).filter(
      (d) => d.state.status === status,
    );

// Count selectors for performance
export const selectTotalDownloadsCount = (state: DownloadStoreState): number =>
  state.stats.totalDownloads;
export const selectActiveDownloadsCount = (state: DownloadStoreState): number =>
  state.stats.activeDownloads;
export const selectCompletedDownloadsCount = (
  state: DownloadStoreState,
): number => state.stats.completedDownloads;
export const selectFailedDownloadsCount = (state: DownloadStoreState): number =>
  state.stats.failedDownloads;

// Download speed selector
export const selectCurrentDownloadSpeed = (state: DownloadStoreState): number =>
  state.stats.currentDownloadSpeed;

// Storage selectors
export const selectStorageUsed = (state: DownloadStoreState): number =>
  state.stats.storageUsed;
export const selectStorageAvailable = (state: DownloadStoreState): number =>
  state.stats.storageAvailable;

/**
 * Hook for getting download by ID
 */
export const useDownload = (downloadId: string): DownloadItem | undefined => {
  return useDownloadStore((state) => state.getDownloadById(downloadId));
};

/**
 * Hook for getting downloads by status
 */
export const useDownloadsByStatus = (
  status: DownloadItem["state"]["status"],
): DownloadItem[] => {
  return useDownloadStore((state) => state.getDownloadsByStatus(status));
};

/**
 * Hook for getting download counts
 */
export const useDownloadCounts = () => {
  return useDownloadStore((state) => ({
    total: state.stats.totalDownloads,
    active: state.stats.activeDownloads,
    completed: state.stats.completedDownloads,
    failed: state.stats.failedDownloads,
    pending: state.getPendingDownloadsCount(),
  }));
};

/**
 * Hook for getting current download speed
 */
export const useCurrentDownloadSpeed = (): number => {
  return useDownloadStore((state) => state.stats.currentDownloadSpeed);
};

/**
 * Hook for getting download configuration
 */
export const useDownloadConfig = (): DownloadQueueConfig => {
  return useDownloadStore((state) => state.config);
};
