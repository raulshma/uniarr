import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { ServiceConfig } from "@/models/service.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useConnectorsStore } from "@/store/connectorsStore";
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
  const { connectors } = useConnectorsStore();
  const connectorManager = ConnectorManager.getInstance();

  const serviceIds = useMemo(() => {
    const ids = Object.keys(connectors);
    logger.debug(
      `[useServicesHealth] Monitoring ${ids.length} services: ${ids.join(", ")}`,
    );
    return ids;
  }, [connectors]);

  // Create health queries for all services
  const healthQueries = useQueries({
    queries: serviceIds.map((serviceId) => ({
      queryKey: queryKeys.services.health(serviceId),
      queryFn: async () => {
        const connector = connectorManager.getConnector(serviceId);
        if (!connector) {
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
      },
      refetchInterval: 60000, // 60 seconds
      ...getQueryConfig("HEALTH"),
    })),
  });

  const isLoading = healthQueries.some((query) => query.isLoading);
  const isError = healthQueries.some((query) => query.isError);
  const isRefreshing = healthQueries.some(
    (query) => query.isFetching && !query.isLoading,
  );

  const services = useMemo(() => {
    return serviceIds
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
  }, [serviceIds, healthQueries, connectorManager]);

  const overview = useMemo((): ServicesHealthOverview => {
    const total = services.length;
    let online = 0;
    let offline = 0;
    let degraded = 0;
    let disabled = 0;
    let pendingConfigs = 0;
    let lastUpdated: Date | null = null;

    services.forEach((service) => {
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
    });

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

  const refetch = () => {
    healthQueries.forEach((query) => {
      query.refetch();
    });
  };

  return {
    overview,
    services,
    isLoading,
    isError,
    refetch,
    isRefreshing,
  };
};
