import React, { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { DownloadPortalProvider } from "./DownloadPortalProvider";
import { useDownloadManagerInit } from "@/hooks/useDownloadManagerInit";
import { useDownloadService } from "@/services/download";
import { logger } from "@/services/logger/LoggerService";
import type { DownloadManagerOptions } from "@/models/download.types";

interface DownloadManagerProviderProps {
  children: ReactNode;
  /** Download manager configuration options */
  managerOptions?: DownloadManagerOptions;
  /** Whether to initialize the download manager on mount */
  initializeOnMount?: boolean;
  /** Callback when download manager is successfully initialized */
  onInitialized?: (success: boolean) => void;
  /** Callback when download manager initialization fails */
  onError?: (error: Error) => void;
  /** Auto-show download sheet when downloads are active */
  autoShowOnActive?: boolean;
  /** Position of the download indicator */
  indicatorPosition?: "header" | "floating";
}

/**
 * Provider component that initializes the download service and provides
 * the download manager to the entire app through DownloadPortalProvider.
 *
 * This component should be placed near the root of the app to ensure
 * download functionality is available throughout the application.
 *
 * @example
 * ```tsx
 * <DownloadManagerProvider
 *   managerOptions={{
 *     queueConfig: {
 *       maxConcurrentDownloads: 3,
 *       allowMobileData: false,
 *     },
 *     progressUpdateInterval: 1000,
 *   }}
 *   onInitialized={(success) => {
 *     if (success) {
 *       console.log("Downloads are ready");
 *     }
 *   }}
 *   onError={(error) => {
 *     console.error("Download system failed:", error);
 *   }}
 * >
 *   <App />
 * </DownloadManagerProvider>
 * ```
 */
export const DownloadManagerProvider: React.FC<
  DownloadManagerProviderProps
> = ({
  children,
  managerOptions,
  initializeOnMount = true,
  onInitialized,
  onError,
  autoShowOnActive = false,
  indicatorPosition = "header",
}) => {
  const { isReady, error, initialize } = useDownloadManagerInit({
    managerOptions,
    initializeOnMount,
    onInitialized: (success) => {
      logger.info("Download manager initialization completed", { success });
      onInitialized?.(success);
    },
    onError: (err) => {
      logger.error("Download manager initialization failed", {
        error: err.message,
      });
      onError?.(err);
    },
  });

  const { getManager } = useDownloadService();
  const downloadManager = useMemo(() => {
    if (isReady) {
      return getManager();
    }
    return null;
  }, [isReady, getManager]);

  // Ensure download manager is connected to the portal when ready
  useEffect(() => {
    if (isReady && downloadManager) {
      logger.info("Download manager is ready and connected to portal", {
        managerId: downloadManager.constructor.name,
      });
    } else if (!isReady) {
      logger.debug("Download manager not yet ready");
    }
  }, [isReady, downloadManager]);

  // Provide the download manager to the portal
  return (
    <DownloadPortalProvider
      downloadManager={downloadManager}
      autoShowOnActive={autoShowOnActive}
      indicatorPosition={indicatorPosition}
    >
      {children}
    </DownloadPortalProvider>
  );
};

export default DownloadManagerProvider;
