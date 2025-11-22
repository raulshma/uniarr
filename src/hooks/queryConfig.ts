/**
 * Centralized query configuration for consistent caching and retry strategies across the application.
 */

export const STALE_TIME = {
  // Real-time data that changes frequently
  REALTIME: 5_000, // 5 seconds
  SHORT: 15_000, // 15 seconds
  MEDIUM: 60_000, // 1 minute
  LONG: 5 * 60_000, // 5 minutes
  VERY_LONG: 15 * 60_000, // 15 minutes
  // Static data that rarely changes
  RARELY: 12 * 60 * 60_000, // 12 hours
} as const;

export const CACHE_TIME = {
  // Keep data in cache for garbage collection
  SHORT: 60_000, // 1 minute
  MEDIUM: 5 * 60_000, // 5 minutes
  LONG: 15 * 60_000, // 15 minutes
  VERY_LONG: 60 * 60_000, // 1 hour
  // Static data
  RARELY: 24 * 60 * 60_000, // 24 hours
} as const;

export const RETRY_CONFIG = {
  // Default retry configuration
  DEFAULT: {
    retry: 2,
    retryDelay: (attemptIndex: number) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),
  },
  // No retry for validation errors
  NO_RETRY: {
    retry: false,
  },
  // Aggressive retry for critical data
  AGGRESSIVE: {
    retry: 3,
    retryDelay: (attemptIndex: number) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),
  },
} as const;

export const REFETCH_CONFIG = {
  // Default: no refetch on window focus for better UX
  DEFAULT: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },
  // Real-time data: refetch more frequently
  REALTIME: {
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: true,
  },
  // Static data: minimal refetching
  STATIC: {
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  },
} as const;

/**
 * Predefined query configurations for different data types
 */
