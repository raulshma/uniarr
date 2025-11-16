import { z } from "zod";
import type { ToolDefinition, ToolResult, ToolServiceType } from "./types";
import { ToolError, ToolErrorCategory } from "./types";
import { ToolContext } from "./ToolContext";
import { ConfirmationManager } from "./ConfirmationManager";
import { logger } from "@/services/logger/LoggerService";
import type { QBittorrentConnector } from "@/connectors/implementations/QBittorrentConnector";
import type {
  SonarrConnector,
  SonarrQueueItem,
} from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { Torrent, TorrentState } from "@/models/torrent.types";
import type { RadarrQueueItem } from "@/models/movie.types";

/**
 * Parameters for the DownloadManagementTool
 */
const downloadManagementParamsSchema = z.object({
  action: z
    .enum(["list", "pause", "resume", "remove", "pauseAll", "resumeAll"])
    .describe(
      "Action to perform on downloads: list, pause, resume, remove (single), pauseAll, resumeAll (bulk)",
    ),
  downloadId: z
    .string()
    .optional()
    .describe(
      "Download ID (hash for torrents, queue ID for Sonarr/Radarr) - required for pause, resume, remove actions",
    ),
  serviceType: z
    .enum([
      "qbittorrent",
      "transmission",
      "deluge",
      "sabnzbd",
      "sonarr",
      "radarr",
    ])
    .optional()
    .describe("Filter downloads by service type"),
  status: z
    .enum(["downloading", "paused", "completed", "failed", "queued", "all"])
    .optional()
    .default("all")
    .describe("Filter downloads by status"),
  sortBy: z
    .enum(["progress", "speed", "eta", "size", "name"])
    .optional()
    .default("name")
    .describe(
      "Sort downloads by: progress (completion %), speed (download speed), eta (estimated time), size (total size), or name",
    ),
  confirmationId: z
    .string()
    .optional()
    .describe(
      "Confirmation ID for destructive actions (provided after user confirms)",
    ),
});

type DownloadManagementParams = z.infer<typeof downloadManagementParamsSchema>;

/**
 * Unified download item structure for tool results
 */
interface DownloadItem {
  id: string;
  name: string;
  status: string;
  progress: number;
  size: number;
  downloaded: number;
  downloadSpeed: number;
  uploadSpeed?: number;
  eta: number | string;
  serviceId: string;
  serviceName: string;
  serviceType: ToolServiceType;
  // Additional metadata
  category?: string;
  tags?: string[];
  ratio?: number;
  addedOn?: number;
  // For media management services
  mediaTitle?: string;
  mediaType?: "movie" | "series";
  protocol?: string;
}

/**
 * Result data structure for DownloadManagementTool
 */
interface DownloadManagementResult {
  action: string;
  downloads?: DownloadItem[];
  totalCount?: number;
  message: string;
  serviceTypes?: string[];
  requiresConfirmation?: boolean;
  confirmationId?: string;
  confirmationPrompt?: string;
}

/**
 * DownloadManagementTool - Manage download queue across services
 *
 * This tool allows the LLM to view, pause, resume, and remove downloads
 * from download clients (qBittorrent, Transmission, etc.) and media
 * management services (Sonarr, Radarr).
 *
 * @example
 * ```typescript
 * // List all active downloads
 * const result = await execute({
 *   action: 'list',
 *   status: 'downloading'
 * });
 *
 * // Pause a specific download
 * const result = await execute({
 *   action: 'pause',
 *   downloadId: 'abc123hash',
 *   serviceType: 'qbittorrent'
 * });
 * ```
 */
export const downloadManagementTool: ToolDefinition<
  DownloadManagementParams,
  DownloadManagementResult
