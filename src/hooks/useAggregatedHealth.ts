import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  HealthAggregationService,
  type AggregatedHealth,
  type ServiceHealthDetail,
} from "@/services/health/HealthAggregationService";
import { LogHealthCacheService } from "@/services/cache/LogHealthCacheService";
import { STALE_TIME, CACHE_TIME, RETRY_CONFIG } from "@/hooks/queryConfig";

/**
 * Query key factory for health queries
 */
const healthKeys = {
  base: ["health"] as const,
  aggregated: (serviceIds?: string[]) =>
    [
      "health",
      "aggregated",
      serviceIds ? [...serviceIds].sort() : "all",
    ] as const,
  service: (serviceId: string) => ["health", "service", serviceId] as const,
};

/**
 * Options for useAggregatedHealth hook
 */
export interface UseAggregatedHealthOptions {
  /**
   * Array of service IDs to query. If undefined, queries all services.
   */
  serviceIds?: string[];

  /**
   * Refetch interval in milliseconds. Defaults to 60 seconds.
   */
  refetchInterval?: number;

  /**
   * Enable real-time subscriptions to health updates
   */
  enableSubscription?: boolean;

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Hook for fetching aggregated health status from multiple services
 *
 * Features:
 * - TanStack Query for server state management
 * - 60-second refetch interval by default
 * - Offline mode with cached data
 * - Optional real-time subscriptions
 *
 * @param options - Configuration options
 * @returns Query result with aggregated health data
 *
 * @example
 * ```tsx
 * const { data: health, isLoading, error } = useAggregatedHealth({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   refetchInterval: 60000,
 * });
 * ```
 */
export function useAggregatedHealth(options: UseAggregatedHealthOptions = {}) {
  const {
    serviceIds,
    refetchInterval = 60000, // 60 seconds
    enableSubscription = false,
    enabled = true,
  } = options;

  const { isConnected } = useNetworkStatus();
  const queryClient = useQueryClient();
  const healthService = HealthAggregationService.getInstance();
  const cacheService = LogHealthCacheService.getInstance();

  const queryKey = healthKeys.aggregated(serviceIds);

  // Query for aggregated health
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AggregatedHealth> => {
      // Try to fetch from service
      if (isConnected) {
        try {
          const health = await healthService.aggregateHealth(serviceIds);

          // Cache the result
          await cacheService.cacheHealth(health);

          return health;
        } catch (error) {
          // If fetch fails and we're offline, try cache
          if (!isConnected) {
            const cached = await cacheService.getCachedHealth();
            if (cached) {
              return cached;
            }
          }
          throw error;
        }
      }

      // Offline mode: return cached data
      const cached = await cacheService.getCachedHealth();

      if (cached) {
        return cached;
      }

      // No cached data available
      throw new Error("No cached health data available offline");
    },
    staleTime: STALE_TIME.MEDIUM, // 1 minute
    gcTime: CACHE_TIME.MEDIUM, // 5 minutes (formerly cacheTime)
    refetchInterval: isConnected ? refetchInterval : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled,
    ...RETRY_CONFIG.AGGRESSIVE,
  });

  // Set up real-time subscription if enabled
  useEffect(() => {
    if (!enableSubscription || !enabled) {
      return;
    }

    const unsubscribe = healthService.subscribeToHealthUpdates((health) => {
      // Filter health data if serviceIds are specified
      if (serviceIds && serviceIds.length > 0) {
        const filteredServices = health.services.filter((s) =>
          serviceIds.includes(s.serviceId),
        );

        const filteredHealth: AggregatedHealth = {
          ...health,
          services: filteredServices,
          criticalIssues: health.criticalIssues.filter((msg) =>
            serviceIds.includes(msg.serviceId),
          ),
          warnings: health.warnings.filter((msg) =>
            serviceIds.includes(msg.serviceId),
          ),
        };

        queryClient.setQueryData(queryKey, filteredHealth);
      } else {
        queryClient.setQueryData(queryKey, health);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    enableSubscription,
    enabled,
    healthService,
    queryClient,
    queryKey,
    serviceIds,
  ]);

  // Refresh health data when coming back online
  useEffect(() => {
    if (isConnected && enabled) {
      void query.refetch();
    }
  }, [isConnected, enabled, query]);

  return query;
}

/**
 * Hook for fetching detailed health information for a single service
 *
 * @param serviceId - ID of the service to query
 * @param options - Query options
 * @returns Query result with service health detail
 *
 * @example
 * ```tsx
 * const { data: health, isLoading } = useServiceHealth('sonarr-1');
 * ```
 */
export function useServiceHealth(
  serviceId: string,
  options: { enabled?: boolean; refetchInterval?: number } = {},
) {
  const { enabled = true, refetchInterval = 60000 } = options;
  const { isConnected } = useNetworkStatus();
  const healthService = HealthAggregationService.getInstance();
  const cacheService = LogHealthCacheService.getInstance();

  const queryKey = healthKeys.service(serviceId);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ServiceHealthDetail> => {
      // Try to fetch from service
      if (isConnected) {
        try {
          const health = await healthService.getServiceHealth(serviceId);

          // Cache the result
          await cacheService.cacheHealth({
            overall: health.status,
            services: [health],
            criticalIssues: health.messages.filter(
              (m) => m.severity === "critical" || m.severity === "error",
            ),
            warnings: health.messages.filter((m) => m.severity === "warning"),
            lastUpdated: new Date(),
          });

          return health;
        } catch (error) {
          // If fetch fails and we're offline, try cache
          if (!isConnected) {
            const cached = await cacheService.getCachedHealth();
            if (cached && cached.services.length > 0) {
              const cachedService = cached.services.find(
                (s) => s.serviceId === serviceId,
              );
              if (cachedService) {
                return cachedService as ServiceHealthDetail;
              }
            }
          }
          throw error;
        }
      }

      // Offline mode: return cached data
      const cached = await cacheService.getCachedHealth();

      if (cached && cached.services.length > 0) {
        const cachedService = cached.services.find(
          (s) => s.serviceId === serviceId,
        );
        if (cachedService) {
          return cachedService as ServiceHealthDetail;
        }
      }

      // No cached data available
      throw new Error(
        `No cached health data available offline for service: ${serviceId}`,
      );
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
    refetchInterval: isConnected ? refetchInterval : false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: enabled && !!serviceId,
    ...RETRY_CONFIG.AGGRESSIVE,
  });
}

/**
 * Hook to manually refresh aggregated health
 *
 * @returns Callback to refresh health data
 *
 * @example
 * ```tsx
 * const refreshHealth = useRefreshHealth();
 *
 * <Button onPress={() => refreshHealth()}>Refresh</Button>
 * ```
 */
export function useRefreshHealth() {
  const queryClient = useQueryClient();

  return useCallback(
    async (serviceIds?: string[]) => {
      const queryKey = healthKeys.aggregated(serviceIds);
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );
}
