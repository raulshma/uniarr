import { useQuery } from "@tanstack/react-query";
import type { ConnectionResult } from "@/connectors/base/IConnector";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { ServiceConfig } from "@/models/service.types";
import { queryKeys } from "@/hooks/queryKeys";
import { getQueryConfig } from "@/hooks/queryConfig";
import type { ServiceStatusState } from "@/components/service/ServiceStatus";

export type ServiceHealthResult = {
  status: ServiceStatusState;
  statusDescription?: string;
  lastCheckedAt?: Date;
  latency?: number;
  version?: string;
};

const deriveStatus = (
  config: ServiceConfig,
  result: ConnectionResult | undefined,
  checkedAt: Date,
): ServiceHealthResult => {
  if (!config.enabled) {
    return {
      status: "offline",
      statusDescription: "Service disabled",
    };
  }

  if (!result) {
    return {
      status: "offline",
      statusDescription: "Status unavailable",
      lastCheckedAt: checkedAt,
    };
  }

  const latency = result.latency ?? undefined;
  const version = result.version ?? undefined;
  const isHighLatency = typeof latency === "number" && latency > 2000;

  const status: ServiceStatusState = result.success
    ? isHighLatency
      ? "degraded"
      : "online"
    : "offline";

  const descriptionParts: string[] = [];
  if (result.message) {
    descriptionParts.push(result.message);
  }
  if (typeof latency === "number") {
    descriptionParts.push(`Latency ${latency}ms`);
  }
  if (version) {
    descriptionParts.push(`Version ${version}`);
  }

  const statusDescription =
    descriptionParts.length > 0 ? descriptionParts.join(" • ") : undefined;

  return {
    status,
    statusDescription,
    lastCheckedAt: checkedAt,
    latency,
    version,
  };
};

const fetchServiceHealth = async (
  serviceId: string,
): Promise<ServiceHealthResult> => {
  const manager = ConnectorManager.getInstance();

  // Get the service config
  const connector = manager.getConnector(serviceId);
  if (!connector) {
    throw new Error(`Service connector not found: ${serviceId}`);
  }

  const config = connector.config;
  const checkedAt = new Date();

  try {
    // Test individual service connection with shorter timeout for better UX
    const result = await Promise.race([
      connector.testConnection(),
      new Promise<ConnectionResult>((resolve) => {
        // Reduced timeout to 5 seconds for individual services
        setTimeout(() => {
          resolve({
            success: false,
            message: "Health check timeout",
            latency: 5000,
          });
        }, 5000);
      }),
    ]);

    return deriveStatus(config, result, checkedAt);
  } catch (error) {
    return deriveStatus(
      config,
      {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      },
      checkedAt,
    );
  }
};

export const useServiceHealth = (serviceId: string) => {
  return useQuery({
    queryKey: queryKeys.services.health(serviceId),
    queryFn: () => fetchServiceHealth(serviceId),
    refetchInterval: 60000, // 60 seconds
    ...getQueryConfig("HEALTH"),
  });
};
