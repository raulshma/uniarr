import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import DownloadProgressSheet from "@/components/downloads/DownloadProgressSheet";
import DownloadIndicator from "@/components/downloads/DownloadIndicator";
import {
  useDownloadStore,
  selectActiveDownloadsCount,
} from "@/store/downloadStore";
import type { DownloadManager } from "@/services/download/DownloadManager";
import { logger } from "@/services/logger/LoggerService";

interface DownloadPortalContextValue {
  /** Show the download progress sheet */
  showDownloads: () => void;
  /** Hide the download progress sheet */
  hideDownloads: () => void;
  /** Toggle the download progress sheet visibility */
  toggleDownloads: () => void;
  /** Current visibility state of the download progress sheet */
  isDownloadsVisible: boolean;
  /** Number of active downloads */
  activeDownloadsCount: number;
  /** Set the download manager instance */
  setDownloadManager: (manager: DownloadManager | null) => void;
  /** Download manager instance */
  downloadManager: DownloadManager | null;
}

const DownloadPortalContext = createContext<DownloadPortalContextValue | null>(
  null,
);

interface DownloadPortalProviderProps {
  children: ReactNode;
  /** Custom download manager instance */
  downloadManager?: DownloadManager | null;
  /** Auto-show download sheet when downloads are active */
  autoShowOnActive?: boolean;
  /** Position of the download indicator */
  indicatorPosition?: "header" | "floating";
}

/**
 * Provider component that manages the download portal functionality
 */
export const DownloadPortalProvider: React.FC<DownloadPortalProviderProps> = ({
  children,
  downloadManager: initialDownloadManager = null,
  autoShowOnActive = false,
  indicatorPosition = "header",
}) => {
  const [isDownloadsVisible, setIsDownloadsVisible] = useState(false);
  const [downloadManager, setDownloadManager] =
    useState<DownloadManager | null>(initialDownloadManager);
  const autoShowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update download manager when it changes
  React.useEffect(() => {
    if (initialDownloadManager && !downloadManager) {
      setDownloadManager(initialDownloadManager);
      logger.debug("Download manager updated from prop");
    }
  }, [initialDownloadManager, downloadManager]);

  // Get active downloads count from store
  const activeDownloadsCount = useDownloadStore(selectActiveDownloadsCount);

  // Auto-show functionality when downloads become active
  const handleAutoShow = useCallback(() => {
    if (autoShowOnActive && activeDownloadsCount > 0 && !isDownloadsVisible) {
      // Clear any existing timer
      if (autoShowTimerRef.current) {
        clearTimeout(autoShowTimerRef.current);
      }

      // Show downloads after a short delay
      autoShowTimerRef.current = setTimeout(() => {
        setIsDownloadsVisible(true);
        logger.debug("Auto-showing download progress sheet", {
          activeDownloads: activeDownloadsCount,
        });
      }, 500);
    }
  }, [autoShowOnActive, activeDownloadsCount, isDownloadsVisible]);

  // Handle auto-show when download count changes
  React.useEffect(() => {
    handleAutoShow();
  }, [handleAutoShow]);

  // Clear timer on unmount
  React.useEffect(() => {
    return () => {
      if (autoShowTimerRef.current) {
        clearTimeout(autoShowTimerRef.current);
      }
    };
  }, []);

  // Show downloads
  const showDownloads = useCallback(() => {
    setIsDownloadsVisible(true);
    logger.debug("Download progress sheet shown", {
      activeDownloads: activeDownloadsCount,
    });
  }, [activeDownloadsCount]);

  // Hide downloads
  const hideDownloads = useCallback(() => {
    setIsDownloadsVisible(false);
    logger.debug("Download progress sheet hidden");
  }, []);

  // Toggle downloads
  const toggleDownloads = useCallback(() => {
    setIsDownloadsVisible((prev) => {
      const newState = !prev;
      logger.debug("Download progress sheet toggled", {
        newState,
        activeDownloads: activeDownloadsCount,
      });
      return newState;
    });
  }, [activeDownloadsCount]);

  // Context value
  const contextValue = useMemo<DownloadPortalContextValue>(
    () => ({
      showDownloads,
      hideDownloads,
      toggleDownloads,
      isDownloadsVisible,
      activeDownloadsCount,
      setDownloadManager,
      downloadManager,
    }),
    [
      showDownloads,
      hideDownloads,
      toggleDownloads,
      isDownloadsVisible,
      activeDownloadsCount,
      setDownloadManager,
      downloadManager,
    ],
  );

  return (
    <DownloadPortalContext.Provider value={contextValue}>
      {children}

      {/* Download Progress Sheet */}
      <DownloadProgressSheet
        visible={isDownloadsVisible}
        onDismiss={hideDownloads}
      />

      {/* Download Indicator - only show when there are active downloads */}
      {activeDownloadsCount > 0 && (
        <DownloadIndicator
          onPress={showDownloads}
          showSpeed={true}
          size="medium"
          position={indicatorPosition}
        />
      )}
    </DownloadPortalContext.Provider>
  );
};

/**
 * Hook to access the download portal context
 */
export const useDownloadPortal = (): DownloadPortalContextValue => {
  const context = useContext(DownloadPortalContext);
  if (!context) {
    throw new Error(
      "useDownloadPortal must be used within a DownloadPortalProvider",
    );
  }
  return context;
};

/**
 * Hook to access download portal actions without full context
 */
export const useDownloadActions = () => {
  const {
    showDownloads,
    hideDownloads,
    toggleDownloads,
    isDownloadsVisible,
    activeDownloadsCount,
  } = useDownloadPortal();

  return {
    showDownloads,
    hideDownloads,
    toggleDownloads,
    isDownloadsVisible,
    activeDownloadsCount,
  };
};

/**
 * Hook to get download indicator state
 */
export const useDownloadIndicator = () => {
  const { activeDownloadsCount, showDownloads } = useDownloadPortal();

  return {
    activeDownloadsCount,
    showDownloads,
    hasActiveDownloads: activeDownloadsCount > 0,
  };
};

/**
 * Hook to manage download manager instance
 */
export const useDownloadManager = () => {
  const { downloadManager, setDownloadManager } = useDownloadPortal();

  const registerDownloadManager = useCallback(
    (manager: DownloadManager) => {
      setDownloadManager(manager);
      logger.info("Download manager registered in portal");
    },
    [setDownloadManager],
  );

  const unregisterDownloadManager = useCallback(() => {
    setDownloadManager(null);
    logger.info("Download manager unregistered from portal");
  }, [setDownloadManager]);

  return {
    downloadManager,
    registerDownloadManager,
    unregisterDownloadManager,
  };
};

export default DownloadPortalProvider;
