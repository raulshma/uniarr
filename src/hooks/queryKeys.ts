type QueryKeySegment = string | number | boolean | Record<string, unknown> | undefined;

type QueryKeyBuilder = readonly QueryKeySegment[];

/** Centralised query key factories for TanStack Query resources. */
export const queryKeys = {
  services: {
    base: ['services'] as const,
    overview: ['services', 'overview'] as const,
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
} as const;

export type QueryKeys = typeof queryKeys;
