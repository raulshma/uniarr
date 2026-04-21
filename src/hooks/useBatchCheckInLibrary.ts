import { useQuery } from "@tanstack/react-query";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import {
  useConnectorsStore,
  selectConnectorsByType,
} from "@/store/connectorsStore";
import { logger } from "@/services/logger/LoggerService";
import type {
  DiscoverMediaKind,
  DiscoverMediaItem,
} from "@/models/discover.types";
import { queryKeys } from "@/hooks/queryKeys";

export interface FoundService {
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly sourceId?: number;
  readonly services: {
    readonly serviceId: string;
    readonly name: string;
    readonly connectorType: "radarr" | "sonarr";
    readonly remoteId: number;
  }[];
}

export interface UseBatchCheckInLibraryResult {
  readonly isLoading: boolean;
  readonly error: Error | null;
  readonly itemsInLibrary: Map<string, FoundService>;
  readonly refetch: () => void;
}

interface CheckItemParams {
  readonly id: string;
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly sourceId?: number;
  readonly mediaType: DiscoverMediaKind;
}

const checkItemsInLibrary = async (
  items: CheckItemParams[],
  radarrConnectors: RadarrConnector[],
  sonarrConnectors: SonarrConnector[],
): Promise<Map<string, FoundService>> => {
  const result = new Map<string, FoundService>();

  if (items.length === 0) {
    return result;
  }

  try {
    const movieItems = items.filter((item) => item.mediaType === "movie");
    const seriesItems = items.filter((item) => item.mediaType === "series");

    if (movieItems.length > 0) {
      for (const connector of radarrConnectors) {
        try {
          const movies = await connector.getMovies();

          for (const item of movieItems) {
            if (!item.tmdbId) continue;

            const matchingMovie = movies.find(
              (movie) => movie.tmdbId === item.tmdbId,
            );
            if (matchingMovie) {
              const key = item.id;
              if (!result.has(key)) {
                result.set(key, {
                  tmdbId: item.tmdbId,
                  sourceId: item.sourceId,
                  services: [],
                });
              }
              result.get(key)!.services.push({
                serviceId: connector.config.id,
                name: connector.config.name,
                connectorType: "radarr",
                remoteId: matchingMovie.id,
              });
            }
          }
        } catch (error) {
          logger.warn(
            "[useBatchCheckInLibrary] Failed to check Radarr service",
            {
              serviceId: connector.config.id,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }

    if (seriesItems.length > 0) {
      for (const connector of sonarrConnectors) {
        try {
          const series = await connector.getSeries();

          for (const item of seriesItems) {
            const matchingShow = series.find(
              (show) =>
                (item.tmdbId && show.tmdbId === item.tmdbId) ||
                (item.tvdbId && show.tvdbId === item.tvdbId),
            );

            if (matchingShow) {
              const key = item.id;
              if (!result.has(key)) {
                result.set(key, {
                  tmdbId: item.tmdbId,
                  tvdbId: item.tvdbId,
                  sourceId: item.sourceId,
                  services: [],
                });
              }
              result.get(key)!.services.push({
                serviceId: connector.config.id,
                name: connector.config.name,
                connectorType: "sonarr",
                remoteId: matchingShow.id,
              });
            }
          }
        } catch (error) {
          logger.warn(
            "[useBatchCheckInLibrary] Failed to check Sonarr service",
            {
              serviceId: connector.config.id,
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  } catch (error) {
    logger.error(
      "[useBatchCheckInLibrary] Unexpected error during batch check",
      {
        error: error instanceof Error ? error.message : String(error),
        itemCount: items.length,
      },
    );
    throw error;
  }

  return result;
};

export const useBatchCheckInLibrary = (
  items: DiscoverMediaItem[],
): UseBatchCheckInLibraryResult => {
  const radarrConnectors = useConnectorsStore(
    selectConnectorsByType("radarr"),
  ) as RadarrConnector[];
  const sonarrConnectors = useConnectorsStore(
    selectConnectorsByType("sonarr"),
  ) as SonarrConnector[];

  const checkItems = items.map((item) => ({
    id: item.id,
    tmdbId: item.tmdbId,
    tvdbId: item.tvdbId,
    sourceId: item.sourceId,
    mediaType: item.mediaType,
  }));

  const query = useQuery({
    queryKey: queryKeys.library.batchCheckInLibrary(
      checkItems.map((item) => `${item.id}`),
    ),
    queryFn: async () =>
      checkItemsInLibrary(checkItems, radarrConnectors, sonarrConnectors),
    enabled: items.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const safeData = query.data;
  let itemsInLibraryMap: Map<string, FoundService>;

  if (safeData instanceof Map) {
    itemsInLibraryMap = safeData;
  } else if (safeData && typeof safeData === "object") {
    try {
      itemsInLibraryMap = new Map(
        Object.entries(safeData) as [string, FoundService][],
      );
    } catch {
      itemsInLibraryMap = new Map();
    }
  } else {
    itemsInLibraryMap = new Map();
  }

  return {
    isLoading: query.isLoading,
    error: query.error,
    itemsInLibrary: itemsInLibraryMap,
    refetch: () => void query.refetch(),
  };
};
