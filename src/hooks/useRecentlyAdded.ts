import { useQuery } from "@tanstack/react-query";

import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import {
  useConnectorsStore,
  selectConnectorsByType,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";

export type RecentlyAddedItem = {
  id: string;
  title: string;
  type: "series" | "movie";
  addedDate: string;
  posterUrl?: string;
  serviceName: string;
  serviceId: string;
};

export type RecentlyAddedOverview = {
  items: RecentlyAddedItem[];
  total: number;
};

const fetchRecentlyAdded = async (
  sonarrConnectors: SonarrConnector[],
  radarrConnectors: RadarrConnector[],
): Promise<RecentlyAddedOverview> => {
  const recentlyAddedItems: RecentlyAddedItem[] = [];

  for (const connector of sonarrConnectors) {
    try {
      const series = await connector.getSeries();

      const recentSeries = series
        .filter((s) => s.added)
        .sort(
          (a, b) => new Date(b.added!).getTime() - new Date(a.added!).getTime(),
        )
        .slice(0, 10);

      for (const item of recentSeries) {
        recentlyAddedItems.push({
          id: `sonarr-${item.id}`,
          title: item.title,
          type: "series",
          addedDate: item.added!,
          posterUrl: item.posterUrl,
          serviceName: connector.config.name,
          serviceId: connector.config.id,
        });
      }
    } catch (error) {
      console.warn(
        `Failed to fetch series from ${connector.config.name}:`,
        error,
      );
    }
  }

  for (const connector of radarrConnectors) {
    try {
      const movies = await connector.getMovies();

      const recentMovies = movies
        .filter((m) => m.movieFile?.dateAdded)
        .sort(
          (a, b) =>
            new Date(b.movieFile!.dateAdded!).getTime() -
            new Date(a.movieFile!.dateAdded!).getTime(),
        )
        .slice(0, 10);

      for (const movie of recentMovies) {
        recentlyAddedItems.push({
          id: `radarr-${movie.id}`,
          title: movie.title,
          type: "movie",
          addedDate: movie.movieFile!.dateAdded!,
          posterUrl: movie.posterUrl,
          serviceName: connector.config.name,
          serviceId: connector.config.id,
        });
      }
    } catch (error) {
      console.warn(
        `Failed to fetch movies from ${connector.config.name}:`,
        error,
      );
    }
  }

  const sortedItems = recentlyAddedItems
    .sort(
      (a, b) =>
        new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime(),
    )
    .slice(0, 20);

  return {
    items: sortedItems,
    total: sortedItems.length,
  };
};

export const useRecentlyAdded = () => {
  const sonarrConnectors = useConnectorsStore(
    selectConnectorsByType("sonarr"),
  ) as SonarrConnector[];
  const radarrConnectors = useConnectorsStore(
    selectConnectorsByType("radarr"),
  ) as RadarrConnector[];
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: queryKeys.activity.recentlyAdded,
    queryFn: async () => {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();

      return fetchRecentlyAdded(sonarrConnectors, radarrConnectors);
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    recentlyAdded: data ?? { items: [], total: 0 },
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
};
