import { useQuery } from "@tanstack/react-query";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import {
  useConnectorsStore,
  selectConnectorsByType,
} from "@/store/connectorsStore";
import { logger } from "@/services/logger/LoggerService";
import type { DiscoverMediaKind } from "@/models/discover.types";
import { queryKeys } from "@/hooks/queryKeys";
import { QUERY_CONFIG } from "@/hooks/queryConfig";

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
  radarrConnectors: RadarrConnector[],
  sonarrConnectors: SonarrConnector[],
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
      for (const connector of radarrConnectors) {
        try {
          const movies = await connector.getMovies();
          for (const movie of movies) {
            if (tmdbId && movie.tmdbId === tmdbId) {
              foundServices.push({
                serviceId: connector.config.id,
                name: connector.config.name,
                connectorType: "radarr",
                remoteId: movie.id,
              });
              break;
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
      for (const connector of sonarrConnectors) {
        try {
          const series = await connector.getSeries();
          for (const item of series) {
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
              break;
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

export const useCheckInLibrary = (
  params: CheckInLibraryParams,
): UseCheckInLibraryResult => {
  const radarrConnectors = useConnectorsStore(
    selectConnectorsByType("radarr"),
  ) as RadarrConnector[];
  const sonarrConnectors = useConnectorsStore(
    selectConnectorsByType("sonarr"),
  ) as SonarrConnector[];

  const query = useQuery({
    queryKey: queryKeys.library.checkInLibrary({
      tmdbId: params.tmdbId,
      tvdbId: params.tvdbId,
      imdbId: params.sourceId,
      mediaType: params.mediaType,
    }),
    queryFn: async () =>
      checkItemInLibrary(params, radarrConnectors, sonarrConnectors),
    enabled: params.enabled !== false,
    ...QUERY_CONFIG.LIBRARY_CHECK,
  });

  return {
    isLoading: query.isLoading,
    error: query.error,
    foundServices: query.data ?? [],
    refetch: () => void query.refetch(),
  };
};
