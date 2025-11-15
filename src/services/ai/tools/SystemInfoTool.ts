import { z } from "zod";
import type { ToolDefinition, ToolResult, ToolServiceType } from "./types";
import { ToolError, ToolErrorCategory, serviceIdsSchema } from "./types";
import { ToolContext } from "./ToolContext";
import { logger } from "@/services/logger/LoggerService";
import type { RootFolder } from "@/models/media.types";

/**
 * Parameters for the SystemInfoTool
 */
const systemInfoParamsSchema = z.object({
  serviceIds: serviceIdsSchema.describe(
    "Array of specific service IDs to get info for. If not provided, gets info for all configured services.",
  ),
  includeVersions: z
    .boolean()
    .default(true)
    .describe("Include service version information (default: true)"),
  includeDiskSpace: z
    .boolean()
    .default(true)
    .describe("Include disk space information where available (default: true)"),
});

type SystemInfoParams = z.infer<typeof systemInfoParamsSchema>;

/**
 * Disk space information for a service
 */
interface DiskSpaceInfo {
  path: string;
  freeSpace: number;
  freeSpaceGB: number;
  percentFree?: number;
  accessible: boolean;
  warning?: string;
}

/**
 * System information for a single service
 */
interface ServiceSystemInfo {
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  version?: string;
  diskSpaces?: DiskSpaceInfo[];
  totalFreeSpaceGB?: number;
  lowestFreeSpacePercent?: number;
  error?: string;
}

/**
 * Result data structure for SystemInfoTool
 */
interface SystemInfoResult {
  services: ServiceSystemInfo[];
  summary: {
    total: number;
    withVersionInfo: number;
    withDiskInfo: number;
    lowDiskSpaceWarnings: number;
  };
  warnings: string[];
  message: string;
}

/**
 * SystemInfoTool - Retrieve system information from configured services
 *
 * This tool allows the LLM to query system information including service versions,
 * disk space, and resource usage from the user's configured services. It can check
 * individual services or all services at once, and provides warnings for low disk space.
 *
 * @example
 * ```typescript
 * // Get system info for all services
 * const result = await execute({
 *   includeVersions: true,
 *   includeDiskSpace: true
 * });
 *
 * // Get info for specific services
 * const result = await execute({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   includeVersions: true,
 *   includeDiskSpace: true
 * });
 * ```
 */
export const systemInfoTool: ToolDefinition<
  SystemInfoParams,
  SystemInfoResult
