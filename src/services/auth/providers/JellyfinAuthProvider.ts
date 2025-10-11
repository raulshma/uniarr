import axios, { AxiosError } from 'axios';

import { BaseAuthProvider } from './BaseAuthProvider';
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from '../types';
import { logger } from '@/services/logger/LoggerService';
import type { JellyfinUserProfile } from '@/models/jellyfin.types';

const CLIENT_NAME = 'UniArr';
const DEVICE_NAME = 'UniArr Mobile';
const CLIENT_VERSION = '1.0.0';

const sanitizeApiKey = (token: string | undefined): string | undefined =>
  token && token.trim().length > 0 ? token.trim() : undefined;

const normalizeName = (value: string | undefined): string | undefined =>
  value && value.trim().length > 0 ? value.trim().toLowerCase() : undefined;

export class JellyfinAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return 'api-key';
  }

  async authenticate(config: AuthConfig): Promise<AuthResult> {
    const validationError = this.validateCredentials(config);
    if (validationError) {
      return {
        success: false,
        authenticated: false,
        error: validationError,
      };
    }

    const apiKey = sanitizeApiKey(config.credentials.apiKey);
    if (!apiKey) {
      return {
        success: false,
        authenticated: false,
        error: 'API key is required for Jellyfin authentication.',
      };
    }

    const deviceId = this.buildDeviceId(config);
    const baseUrl = this.normalizeBaseUrl(config.baseUrl);
    const initialHeaders = this.buildAuthorizationHeaders(apiKey, deviceId);

    try {
      const profile = await this.fetchUserProfile(
        baseUrl,
        initialHeaders,
        config.timeout ?? this.timeout,
        config.credentials.username,
      );

      if (!profile) {
        return {
          success: false,
          authenticated: false,
          error: 'Unable to resolve Jellyfin user context. Provide a username or create a user-bound API key.',
        };
      }

      const finalHeaders = this.buildAuthorizationHeaders(apiKey, deviceId, profile.Id, profile.Name);

      return {
        success: true,
        authenticated: true,
        token: apiKey,
        headers: finalHeaders,
        context: {
          userId: profile?.Id,
          userName: profile?.Name,
          deviceId,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError<{ Message?: string }>;
      const status = axiosError.response?.status;

      const message = this.normalizeErrorMessage(axiosError);
      void logger.error('Jellyfin authentication failed.', {
        url: `${baseUrl}/Users/Me`,
        status,
        message,
      });

      return {
        success: false,
        authenticated: false,
        error: message,
      };
    }
  }

  override async refresh(config: AuthConfig, _session: AuthSession): Promise<AuthResult> {
    // API keys do not expire, but we re-validate to ensure the key still works.
    return this.authenticate(config);
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    if (!session.isAuthenticated || !session.token) {
      return {};
    }

    const deviceId = this.extractDeviceId(session);
    const userId = typeof session.context?.userId === 'string' ? session.context.userId : undefined;
    const userName = typeof session.context?.userName === 'string' ? session.context.userName : undefined;

    return this.buildAuthorizationHeaders(session.token, deviceId, userId, userName);
  }

  override isSessionValid(session: AuthSession): boolean {
    return Boolean(session.isAuthenticated && session.token);
  }

  private async fetchUserProfile(
    baseUrl: string,
    headers: Record<string, string>,
    timeout: number,
    preferredUsername?: string,
  ): Promise<JellyfinUserProfile | undefined> {
    const url = `${baseUrl}/Users/Me`;
    try {
      const response = await axios.get<JellyfinUserProfile>(url, {
        timeout,
        headers,
        params: {
          Fields: 'PrimaryImageAspectRatio',
        },
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<{ Message?: string }>;
      if (axiosError.response?.status === 400) {
        return this.resolveUserFromApiKey(baseUrl, headers, timeout, preferredUsername);
      }

      throw error;
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private buildAuthorizationHeaders(apiKey: string, deviceId: string, userId?: string, userName?: string): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-MediaBrowser-Token': apiKey,
      'X-Emby-Token': apiKey,
      ...(userId ? { 'X-Emby-User-Id': userId } : {}),
      'X-Emby-Authorization': this.buildAuthorizationValue(deviceId, apiKey, userId, userName),
    };
  }

  private buildAuthorizationValue(deviceId: string, token?: string, userId?: string, userName?: string): string {
    const safeDeviceId = deviceId || 'uniarr-device';
    const tokenSegment = token ? `, Token="${token}"` : '';
    const userIdSegment = userId ? `, UserId="${userId}"` : '';
    const userNameSegment = userName ? `, UserName="${userName}"` : '';
    return `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${safeDeviceId}", Version="${CLIENT_VERSION}"${tokenSegment}${userIdSegment}${userNameSegment}`;
  }

  private buildDeviceId(config: AuthConfig): string {
    const fallbackUser = config.credentials.username?.trim().toLowerCase() || 'api';
    let host = 'service';
    try {
      const parsed = new URL(config.baseUrl);
      host = parsed.hostname.replace(/[^a-z0-9-]/gi, '') || host;
    } catch {
      host = config.baseUrl.replace(/[^a-z0-9-]/gi, '') || host;
    }

    return `uniarr-${host}-${fallbackUser}`.slice(0, 50);
  }

  private extractDeviceId(session: AuthSession): string {
    const contextDeviceId = typeof session.context?.deviceId === 'string' ? session.context.deviceId : undefined;
    return contextDeviceId ?? 'uniarr-device';
  }

  private async resolveUserFromApiKey(
    baseUrl: string,
    headers: Record<string, string>,
    timeout: number,
    preferredUsername?: string,
  ): Promise<JellyfinUserProfile | undefined> {
    try {
      const response = await axios.get<ReadonlyArray<Partial<JellyfinUserProfile> & { readonly Username?: string; readonly IsDisabled?: boolean }>>(
        `${baseUrl}/Users`,
        {
          timeout,
          headers,
        },
      );

      const users = Array.isArray(response.data) ? response.data : [];
      if (!users.length) {
        return undefined;
      }

      const normalized = normalizeName(preferredUsername);
      const match = normalized
        ? users.find((user) => normalizeName(user.Name) === normalized || normalizeName(user.Username) === normalized)
        : undefined;

      const activeUser = match ?? users.find((user) => user.IsDisabled !== true) ?? users[0];

      if (!activeUser?.Id) {
        return undefined;
      }

      void logger.debug('Resolved Jellyfin user via fallback lookup.', {
        userId: activeUser.Id,
        userName: activeUser.Name ?? activeUser.Username,
      });

      return {
        Id: activeUser.Id,
        Name: activeUser.Name ?? activeUser.Username,
      };
    } catch (error) {
      void logger.debug('Failed to resolve Jellyfin user via fallback lookup.', {
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private normalizeErrorMessage(error: AxiosError<{ Message?: string }>): string {
    if (error.response?.status === 401) {
      const serverMessage = error.response.data?.Message;
      return serverMessage ? `Authentication failed: ${serverMessage}` : 'Authentication failed. Check your API key.';
    }

    if (error.response?.status === 403) {
      return 'Authentication is forbidden. Verify the Jellyfin API key permissions.';
    }

    if (error.code === 'ECONNABORTED') {
      return 'Authentication timed out. Ensure the Jellyfin server is reachable.';
    }

    if (error.message) {
      return error.message;
    }

    return 'Unable to authenticate with Jellyfin.';
  }
}
