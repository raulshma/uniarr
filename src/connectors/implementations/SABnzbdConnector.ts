import { BaseConnector } from "@/connectors/base/BaseConnector";
import { handleApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";
import type {
  Torrent,
  TorrentState,
  TorrentTransferInfo,
} from "@/models/torrent.types";
import type { SystemHealth } from "@/connectors/base/IConnector";

// SABnzbd API types (adapted for torrent-like interface)
interface SABnzbdQueueItem {
  readonly nzo_id: string;
  readonly name: string;
  readonly status: string;
  readonly avg_age?: string;
  readonly script?: string;
  readonly mb: number;
  readonly mbleft: number;
  readonly percentage: number;
  readonly mb_per_sec?: number;
  readonly eta?: string;
  readonly time_left?: string;
  readonly priority: string;
  readonly cat?: string;
  readonly size?: string;
  readonly sizeleft?: string;
  readonly downloaded?: number;
  readonly uploaded?: number;
}

interface SABnzbdQueueResponse {
  readonly queue: {
    readonly slots: SABnzbdQueueItem[];
    readonly speedlimit?: number;
    readonly speedlimit_abs?: string;
    readonly paused: boolean;
    readonly pause_int?: string;
    readonly noofslots?: number;
    readonly noofslots_total?: number;
    readonly limit?: number;
    readonly limit_abs?: string;
    readonly finish?: number;
    readonly finishaction?: string | null;
    readonly eta?: string;
    readonly timeleft?: string;
    readonly speed?: string;
    readonly kbpersec?: number;
    readonly size?: string;
    readonly sizeleft?: string;
    readonly mb?: number;
    readonly mbleft?: number;
  };
}

interface SABnzbdHistoryItem {
  readonly nzo_id: string;
  readonly name: string;
  readonly status: string;
  readonly script?: string;
  readonly downloaded?: number;
  readonly downloaded_formatted?: string;
  readonly size?: string;
  readonly size_formatted?: string;
  readonly category?: string;
  readonly pp?: string;
  readonly completeness?: number;
  readonly url?: string;
  readonly report?: string;
  readonly completed?: number;
  readonly downloaded_time?: number;
  readonly seeder?: string;
  readonly reason?: string;
  readonly nzb_name?: string;
  readonly storage?: string;
  readonly path?: string;
  readonly postproc_time?: number;
  readonly stage_log?: string[];
  readonly downloaded_time_str?: string;
  readonly seeder_formatted?: string;
  readonly reason_formatted?: string;
}

interface SABnzbdHistoryResponse {
  readonly history: {
    readonly slots: SABnzbdHistoryItem[];
    readonly noofslots?: number;
    readonly last_history_update?: number;
  };
}

interface SABnzbdVersionResponse {
  readonly version: string;
  readonly sabnzbd_version?: string;
}

// SABnzbd status mapping to torrent states
const SABNZBD_STATUS_MAP: Record<string, TorrentState> = {
  Downloading: "downloading",
  Queued: "queuedDL",
  Paused: "pausedDL",
  Checking: "checkingDL",
  Repairing: "checkingDL",
  Verifying: "checkingDL",
  Extracting: "checkingDL",
  Moving: "moving",
  Completed: "uploading", // SABnzbd doesn't have seeding, but completed items are "uploaded"
  Failed: "error",
  Deleted: "error",
};

/**
 * Connector responsible for interacting with SABnzbd's REST API.
 */
export class SABnzbdConnector extends BaseConnector<Torrent> {
  async initialize(): Promise<void> {
    logger.debug("[SABnzbdConnector] Initializing", {
      serviceId: this.config.id,
    });
    // SABnzbd doesn't require explicit initialization beyond auth
    logger.debug("[SABnzbdConnector] Initialization completed", {
      serviceId: this.config.id,
    });
  }

  async getVersion(): Promise<string> {
    logger.debug("[SABnzbdConnector] Getting version", {
      serviceId: this.config.id,
    });

    try {
      const response = await this.client.get<SABnzbdVersionResponse>(
        "version",
        {
          params: { apikey: this.config.apiKey },
        },
      );

      return response.data.version || "unknown";
    } catch (error) {
      logger.error("[SABnzbdConnector] Version request failed", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: "/api",
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      const version = await this.getVersion();

      return {
        status: "healthy",
        message: "SABnzbd is running and accessible.",
        lastChecked: new Date(),
        details: {
          version,
          apiVersion: "REST",
        },
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHealth",
        endpoint: "/api",
      });

      return {
        status: diagnostic.isNetworkError ? "offline" : "degraded",
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  async getTorrents(filters?: {
    category?: string;
    tag?: string;
    status?: string;
  }): Promise<Torrent[]> {
    try {
      // Get queue (active downloads)
      const queueResponse = await this.client.get<SABnzbdQueueResponse>(
        "queue",
        {
          params: { apikey: this.config.apiKey },
        },
      );

      const queueItems = queueResponse.data.queue.slots || [];

      // Get history (completed/failed downloads)
      const historyResponse = await this.client.get<SABnzbdHistoryResponse>(
        "history",
        {
          params: {
            apikey: this.config.apiKey,
            limit: 100, // Get recent history items
          },
        },
      );

      const historyItems = historyResponse.data.history.slots || [];

      // Combine queue and history items
      const allItems = [...queueItems, ...historyItems];

      return allItems.map((item) => this.mapQueueItem(item));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTorrents",
        endpoint: "/api",
      });
    }
  }

  async pauseTorrent(hash: string): Promise<void> {
    try {
      await this.client.get("queue", {
        params: {
          apikey: this.config.apiKey,
          name: "pause",
          value: hash,
        },
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "pauseTorrent",
        endpoint: "/api",
      });
    }
  }

  async resumeTorrent(hash: string): Promise<void> {
    try {
      await this.client.get("queue", {
        params: {
          apikey: this.config.apiKey,
          name: "resume",
          value: hash,
        },
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "resumeTorrent",
        endpoint: "/api",
      });
    }
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
    try {
      await this.client.get("queue", {
        params: {
          apikey: this.config.apiKey,
          name: "delete",
          value: hash,
          ...(deleteFiles && { del_files: 1 }),
        },
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTorrent",
        endpoint: "/api",
      });
    }
  }

  async forceRecheck(hash: string): Promise<void> {
    try {
      // SABnzbd doesn't have a direct recheck, but we can retry the download
      await this.client.get("queue", {
        params: {
          apikey: this.config.apiKey,
          name: "retry",
          value: hash,
        },
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "forceRecheck",
        endpoint: "/api",
      });
    }
  }

  async getTransferInfo(): Promise<TorrentTransferInfo> {
    try {
      const response = await this.client.get<SABnzbdQueueResponse>("queue", {
        params: { apikey: this.config.apiKey },
      });

      const queue = response.data.queue;

      return {
        downloadSpeed: (queue.kbpersec || 0) * 1024, // Convert KB/s to B/s
        uploadSpeed: 0, // SABnzbd doesn't upload (Usenet client)
        dhtNodes: 0, // SABnzbd doesn't use DHT
        connectionStatus: queue.paused ? "disconnected" : "connected",
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTransferInfo",
        endpoint: "/api",
      });
    }
  }

  private mapQueueItem(item: SABnzbdQueueItem | SABnzbdHistoryItem): Torrent {
    const isQueueItem = "mbleft" in item;
    const progress = isQueueItem
      ? ((item.mb - item.mbleft) / item.mb) * 100
      : 100;
    const status = isQueueItem
      ? item.status
      : item.status === "Completed"
        ? "Completed"
        : "Failed";
    const size = isQueueItem
      ? item.mb * 1024 * 1024
      : parseInt(item.size || "0");

    return {
      hash: item.nzo_id,
      name: item.name,
      state: SABNZBD_STATUS_MAP[status] || "unknown",
      progress: progress / 100, // Convert percentage to 0-1 range
      size,
      downloaded: isQueueItem ? (item.mb - item.mbleft) * 1024 * 1024 : size,
      uploaded: 0, // SABnzbd doesn't upload (Usenet client)
      ratio: 0, // No ratio for Usenet downloads
      downloadSpeed: isQueueItem ? (item.mb_per_sec || 0) * 1024 * 1024 : 0, // Convert MB/s to B/s
      uploadSpeed: 0, // SABnzbd doesn't upload
      eta: this.parseEta(isQueueItem ? item.time_left : (item as any).eta || 0),
      addedOn: undefined, // SABnzbd doesn't provide this in the basic API
      completedOn: isQueueItem ? undefined : item.completed,
      seedingTime: 0, // SABnzbd doesn't seed
      lastActivity: isQueueItem ? undefined : item.downloaded_time,
      seeds: {
        connected: 0, // SABnzbd doesn't provide peer info for Usenet
        total: 0,
      },
      peers: {
        connected: 0, // SABnzbd doesn't provide peer info for Usenet
        total: 0,
      },
      availability: isQueueItem ? 0 : item.completeness || 0,
    };
  }

  private parseEta(etaString?: string): number {
    if (!etaString || etaString === "0:00:00") {
      return 0;
    }

    // Parse "X:YY:ZZ" format (days:hours:minutes:seconds)
    const parts = etaString.split(":");
    if (parts.length >= 3) {
      const seconds = parseInt(parts[parts.length - 1] || "0") || 0;
      const minutes = parseInt(parts[parts.length - 2] || "0") || 0;
      const hours = parseInt(parts[parts.length - 3] || "0") || 0;
      const days =
        parts.length > 3 ? parseInt(parts[parts.length - 4] || "0") || 0 : 0;

      return days * 86400 + hours * 3600 + minutes * 60 + seconds;
    }

    return 0;
  }
}
