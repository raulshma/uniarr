import type { AxiosInstance } from 'axios';

import { BaseConnector } from '@/connectors/base/BaseConnector';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';
import type { Torrent, TorrentState, TorrentTransferInfo } from '@/models/torrent.types';
import type { SystemHealth } from '@/connectors/base/IConnector';

// Deluge JSON-RPC API types
interface DelugeTorrent {
  readonly name: string;
  readonly hash: string;
  readonly state: string;
  readonly progress: number;
  readonly total_size: number;
  readonly total_downloaded: number;
  readonly total_uploaded: number;
  readonly download_payload_rate: number;
  readonly upload_payload_rate: number;
  readonly eta: number;
  readonly time_added?: number;
  readonly completed_time?: number;
  readonly seeding_time?: number;
  readonly last_seen_complete?: number;
  readonly num_seeds?: number;
  readonly total_seeds?: number;
  readonly num_peers?: number;
  readonly total_peers?: number;
  readonly ratio?: number;
  readonly distributed_copies?: number;
}

interface DelugeResponse<T = any> {
  readonly result: T;
  readonly error: any;
  readonly id: number;
}

interface DelugeSessionResponse extends DelugeResponse<{
  readonly version: string;
}> {}

interface DelugeTorrentsResponse extends DelugeResponse<Record<string, DelugeTorrent>> {}

interface DelugeStatsResponse extends DelugeResponse<{
  readonly download_rate: number;
  readonly upload_rate: number;
}> {}

// Deluge status mapping
const DELUGE_STATUS_MAP: Record<string, TorrentState> = {
  'Downloading': 'downloading',
  'Seeding': 'uploading',
  'Paused': 'pausedDL',
  'Checking': 'checkingDL',
  'Queued': 'queuedDL',
  'Error': 'error',
  'Moving': 'moving',
};

/**
 * Connector responsible for interacting with Deluge's JSON-RPC API.
 */
export class DelugeConnector extends BaseConnector<Torrent> {
  private requestId = 0;

  protected override createHttpClient(): AxiosInstance {
    const instance = super.createHttpClient();

    // Deluge uses basic auth for JSON-RPC
    if (this.config.username && this.config.password) {
      instance.defaults.auth = {
        username: this.config.username,
        password: this.config.password,
      };
    }

    return instance;
  }

  async initialize(): Promise<void> {
    console.log('🔧 [DelugeConnector] Initializing...');
    // Deluge doesn't require explicit initialization beyond auth
    console.log('🔧 [DelugeConnector] Initialization completed');
  }

  async getVersion(): Promise<string> {
    console.log('🔧 [DelugeConnector] Getting version...');

    try {
      const response = await this.rpcRequest<DelugeSessionResponse>('web.get_version');
      return response.result.version;
    } catch (error) {
      console.error('🔧 [DelugeConnector] Version request failed:', error);
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: '/json',
      });
    }
  }

  override async getHealth(): Promise<SystemHealth> {
    try {
      const version = await this.getVersion();

      return {
        status: 'healthy',
        message: 'Deluge is running and accessible.',
        lastChecked: new Date(),
        details: {
          version,
          apiVersion: 'JSON-RPC',
        },
      };
    } catch (error) {
      const diagnostic = handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getHealth',
        endpoint: '/json',
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
    try {
      // Get all torrent hashes first
      const hashesResponse = await this.rpcRequest<DelugeResponse<string[]>>('core.get_torrents_status', [
        {}, // Empty filter to get all torrents
        [
          'name', 'hash', 'state', 'progress', 'total_size', 'total_downloaded',
          'total_uploaded', 'download_payload_rate', 'upload_payload_rate', 'eta',
          'time_added', 'completed_time', 'seeding_time', 'last_seen_complete',
          'num_seeds', 'total_seeds', 'num_peers', 'total_peers', 'ratio', 'distributed_copies'
        ]
      ]);

      const hashes = Object.keys(hashesResponse.result);
      if (hashes.length === 0) {
        return [];
      }

      // Get detailed info for all torrents
      const detailsResponse = await this.rpcRequest<DelugeTorrentsResponse>('core.get_torrents_status', [
        { id: hashes }, // Filter by specific hashes
        [
          'name', 'hash', 'state', 'progress', 'total_size', 'total_downloaded',
          'total_uploaded', 'download_payload_rate', 'upload_payload_rate', 'eta',
          'time_added', 'completed_time', 'seeding_time', 'last_seen_complete',
          'num_seeds', 'total_seeds', 'num_peers', 'total_peers', 'ratio', 'distributed_copies'
        ]
      ]);

      return Object.values(detailsResponse.result).map((torrent: DelugeTorrent) => this.mapTorrent(torrent));
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTorrents',
        endpoint: '/json',
      });
    }
  }

  async pauseTorrent(hash: string): Promise<void> {
    try {
      await this.rpcRequest('core.pause_torrent', [[hash]]);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'pauseTorrent',
        endpoint: '/json',
      });
    }
  }

  async resumeTorrent(hash: string): Promise<void> {
    try {
      await this.rpcRequest('core.resume_torrent', [[hash]]);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'resumeTorrent',
        endpoint: '/json',
      });
    }
  }

  async deleteTorrent(hash: string, deleteFiles = false): Promise<void> {
    try {
      await this.rpcRequest('core.remove_torrent', [hash, deleteFiles]);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'deleteTorrent',
        endpoint: '/json',
      });
    }
  }

  async forceRecheck(hash: string): Promise<void> {
    try {
      await this.rpcRequest('core.force_recheck', [[hash]]);
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'forceRecheck',
        endpoint: '/json',
      });
    }
  }

  async getTransferInfo(): Promise<TorrentTransferInfo> {
    try {
      const response = await this.rpcRequest<DelugeStatsResponse>('core.get_session_status', [
        ['download_rate', 'upload_rate']
      ]);

      return {
        downloadSpeed: response.result.download_rate,
        uploadSpeed: response.result.upload_rate,
        dhtNodes: 0, // Deluge doesn't expose DHT node count in this API
        connectionStatus: 'connected', // Deluge doesn't provide connection status in this API
      };
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getTransferInfo',
        endpoint: '/json',
      });
    }
  }

  private async rpcRequest<T>(method: string, params?: any[]): Promise<T> {
    const payload = {
      method,
      params: params || [],
      id: ++this.requestId,
      jsonrpc: '2.0',
    };

    const response = await this.client.post('/json', payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  }

  private mapTorrent(raw: DelugeTorrent): Torrent {
    return {
      hash: raw.hash,
      name: raw.name,
      state: DELUGE_STATUS_MAP[raw.state] || 'unknown',
      progress: raw.progress,
      size: raw.total_size,
      downloaded: raw.total_downloaded,
      uploaded: raw.total_uploaded,
      ratio: raw.ratio || 0,
      downloadSpeed: raw.download_payload_rate,
      uploadSpeed: raw.upload_payload_rate,
      eta: raw.eta,
      addedOn: raw.time_added,
      completedOn: raw.completed_time,
      seedingTime: raw.seeding_time,
      lastActivity: raw.last_seen_complete,
      seeds: {
        connected: raw.num_seeds || 0,
        total: raw.total_seeds || 0,
      },
      peers: {
        connected: raw.num_peers || 0,
        total: raw.total_peers || 0,
      },
      availability: raw.distributed_copies || 0,
    };
  }
}
