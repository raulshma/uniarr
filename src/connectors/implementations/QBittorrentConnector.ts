import { AxiosHeaders } from 'axios';
import type { AxiosHeaderValue, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { BaseConnector } from '@/connectors/base/BaseConnector';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';
import type { Torrent, TorrentState, TorrentTransferInfo } from '@/models/torrent.types';
import type { SystemHealth } from '@/connectors/base/IConnector';

const QB_API_PREFIX = '/api/v2';

interface QBittorrentTorrent {
  readonly hash: string;
  readonly name: string;
  readonly state: TorrentState | string;
  readonly category?: string;
  readonly tags?: string;
  readonly progress: number;
  readonly size?: number;
  readonly total_size?: number;
  readonly downloaded: number;
  readonly uploaded: number;
  readonly ratio: number;
  readonly dlspeed: number;
  readonly upspeed: number;
  readonly eta: number;
  readonly added_on?: number;
  readonly completion_on?: number;
  readonly seeding_time?: number;
  readonly last_activity?: number;
  readonly num_seeds?: number;
  readonly num_complete?: number;
  readonly num_leechs?: number;
  readonly num_incomplete?: number;
  readonly availability?: number;
}

interface QBittorrentTransferInfo {
  readonly dl_info_speed: number;
  readonly up_info_speed: number;
  readonly dht_nodes: number;
  readonly connection_status: 'connected' | 'firewalled' | 'disconnected';
}

type AuthenticatedRequestConfig = AxiosRequestConfig & { _retry?: boolean };

/**
 * Connector responsible for interacting with qBittorrent's Web API.
 */
export class QBittorrentConnector extends BaseConnector<Torrent> {
  private authPromise: Promise<void> | null = null;

  protected override createHttpClient(): AxiosInstance {
    const instance = super.createHttpClient();
    instance.defaults.withCredentials = true;

    // Axios automatically handles cookies when withCredentials is true
    // No need for manual cookie management

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const originalRequest = error?.config as AuthenticatedRequestConfig | undefined;
        const isAuthRequest = typeof originalRequest?.url === 'string' && originalRequest.url.includes('/auth/login');

        if (!originalRequest || isAuthRequest) {
          return Promise.reject(error);
        }

        if (status === 401 || status === 403) {
          if (originalRequest._retry) {
            return Promise.reject(error);
          }

          originalRequest._retry = true;

          try {
            await this.ensureAuthenticated();
          } catch (authError) {
            return Promise.reject(authError);
          }

          // Axios will automatically include cookies in the retry request
          return instance(originalRequest);
        }

        return Promise.reject(error);
      },
    );

    return instance;
  }

  async initialize(): Promise<void> {
    console.log('🔧 [QBittorrentConnector] Initializing...');
    await this.ensureAuthenticated();
    console.log('🔧 [QBittorrentConnector] Initialization completed');
  }

  async getVersion(): Promise<string> {
    console.log('🔧 [QBittorrentConnector] Getting version...');
    await this.ensureAuthenticated();

    try {
      console.log('🔧 [QBittorrentConnector] Making version request to:', `${this.config.url}${QB_API_PREFIX}/app/version`);
      const response = await this.client.get<string>(`${QB_API_PREFIX}/app/version`, {
        responseType: 'text',
        transformResponse: (value) => value,
      });

      const version = typeof response.data === 'string' ? response.data.trim() : undefined;
      const finalVersion = version && version.length > 0 ? version : 'unknown';
      console.log('🔧 [QBittorrentConnector] Version retrieved:', finalVersion);
      return finalVersion;
    } catch (error) {
      console.error('🔧 [QBittorrentConnector] Version request failed:', error);
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: `${QB_API_PREFIX}/app/version`,
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      await this.ensureAuthenticated();

      // Use the app/version endpoint as a health check since qBittorrent doesn't have a dedicated health endpoint
      const response = await this.client.get<string>(`${QB_API_PREFIX}/app/version`, {
        responseType: 'text',
        transformResponse: (value) => value,
      });

      const version = typeof response.data === 'string' ? response.data.trim() : undefined;
      
      return {
        status: 'healthy',
        message: 'qBittorrent is running and accessible.',
        lastChecked: new Date(),
        details: {
          version: version && version.length > 0 ? version : 'unknown',
          apiVersion: 'v2',
        },
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getHealth',
        endpoint: `${QB_API_PREFIX}/app/version`,
      });

      return {
        status: diagnostic.isNetworkError ? 'offline' : 'degraded',
        message: diagnostic.message,
        lastChecked: new Date(),
        details: diagnostic.details,
      };
    }
  }

  async getTorrents(filters?: { category?: string; tag?: string; status?: string }): Promise<Torrent[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get<QBittorrentTorrent[]>(`${QB_API_PREFIX}/torrents/info`, {
        params: {
          category: filters?.category,
          tag: filters?.tag,
          filter: filters?.status,
        },
      });

      return response.data.map((torrent) => this.mapTorrent(torrent));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTorrents',
        endpoint: `${QB_API_PREFIX}/torrents/info`,
      });
    }
  }

  async pauseTorrent(hash: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.postForm(`${QB_API_PREFIX}/torrents/pause`, { hashes: hash });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'pauseTorrent',
        endpoint: `${QB_API_PREFIX}/torrents/pause`,
      });
    }
  }

  async resumeTorrent(hash: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.postForm(`${QB_API_PREFIX}/torrents/resume`, { hashes: hash });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'resumeTorrent',
        endpoint: `${QB_API_PREFIX}/torrents/resume`,
      });
    }
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.postForm(`${QB_API_PREFIX}/torrents/delete`, {
        hashes: hash,
        deleteFiles: deleteFiles ? 'true' : 'false',
      });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'deleteTorrent',
        endpoint: `${QB_API_PREFIX}/torrents/delete`,
      });
    }
  }

  async forceRecheck(hash: string): Promise<void> {
    await this.ensureAuthenticated();

    try {
      await this.postForm(`${QB_API_PREFIX}/torrents/recheck`, { hashes: hash });
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'forceRecheck',
        endpoint: `${QB_API_PREFIX}/torrents/recheck`,
      });
    }
  }

  async getTransferInfo(): Promise<TorrentTransferInfo> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get<QBittorrentTransferInfo>(`${QB_API_PREFIX}/transfer/info`);
      return this.mapTransferInfo(response.data);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTransferInfo',
        endpoint: `${QB_API_PREFIX}/transfer/info`,
      });
    }
  }

  override dispose(): void {
    // Session-based auth doesn't require explicit logout
    super.dispose();
  }


  private mapTorrent(raw: QBittorrentTorrent): Torrent {
    return {
      hash: raw.hash,
      name: raw.name,
      state: this.normalizeState(raw.state),
      category: raw.category,
      tags: this.normalizeTags(raw.tags),
      progress: raw.progress,
      size: raw.total_size ?? raw.size ?? 0,
      downloaded: raw.downloaded,
      uploaded: raw.uploaded,
      ratio: raw.ratio,
      downloadSpeed: raw.dlspeed,
      uploadSpeed: raw.upspeed,
      eta: raw.eta,
      addedOn: raw.added_on,
      completedOn: raw.completion_on,
      seedingTime: raw.seeding_time,
      lastActivity: raw.last_activity,
      seeds: {
        connected: raw.num_seeds ?? 0,
        total: raw.num_complete ?? 0,
      },
      peers: {
        connected: raw.num_leechs ?? 0,
        total: raw.num_incomplete ?? 0,
      },
      availability: raw.availability,
    };
  }

  private mapTransferInfo(raw: QBittorrentTransferInfo): TorrentTransferInfo {
    return {
      downloadSpeed: raw.dl_info_speed,
      uploadSpeed: raw.up_info_speed,
      dhtNodes: raw.dht_nodes,
      connectionStatus: raw.connection_status,
    };
  }

  private normalizeState(state: string): TorrentState {
    const normalized = state as TorrentState;

    if (
      normalized === 'error' ||
      normalized === 'missingFiles' ||
      normalized === 'uploading' ||
      normalized === 'stalledUP' ||
      normalized === 'queuedUP' ||
      normalized === 'pausedUP' ||
      normalized === 'checkingUP' ||
      normalized === 'checkingResumeData' ||
      normalized === 'forcedUP' ||
      normalized === 'allocating' ||
      normalized === 'downloading' ||
      normalized === 'metaDL' ||
      normalized === 'stalledDL' ||
      normalized === 'checkingDL' ||
      normalized === 'queuedDL' ||
      normalized === 'pausedDL' ||
      normalized === 'forcedDL' ||
      normalized === 'forcedMetaDL' ||
      normalized === 'moving'
    ) {
      return normalized;
    }

    return 'unknown';
  }

  private normalizeTags(tags: string | undefined): string[] | undefined {
    if (!tags) {
      return undefined;
    }

    const parts = tags
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    return parts.length ? parts : undefined;
  }


  private async postForm(url: string, payload: Record<string, string>): Promise<void> {
    const body = new URLSearchParams(payload);

    await this.client.post(url, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  }
}
