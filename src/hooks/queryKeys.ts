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
    mediaDetail: (serviceId: string, mediaType: 'movie' | 'tv', mediaId: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'media',
      mediaType,
      mediaId,
    ] as const,
    /**
     * Credits for a media item (cast/crew) keyed by service, media type and id.
     */
    mediaCredits: (serviceId: string, mediaType: 'movie' | 'tv', mediaId: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'mediaCredits',
      mediaType,
      mediaId,
    ] as const,
    search: (serviceId: string, term: string, params?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'search',
      { term, params },
    ] as const,
    animeRecommendations: (serviceId: string, page?: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'anime',
      'recommendations',
      { page },
    ] as const,
    animeUpcoming: (serviceId: string, page?: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'anime',
      'upcoming',
      { page },
    ] as const,
    trendingAnime: (serviceId: string, page?: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'anime',
      'trending',
      { page },
    ] as const,
    animeMovies: (serviceId: string, page?: number): QueryKeyBuilder => [
      ...queryKeys.jellyseerr.service(serviceId),
      'anime',
      'movies',
      { page },
    ] as const,
  },
  jellyfin: {
    base: ['jellyfin'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['jellyfin', serviceId] as const,
    libraries: (serviceId: string): QueryKeyBuilder => [...queryKeys.jellyfin.service(serviceId), 'libraries'] as const,
    resume: (serviceId: string, options?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyfin.service(serviceId),
      'resume',
      options ?? {},
    ] as const,
    latest: (serviceId: string, libraryId: string, options?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyfin.service(serviceId),
      'latest',
      libraryId,
      options ?? {},
    ] as const,
    libraryItems: (serviceId: string, libraryId: string, options?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyfin.service(serviceId),
      'libraryItems',
      libraryId,
      options ?? {},
    ] as const,
    item: (serviceId: string, itemId: string): QueryKeyBuilder => [
      ...queryKeys.jellyfin.service(serviceId),
      'item',
      itemId,
    ] as const,
    nowPlaying: (serviceId: string): QueryKeyBuilder => [...queryKeys.jellyfin.service(serviceId), 'nowPlaying'] as const,
    search: (serviceId: string, term: string, options?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.jellyfin.service(serviceId),
      'search',
      { term, options },
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
  transmission: {
    base: ['transmission'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['transmission', serviceId] as const,
    torrents: (serviceId: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.transmission.service(serviceId),
      'torrents',
      filters ?? {},
    ] as const,
    transferInfo: (serviceId: string): QueryKeyBuilder => [...queryKeys.transmission.service(serviceId), 'transferInfo'] as const,
  },
  calendar: {
    base: ['calendar'] as const,
    releases: (currentDate: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      'calendar',
      'releases',
      currentDate,
      filters ?? {},
    ] as const,
    stats: (currentDate: string, filters?: Record<string, unknown>): QueryKeyBuilder => [
      'calendar',
      'stats',
      currentDate,
      filters ?? {},
    ] as const,
  },
  discover: {
    base: ['discover'] as const,
    unified: ['discover', 'unified'] as const,
    jikanDetail: (malId: number): QueryKeyBuilder => ['discover', 'jikan', 'detail', malId] as const,
  },
  bazarr: {
    base: ['bazarr'] as const,
    service: (serviceId: string): QueryKeyBuilder => ['bazarr', serviceId] as const,
    moviesList: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'movies'] as const,
    movieDetail: (serviceId: string, movieId: number): QueryKeyBuilder => [
      ...queryKeys.bazarr.service(serviceId),
      'movies',
      movieId,
    ] as const,
    episodesList: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'episodes'] as const,
    episodeDetail: (serviceId: string, episodeId: number): QueryKeyBuilder => [
      ...queryKeys.bazarr.service(serviceId),
      'episodes',
      episodeId,
    ] as const,
    subtitlesList: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'subtitles'] as const,
    subtitlesByMovie: (serviceId: string, movieId: number): QueryKeyBuilder => [
      ...queryKeys.bazarr.service(serviceId),
      'subtitles',
      'movie',
      movieId,
    ] as const,
    subtitlesByEpisode: (serviceId: string, episodeId: number): QueryKeyBuilder => [
      ...queryKeys.bazarr.service(serviceId),
      'subtitles',
      'episode',
      episodeId,
    ] as const,
    languages: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'languages'] as const,
    providers: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'providers'] as const,
    profiles: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'profiles'] as const,
    queue: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'queue'] as const,
    history: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'history'] as const,
    statistics: (serviceId: string): QueryKeyBuilder => [...queryKeys.bazarr.service(serviceId), 'statistics'] as const,
    search: (serviceId: string, query: string, options?: Record<string, unknown>): QueryKeyBuilder => [
      ...queryKeys.bazarr.service(serviceId),
      'search',
      { query, options },
    ] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