> = {
  name: "manage_downloads",
  description:
    "View, pause, resume, or remove downloads from download clients and media management services. Can list active downloads with progress, speed, and ETA information. Supports filtering by service type and status.",
  parameters: downloadManagementParamsSchema,

  async execute(
    params: DownloadManagementParams,
  ): Promise<ToolResult<DownloadManagementResult>> {
    const startTime = Date.now();
    const context = ToolContext.getInstance();
    const connectorManager = context.getConnectorManager();

    try {
      void logger.debug("DownloadManagementTool execution started", { params });

      // Validate parameters based on action
      if (["pause", "resume", "remove"].includes(params.action)) {
        if (!params.downloadId) {
          throw new ToolError(
            `Download ID is required for ${params.action} action`,
            ToolErrorCategory.INVALID_PARAMETERS,
            `Please provide a downloadId parameter to ${params.action} a download.`,
            { action: params.action },
          );
        }
      }

      // Execute the requested action
      switch (params.action) {
        case "list":
          return await listDownloads(params, connectorManager, startTime);
        case "pause":
          return await pauseDownload(params, connectorManager, startTime);
        case "resume":
          return await resumeDownload(params, connectorManager, startTime);
        case "remove":
          return await removeDownload(params, connectorManager, startTime);
        case "pauseAll":
          return await pauseAllDownloads(params, connectorManager, startTime);
        case "resumeAll":
          return await resumeAllDownloads(params, connectorManager, startTime);
        default:
          throw new ToolError(
            `Unknown action: ${params.action}`,
            ToolErrorCategory.INVALID_PARAMETERS,
            "Please use one of: list, pause, resume, remove, pauseAll, resumeAll",
            { action: params.action },
          );
      }
    } catch (error) {
      void logger.error("DownloadManagementTool execution failed", {
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

// ==================== ACTION HANDLERS ====================

/**
 * List downloads from all or specific services
 */
async function listDownloads(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const allDownloads: DownloadItem[] = [];
  const serviceTypes = new Set<string>();

  // Get download connectors based on serviceType filter
  const downloadConnectors = params.serviceType
    ? connectorManager.getConnectorsByType(params.serviceType)
    : connectorManager.getAllConnectors();

  if (downloadConnectors.length === 0) {
    const serviceTypeHint = params.serviceType || "download client";
    throw new ToolError(
      `No ${serviceTypeHint} services configured`,
      ToolErrorCategory.SERVICE_NOT_CONFIGURED,
      `Please add a ${serviceTypeHint} service in Settings > Services to view downloads.`,
      { requestedServiceType: params.serviceType },
    );
  }

  // Fetch downloads from each connector
  await Promise.all(
    downloadConnectors.map(async (connector) => {
      try {
        const downloads = await fetchDownloadsFromConnector(connector);
        allDownloads.push(...downloads);
        serviceTypes.add(connector.config.type);
      } catch (error) {
        // Log error but continue with other connectors
        void logger.warn("Failed to fetch downloads from connector", {
          serviceId: connector.config.id,
          serviceType: connector.config.type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  // Filter by status if specified
  let filteredDownloads = allDownloads;
  if (params.status && params.status !== "all") {
    filteredDownloads = filterDownloadsByStatus(allDownloads, params.status);
  }

  // Sort downloads
  const sortedDownloads = sortDownloads(filteredDownloads, params.sortBy);

  const message = generateListMessage(
    sortedDownloads.length,
    allDownloads.length,
    params,
  );

  void logger.debug("DownloadManagementTool list completed", {
    totalDownloads: allDownloads.length,
    filteredDownloads: filteredDownloads.length,
    serviceTypes: Array.from(serviceTypes),
  });

  return {
    success: true,
    data: {
      action: "list",
      downloads: sortedDownloads,
      totalCount: sortedDownloads.length,
      message,
      serviceTypes: Array.from(serviceTypes),
    },
    metadata: {
      executionTime: Date.now() - startTime,
      serviceTypes: Array.from(serviceTypes),
    },
  };
}

/**
 * Pause a specific download
 */
async function pauseDownload(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const { downloadId, serviceType } = params;

  if (!downloadId) {
    throw new ToolError(
      "Download ID is required",
      ToolErrorCategory.INVALID_PARAMETERS,
      "Please provide a downloadId to pause.",
    );
  }

  // Find the appropriate connector
  const connector = await findConnectorForDownload(
    connectorManager,
    downloadId,
    serviceType,
  );

  if (!connector) {
    throw new ToolError(
      `Download not found: ${downloadId}`,
      ToolErrorCategory.OPERATION_FAILED,
      serviceType
        ? `No ${serviceType} service found with download ID ${downloadId}.`
        : `No download found with ID ${downloadId}. Try specifying the serviceType parameter.`,
      { downloadId, serviceType },
    );
  }

  // Pause the download based on connector type
  try {
    if (connector.config.type === "qbittorrent") {
      await (connector as QBittorrentConnector).pauseTorrent(downloadId);
    } else {
      throw new ToolError(
        `Pause not supported for ${connector.config.type}`,
        ToolErrorCategory.OPERATION_FAILED,
        `The ${connector.config.type} service does not support pausing downloads through this tool.`,
        { serviceType: connector.config.type },
      );
    }

    void logger.info("Download paused successfully", {
      downloadId,
      serviceId: connector.config.id,
      serviceType: connector.config.type,
    });

    return {
      success: true,
      data: {
        action: "pause",
        message: `Download paused successfully.`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceId: connector.config.id,
        serviceType: connector.config.type,
      },
    };
  } catch (error) {
    throw new ToolError(
      `Failed to pause download: ${error instanceof Error ? error.message : String(error)}`,
      ToolErrorCategory.OPERATION_FAILED,
      "The download could not be paused. Please check if the download still exists.",
      { downloadId, serviceType: connector.config.type, error },
    );
  }
}

/**
 * Resume a specific download
 */
async function resumeDownload(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const { downloadId, serviceType } = params;

  if (!downloadId) {
    throw new ToolError(
      "Download ID is required",
      ToolErrorCategory.INVALID_PARAMETERS,
      "Please provide a downloadId to resume.",
    );
  }

  // Find the appropriate connector
  const connector = await findConnectorForDownload(
    connectorManager,
    downloadId,
    serviceType,
  );

  if (!connector) {
    throw new ToolError(
      `Download not found: ${downloadId}`,
      ToolErrorCategory.OPERATION_FAILED,
      serviceType
        ? `No ${serviceType} service found with download ID ${downloadId}.`
        : `No download found with ID ${downloadId}. Try specifying the serviceType parameter.`,
      { downloadId, serviceType },
    );
  }

  // Resume the download based on connector type
  try {
    if (connector.config.type === "qbittorrent") {
      await (connector as QBittorrentConnector).resumeTorrent(downloadId);
    } else {
      throw new ToolError(
        `Resume not supported for ${connector.config.type}`,
        ToolErrorCategory.OPERATION_FAILED,
        `The ${connector.config.type} service does not support resuming downloads through this tool.`,
        { serviceType: connector.config.type },
      );
    }

    void logger.info("Download resumed successfully", {
      downloadId,
      serviceId: connector.config.id,
      serviceType: connector.config.type,
    });

    return {
      success: true,
      data: {
        action: "resume",
        message: `Download resumed successfully.`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceId: connector.config.id,
        serviceType: connector.config.type,
      },
    };
  } catch (error) {
    throw new ToolError(
      `Failed to resume download: ${error instanceof Error ? error.message : String(error)}`,
      ToolErrorCategory.OPERATION_FAILED,
      "The download could not be resumed. Please check if the download still exists.",
      { downloadId, serviceType: connector.config.type, error },
    );
  }
}

/**
 * Remove a specific download
 */
async function removeDownload(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const { downloadId, serviceType, confirmationId } = params;
  const context = ToolContext.getInstance();
  const confirmationManager = ConfirmationManager.getInstance();

  if (!downloadId) {
    throw new ToolError(
      "Download ID is required",
      ToolErrorCategory.INVALID_PARAMETERS,
      "Please provide a downloadId to remove.",
    );
  }

  // Find the appropriate connector
  const connector = await findConnectorForDownload(
    connectorManager,
    downloadId,
    serviceType,
  );

  if (!connector) {
    throw new ToolError(
      `Download not found: ${downloadId}`,
      ToolErrorCategory.OPERATION_FAILED,
      serviceType
        ? `No ${serviceType} service found with download ID ${downloadId}.`
        : `No download found with ID ${downloadId}. Try specifying the serviceType parameter.`,
      { downloadId, serviceType },
    );
  }

  // Get download details for confirmation message
  const downloads = await fetchDownloadsFromConnector(connector);
  const download = downloads.find((d) => d.id === downloadId);
  const downloadName = download?.name || downloadId;

  // Check if this is a destructive action that requires confirmation
  const destructiveCheck = context.isDestructiveAction("manage_downloads", {
    action: "remove",
  });

  if (destructiveCheck && !confirmationId) {
    // Request confirmation before proceeding
    const newConfirmationId = confirmationManager.requestConfirmation({
      action: "Remove download",
      target: downloadName,
      severity: destructiveCheck.severity,
      toolName: "manage_downloads",
      params: { downloadId, serviceType },
    });

    void logger.info("Confirmation requested for download removal", {
      confirmationId: newConfirmationId,
      downloadId,
      downloadName,
    });

    return {
      success: true,
      data: {
        action: "remove",
        message: `Are you sure you want to remove "${downloadName}"?`,
        requiresConfirmation: true,
        confirmationId: newConfirmationId,
        confirmationPrompt: `This will remove the download "${downloadName}" from ${connector.config.name}. Do you want to proceed?`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceId: connector.config.id,
        serviceType: connector.config.type,
      },
    };
  }

  // If confirmation ID is provided, verify it
  if (confirmationId) {
    const confirmed = confirmationManager.confirmAction(confirmationId);
    if (!confirmed) {
      throw new ToolError(
        "Confirmation expired or invalid",
        ToolErrorCategory.OPERATION_FAILED,
        "The confirmation has expired or is invalid. Please request the action again.",
        { confirmationId },
      );
    }

    void logger.info("Confirmation verified for download removal", {
      confirmationId,
      downloadId,
    });
  }

  // Remove the download based on connector type
  try {
    if (connector.config.type === "qbittorrent") {
      await (connector as QBittorrentConnector).deleteTorrent(
        downloadId,
        false,
      );
    } else {
      throw new ToolError(
        `Remove not supported for ${connector.config.type}`,
        ToolErrorCategory.OPERATION_FAILED,
        `The ${connector.config.type} service does not support removing downloads through this tool.`,
        { serviceType: connector.config.type },
      );
    }

    void logger.info("Download removed successfully", {
      downloadId,
      serviceId: connector.config.id,
      serviceType: connector.config.type,
    });

    return {
      success: true,
      data: {
        action: "remove",
        message: `Download "${downloadName}" removed successfully.`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
        serviceId: connector.config.id,
        serviceType: connector.config.type,
      },
    };
  } catch (error) {
    throw new ToolError(
      `Failed to remove download: ${error instanceof Error ? error.message : String(error)}`,
      ToolErrorCategory.OPERATION_FAILED,
      "The download could not be removed. Please check if the download still exists.",
      { downloadId, serviceType: connector.config.type, error },
    );
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch downloads from a specific connector
 */
async function fetchDownloadsFromConnector(
  connector: any,
): Promise<DownloadItem[]> {
  const serviceType = connector.config.type as ToolServiceType;

  switch (serviceType) {
    case "qbittorrent": {
      const qbConnector = connector as QBittorrentConnector;
      const torrents = await qbConnector.getTorrents();
      return torrents.map((t) =>
        mapTorrentToDownloadItem(
          t,
          connector.config.id,
          connector.config.name,
          serviceType,
        ),
      );
    }

    case "sonarr": {
      const sonarrConnector = connector as SonarrConnector;
      const queue = await sonarrConnector.getQueue();
      return queue.map((q) =>
        mapSonarrQueueToDownloadItem(
          q,
          connector.config.id,
          connector.config.name,
        ),
      );
    }

    case "radarr": {
      const radarrConnector = connector as RadarrConnector;
      const queue = await radarrConnector.getQueue();
      return queue.map((q) =>
        mapRadarrQueueToDownloadItem(
          q,
          connector.config.id,
          connector.config.name,
        ),
      );
    }

    default:
      // Service type doesn't support download listing
      return [];
  }
}

/**
 * Map a torrent to a unified download item
 */
function mapTorrentToDownloadItem(
  torrent: Torrent,
  serviceId: string,
  serviceName: string,
  serviceType: ToolServiceType,
): DownloadItem {
  return {
    id: torrent.hash,
    name: torrent.name,
    status: normalizeStatus(torrent.state),
    progress: torrent.progress,
    size: torrent.size,
    downloaded: torrent.downloaded,
    downloadSpeed: torrent.downloadSpeed,
    uploadSpeed: torrent.uploadSpeed,
    eta: torrent.eta,
    serviceId,
    serviceName,
    serviceType,
    category: torrent.category,
    tags: torrent.tags,
    ratio: torrent.ratio,
    addedOn: torrent.addedOn,
  };
}

/**
 * Map a Sonarr queue item to a unified download item
 */
function mapSonarrQueueToDownloadItem(
  queueItem: SonarrQueueItem,
  serviceId: string,
  serviceName: string,
): DownloadItem {
  const progress =
    queueItem.size && queueItem.sizeleft
      ? ((queueItem.size - queueItem.sizeleft) / queueItem.size) * 100
      : 0;

  return {
    id: String(queueItem.id),
    name: queueItem.seriesTitle || "Unknown",
    status: queueItem.status || "unknown",
    progress,
    size: queueItem.size || 0,
    downloaded:
      queueItem.size && queueItem.sizeleft
        ? queueItem.size - queueItem.sizeleft
        : 0,
    downloadSpeed: 0, // Sonarr doesn't provide speed
    eta: queueItem.timeleft || "Unknown",
    serviceId,
    serviceName,
    serviceType: "sonarr",
    mediaType: "series",
    protocol: queueItem.protocol,
  };
}

/**
 * Map a Radarr queue item to a unified download item
 */
function mapRadarrQueueToDownloadItem(
  queueItem: RadarrQueueItem,
  serviceId: string,
  serviceName: string,
): DownloadItem {
  const progress =
    queueItem.size && queueItem.sizeleft
      ? ((queueItem.size - queueItem.sizeleft) / queueItem.size) * 100
      : 0;

  return {
    id: String(queueItem.id),
    name: queueItem.title || "Unknown",
    status: queueItem.status || "unknown",
    progress,
    size: queueItem.size || 0,
    downloaded:
      queueItem.size && queueItem.sizeleft
        ? queueItem.size - queueItem.sizeleft
        : 0,
    downloadSpeed: 0, // Radarr doesn't provide speed
    eta: queueItem.timeleft || "Unknown",
    serviceId,
    serviceName,
    serviceType: "radarr",
    mediaType: "movie",
    protocol: queueItem.protocol,
  };
}

/**
 * Normalize torrent state to a simpler status
 */
function normalizeStatus(state: TorrentState): string {
  switch (state) {
    case "downloading":
    case "metaDL":
    case "forcedDL":
    case "forcedMetaDL":
      return "downloading";
    case "pausedDL":
    case "pausedUP":
      return "paused";
    case "stalledDL":
    case "stalledUP":
      return "stalled";
    case "queuedDL":
    case "queuedUP":
      return "queued";
    case "uploading":
    case "forcedUP":
      return "completed";
    case "error":
    case "missingFiles":
      return "failed";
    case "checkingDL":
    case "checkingUP":
    case "checkingResumeData":
      return "checking";
    case "allocating":
    case "moving":
      return "processing";
    default:
      return "unknown";
  }
}

/**
 * Filter downloads by status
 */
function filterDownloadsByStatus(
  downloads: DownloadItem[],
  status: string,
): DownloadItem[] {
  return downloads.filter((download) => {
    const normalizedStatus = download.status.toLowerCase();
    const filterStatus = status.toLowerCase();

    if (filterStatus === "all") {
      return true;
    }

    // Map filter status to possible download statuses
    switch (filterStatus) {
      case "downloading":
        return (
          normalizedStatus === "downloading" || normalizedStatus === "stalled"
        );
      case "paused":
        return normalizedStatus === "paused";
      case "completed":
        return (
          normalizedStatus === "completed" || normalizedStatus === "uploading"
        );
      case "failed":
        return normalizedStatus === "failed" || normalizedStatus === "error";
      case "queued":
        return normalizedStatus === "queued";
      default:
        return normalizedStatus === filterStatus;
    }
  });
}

/**
 * Find the connector that has a specific download
 */
async function findConnectorForDownload(
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  downloadId: string,
  serviceType?: string,
): Promise<any | null> {
  const connectors = serviceType
    ? connectorManager.getConnectorsByType(serviceType as ToolServiceType)
    : connectorManager.getAllConnectors();

  for (const connector of connectors) {
    try {
      const downloads = await fetchDownloadsFromConnector(connector);
      const found = downloads.find((d) => d.id === downloadId);
      if (found) {
        return connector;
      }
    } catch {
      // Continue searching other connectors
      continue;
    }
  }

  return null;
}

/**
 * Sort downloads based on the specified sort field
 */
function sortDownloads(
  downloads: DownloadItem[],
  sortBy: "progress" | "speed" | "eta" | "size" | "name" = "name",
): DownloadItem[] {
  return [...downloads].sort((a, b) => {
    switch (sortBy) {
      case "progress":
        return b.progress - a.progress; // Highest progress first

      case "speed":
        return b.downloadSpeed - a.downloadSpeed; // Fastest first

      case "eta": {
        // Convert ETA to comparable numbers (handle "Unknown" and string ETAs)
        const etaA =
          typeof a.eta === "number" ? a.eta : Number.MAX_SAFE_INTEGER;
        const etaB =
          typeof b.eta === "number" ? b.eta : Number.MAX_SAFE_INTEGER;
        return etaA - etaB; // Shortest ETA first
      }

      case "size":
        return b.size - a.size; // Largest first

      case "name":
      default:
        return a.name.localeCompare(b.name); // Alphabetical
    }
  });
}

/**
 * Pause all downloads
 */
async function pauseAllDownloads(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const context = ToolContext.getInstance();
  const confirmationManager = ConfirmationManager.getInstance();
  const { serviceType, confirmationId } = params;

  // Get download connectors based on serviceType filter
  const downloadConnectors = serviceType
    ? connectorManager.getConnectorsByType(serviceType)
    : connectorManager
        .getAllConnectors()
        .filter((c) =>
          ["qbittorrent", "transmission", "deluge"].includes(c.config.type),
        );

  if (downloadConnectors.length === 0) {
    throw new ToolError(
      "No download clients configured",
      ToolErrorCategory.SERVICE_NOT_CONFIGURED,
      "Please add a download client service in Settings > Services.",
      { requestedServiceType: serviceType },
    );
  }

  // Get all active downloads to count them
  const allDownloads: DownloadItem[] = [];
  await Promise.all(
    downloadConnectors.map(async (connector) => {
      try {
        const downloads = await fetchDownloadsFromConnector(connector);
        allDownloads.push(...downloads);
      } catch {
        // Continue with other connectors
      }
    }),
  );

  const activeDownloads = allDownloads.filter(
    (d) => d.status === "downloading" || d.status === "stalled",
  );

  if (activeDownloads.length === 0) {
    return {
      success: true,
      data: {
        action: "pauseAll",
        message: "No active downloads to pause.",
      },
      metadata: {
        executionTime: Date.now() - startTime,
      },
    };
  }

  // Check if this requires confirmation
  const destructiveCheck = context.isDestructiveAction("manage_downloads", {
    action: "pauseAll",
  });

  if (destructiveCheck && !confirmationId) {
    const newConfirmationId = confirmationManager.requestConfirmation({
      action: "Pause all downloads",
      target: `${activeDownloads.length} active download${activeDownloads.length === 1 ? "" : "s"}`,
      severity: "low",
      toolName: "manage_downloads",
      params: { action: "pauseAll", serviceType },
    });

    return {
      success: true,
      data: {
        action: "pauseAll",
        message: `Are you sure you want to pause ${activeDownloads.length} active download${activeDownloads.length === 1 ? "" : "s"}?`,
        requiresConfirmation: true,
        confirmationId: newConfirmationId,
        confirmationPrompt: `This will pause all ${activeDownloads.length} active downloads. Do you want to proceed?`,
      },
      metadata: {
        executionTime: Date.now() - startTime,
      },
    };
  }

  // Verify confirmation if provided
  if (confirmationId) {
    const confirmed = confirmationManager.confirmAction(confirmationId);
    if (!confirmed) {
      throw new ToolError(
        "Confirmation expired or invalid",
        ToolErrorCategory.OPERATION_FAILED,
        "The confirmation has expired or is invalid. Please request the action again.",
        { confirmationId },
      );
    }
  }

  // Pause all downloads
  let pausedCount = 0;
  let failedCount = 0;

  for (const connector of downloadConnectors) {
    if (connector.config.type === "qbittorrent") {
      try {
        const qbConnector = connector as QBittorrentConnector;
        const downloads = await fetchDownloadsFromConnector(connector);
        const activeDownloadsForService = downloads.filter(
          (d) => d.status === "downloading" || d.status === "stalled",
        );

        // Pause each active download
        for (const download of activeDownloadsForService) {
          try {
            await qbConnector.pauseTorrent(download.id);
          } catch {
            // Continue with other downloads
          }
        }

        pausedCount += activeDownloadsForService.length;
      } catch (error) {
        failedCount++;
        void logger.warn("Failed to pause downloads on connector", {
          serviceId: connector.config.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  void logger.info("Bulk pause completed", { pausedCount, failedCount });

  return {
    success: true,
    data: {
      action: "pauseAll",
      message:
        failedCount > 0
          ? `Paused downloads on ${pausedCount} service${pausedCount === 1 ? "" : "s"}, but ${failedCount} service${failedCount === 1 ? "" : "s"} failed.`
          : `Successfully paused all downloads.`,
    },
    metadata: {
      executionTime: Date.now() - startTime,
    },
  };
}

/**
 * Resume all downloads
 */
async function resumeAllDownloads(
  params: DownloadManagementParams,
  connectorManager: ReturnType<
    typeof ToolContext.prototype.getConnectorManager
  >,
  startTime: number,
): Promise<ToolResult<DownloadManagementResult>> {
  const { serviceType } = params;

  // Get download connectors based on serviceType filter
  const downloadConnectors = serviceType
    ? connectorManager.getConnectorsByType(serviceType)
    : connectorManager
        .getAllConnectors()
        .filter((c) =>
          ["qbittorrent", "transmission", "deluge"].includes(c.config.type),
        );

  if (downloadConnectors.length === 0) {
    throw new ToolError(
      "No download clients configured",
      ToolErrorCategory.SERVICE_NOT_CONFIGURED,
      "Please add a download client service in Settings > Services.",
      { requestedServiceType: serviceType },
    );
  }

  // Resume all downloads
  let resumedCount = 0;
  let failedCount = 0;

  for (const connector of downloadConnectors) {
    if (connector.config.type === "qbittorrent") {
      try {
        const qbConnector = connector as QBittorrentConnector;
        const downloads = await fetchDownloadsFromConnector(connector);
        const pausedDownloads = downloads.filter((d) => d.status === "paused");

        // Resume each paused download
        for (const download of pausedDownloads) {
          try {
            await qbConnector.resumeTorrent(download.id);
          } catch {
            // Continue with other downloads
          }
        }

        resumedCount += pausedDownloads.length;
      } catch (error) {
        failedCount++;
        void logger.warn("Failed to resume downloads on connector", {
          serviceId: connector.config.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  void logger.info("Bulk resume completed", { resumedCount, failedCount });

  return {
    success: true,
    data: {
      action: "resumeAll",
      message:
        failedCount > 0
          ? `Resumed downloads on ${resumedCount} service${resumedCount === 1 ? "" : "s"}, but ${failedCount} service${failedCount === 1 ? "" : "s"} failed.`
          : `Successfully resumed all downloads.`,
    },
    metadata: {
      executionTime: Date.now() - startTime,
    },
  };
}

/**
 * Generate a user-friendly message for list results
 */
function generateListMessage(
  returnedCount: number,
  totalCount: number,
  params: DownloadManagementParams,
): string {
  if (returnedCount === 0) {
    if (params.status && params.status !== "all") {
      return `No ${params.status} downloads found.`;
    }
    return "No active downloads found.";
  }

  const statusStr =
    params.status && params.status !== "all" ? ` ${params.status}` : "";
  const serviceStr = params.serviceType ? ` from ${params.serviceType}` : "";

  if (returnedCount < totalCount) {
    return `Showing ${returnedCount} of ${totalCount}${statusStr} downloads${serviceStr}.`;
  }

  return `Found ${totalCount}${statusStr} download${totalCount === 1 ? "" : "s"}${serviceStr}.`;
}