export const QUERY_CONFIG = {
  // Calendar data - medium freshness, refetch on window focus
  CALENDAR: {
    staleTime: STALE_TIME.MEDIUM,
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.DEFAULT,
  },
  // Queue/torrent data - very fresh, real-time
  QUEUE: {
    staleTime: STALE_TIME.REALTIME,
    cacheTime: CACHE_TIME.SHORT,
    ...RETRY_CONFIG.AGGRESSIVE,
    ...REFETCH_CONFIG.REALTIME,
  },
  // Search results - short stale time, no window focus refetch
  SEARCH: {
    staleTime: STALE_TIME.SHORT,
    cacheTime: CACHE_TIME.MEDIUM,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.DEFAULT,
  },
  // AI search interpretation - 5 minutes (users may refine)
  AI_SEARCH_INTERPRETATION: {
    staleTime: STALE_TIME.LONG,
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.DEFAULT,
  },
  // Search recommendations - 30 minutes (relatively static)
  SEARCH_RECOMMENDATIONS: {
    staleTime: STALE_TIME.VERY_LONG,
    cacheTime: CACHE_TIME.VERY_LONG,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.DEFAULT,
  },
  // Search history - static data
  SEARCH_HISTORY: {
    staleTime: STALE_TIME.RARELY,
    cacheTime: CACHE_TIME.RARELY,
    ...RETRY_CONFIG.NO_RETRY,
    ...REFETCH_CONFIG.STATIC,
  },
  // Service health - medium freshness
  HEALTH: {
    staleTime: STALE_TIME.MEDIUM,
    cacheTime: CACHE_TIME.MEDIUM,
    ...RETRY_CONFIG.AGGRESSIVE,
    ...REFETCH_CONFIG.REALTIME,
  },
  // Media metadata (TMDB, etc.) - very stable
  METADATA: {
    staleTime: STALE_TIME.VERY_LONG,
    cacheTime: CACHE_TIME.RARELY,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.STATIC,
  },
  // User services/settings - medium freshness
  SERVICES: {
    staleTime: STALE_TIME.MEDIUM,
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    ...REFETCH_CONFIG.DEFAULT,
  },
  // Library data (movies, series) - medium freshness
  LIBRARY: {
    staleTime: STALE_TIME.LONG, // 5 minutes
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Library details - shorter freshness
  LIBRARY_DETAIL: {
    staleTime: STALE_TIME.SHORT * 8, // 2 minutes
    cacheTime: CACHE_TIME.MEDIUM,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Anime/Jikan data - medium freshness
  ANIME: {
    staleTime: STALE_TIME.LONG, // 5 minutes
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Anime details - longer freshness
  ANIME_DETAIL: {
    staleTime: STALE_TIME.VERY_LONG, // 15 minutes
    cacheTime: CACHE_TIME.VERY_LONG,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Subtitles data - short freshness
  SUBTITLES: {
    staleTime: STALE_TIME.SHORT, // 15 seconds
    cacheTime: CACHE_TIME.MEDIUM,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Subtitles statistics - medium freshness
  SUBTITLES_STATS: {
    staleTime: STALE_TIME.LONG * 2, // 10 minutes
    cacheTime: CACHE_TIME.LONG,
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Library check - medium freshness with limited retry
  LIBRARY_CHECK: {
    staleTime: STALE_TIME.LONG, // 5 minutes
    cacheTime: CACHE_TIME.LONG * 2, // 10 minutes
    retry: 1,
    refetchOnWindowFocus: false,
  },
  // Discover releases - medium freshness, offline-first
  DISCOVER_RELEASES: {
    staleTime: STALE_TIME.LONG * 2, // 10 minutes
    cacheTime: CACHE_TIME.LONG * 2, // 30 minutes
    ...RETRY_CONFIG.DEFAULT,
    networkMode: "offlineFirst" as const,
    refetchOnWindowFocus: false,
  },
  // Unified discover - longer freshness
  UNIFIED_DISCOVER: {
    staleTime: STALE_TIME.VERY_LONG, // 15 minutes
    cacheTime: CACHE_TIME.LONG * 2, // 30 minutes
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Recently added - short freshness with auto-refetch
  RECENTLY_ADDED: {
    staleTime: STALE_TIME.SHORT * 8, // 2 minutes
    cacheTime: CACHE_TIME.MEDIUM,
    refetchInterval: STALE_TIME.LONG, // 5 minutes
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Recommendations - very long freshness
  RECOMMENDATIONS: {
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
  // Content gaps - very long freshness
  CONTENT_GAPS: {
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    cacheTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
  },
} as const;

/**
 * Get query configuration for a specific data type
 */
export function getQueryConfig(dataType: keyof typeof QUERY_CONFIG) {
  return QUERY_CONFIG[dataType];
}

/**
 * Merge custom configuration with predefined defaults
 */
export function createQueryConfig(
  baseType: keyof typeof QUERY_CONFIG,
  overrides: Record<string, unknown> = {},
) {
  const baseConfig = QUERY_CONFIG[baseType];
  return { ...baseConfig, ...overrides };
}

/**
 * Common query key patterns
 */
export const QUERY_KEYS = {
  // Calendar
  CALENDAR: ["calendar"] as const,
  CALENDAR_RANGE: (start: string, end: string) =>
    ["calendar", { start, end }] as const,

  // Services
  SERVICES: ["services"] as const,
  SERVICE_HEALTH: (serviceId: string) =>
    ["services", serviceId, "health"] as const,

  // Queue/Torrents
  QUEUE: ["queue"] as const,
  QUEUE_SERVICE: (serviceId: string) => ["queue", serviceId] as const,
  TORRENTS: ["torrents"] as const,
  TORRENTS_SERVICE: (serviceId: string) => ["torrents", serviceId] as const,

  // Search
  SEARCH: ["search"] as const,
  SEARCH_HISTORY: ["search", "history"] as const,

  // Metadata
  TMDB_GENRES: ["tmdb", "genres"] as const,
  TMDB_DETAILS: (mediaType: string, tmdbId: number) =>
    ["tmdb", mediaType, tmdbId] as const,

  // Notifications
  NOTIFICATIONS: ["notifications"] as const,
} as const;
