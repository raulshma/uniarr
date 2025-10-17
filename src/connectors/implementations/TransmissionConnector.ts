import type { AxiosInstance, AxiosError } from "axios";

import { BaseConnector } from "@/connectors/base/BaseConnector";
import { handleApiError } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";
import type {
  Torrent,
  TorrentState,
  TorrentTransferInfo,
} from "@/models/torrent.types";
import type { SystemHealth } from "@/connectors/base/IConnector";

// Transmission RPC API types
interface TransmissionTorrent {
  readonly id: number;
  readonly name: string;
  readonly status: number;
  readonly hashString: string;
  readonly totalSize: number;
  readonly downloadedEver: number;
  readonly uploadedEver: number;
  readonly rateDownload: number;
  readonly rateUpload: number;
  readonly eta: number;
  readonly percentDone: number;
  readonly addedDate?: number;
  readonly doneDate?: number;
  readonly seedTime?: number;
  readonly lastActivityDate?: number;
  readonly trackerStats?: {
    readonly id: number;
    readonly announce: string;
    readonly scrape: string;
    readonly tier: number;
    readonly lastAnnounceResult?: string;
    readonly lastAnnounceTime?: number;
    readonly lastScrapeResult?: string;
    readonly lastScrapeTime?: number;
    readonly leecherCount?: number;
    readonly seederCount?: number;
  }[];
}

interface TransmissionTorrentResponse {
  readonly arguments: {
    readonly torrents: TransmissionTorrent[];
  };
  readonly result: "success" | string;
}

interface TransmissionSessionResponse {
  readonly arguments: {
    readonly version: string;
  };
  readonly result: "success" | string;
}

interface TransmissionSessionStatsResponse {
  readonly arguments: {
    readonly downloadSpeed: number;
    readonly uploadSpeed: number;
    readonly activeTorrentCount: number;
    readonly pausedTorrentCount: number;
  };
  readonly result: "success" | string;
}

// Transmission status mapping
const TRANSMISSION_STATUS_MAP: Record<number, TorrentState> = {
  0: "pausedDL", // stopped
  1: "queuedDL", // check pending
  2: "checkingDL", // checking
  3: "queuedDL", // download pending
  4: "downloading", // downloading
  5: "queuedDL", // seed pending
  6: "uploading", // seeding
};

/**
 * Connector responsible for interacting with Transmission's RPC API.
 */
export class TransmissionConnector extends BaseConnector<Torrent> {
  private sessionId: string | null = null;

  protected override createHttpClient(): AxiosInstance {
    const instance = super.createHttpClient();

    instance.interceptors.request.use((config) => {
      if (this.sessionId) {
        config.headers["X-Transmission-Session-Id"] = this.sessionId;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config;

        // Handle Transmission's session ID requirements
        if (status === 409 && !originalRequest._retry) {
          originalRequest._retry = true;
          const sessionId =
            error.response?.headers?.["x-transmission-session-id"];
          if (sessionId) {
            this.sessionId = sessionId;
            return instance(originalRequest);
          }
        }

        return Promise.reject(error);
      },
    );

    return instance;
  }

  async initialize(): Promise<void> {
    logger.debug("[TransmissionConnector] Initializing", {
      serviceId: this.config.id,
    });
    await this.getSessionId();
    logger.debug("[TransmissionConnector] Initialization completed", {
      serviceId: this.config.id,
    });
  }

  async getVersion(): Promise<string> {
    logger.debug("[TransmissionConnector] Getting version", {
      serviceId: this.config.id,
    });

    try {
      const response =
        await this.rpcRequest<TransmissionSessionResponse>("session-get");
      return response.arguments.version;
    } catch (error) {
      logger.error("[TransmissionConnector] Version request failed", {
        serviceId: this.config.id,
        error,
      });
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getVersion",
        endpoint: "/transmission/rpc",
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      const version = await this.getVersion();

      return {
        status: "healthy",
        message: "Transmission is running and accessible.",
        lastChecked: new Date(),
        details: {
          version,
          apiVersion: "RPC",
        },
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getHealth",
        endpoint: "/transmission/rpc",
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
      const response = await this.rpcRequest<TransmissionTorrentResponse>(
        "torrent-get",
        {
          fields: [
            "id",
            "name",
            "status",
            "hashString",
            "totalSize",
            "downloadedEver",
            "uploadedEver",
            "rateDownload",
            "rateUpload",
            "eta",
            "percentDone",
            "addedDate",
            "doneDate",
            "seedTime",
            "lastActivityDate",
            "trackerStats",
          ],
        },
      );

      return response.arguments.torrents.map((torrent) =>
        this.mapTorrent(torrent),
      );
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTorrents",
        endpoint: "/transmission/rpc",
      });
    }
  }

