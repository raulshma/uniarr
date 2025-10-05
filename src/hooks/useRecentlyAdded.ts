import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { Series } from '@/models/media.types';
import type { Movie } from '@/models/movie.types';
import type { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import type { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';

export type RecentlyAddedItem = {
  id: string;
  title: string;
  type: 'series' | 'movie';
  addedDate: string;
  posterUrl?: string;
  serviceName: string;
  serviceId: string;
};

export type RecentlyAddedOverview = {
  items: RecentlyAddedItem[];
  total: number;
};

const fetchRecentlyAdded = async (): Promise<RecentlyAddedOverview> => {
  const manager = ConnectorManager.getInstance();
  await manager.loadSavedServices();

  const sonarrConnectors = manager.getConnectorsByType('sonarr') as SonarrConnector[];
  const radarrConnectors = manager.getConnectorsByType('radarr') as RadarrConnector[];

  const recentlyAddedItems: RecentlyAddedItem[] = [];

  // Get recently added series from Sonarr
  for (const connector of sonarrConnectors) {
    try {
      const series = await connector.getSeries();

      // Filter series that have been added and sort by added date (most recent first)
      const recentSeries = series
        .filter((s) => s.added)
        .sort((a, b) => new Date(b.added!).getTime() - new Date(a.added!).getTime())
        .slice(0, 10); // Get 10 most recent

      for (const series of recentSeries) {
        recentlyAddedItems.push({
          id: `sonarr-${series.id}`,
          title: series.title,
          type: 'series',
          addedDate: series.added!,
          posterUrl: series.posterUrl,
          serviceName: connector.config.name,
          serviceId: connector.config.id,
        });
      }
    } catch (error) {
      // Skip this connector if it fails
      console.warn(`Failed to fetch series from ${connector.config.name}:`, error);
    }
  }

  // Get recently added movies from Radarr
  for (const connector of radarrConnectors) {
    try {
      const movies = await connector.getMovies();

      // Filter movies that have files (downloaded) and sort by file date (most recent first)
      const recentMovies = movies
        .filter((m) => m.movieFile?.dateAdded)
        .sort((a, b) => new Date(b.movieFile!.dateAdded!).getTime() - new Date(a.movieFile!.dateAdded!).getTime())
        .slice(0, 10); // Get 10 most recent

      for (const movie of recentMovies) {
        recentlyAddedItems.push({
          id: `radarr-${movie.id}`,
          title: movie.title,
          type: 'movie',
          addedDate: movie.movieFile!.dateAdded!,
          posterUrl: movie.posterUrl,
          serviceName: connector.config.name,
          serviceId: connector.config.id,
        });
      }
    } catch (error) {
      // Skip this connector if it fails
      console.warn(`Failed to fetch movies from ${connector.config.name}:`, error);
    }
  }

  // Sort all items by added date (most recent first) and take top 20
  const sortedItems = recentlyAddedItems
    .sort((a, b) => new Date(b.addedDate).getTime() - new Date(a.addedDate).getTime())
    .slice(0, 20);

  return {
    items: sortedItems,
    total: sortedItems.length,
  };
};

export const useRecentlyAdded = () => {
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.activity.recentlyAdded,
    queryFn: fetchRecentlyAdded,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
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
