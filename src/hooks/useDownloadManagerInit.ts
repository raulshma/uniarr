import { useEffect, useState, useCallback } from "react";
import {
  initializeDownloadService,
  cleanupDownloadService,
} from "@/services/download";
import type { DownloadManagerOptions } from "@/models/download.types";
import { logger } from "@/services/logger/LoggerService";

interface UseDownloadManagerInitOptions {
  /** Download manager initialization options */
  managerOptions?: DownloadManagerOptions;
  /** Whether to initialize on mount (default: true) */
  initializeOnMount?: boolean;
  /** Custom initialization callback */
  onInitialized?: (manager: any) => void;
  /** Custom error callback */
  onError?: (error: Error) => void;
}

interface UseDownloadManagerInitReturn {
  /** Whether the download manager is currently initializing */
  isInitializing: boolean;
  /** Whether the download manager is ready to use */
  isReady: boolean;
  /** Initialization error, if any */
  error: Error | null;
  /** Initialize the download manager manually */
  initialize: () => Promise<void>;
  /** Cleanup the download manager manually */
  cleanup: () => Promise<void>;
  /** Retry initialization after an error */
  retry: () => Promise<void>;
}

/**
 * Hook to initialize and manage the download service lifecycle
 *
 * This hook handles the initialization of the DownloadService which creates
 * the DownloadManager instance that's used throughout the app for download
 * functionality.
 *
 * @example
 * ```tsx
 * const { isReady, error, initialize } = useDownloadManagerInit({
 *   initializeOnMount: true,
 *   managerOptions: {
 *     queueConfig: {
 *       maxConcurrentDownloads: 3,
 *       allowMobileData: false,
 *     },
 *     progressUpdateInterval: 1000,
 *   },
 *   onInitialized: (manager) => {
 *     console.log("Download manager initialized");
 *   },
 *   onError: (error) => {
 *     console.error("Failed to initialize download manager:", error);
 *   },
 * });
 * ```
 */
export const useDownloadManagerInit = ({
  managerOptions,
  initializeOnMount = true,
  onInitialized,
  onError,
}: UseDownloadManagerInitOptions = {}): UseDownloadManagerInitReturn => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(async () => {
    if (isInitializing || isReady) {
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      logger.info("Initializing download service", { managerOptions });

      await initializeDownloadService(managerOptions);

      setIsReady(true);
      setError(null);

      logger.info("Download service initialized successfully");

      // Call custom initialization callback if provided
      if (onInitialized) {
        onInitialized(true);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsReady(false);

      logger.error("Failed to initialize download service", {
        error: error.message,
      });

      // Call custom error callback if provided
      if (onError) {
        onError(error);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [isInitializing, isReady, managerOptions, onInitialized, onError]);

  const cleanup = useCallback(async () => {
    try {
      await cleanupDownloadService();
      setIsReady(false);
      setError(null);
      logger.info("Download service cleaned up");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("Failed to cleanup download service", {
        error: error.message,
      });
    }
  }, []);

  const retry = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // Initialize on mount if requested
  useEffect(() => {
    if (initializeOnMount) {
      void initialize();
    }

    // Cleanup on unmount
    return () => {
      if (isReady) {
        void cleanup();
      }
    };
  }, [initializeOnMount, initialize, cleanup, isReady]);

  return {
    isInitializing,
    isReady,
    error,
    initialize,
    cleanup,
    retry,
  };
};

export default useDownloadManagerInit;
