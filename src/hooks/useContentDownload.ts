import { useState, useCallback, useEffect } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useDownloadActions } from "./useDownloadActions";
import { useDownloadPortal } from "@/providers/DownloadPortalProvider";
import { logger } from "@/services/logger/LoggerService";
import type { ServiceConfig } from "@/models/service.types";
import type {
  DownloadCapability,
  QualityOption,
} from "@/connectors/base/IDownloadConnector";
import type { JellyfinItem } from "@/models/jellyfin.types";

interface UseContentDownloadOptions {
  /** Service configuration for the content */
  serviceConfig: ServiceConfig;
  /** Content ID from the service */
  contentId: string;
  /** Optional initial download check */
  checkDownloadCapabilityOnMount?: boolean;
}

interface DownloadCapabilityState {
  /** Whether download capability is being checked */
  isLoading: boolean;
  /** Download capability information */
  capability: DownloadCapability | null;
  /** Available quality options */
  qualityOptions: QualityOption[];
  /** Selected quality */
  selectedQuality: string | null;
  /** Error information */
  error: string | null;
  /** Episodes for series */
  episodes: JellyfinItem[] | null;
  /** Selected episodes for download */
  selectedEpisodes: string[];
}

/**
 * Hook for managing content downloads from services
 */
export const useContentDownload = ({
  serviceConfig,
  contentId,
  checkDownloadCapabilityOnMount = false,
}: UseContentDownloadOptions) => {
  const { downloadManager } = useDownloadPortal();
  const { startDownload } = useDownloadActions();
  const connectorManager = ConnectorManager.getInstance();
  const [isPortalReady, setIsPortalReady] = useState(!!downloadManager);

  // State
  const [state, setState] = useState<DownloadCapabilityState>({
    isLoading: false,
    capability: null,
    qualityOptions: [],
    selectedQuality: null,
    error: null,
    episodes: null,
    selectedEpisodes: [],
  });

  // Track when download manager becomes available
  useEffect(() => {
    if (downloadManager && !isPortalReady) {
      setIsPortalReady(true);
      logger.debug("Download manager became available in portal");
    } else if (!downloadManager && isPortalReady) {
      setIsPortalReady(false);
      logger.warn("Download manager no longer available in portal");
    }
  }, [downloadManager, isPortalReady]);

  // Reset state
  const resetState = useCallback(() => {
    setState({
      isLoading: false,
      capability: null,
      qualityOptions: [],
      selectedQuality: null,
      error: null,
      episodes: null,
      selectedEpisodes: [],
    });
  }, []);

  // Check if content can be downloaded
  const checkDownloadCapability = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get download connector
      const downloadConnector = connectorManager.getDownloadConnector(
        serviceConfig.id,
      );
      if (!downloadConnector) {
        throw new Error(
          `Service ${serviceConfig.name} does not support downloads`,
        );
      }

      // Check capability
      const capability = await downloadConnector.canDownload(contentId);

      // Get quality options if download is supported
      let qualityOptions: QualityOption[] = [];
      if (capability.canDownload && downloadConnector.getDownloadQualities) {
        qualityOptions = [
          ...(await downloadConnector.getDownloadQualities(contentId)),
        ];
      }

      // Get episodes if this is a series
      let episodes: JellyfinItem[] | null = null;
      if (capability.isSeries && downloadConnector.getSeriesEpisodes) {
        try {
          const fetchedEpisodes =
            await downloadConnector.getSeriesEpisodes(contentId);
          episodes = Array.isArray(fetchedEpisodes)
            ? [...(fetchedEpisodes as JellyfinItem[])]
            : null;
        } catch (error) {
          logger.warn("Failed to fetch episodes", {
            contentId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      setState({
        isLoading: false,
        capability,
        qualityOptions,
        selectedQuality:
          qualityOptions.length > 0 ? (qualityOptions[0]?.value ?? null) : null,
        error: null,
        episodes,
        selectedEpisodes: [],
      });

      return { capability, qualityOptions };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
      }));

      logger.error("Failed to check download capability", {
        serviceId: serviceConfig.id,
        contentId,
        error: message,
      });

      throw error;
    }
  }, [connectorManager, serviceConfig, contentId]);

  // Select quality
  const selectQuality = useCallback((qualityValue: string) => {
    setState((prev) => ({ ...prev, selectedQuality: qualityValue }));
  }, []);

  // Select episodes
  const setSelectedEpisodes = useCallback((episodeIds: string[]) => {
    setState((prev) => ({ ...prev, selectedEpisodes: episodeIds }));
  }, []);

  // Start download
  const startContentDownload = useCallback(
    async (overrideEpisodes?: readonly string[]) => {
      if (!downloadManager) {
        logger.error("Download manager not available", {
          downloadManager: !!downloadManager,
          state: "attempting to start download",
        });
        throw new Error("Download manager not available");
      }

      if (!state.capability?.canDownload) {
        throw new Error("Content cannot be downloaded");
      }

      try {
        // Start the download with haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const episodesToDownload = overrideEpisodes
          ? [...overrideEpisodes]
          : state.selectedEpisodes;

        const downloadId = await startDownload(
          serviceConfig,
          contentId,
          state.selectedQuality || undefined,
          {
            haptics: true,
          },
          episodesToDownload.length > 0 ? episodesToDownload : undefined,
        );

        logger.info("Content download started", {
          downloadId,
          contentId,
          service: serviceConfig.name,
          quality: state.selectedQuality,
        });

        return downloadId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

        logger.error("Failed to start content download", {
          serviceId: serviceConfig.id,
          contentId,
          error: message,
        });

        throw error;
      }
    },
    [
      downloadManager,
      startDownload,
      serviceConfig,
      contentId,
      state.capability,
      state.selectedQuality,
      state.selectedEpisodes,
    ],
  );

  // Show download confirmation dialog
  const showDownloadConfirmation = useCallback(() => {
    if (!state.capability?.canDownload) {
      return;
    }

    const estimatedSize = state.capability.estimatedSize
      ? `${(state.capability.estimatedSize / 1024 / 1024).toFixed(1)} MB`
      : "Unknown size";

    Alert.alert(
      "Download Content",
      `Download ${state.capability.format || "content"} (${estimatedSize})?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Download",
          style: "default",
          onPress: () => void startContentDownload(),
        },
      ],
    );
  }, [state.capability, startContentDownload]);

  // Check capability on mount if requested
  useEffect(() => {
    if (checkDownloadCapabilityOnMount) {
      void checkDownloadCapability();
    }
  }, [checkDownloadCapabilityOnMount, checkDownloadCapability]);

  // Return state and actions
  return {
    // State
    isLoading: state.isLoading,
    canDownload: state.capability?.canDownload ?? false,
    downloadCapability: state.capability,
    qualityOptions: state.qualityOptions,
    selectedQuality: state.selectedQuality,
    error: state.error,
    episodes: state.episodes,
    selectedEpisodes: state.selectedEpisodes,

    // Actions
    checkDownloadCapability,
    selectQuality,
    setSelectedEpisodes,
    startDownload: startContentDownload,
    showDownloadConfirmation,
    resetState,

    // Convenience getters
    hasQualities: state.qualityOptions.length > 0,
    isReadyToDownload: state.capability?.canDownload && !state.isLoading,
    selectedQualityLabel: state.qualityOptions.find(
      (q) => q.value === state.selectedQuality,
    )?.label,
  };
};

/**
 * Hook for quickly checking if content can be downloaded
 */
export const useQuickDownloadCheck = (
  serviceConfig: ServiceConfig,
  contentId: string,
) => {
  const [canDownload, setCanDownload] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const connectorManager = ConnectorManager.getInstance();

  const checkCapability = useCallback(async () => {
    setIsLoading(true);
    try {
      const downloadConnector = connectorManager.getDownloadConnector(
        serviceConfig.id,
      );
      if (!downloadConnector) {
        setCanDownload(false);
        return;
      }

      const capability = await downloadConnector.canDownload(contentId);
      setCanDownload(capability.canDownload);
    } catch (error) {
      logger.warn("Quick download check failed", {
        serviceId: serviceConfig.id,
        contentId,
        error: error instanceof Error ? error.message : String(error),
      });
      setCanDownload(false);
    } finally {
      setIsLoading(false);
    }
  }, [connectorManager, serviceConfig, contentId]);

  return {
    canDownload,
    isLoading,
    checkCapability,
  };
};

export default useContentDownload;
