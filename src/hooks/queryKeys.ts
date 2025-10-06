import type { UnifiedSearchMediaType } from '@/models/search.types';

type QueryKeySegment = string | number | boolean | Record<string, unknown> | undefined;

type QueryKeyBuilder = readonly QueryKeySegment[];

/** Centralised query key factories for TanStack Query resources. */
export const queryKeys = {
  unifiedSearch: {
    base: ['unifiedSearch'] as const,
    results: (
      term: string,
      options?: { serviceIds?: string[]; mediaTypes?: UnifiedSearchMediaType[] },
    ): QueryKeyBuilder => [
      'unifiedSearch',
      'results',
      {
        term: term.trim(),
        services: options?.serviceIds ? [...options.serviceIds].sort() : undefined,
        mediaTypes: options?.mediaTypes ? [...options.mediaTypes].sort() : undefined,
      },
    ] as const,
    history: ['unifiedSearch', 'history'] as const,
    services: ['unifiedSearch', 'services'] as const,
  },
  services: {
    base: ['services'] as const,
    overview: ['services', 'overview'] as const,
  },
  activity: {
    base: ['activity'] as const,
    recentlyAdded: ['activity', 'recentlyAdded'] as const,
    downloadsOverview: ['activity', 'downloadsOverview'] as const,
  },
  sonarr: {
    base: ['sonarr'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['sonarr', serviceId] as const,
    seriesList: (serviceId: string): QueryKeyBuilder => [...queryKeys.sonarr.service(serviceId), 'series'] as const,
    seriesDetail: (serviceId: string, seriesId: number): QueryKeyBuilder => [
      ...queryKeys.sonarr.service(serviceId),
      'series',
      seriesId,
    ] as const,
    qualityProfiles: (serviceId: string): QueryKeyBuilder => [...queryKeys.sonarr.service(serviceId), 'qualityProfiles'] as const,
    rootFolders: (serviceId: string): QueryKeyBuilder => [...queryKeys.sonarr.service(serviceId), 'rootFolders'] as const,
    search: (serviceId: string, term: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.sonarr.service(serviceId),
      'search',
      { term, filters },
    ] as const,
    queue: (serviceId: string): QueryKeyBuilder => [...queryKeys.sonarr.service(serviceId), 'queue'] as const,
  },
  radarr: {
    base: ['radarr'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['radarr', serviceId] as const,
    moviesList: (serviceId: string): QueryKeyBuilder => [...queryKeys.radarr.service(serviceId), 'movies'] as const,
    movieDetail: (serviceId: string, movieId: number): QueryKeyBuilder => [
      ...queryKeys.radarr.service(serviceId),
      'movies',
      movieId,
    ] as const,
    qualityProfiles: (serviceId: string): QueryKeyBuilder => [...queryKeys.radarr.service(serviceId), 'qualityProfiles'] as const,
    rootFolders: (serviceId: string): QueryKeyBuilder => [...queryKeys.radarr.service(serviceId), 'rootFolders'] as const,
    search: (serviceId: string, term: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.radarr.service(serviceId),
      'search',
      { term, filters },
    ] as const,
    queue: (serviceId: string): QueryKeyBuilder => [...queryKeys.radarr.service(serviceId), 'queue'] as const,
  },
  jellyseerr: {
    base: ['jellyseerr'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['jellyseerr', serviceId] as const,
    requestsList: (serviceId: string, params?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'requests',
      params ?? {},
    ] as const,
    requestDetail: (serviceId: string, requestId: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'requests',
      requestId,
    ] as const,
    search: (serviceId: string, term: string, params?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'search',
      { term, params },
    ] as const,
  },
  qbittorrent: {
    base: ['qbittorrent'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['qbittorrent', serviceId] as const,
    torrents: (serviceId: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.qbittorrent.service(serviceId),
      'torrents',
      filters ?? {},
    ] as const,
    transferInfo: (serviceId: string): QueryKeyBuilder => [...queryKeys.qbittorrent.service(serviceId), 'transferInfo'] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
