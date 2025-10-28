import { useQuery } from "@tanstack/react-query";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import {
  useConnectorsStore,
  selectGetConnectorsByType,
} from "@/store/connectorsStore";
import { logger } from "@/services/logger/LoggerService";
import type { DiscoverMediaKind } from "@/models/discover.types";

export interface FoundService {
  readonly serviceId: string;
  readonly name: string;
  readonly connectorType: "radarr" | "sonarr";
  readonly remoteId: number;
}

export interface UseCheckInLibraryResult {
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly foundServices: FoundService[];
  readonly refetch: () => void;
}

interface CheckInLibraryParams {
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly sourceId?: number;
  readonly mediaType: DiscoverMediaKind;
  readonly enabled?: boolean;
}

const checkItemInLibrary = async (
  params: CheckInLibraryParams,
  getConnectorsByType: ReturnType<typeof selectGetConnectorsByType>,
): Promise<FoundService[]> => {
  const { tmdbId, tvdbId, sourceId, mediaType, enabled = true } = params;

  if (!enabled) {
    return [];
  }

  if (!tmdbId && !tvdbId && !sourceId) {
    return [];
  }

  const foundServices: FoundService[] = [];

  try {
    if (mediaType === "movie") {
      const radarrConnectors = getConnectorsByType(
        "radarr",
      ) as RadarrConnector[];

      for (const connector of radarrConnectors) {
        try {
          const movies = await connector.getMovies();
          for (const movie of movies) {
            // Match by tmdbId (movies don't have tvdbId)
            if (tmdbId && movie.tmdbId === tmdbId) {
              foundServices.push({
                serviceId: connector.config.id,
                name: connector.config.name,
                connectorType: "radarr",
                remoteId: movie.id,
              });
              break; // Found in this service, move to next
            }
          }
        } catch (error) {
          logger.warn("[useCheckInLibrary] Failed to check Radarr service", {
            serviceId: connector.config.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } else if (mediaType === "series") {
      const sonarrConnectors = getConnectorsByType(
        "sonarr",
      ) as SonarrConnector[];

      for (const connector of sonarrConnectors) {
        try {
          const series = await connector.getSeries();
          for (const item of series) {
            // Match by tmdbId or tvdbId
            if (
              (tmdbId && item.tmdbId === tmdbId) ||
              (tvdbId && item.tvdbId === tvdbId)
            ) {
              foundServices.push({
                serviceId: connector.config.id,
                name: connector.config.name,
                connectorType: "sonarr",
                remoteId: item.id,
              });
              break; // Found in this service, move to next
            }
          }
        } catch (error) {
          logger.warn("[useCheckInLibrary] Failed to check Sonarr service", {
            serviceId: connector.config.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  } catch (error) {
    logger.error("[useCheckInLibrary] Unexpected error during check", {
      error: error instanceof Error ? error.message : String(error),
      mediaType,
      tmdbId,
    });
    throw error;
  }

  return foundServices;
};

/**
 * Hook to lazily check if a discover item is already in a user's Radarr/Sonarr library.
 * Performs the check when the hook mounts or when dependencies change.
 * Returns matching services and their remote IDs for navigation or display.
 */
export const useCheckInLibrary = (
  params: CheckInLibraryParams,
): UseCheckInLibraryResult => {
  const getConnectorsByType = useConnectorsStore(selectGetConnectorsByType);

  const query = useQuery({
    queryKey: [
      "check-in-library",
      params.tmdbId,
      params.tvdbId,
      params.sourceId,
      params.mediaType,
    ],
    queryFn: async () => checkItemInLibrary(params, getConnectorsByType),
    enabled: params.enabled !== false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });

  return {
    isLoading: query.isLoading,
    error: query.error,
    foundServices: query.data ?? [],
    refetch: () => void query.refetch(),
  };
};