> = {
  name: "get_system_info",
  description:
    "Get system information including service versions, disk space, and resource usage. Returns version information and disk space details for configured services. Useful for checking available storage and service versions. Proactively warns about low disk space.",
  parameters: systemInfoParamsSchema,

  async execute(
    params: SystemInfoParams,
  ): Promise<ToolResult<SystemInfoResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();
    const connectorManager = context.getConnectorManager();

    try {
      void logger.debug("SystemInfoTool execution started", { params });

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
          "Please add services in Settings > Services to check their system information.",
        );
      }

      // Collect system information from all selected connectors
      const systemInfos: ServiceSystemInfo[] = [];
      const warnings: string[] = [];

      await Promise.all(
        connectorsToCheck.map(async (connector) => {
          const info: ServiceSystemInfo = {
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: connector.config.type as ToolServiceType,
          };

          try {
            // Get version information if requested
            if (params.includeVersions) {
              try {
                const version = await connector.getVersion();
                info.version = version;
              } catch (error) {
                void logger.debug("Failed to fetch version", {
                  serviceId: connector.config.id,
                  error: error instanceof Error ? error.message : String(error),
                });
                info.error = "Could not retrieve version information";
              }
            }

            // Get disk space information if requested
            if (params.includeDiskSpace) {
              try {
                const diskSpaces = await fetchDiskSpaceInfo(connector);
                if (diskSpaces.length > 0) {
                  info.diskSpaces = diskSpaces;

                  // Calculate total free space
                  info.totalFreeSpaceGB = diskSpaces.reduce(
                    (sum, ds) => sum + ds.freeSpaceGB,
                    0,
                  );

                  // Find lowest free space percentage
                  const percentages = diskSpaces
                    .map((ds) => ds.percentFree)
                    .filter((p): p is number => p !== undefined);

                  if (percentages.length > 0) {
                    info.lowestFreeSpacePercent = Math.min(...percentages);

                    // Check for low disk space warnings
                    if (info.lowestFreeSpacePercent < 10) {
                      const warning = generateLowDiskSpaceWarning(
                        connector.config.name,
                        info.lowestFreeSpacePercent,
                        diskSpaces,
                      );
                      warnings.push(warning);
                      diskSpaces.forEach((ds) => {
                        if (
                          ds.percentFree !== undefined &&
                          ds.percentFree < 10
                        ) {
                          ds.warning = "Low disk space";
                        }
                      });
                    }
                  }
                }
              } catch (error) {
                void logger.debug("Failed to fetch disk space info", {
                  serviceId: connector.config.id,
                  error: error instanceof Error ? error.message : String(error),
                });
                // Don't set error if we already have version info
                if (!info.version) {
                  info.error = "Could not retrieve system information";
                }
              }
            }

            systemInfos.push(info);
          } catch (error) {
            void logger.warn("System info check failed with unhandled error", {
              serviceId: connector.config.id,
              serviceType: connector.config.type,
              error: error instanceof Error ? error.message : String(error),
            });

            info.error =
              error instanceof Error
                ? error.message
                : "Unexpected error retrieving system information";
            systemInfos.push(info);
          }
        }),
      );

      // Calculate summary statistics
      const summary = {
        total: systemInfos.length,
        withVersionInfo: systemInfos.filter((s) => s.version).length,
        withDiskInfo: systemInfos.filter((s) => s.diskSpaces).length,
        lowDiskSpaceWarnings: warnings.length,
      };

      const message = generateSummaryMessage(summary, systemInfos, warnings);

      void logger.debug("SystemInfoTool execution completed", {
        summary,
        checkedServices: systemInfos.length,
        warnings: warnings.length,
      });

      return {
        success: true,
        data: {
          services: systemInfos,
          summary,
          warnings,
          message,
        },
        metadata: {
          executionTime: Date.now() - startTime,
          checkedServices: systemInfos.length,
        },
      };
    } catch (error) {
      void logger.error("SystemInfoTool execution failed", {
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
 * Fetch disk space information from a connector
 */
async function fetchDiskSpaceInfo(
  connector: ReturnType<
    ReturnType<typeof ToolContext.prototype.getConnectorManager>["getConnector"]
  >,
): Promise<DiskSpaceInfo[]> {
  if (!connector) {
    return [];
  }

  const serviceType = connector.config.type;

  // Only certain service types have disk space information
  if (
    serviceType !== "sonarr" &&
    serviceType !== "radarr" &&
    serviceType !== "lidarr"
  ) {
    return [];
  }

  try {
    // These services have getRootFolders() method that returns disk space info
    const connectorWithRootFolders = connector as unknown as {
      getRootFolders: () => Promise<RootFolder[]>;
    };

    if (typeof connectorWithRootFolders.getRootFolders !== "function") {
      return [];
    }

    const rootFolders = await connectorWithRootFolders.getRootFolders();

    return rootFolders
      .filter((folder) => folder.freeSpace !== undefined)
      .map((folder) => {
        const freeSpaceBytes = folder.freeSpace ?? 0;
        const freeSpaceGB = freeSpaceBytes / (1024 * 1024 * 1024);

        // We don't have total space, so we can't calculate percentage
        // But we can provide a warning based on absolute free space
        const diskInfo: DiskSpaceInfo = {
          path: folder.path,
          freeSpace: freeSpaceBytes,
          freeSpaceGB: Math.round(freeSpaceGB * 100) / 100,
          accessible: folder.accessible ?? true,
        };

        // Warn if less than 10GB free (arbitrary threshold)
        if (freeSpaceGB < 10) {
          diskInfo.warning = "Low disk space";
        }

        return diskInfo;
      });
  } catch (error) {
    void logger.debug("Failed to fetch root folders for disk space", {
      serviceId: connector.config.id,
      serviceType,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Generate a low disk space warning message
 */
function generateLowDiskSpaceWarning(
  serviceName: string,
  lowestPercent: number,
  diskSpaces: DiskSpaceInfo[],
): string {
  const lowSpacePaths = diskSpaces
    .filter((ds) => ds.freeSpaceGB < 10)
    .map((ds) => `${ds.path} (${ds.freeSpaceGB.toFixed(1)} GB free)`);

  if (lowSpacePaths.length === 0) {
    return `${serviceName} has low disk space (${lowestPercent.toFixed(1)}% free).`;
  }

  return `${serviceName} has low disk space: ${lowSpacePaths.join(", ")}. Consider freeing up space or adding more storage.`;
}

/**
 * Generate a summary message based on system info results
 */
function generateSummaryMessage(
  summary: SystemInfoResult["summary"],
  systemInfos: ServiceSystemInfo[],
  warnings: string[],
): string {
  const { total, withVersionInfo, withDiskInfo, lowDiskSpaceWarnings } =
    summary;

  if (total === 0) {
    return "No services to check.";
  }

  const parts: string[] = [];

  // Version info summary
  if (withVersionInfo > 0) {
    parts.push(
      `Retrieved version information from ${withVersionInfo} service${withVersionInfo === 1 ? "" : "s"}`,
    );
  }

  // Disk space summary
  if (withDiskInfo > 0) {
    parts.push(
      `disk space information from ${withDiskInfo} service${withDiskInfo === 1 ? "" : "s"}`,
    );
  }

  let message = parts.join(" and ");
  if (message) {
    message += ".";
  } else {
    message = `Checked ${total} service${total === 1 ? "" : "s"}.`;
  }

  // Add warnings
  if (lowDiskSpaceWarnings > 0) {
    message += ` ⚠️ ${lowDiskSpaceWarnings} low disk space warning${lowDiskSpaceWarnings === 1 ? "" : "s"} detected.`;
  }

  // Add specific service errors
  const servicesWithErrors = systemInfos.filter((s) => s.error);
  if (servicesWithErrors.length > 0 && servicesWithErrors.length < total) {
    message += ` Note: ${servicesWithErrors.length} service${servicesWithErrors.length === 1 ? "" : "s"} could not be queried.`;
  }

  return message;
}
