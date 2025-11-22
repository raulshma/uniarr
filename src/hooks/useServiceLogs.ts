import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  LogAggregationService,
  type AggregatedLogs,
  type LogSearchOptions,
} from "@/services/logs/LogAggregationService";
import { LogHealthCacheService } from "@/services/cache/LogHealthCacheService";
import type { ServiceLog, LogQueryOptions } from "@/models/logger.types";
import { STALE_TIME, CACHE_TIME, RETRY_CONFIG } from "@/hooks/queryConfig";

/**
 * Query key factory for log queries
 */
const logKeys = {
  base: ["logs"] as const,
  aggregated: (serviceIds: string[], options?: LogQueryOptions) =>
    [
      "logs",
      "aggregated",
      { serviceIds: [...serviceIds].sort(), options },
    ] as const,
  search: (query: string, options?: LogSearchOptions) =>
    ["logs", "search", { query, options }] as const,
};

/**
 * Options for useServiceLogs hook
 */
export interface UseServiceLogsOptions extends LogQueryOptions {
  /**
   * Array of service IDs to query. If empty, queries all services.
   */
  serviceIds?: string[];

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Enable pagination. Defaults to false.
   */
  enablePagination?: boolean;

  /**
   * Page size for pagination. Defaults to 100.
   */
  pageSize?: number;
}

/**
 * Hook for fetching service logs (non-paginated)
 *
 * Features:
 * - TanStack Query integration
 * - Search, filter, and sort functionality
 * - Offline mode with cached data
 * - Automatic cache management
 *
 * @param options - Configuration options
 * @returns Query result with log data
 *
 * @example
 * ```tsx
 * const { data: logs, isLoading } = useServiceLogs({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   level: ['error', 'warn'],
 *   since: new Date(Date.now() - 24 * 60 * 60 * 1000),
 * });
 * ```
 */
