import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import type { JellyseerrConnector } from '@/connectors/implementations/JellyseerrConnector';
import type { RadarrConnector } from '@/connectors/implementations/RadarrConnector';
import type { SonarrConnector } from '@/connectors/implementations/SonarrConnector';
import type { IConnector } from '@/connectors/base/IConnector';
import type { ServiceType } from '@/models/service.types';
import { useConnectorsStore } from '@/store/connectorsStore';
import { queryKeys } from '@/hooks/queryKeys';
import type { DiscoverMediaItem, DiscoverSection, UnifiedDiscoverPayload, UnifiedDiscoverServices } from '@/models/discover.types';
import type { JellyseerrSearchResult } from '@/models/jellyseerr.types';
import type { ServiceConfig } from '@/models/service.types';

const emptyServices: UnifiedDiscoverServices = {
  sonarr: [],
  radarr: [],
  jellyseerr: [],
};

const mapServiceSummaries = (configs: ServiceConfig[]) =>
  configs.map((config) => ({
    id: config.id,
    name: config.name,
    type: config.type,
  }));

const mapTrendingResult = (
  result: JellyseerrSearchResult,
  mediaType: DiscoverMediaItem['mediaType'],
  sourceServiceId?: string,
): DiscoverMediaItem => ({
  id: `${mediaType}-${result.tmdbId ?? result.tvdbId ?? result.id}`,
  title: result.title,
  mediaType,
  overview: result.overview,
  posterUrl: result.posterUrl,
  backdropUrl: result.backdropUrl,
  rating: result.rating,
  popularity: result.popularity,
  releaseDate: result.mediaType === 'tv' ? result.firstAirDate ?? result.releaseDate : result.releaseDate,
  year: (() => {
    const dateString = result.mediaType === 'tv' ? result.firstAirDate : result.releaseDate;
    if (!dateString) {
      return undefined;
    }
    const parsed = Number.parseInt(dateString.slice(0, 4), 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  })(),
  sourceId: result.id,
  tmdbId: result.tmdbId,
  tvdbId: result.tvdbId,
  imdbId: result.imdbId,
  voteCount: result.popularity ?? undefined,
  sourceServiceId: sourceServiceId,
  source: 'jellyseerr',
});

const fetchUnifiedDiscover = async (getConnectorsByType: (type: ServiceType) => IConnector[]): Promise<UnifiedDiscoverPayload> => {

  const jellyConnectors = getConnectorsByType('jellyseerr') as JellyseerrConnector[];
  const sonarrConnectors = getConnectorsByType('sonarr') as SonarrConnector[];
  const radarrConnectors = getConnectorsByType('radarr') as RadarrConnector[];

  const services: UnifiedDiscoverServices = {
    sonarr: mapServiceSummaries(sonarrConnectors.map((connector) => connector.config)),
    radarr: mapServiceSummaries(radarrConnectors.map((connector) => connector.config)),
    jellyseerr: mapServiceSummaries(jellyConnectors.map((connector) => connector.config)),
  };

  const trendingResponses = await Promise.all(
    jellyConnectors.map(async (connector) => {
      try {
        const response = await connector.getTrending({ page: 1 });
        return { connectorId: connector.config.id, items: response.items } as const;
      } catch (error) {
        console.warn(`Failed to load trending titles from ${connector.config.name}:`, error);
        return { connectorId: connector.config.id, items: [] as JellyseerrSearchResult[] } as const;
      }
    }),
  );

  // Flatten while keeping a reference to which connector the item came from so
  // that we can pre-fill sourceServiceId for subsequent detailed fetches.
  const trendingItems = trendingResponses.flatMap((r) => r.items.map((it) => ({ ...it, __sourceServiceId: r.connectorId } as unknown as JellyseerrSearchResult & { __sourceServiceId?: string })));

  if (trendingItems.length === 0) {
    return {
      sections: [],
      services,
    };
  }

  const deduped = new Map<string, JellyseerrSearchResult & { __sourceServiceId?: string }>();
  for (const item of trendingItems) {
    const key = item.tmdbId ? `tmdb-${item.tmdbId}` : `${item.mediaType}-${item.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, item as JellyseerrSearchResult & { __sourceServiceId?: string });
    }
  }

  const tvResults: DiscoverMediaItem[] = [];
  const movieResults: DiscoverMediaItem[] = [];

  deduped.forEach((value) => {
    const connectorId = (value as any).__sourceServiceId as string | undefined;
    if (value.mediaType === 'tv') {
      tvResults.push(mapTrendingResult(value, 'series', connectorId));
    } else if (value.mediaType === 'movie') {
      movieResults.push(mapTrendingResult(value, 'movie', connectorId));
    }
  });

  const sections: DiscoverSection[] = [];

  if (tvResults.length) {
    sections.push({
      id: 'popular-tv',
      title: 'Popular TV Shows',
      mediaType: 'series',
      source: 'jellyseerr',
      items: tvResults.slice(0, 12),
    });
  }

  if (movieResults.length) {
    sections.push({
      id: 'trending-movies',
      title: 'Trending Movies',
      mediaType: 'movie',
      source: 'jellyseerr',
      items: movieResults.slice(0, 12),
    });
  }

  return {
    sections,
    services,
  };
};

export const useUnifiedDiscover = () => {
  const { getConnectorsByType } = useConnectorsStore();
  const query = useQuery<UnifiedDiscoverPayload>({
    queryKey: queryKeys.discover.unified,
    queryFn: () => fetchUnifiedDiscover(getConnectorsByType),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const services = useMemo(() => query.data?.services ?? emptyServices, [query.data?.services]);
  const sections = useMemo(() => query.data?.sections ?? [], [query.data?.sections]);

  return {
    sections,
    services,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};
