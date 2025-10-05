import { AxiosHeaders } from 'axios';
import type { AxiosHeaderValue, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { BaseConnector } from '@/connectors/base/BaseConnector';
import { handleApiError } from '@/utils/error.utils';
import { logger } from '@/services/logger/LoggerService';
import type { Torrent, TorrentState, TorrentTransferInfo } from '@/models/torrent.types';

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
  private sessionCookie?: string;
  private authPromise: Promise<void> | null = null;

  protected override createHttpClient(): AxiosInstance {
    const instance = super.createHttpClient();
    instance.defaults.withCredentials = true;

    instance.interceptors.request.use((config) => {
      if (!this.sessionCookie) {
        return config;
      }

      const headers = new AxiosHeaders(
        config.headers as AxiosHeaders | Record<string, AxiosHeaderValue> | string | undefined,
      );
      headers.set('Cookie', this.sessionCookie);
      config.headers = headers;
      return config;
    });

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
            await this.authenticate();
          } catch (authError) {
            return Promise.reject(authError);
          }

          if (this.sessionCookie) {
            const retryHeaders = new AxiosHeaders(
              originalRequest.headers as AxiosHeaders | Record<string, AxiosHeaderValue> | string | undefined,
            );
            retryHeaders.set('Cookie', this.sessionCookie);
            originalRequest.headers = retryHeaders;
          }

          return instance(originalRequest);
        }

        return Promise.reject(error);
      },
    );

    return instance;
  }

  async initialize(): Promise<void> {
    await this.ensureAuthenticated(true);
  }

  async getVersion(): Promise<string> {
    await this.ensureAuthenticated();

    try {
      const response = await this.client.get<string>(`${QB_API_PREFIX}/app/version`, {
        responseType: 'text',
        transformResponse: (value) => value,
      });

      const version = typeof response.data === 'string' ? response.data.trim() : undefined;
      return version && version.length > 0 ? version : 'unknown';
    } catch (error) {
      throw handleApiError(error, {
        serviceId: this.config.id,
        serviceType: this.config.type,
        operation: 'getVersion',
        endpoint: `${QB_API_PREFIX}/app/version`,
      });
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
    void this.logout();
    this.sessionCookie = undefined;
    super.dispose();
  }

  private async ensureAuthenticated(force = false): Promise<void> {
    if (!force && this.sessionCookie) {
      return;
    }

    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    if (this.authPromise) {
      return this.authPromise;
    }

    if (!this.config.username || !this.config.password) {
      throw new Error('qBittorrent credentials are required.');
    }

    const payload = new URLSearchParams({
      username: this.config.username,
      password: this.config.password,
    });

    const request = async () => {
      void logger.debug('Attempting qBittorrent authentication.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        username: this.config.username,
        url: `${this.config.url}${QB_API_PREFIX}/auth/login`,
        referer: this.config.url,
      });

      const response = await this.client.post<string>(`${QB_API_PREFIX}/auth/login`, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': this.config.url,
        },
        transformResponse: (value) => value,
      });

      const body = typeof response.data === 'string' ? response.data.trim() : '';
      const normalizedBody = body.toLowerCase().replace(/\.$/, ''); // Remove trailing period and convert to lowercase
      
      void logger.debug('qBittorrent authentication response received.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        status: response.status,
        responseBody: body,
        hasSetCookie: Boolean(response.headers?.['set-cookie'] || response.headers?.['Set-Cookie']),
      });
      
      if (normalizedBody !== 'ok') {
        // Provide more detailed error information with troubleshooting hints
        let errorMessage = body 
          ? `qBittorrent authentication failed. Server responded with: "${body}"`
          : 'qBittorrent authentication failed. No response body received.';
        
        // Add troubleshooting hints based on common issues
        if (body === 'Fails.' || normalizedBody === 'fails.') {
          errorMessage += ' This usually means incorrect username or password. Default credentials are admin/adminadmin.';
        } else if (body === 'Bad credentials' || normalizedBody === 'bad credentials') {
          errorMessage += ' The provided credentials are invalid.';
        } else if (body === 'Banned' || normalizedBody === 'banned') {
          errorMessage += ' Your IP address has been banned due to multiple failed login attempts.';
        }
        
        void logger.warn('qBittorrent authentication failed.', {
          serviceId: this.config.id,
          serviceType: this.config.type,
          responseBody: body,
          status: response.status,
          headers: response.headers,
        });
        
        throw new Error(errorMessage);
      }

      this.sessionCookie = this.extractSessionCookie(response);
      
      void logger.debug('qBittorrent authentication successful.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        sessionCookie: this.sessionCookie ? 'present' : 'missing',
      });
    };

    this.authPromise = request()
      .catch((error) => {
        this.sessionCookie = undefined;
        throw handleApiError(error, {
          serviceId: this.config.id,
          serviceType: this.config.type,
          operation: 'authenticate',
          endpoint: `${QB_API_PREFIX}/auth/login`,
        });
      })
      .finally(() => {
        this.authPromise = null;
      });

    return this.authPromise;
  }

  private async logout(): Promise<void> {
    if (!this.sessionCookie) {
      return;
    }

    try {
      await this.client.post(`${QB_API_PREFIX}/auth/logout`);
    } catch (error) {
      // Ignore logout errors; the session may already be invalid.
      void error;
    } finally {
      this.sessionCookie = undefined;
    }
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

  private extractSessionCookie(response: AxiosResponse): string {
    void logger.debug('Extracting session cookie from response.', {
      serviceId: this.config.id,
      serviceType: this.config.type,
      headers: response.headers,
      setCookieHeader: response.headers?.['set-cookie'],
      setCookieHeaderAlt: response.headers?.['Set-Cookie'],
    });

    const header = (response.headers?.['set-cookie'] ?? response.headers?.['Set-Cookie']) as string | string[] | undefined;

    const rawCookie = Array.isArray(header) ? header[0] : header;
    if (!rawCookie) {
      void logger.warn('No session cookie found in response headers.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        availableHeaders: Object.keys(response.headers || {}),
      });
      throw new Error('qBittorrent authentication succeeded but session cookie is missing.');
    }

    const cookie = rawCookie.split(';')[0] ?? '';
    if (!cookie) {
      void logger.warn('Empty session cookie received.', {
        serviceId: this.config.id,
        serviceType: this.config.type,
        rawCookie,
      });
      throw new Error('qBittorrent provided an empty session cookie.');
    }

    void logger.debug('Session cookie extracted successfully.', {
      serviceId: this.config.id,
      serviceType: this.config.type,
      cookie: cookie.substring(0, 10) + '...', // Log partial cookie for security
    });

    return cookie;
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