export function useServiceLogs(
  options: Omit<UseServiceLogsOptions, "enablePagination" | "pageSize"> = {},
) {
  const { serviceIds = [], enabled = true, ...queryOptions } = options;

  const { isConnected } = useNetworkStatus();
  const logService = useMemo(() => LogAggregationService.getInstance(), []);
  const cacheService = useMemo(() => LogHealthCacheService.getInstance(), []);

  // Memoize query key to prevent unnecessary refetches
  const queryKey = useMemo(
    () => logKeys.aggregated(serviceIds, queryOptions),
    [serviceIds, queryOptions],
  );

  return useQuery({
    queryKey,
    queryFn: async (): Promise<AggregatedLogs> => {
      const fetchOptions: LogQueryOptions = {
        ...queryOptions,
        limit: queryOptions.limit || 1000, // Default limit
      };

      // Try to fetch from service
      if (isConnected) {
        try {
          const logs = await logService.fetchLogs(serviceIds, fetchOptions);

          // Cache the result
          await cacheService.cacheLogs(
            serviceIds.length > 0 ? serviceIds.join(",") : "all",
            logs.logs,
          );

          return logs;
        } catch (error) {
          // If fetch fails and we're offline, try cache
          if (!isConnected) {
            const cached = await cacheService.getCachedLogs(
              serviceIds.length > 0 ? serviceIds.join(",") : "all",
            );
            if (cached) {
              return {
                logs: cached,
                totalCount: cached.length,
                hasMore: false,
                services: Array.from(
                  new Set(cached.map((log) => log.serviceId)),
                ),
                timeRange: {
                  start:
                    cached.length > 0 && cached[cached.length - 1]
                      ? cached[cached.length - 1]!.timestamp
                      : new Date(),
                  end:
                    cached.length > 0 && cached[0]
                      ? cached[0]!.timestamp
                      : new Date(),
                },
              };
            }
          }
          throw error;
        }
      }

      // Offline mode: return cached data
      const cached = await cacheService.getCachedLogs(
        serviceIds.length > 0 ? serviceIds.join(",") : "all",
      );

      if (cached) {
        return {
          logs: cached,
          totalCount: cached.length,
          hasMore: false,
          services: Array.from(new Set(cached.map((log) => log.serviceId))),
          timeRange: {
            start:
              cached.length > 0 && cached[cached.length - 1]
                ? cached[cached.length - 1]!.timestamp
                : new Date(),
            end:
              cached.length > 0 && cached[0]
                ? cached[0]!.timestamp
                : new Date(),
          },
        };
      }

      // No cached data available
      throw new Error("No cached log data available offline");
    },
    staleTime: STALE_TIME.SHORT,
    gcTime: CACHE_TIME.MEDIUM,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Hook for fetching service logs with pagination support
 *
 * Features:
 * - TanStack Query with infinite scroll pagination
 * - Search, filter, and sort functionality
 * - Offline mode with cached data
 * - Automatic cache management
 *
 * @param options - Configuration options
 * @returns Infinite query result with log data
 *
 * @example
 * ```tsx
 * const { data, isLoading, fetchNextPage, hasNextPage } = useServiceLogsPaginated({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   level: ['error', 'warn'],
 *   pageSize: 50,
 * });
 * ```
 */
export function useServiceLogsPaginated(
  options: Omit<UseServiceLogsOptions, "enablePagination"> = {},
) {
  const {
    serviceIds = [],
    enabled = true,
    pageSize = 100,
    ...queryOptions
  } = options;

  const { isConnected } = useNetworkStatus();
  const logService = useMemo(() => LogAggregationService.getInstance(), []);
  const cacheService = useMemo(() => LogHealthCacheService.getInstance(), []);

  // Memoize query key to prevent unnecessary refetches
  const queryKey = useMemo(
    () => logKeys.aggregated(serviceIds, queryOptions),
    [serviceIds, queryOptions],
  );

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }): Promise<AggregatedLogs> => {
      const fetchOptions: LogQueryOptions = {
        ...queryOptions,
        limit: pageSize,
        startIndex: pageParam as number,
      };

      // Try to fetch from service
      if (isConnected) {
        try {
          const logs = await logService.fetchLogs(serviceIds, fetchOptions);

          // Cache the result
          await cacheService.cacheLogs(
            serviceIds.length > 0 ? serviceIds.join(",") : "all",
            logs.logs,
          );

          return logs;
        } catch (error) {
          // If fetch fails and we're offline, try cache
          if (!isConnected) {
            const cached = await cacheService.getCachedLogs(
              serviceIds.length > 0 ? serviceIds.join(",") : "all",
            );
            if (cached) {
              // Apply pagination to cached logs
              const paginatedLogs = cached.slice(
                pageParam as number,
                (pageParam as number) + pageSize,
              );
              return {
                logs: paginatedLogs,
                totalCount: cached.length,
                hasMore: (pageParam as number) + pageSize < cached.length,
                services: Array.from(
                  new Set(paginatedLogs.map((log) => log.serviceId)),
                ),
                timeRange: {
                  start:
                    paginatedLogs.length > 0 &&
                    paginatedLogs[paginatedLogs.length - 1]
                      ? paginatedLogs[paginatedLogs.length - 1]!.timestamp
                      : new Date(),
                  end:
                    paginatedLogs.length > 0 && paginatedLogs[0]
                      ? paginatedLogs[0]!.timestamp
                      : new Date(),
                },
              };
            }
          }
          throw error;
        }
      }

      // Offline mode: return cached data
      const cached = await cacheService.getCachedLogs(
        serviceIds.length > 0 ? serviceIds.join(",") : "all",
      );

      if (cached) {
        // Apply pagination to cached logs
        const paginatedLogs = cached.slice(
          pageParam as number,
          (pageParam as number) + pageSize,
        );
        return {
          logs: paginatedLogs,
          totalCount: cached.length,
          hasMore: (pageParam as number) + pageSize < cached.length,
          services: Array.from(
            new Set(paginatedLogs.map((log) => log.serviceId)),
          ),
          timeRange: {
            start:
              paginatedLogs.length > 0 &&
              paginatedLogs[paginatedLogs.length - 1]
                ? paginatedLogs[paginatedLogs.length - 1]!.timestamp
                : new Date(),
            end:
              paginatedLogs.length > 0 && paginatedLogs[0]
                ? paginatedLogs[0]!.timestamp
                : new Date(),
          },
        };
      }

      // No cached data available
      throw new Error("No cached log data available offline");
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return allPages.length * pageSize;
    },
    staleTime: STALE_TIME.SHORT, // 15 seconds
    gcTime: CACHE_TIME.MEDIUM, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Hook for searching logs with debouncing
 *
 * @param query - Search query string
 * @param options - Search options
 * @returns Query result with search results
 *
 * @example
 * ```tsx
 * const { data: results, isLoading } = useLogSearch('error', {
 *   serviceIds: ['sonarr-1'],
 *   caseSensitive: false,
 *   highlightMatches: true,
 * });
 * ```
 */
export function useLogSearch(
  query: string,
  options: Omit<LogSearchOptions, "searchTerm"> & { enabled?: boolean } = {},
) {
  const { enabled = true, ...searchOptions } = options;
  const { isConnected } = useNetworkStatus();
  const logService = useMemo(() => LogAggregationService.getInstance(), []);
  const cacheService = useMemo(() => LogHealthCacheService.getInstance(), []);

  // Memoize query key to prevent unnecessary refetches
  const queryKey = useMemo(
    () => logKeys.search(query, searchOptions),
    [query, searchOptions],
  );

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ServiceLog[]> => {
      // Try to search from service
      if (isConnected) {
        try {
          return await logService.searchLogs(query, searchOptions);
        } catch (error) {
          // If search fails and we're offline, search cached data
          if (!isConnected) {
            const cached = await cacheService.getCachedLogs(
              searchOptions.serviceIds
                ? searchOptions.serviceIds.join(",")
                : "all",
            );
            if (cached) {
              // Perform client-side search on cached data
              return performClientSideSearch(cached, query, searchOptions);
            }
          }
          throw error;
        }
      }

      // Offline mode: search cached data
      const cached = await cacheService.getCachedLogs(
        searchOptions.serviceIds ? searchOptions.serviceIds.join(",") : "all",
      );

      if (cached) {
        return performClientSideSearch(cached, query, searchOptions);
      }

      // No cached data available
      return [];
    },
    staleTime: STALE_TIME.SHORT,
    gcTime: CACHE_TIME.SHORT,
    refetchOnWindowFocus: false,
    enabled: enabled && query.trim().length > 0,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Hook to get cache timestamp for logs
 *
 * @param serviceIds - Service IDs to check cache for
 * @returns Cache timestamp or null if not cached
 *
 * @example
 * ```tsx
 * const cacheTimestamp = useLogCacheTimestamp(['sonarr-1']);
 * ```
 */
export function useLogCacheTimestamp(serviceIds: string[] = []): Date | null {
  const cacheService = useMemo(() => LogHealthCacheService.getInstance(), []);
  const cacheKey = useMemo(
    () => (serviceIds.length > 0 ? serviceIds.join(",") : "all"),
    [serviceIds],
  );

  const { data } = useQuery({
    queryKey: useMemo(() => ["logs", "cacheTimestamp", cacheKey], [cacheKey]),
    queryFn: async () => {
      return await cacheService.getLogsCacheTimestamp(cacheKey);
    },
    staleTime: STALE_TIME.SHORT,
    gcTime: CACHE_TIME.SHORT,
  });

  return data || null;
}

/**
 * Hook to manually refresh logs
 *
 * @returns Callback to refresh log data
 *
 * @example
 * ```tsx
 * const refreshLogs = useRefreshLogs();
 *
 * <Button onPress={() => refreshLogs(['sonarr-1'])}>Refresh</Button>
 * ```
 */
export function useRefreshLogs() {
  const queryClient = useQueryClient();

  return useCallback(
    async (serviceIds: string[] = []) => {
      // Invalidate all log queries for the given service IDs
      await queryClient.invalidateQueries({
        queryKey: ["logs", "aggregated"],
        predicate: (query) => {
          const key = query.queryKey as unknown[];
          if (key[0] === "logs" && key[1] === "aggregated" && key[2]) {
            const params = key[2] as { serviceIds: string[] };
            if (serviceIds.length === 0) return true;
            return serviceIds.some((id) => params.serviceIds?.includes(id));
          }
          return false;
        },
      });
    },
    [queryClient],
  );
}

/**
 * Flatten paginated logs from infinite query
 *
 * @param data - Infinite query data
 * @returns Flattened array of logs
 */
export function useFlattenedLogs(
  data: InfiniteData<AggregatedLogs> | undefined,
): ServiceLog[] {
  return useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.logs);
  }, [data]);
}

