import { z } from "zod";
import type { ToolDefinition, ToolResult, ToolServiceType } from "./types";
import { ToolError, ToolErrorCategory, serviceIdsSchema } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import type { ConnectionResult } from "@/connectors/base/IConnector";

/**
 * Parameters for the ServiceHealthTool
 */
const serviceHealthParamsSchema = z.object({
  serviceIds: serviceIdsSchema.describe(
    "Array of specific service IDs to check. If not provided, checks all configured services.",
  ),
  includeMetrics: z
    .boolean()
    .default(true)
    .describe(
      "Include detailed metrics like latency and version information (default: true)",
    ),
});

type ServiceHealthParams = z.infer<typeof serviceHealthParamsSchema>;

/**
 * Health information for a single service
 */
interface ServiceHealthInfo {
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  status: "healthy" | "degraded" | "offline";
  message?: string;
  latency?: number;
  version?: string;
  error?: string;
  troubleshooting?: string;
}

/**
 * Result data structure for ServiceHealthTool
 */
interface ServiceHealthResult {
  services: ServiceHealthInfo[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    offline: number;
  };
  message: string;
}

/**
 * ServiceHealthTool - Check the health and status of configured services
 *
 * This tool allows the LLM to check the connection status, response time,
 * and version information for the user's configured services. It can check
 * individual services or all services at once.
 *
 * @example
 * ```typescript
 * // Check all services
 * const result = await execute({
 *   includeMetrics: true
 * });
 *
 * // Check specific services
 * const result = await execute({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   includeMetrics: true
 * });
 * ```
 */
export const serviceHealthTool: ToolDefinition<
  ServiceHealthParams,
  ServiceHealthResult
