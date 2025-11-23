import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { ServiceConfig } from "@/models/service.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import {
  useConnectorsStore,
  selectConnectorIds,
} from "@/store/connectorsStore";
import { secureStorage } from "@/services/storage/SecureStorage";
import { queryKeys } from "@/hooks/queryKeys";
import { getQueryConfig } from "@/hooks/queryConfig";
import type { ServiceHealthResult } from "@/hooks/useServiceHealth";
import type { ServiceStatusState } from "@/components/service/ServiceStatus";
import { logger } from "@/services/logger/LoggerService";

export interface ServicesHealthOverview {
  total: number;
  online: number;
  offline: number;
  degraded: number;
  disabled: number;
  pendingConfigs: number;
  lastUpdated: Date | null;
}

export interface ServiceHealthExtended extends ServiceHealthResult {
  config: ServiceConfig;
  serviceId: string;
}

export interface ServicesHealthData {
  overview: ServicesHealthOverview;
  services: ServiceHealthExtended[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  isRefreshing: boolean;
}

export const useServicesHealth = (): ServicesHealthData => {
  const connectorManager = ConnectorManager.getInstance();
  const queryClient = useQueryClient();

  // Selector-first: get active service ids from the connectors store (Map -> keys)
  const activeServiceIds = useConnectorsStore(selectConnectorIds);

  // Load persisted service configs (includes disabled/persisted-only entries)
  // Use ref to track if configs have been loaded to ensure effect runs only once
  const configsLoadedRef = useRef(false);
  const [persistedConfigs, setPersistedConfigs] = useState<ServiceConfig[]>([]);

  useEffect(() => {
    // Guard: only load once per component lifetime
    if (configsLoadedRef.current) {
      return;
    }

    let mounted = true;
    configsLoadedRef.current = true;

    (async () => {
      try {
        const configs = await secureStorage.getServiceConfigs();
        if (mounted) {
          setPersistedConfigs(configs);
        }
      } catch (err) {
        logger.warn("useServicesHealth: failed to load persisted configs", {
          error: err instanceof Error ? err.message : String(err),
        });
        // Reset flag on error so it can be retried
        configsLoadedRef.current = false;
      }
    })();

    return () => {
      mounted = false;
    };
  }, []); // Empty deps: run once on mount

  logger.debug(
    `[useServicesHealth] Monitoring active=${activeServiceIds.length} persisted=${persistedConfigs.length}`,
  );

  // React Compiler handles simple object literals
  const healthQueryConfig = {
    refetchInterval: 60000, // 60 seconds
    ...getQueryConfig("HEALTH"),
  };

  // Create stable query function factory to prevent recreation
  const createHealthQueryFn = useMemo(() => {
    return (serviceId: string) => async () => {
      const connector = connectorManager.getConnector(serviceId);
      if (!connector) {
        // Shouldn't happen for activeServiceIds, but guard defensively
        throw new Error(`Service connector not found: ${serviceId}`);
      }

      const config = connector.config;
      const checkedAt = new Date();

      try {
        logger.debug(
          `[useServicesHealth] Testing connection to ${serviceId} (${config.name})`,
        );

        // Test individual service connection with shorter timeout for better UX
        const result = await Promise.race([
          connector.testConnection(),
          new Promise((resolve) => {
            // Reduced timeout to 5 seconds for individual services
            setTimeout(() => {
              logger.warn(
                `[useServicesHealth] Health check timeout for ${serviceId}`,
              );
              resolve({
                success: false,
                message: "Health check timeout",
                latency: 5000,
              });
            }, 5000);
          }),
        ]);

        // Type assertion for the result
        const connectionResult = result as {
          success?: boolean;
          message?: string;
          latency?: number;
          version?: string;
        };

        // Derive status similar to the existing useServiceHealth hook
        const latency = connectionResult.latency ?? undefined;
        const version = connectionResult.version ?? undefined;
        const isHighLatency = typeof latency === "number" && latency > 2000;

        let status: ServiceStatusState;
        if (!config.enabled) {
          status = "offline";
        } else if (connectionResult.success) {
          status = isHighLatency ? "degraded" : "online";
        } else {
          status = "offline";
        }

        const descriptionParts: string[] = [];
        if (connectionResult.message) {
          descriptionParts.push(connectionResult.message);
        }
        if (typeof latency === "number") {
          descriptionParts.push(`Latency ${latency}ms`);
        }
        if (version) {
          descriptionParts.push(`Version ${version}`);
        }

        const statusDescription =
          descriptionParts.length > 0
            ? descriptionParts.join(" • ")
            : undefined;

        logger.debug(
          `[useServicesHealth] ${serviceId} status: ${status}, description: ${statusDescription}`,
        );

        return {
          status,
          statusDescription,
          lastCheckedAt: checkedAt,
          latency,
          version,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logger.error(
          `[useServicesHealth] Health check failed for ${serviceId}:`,
          { error: errorMessage },
        );

        return {
          status: "offline",
          statusDescription: errorMessage,
          lastCheckedAt: checkedAt,
        };
      }
    };
  }, [connectorManager]);

  // Create health queries for all services with stable configuration
  // Only create health queries for active (registered) connectors. Persisted-only configs
  // will be surfaced later as offline/unknown entries.
  const healthQueries = useQueries({
    queries: activeServiceIds.map((serviceId) => ({
      queryKey: queryKeys.services.health(serviceId),
      queryFn: createHealthQueryFn(serviceId),
      ...healthQueryConfig,
    })),
  });

  // Compute loading/error states - these are derived values, no need for useMemo
  const isLoading = healthQueries.some((query) => query.isLoading);
  const isError = healthQueries.some((query) => query.isError);
  const isRefreshing = healthQueries.some(
    (query) => query.isFetching && !query.isLoading,
  );

  // Build active services from health queries
  // We depend on healthQueries directly since TanStack Query already optimizes
  // query object references - they only change when the data actually changes
  const activeServices = useMemo(() => {
    return activeServiceIds
      .map((serviceId, index) => {
        const connector = connectorManager.getConnector(serviceId);
        const healthQuery = healthQueries[index];

        if (!connector) {
          return null;
        }

        const healthData: ServiceHealthExtended = {
          serviceId,
          config: connector.config,
          status:
            (healthQuery?.data?.status as ServiceStatusState) || "offline",
          statusDescription:
            healthQuery?.data?.statusDescription || "Status unavailable",
          lastCheckedAt: healthQuery?.data?.lastCheckedAt,
          latency: healthQuery?.data?.latency,
          version: healthQuery?.data?.version,
        };

        return healthData;
      })
      .filter((service): service is ServiceHealthExtended => service !== null);
  }, [activeServiceIds, healthQueries, connectorManager]);

  // Add persisted-only configs (not currently registered in ConnectorManager)
  const persistedOnlyServices = useMemo(() => {
    return persistedConfigs
      .filter((pc) => !activeServiceIds.includes(pc.id))
      .map((pc) => {
        const healthData: ServiceHealthExtended = {
          serviceId: pc.id,
          config: pc,
          status: pc.enabled ? "offline" : "offline",
          statusDescription: "Service connector not found",
          lastCheckedAt: undefined,
        };
        return healthData;
      });
  }, [persistedConfigs, activeServiceIds]);

  // Keep memoized to prevent unnecessary re-renders in dependent hooks
  const services = useMemo(() => {
    return [...activeServices, ...persistedOnlyServices];
  }, [activeServices, persistedOnlyServices]);

  // Optimize overview statistics computation
  // This computation is relatively expensive as it iterates through all services
  // Ensure it only recomputes when services array actually changes
  const overview = useMemo((): ServicesHealthOverview => {
    const total = services.length;
    let online = 0;
    let offline = 0;
    let degraded = 0;
    let disabled = 0;
    let pendingConfigs = 0;
    let lastUpdated: Date | null = null;

    // Single pass through services for efficiency
    for (const service of services) {
      if (!service.config.enabled) {
        disabled++;
      } else {
        switch (service.status) {
          case "online":
            online++;
            break;
          case "offline":
            offline++;
            // Check if this is a pending configuration (service configured but not working)
            if (
              service.statusDescription?.includes("Status unavailable") ||
              service.statusDescription?.includes("Health check timeout") ||
              service.statusDescription?.includes("Service connector not found")
            ) {
              pendingConfigs++;
            }
            break;
          case "degraded":
            degraded++;
            break;
        }
      }

      // Track the most recent update
      if (service.lastCheckedAt) {
        if (!lastUpdated || service.lastCheckedAt > lastUpdated) {
          lastUpdated = service.lastCheckedAt;
        }
      }
    }

    return {
      total,
      online,
      offline,
      degraded,
      disabled,
      pendingConfigs,
      lastUpdated,
    };
  }, [services]);

  // Optimize refetch to use query invalidation for better cache management
  // This allows TanStack Query to handle the refetch lifecycle more efficiently
  const refetch = useCallback(() => {
    // Invalidate only the specific health queries for active services
    // This is more efficient than calling refetch() on each query individually
    activeServiceIds.forEach((serviceId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.health(serviceId),
        exact: true, // Only invalidate this specific query, not child queries
      });
    });
  }, [activeServiceIds, queryClient]);

  return {
    overview,
    services,
    isLoading,
    isError,
    refetch,
    isRefreshing,
  };
};