  async pauseTorrent(hash: string): Promise<void> {
    try {
      await this.rpcRequest("torrent-stop", { ids: [hash] });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "pauseTorrent",
        endpoint: "/transmission/rpc",
      });
    }
  }

  async resumeTorrent(hash: string): Promise<void> {
    try {
      await this.rpcRequest("torrent-start", { ids: [hash] });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "resumeTorrent",
        endpoint: "/transmission/rpc",
      });
    }
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
    try {
      await this.rpcRequest("torrent-remove", {
        ids: [hash],
        "delete-local-data": deleteFiles,
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "deleteTorrent",
        endpoint: "/transmission/rpc",
      });
    }
  }

  async forceRecheck(hash: string): Promise<void> {
    try {
      await this.rpcRequest("torrent-verify", { ids: [hash] });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "forceRecheck",
        endpoint: "/transmission/rpc",
      });
    }
  }

  async getTransferInfo(): Promise<TorrentTransferInfo> {
    try {
      const response =
        await this.rpcRequest<TransmissionSessionStatsResponse>(
          "session-stats",
        );

      return {
        downloadSpeed: response.arguments.downloadSpeed,
        uploadSpeed: response.arguments.uploadSpeed,
        dhtNodes: 0, // Transmission doesn't expose DHT node count in this API
        connectionStatus: "connected", // Transmission doesn't provide connection status in this API
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: "getTransferInfo",
        endpoint: "/transmission/rpc",
      });
    }
  }

  override dispose(): void {
    this.sessionId = null;
    super.dispose();
  }

  private async getSessionId(): Promise<void> {
    try {
      // Make a request that will fail with 409 to get the session ID
      await this.client.post("/transmission/rpc", { method: "session-get" });
    } catch (error) {
      // Expected to fail, but we get the session ID from the response headers
      const sessionId = (error as AxiosError)?.response?.headers?.[
        "x-transmission-session-id"
      ];
      if (sessionId) {
        this.sessionId = sessionId;
        logger.debug("[TransmissionConnector] Session ID obtained", {
          serviceId: this.config.id,
          sessionId,
        });
      }
    }
  }

  private async rpcRequest<T = any>(method: string, args?: any): Promise<T> {
    const payload = {
      method,
      arguments: args || {},
    };

    const response = await this.client.post("/transmission/rpc", payload);
    return response.data;
  }

  private mapTorrent(raw: TransmissionTorrent): Torrent {
    const trackerStats = raw.trackerStats?.[0];
    const totalSeeds = trackerStats?.seederCount || 0;
    const totalPeers = trackerStats?.leecherCount || 0;

    return {
      hash: raw.hashString,
      name: raw.name,
      state: TRANSMISSION_STATUS_MAP[raw.status] || "unknown",
      progress: raw.percentDone,
      size: raw.totalSize,
      downloaded: raw.downloadedEver,
      uploaded: raw.uploadedEver,
      ratio: raw.totalSize > 0 ? raw.uploadedEver / raw.totalSize : 0,
      downloadSpeed: raw.rateDownload,
      uploadSpeed: raw.rateUpload,
      eta: raw.eta,
      addedOn: raw.addedDate,
      completedOn: raw.doneDate,
      seedingTime: raw.seedTime,
      lastActivity: raw.lastActivityDate,
      seeds: {
        connected: 0, // Transmission doesn't provide connected seed count
        total: totalSeeds,
      },
      peers: {
        connected: 0, // Transmission doesn't provide connected peer count
        total: totalPeers,
      },
      availability: 0, // Transmission doesn't provide availability in this API
    };
  }
}