/**
 * Perform client-side search on cached logs
 */
function performClientSideSearch(
  logs: ServiceLog[],
  query: string,
  options: Omit<LogSearchOptions, "searchTerm">,
): ServiceLog[] {
  if (!query.trim()) {
    return logs;
  }

  const caseSensitive = options.caseSensitive ?? false;
  const searchQuery = caseSensitive ? query : query.toLowerCase();

  // Filter logs
  let filtered = logs.filter((log) => {
    const searchableText = caseSensitive
      ? `${log.message} ${log.logger || ""} ${log.method || ""} ${log.exception || ""}`
      : `${log.message} ${log.logger || ""} ${log.method || ""} ${log.exception || ""}`.toLowerCase();

    return searchableText.includes(searchQuery);
  });

  // Apply additional filters
  if (options.level && options.level.length > 0) {
    filtered = filtered.filter((log) => options.level!.includes(log.level));
  }

  if (options.since) {
    filtered = filtered.filter(
      (log) => log.timestamp >= (options.since as Date),
    );
  }

  if (options.until) {
    filtered = filtered.filter(
      (log) => log.timestamp <= (options.until as Date),
    );
  }

  // Apply pagination
  if (options.limit) {
    const startIndex = options.startIndex || 0;
    filtered = filtered.slice(startIndex, startIndex + options.limit);
  }

  return filtered;
}