> = {
  name: "check_service_health",
  description:
    "Check the health and status of configured media services. Returns connection status, response time, version information, and error messages for each service. Can check individual services or all services at once. Useful for diagnosing connectivity issues.",
  parameters: serviceHealthParamsSchema,

  async execute(
    params: ServiceHealthParams,
  ): Promise<ToolResult<ServiceHealthResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();
    const connectorManager = context.getConnectorManager();

    try {
      // Determine which connectors to check
      const connectorsToCheck = params.serviceIds
        ? params.serviceIds
            .map((id) => connectorManager.getConnector(id))
            .filter((c) => c !== undefined)
        : connectorManager.getAllConnectors();

      if (connectorsToCheck.length === 0) {
        if (params.serviceIds && params.serviceIds.length > 0) {
          throw new ToolError(
            "None of the specified services were found",
            ToolErrorCategory.INVALID_PARAMETERS,
            "Please check the service IDs and try again. You can view configured services in Settings > Services.",
            { requestedServiceIds: params.serviceIds },
          );
        }

        throw new ToolError(
          "No services configured",
          ToolErrorCategory.SERVICE_NOT_CONFIGURED,
          "Please add services in Settings > Services to check their health status.",
        );
      }

      // Test connections for all selected connectors
      const healthInfos: ServiceHealthInfo[] = [];

      await Promise.all(
        connectorsToCheck.map(async (connector) => {
          try {
            const testStartTime = Date.now();
            const connectionResult = await connector.testConnection();
            const testLatency = Date.now() - testStartTime;

            const healthInfo: ServiceHealthInfo = {
              serviceId: connector.config.id,
              serviceName: connector.config.name,
              serviceType: connector.config.type as ToolServiceType,
              status: connectionResult.success ? "healthy" : "offline",
              message: connectionResult.message,
            };

            // Add metrics if requested
            if (params.includeMetrics) {
              healthInfo.latency = connectionResult.latency ?? testLatency;

              // Try to get version information
              if (connectionResult.version) {
                healthInfo.version = connectionResult.version;
              } else {
                try {
                  const version = await connector.getVersion();
                  healthInfo.version = version;
                } catch (error) {
                  // Version fetch failed, but don't fail the whole health check
                  void logger.debug("Failed to fetch version", {
                    serviceId: connector.config.id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                }
              }
            }

            // Add error details if connection failed
            if (!connectionResult.success) {
              healthInfo.error =
                connectionResult.message || "Connection failed";
              healthInfo.troubleshooting = generateTroubleshootingSteps(
                connectionResult,
                connector.config.type,
              );
            }

            healthInfos.push(healthInfo);
          } catch (error) {
            // Handle unexpected errors during health check
            void logger.warn("Health check failed with unhandled error", {
              serviceId: connector.config.id,
              serviceType: connector.config.type,
              error: error instanceof Error ? error.message : String(error),
            });

            healthInfos.push({
              serviceId: connector.config.id,
              serviceName: connector.config.name,
              serviceType: connector.config.type as ToolServiceType,
              status: "offline",
              error:
                error instanceof Error
                  ? error.message
                  : "Unexpected error during health check",
              troubleshooting: generateTroubleshootingSteps(
                { success: false, message: String(error) },
                connector.config.type,
              ),
            });
          }
        }),
      );

      // Calculate summary statistics
      const summary = {
        total: healthInfos.length,
        healthy: healthInfos.filter((h) => h.status === "healthy").length,
        degraded: healthInfos.filter((h) => h.status === "degraded").length,
        offline: healthInfos.filter((h) => h.status === "offline").length,
      };

      const message = generateSummaryMessage(summary, healthInfos);

      return {
        success: true,
        data: {
          services: healthInfos,
          summary,
          message,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          checkedServices: healthInfos.length,
        },
      };
    } catch (error) {
      void logger.error("ServiceHealthTool execution failed", {
        params,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof ToolError) {
        return {
          success: false,
          error: error.toUserMessage(),
          metadata: {
            executionTime: Date.now() - startTime,
            errorCategory: error.category,
          },
        };
      }

      return {
        success: false,
        error: context.formatError(error),
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  },
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate troubleshooting steps based on the connection result and error patterns
 */
function generateTroubleshootingSteps(
  result: ConnectionResult,
  serviceType: string,
): string {
  const message = result.message?.toLowerCase() || "";
  const steps: string[] = [];

  // Detect common error patterns
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout")
  ) {
    steps.push(
      "The service is taking too long to respond. Check if the service is running and accessible.",
    );
    steps.push(
      "Verify the URL is correct and the service is not behind a firewall.",
    );
    steps.push(
      "If using a VPN, try disconnecting it or ensure the service is accessible through the VPN.",
    );
  } else if (
    message.includes("unauthorized") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("api key") ||
    message.includes("authentication")
  ) {
    steps.push(
      "Authentication failed. Check that your API key is correct and has not expired.",
    );
    steps.push(
      `Go to Settings > Services and verify the API key for ${serviceType}.`,
    );
    steps.push(
      "If you recently changed the API key in the service, update it in UniArr as well.",
    );
  } else if (
    message.includes("network") ||
    message.includes("enotfound") ||
    message.includes("econnrefused") ||
    message.includes("connection refused")
  ) {
    steps.push(
      "Cannot reach the service. Check your network connection and ensure the service is running.",
    );
    steps.push("Verify the URL and port number are correct.");
    steps.push(
      "If the service is on your local network, ensure your device is connected to the same network.",
    );
    steps.push(
      "If using a VPN, the service may not be accessible. Try disconnecting the VPN.",
    );
  } else if (
    message.includes("ssl") ||
    message.includes("certificate") ||
    message.includes("https")
  ) {
    steps.push(
      "SSL/Certificate error. If using a self-signed certificate, you may need to disable SSL verification.",
    );
    steps.push(
      "Check if the service URL should use http:// instead of https://.",
    );
  } else if (message.includes("404") || message.includes("not found")) {
    steps.push(
      "The service endpoint was not found. Check that the URL is correct.",
    );
    steps.push(
      "Ensure you're using the correct base URL without any API path suffixes.",
    );
  } else {
    // Generic troubleshooting steps
    steps.push("Check that the service is running and accessible.");
    steps.push("Verify the URL and API key in Settings > Services.");
    steps.push(
      "If using a VPN, try disconnecting it to see if that resolves the issue.",
    );
  }

  return steps.join(" ");
}

/**
 * Generate a summary message based on health check results
 */
function generateSummaryMessage(
  summary: ServiceHealthResult["summary"],
  healthInfos: ServiceHealthInfo[],
): string {
  const { total, healthy, degraded, offline } = summary;

  if (total === 0) {
    return "No services to check.";
  }

  if (healthy === total) {
    return `All ${total} service${total === 1 ? " is" : "s are"} healthy and responding normally.`;
  }

  if (offline === total) {
    return `All ${total} service${total === 1 ? " is" : "s are"} offline or unreachable. Check your network connection and service configurations.`;
  }

  const parts: string[] = [];

  if (healthy > 0) {
    parts.push(`${healthy} healthy`);
  }
  if (degraded > 0) {
    parts.push(`${degraded} degraded`);
  }
  if (offline > 0) {
    parts.push(`${offline} offline`);
  }

  const statusSummary = parts.join(", ");

  // Add specific service names that are offline
  const offlineServices = healthInfos
    .filter((h) => h.status === "offline")
    .map((h) => h.serviceName);

  if (offlineServices.length > 0 && offlineServices.length <= 3) {
    return `Service health: ${statusSummary}. Offline services: ${offlineServices.join(", ")}.`;
  }

  return `Service health: ${statusSummary} out of ${total} total services.`;
}
