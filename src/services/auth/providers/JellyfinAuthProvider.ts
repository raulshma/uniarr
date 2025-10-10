import axios, { AxiosError } from 'axios';

import { BaseAuthProvider } from './BaseAuthProvider';
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from '../types';
import { logger } from '@/services/logger/LoggerService';

const CLIENT_NAME = 'UniArr';
const DEVICE_NAME = 'UniArr Mobile';
const CLIENT_VERSION = '1.0.0';

interface JellyfinLoginResponse {
  readonly AccessToken?: string;
  readonly User?: {
    readonly Id?: string;
    readonly Name?: string;
  };
  readonly SessionInfo?: {
    readonly PlaySessionId?: string;
    readonly DeviceId?: string;
  };
}

const sanitizeToken = (token: string | undefined): string | undefined =>
  token && token.trim().length > 0 ? token.trim() : undefined;

export class JellyfinAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return 'session';
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

    const deviceId = this.buildDeviceId(config);
    const url = this.buildLoginUrl(config.baseUrl);
    const headers = this.buildAuthorizationHeaders(deviceId);

    try {
      const response = await axios.post<JellyfinLoginResponse>(
        url,
        {
          Username: config.credentials.username,
          Pw: config.credentials.password,
        },
        {
          timeout: config.timeout ?? this.timeout,
          headers,
        },
      );

      const accessToken = sanitizeToken(response.data?.AccessToken);
      const userId = response.data?.User?.Id;

      if (!accessToken) {
        return {
          success: false,
          authenticated: false,
          error: 'Jellyfin did not return an access token. Verify the credentials and try again.',
        };
      }

      return {
        success: true,
        authenticated: true,
        token: accessToken,
        headers: {
          'X-MediaBrowser-Token': accessToken,
        },
        context: {
          userId,
          deviceId,
          userName: response.data?.User?.Name,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError<{ Message?: string }>;
      const status = axiosError.response?.status;

      const message = this.normalizeErrorMessage(axiosError);
      void logger.error('Jellyfin authentication failed.', {
        url,
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
    // Re-run the authentication flow with the existing credentials
    return this.authenticate(config);
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    if (!session.isAuthenticated || !session.token) {
      return {};
    }

    const deviceId = this.extractDeviceId(session);

    return {
      'X-MediaBrowser-Token': session.token,
      'X-Emby-Authorization': this.buildAuthorizationValue(deviceId),
      Accept: 'application/json',
    };
  }

  override isSessionValid(session: AuthSession): boolean {
    return Boolean(session.isAuthenticated && session.token);
  }

  private buildLoginUrl(baseUrl: string): string {
    const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${trimmed}/Users/AuthenticateByName`;
  }

  private buildAuthorizationHeaders(deviceId: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Emby-Authorization': this.buildAuthorizationValue(deviceId),
    };
  }

  private buildAuthorizationValue(deviceId: string): string {
    const safeDeviceId = deviceId || 'uniarr-device';
    return `MediaBrowser Client="${CLIENT_NAME}", Device="${DEVICE_NAME}", DeviceId="${safeDeviceId}", Version="${CLIENT_VERSION}"`;
  }

  private buildDeviceId(config: AuthConfig): string {
    const username = config.credentials.username?.trim().toLowerCase() ?? 'user';
    let host = 'service';
    try {
      const parsed = new URL(config.baseUrl);
      host = parsed.hostname.replace(/[^a-z0-9-]/gi, '') || host;
    } catch {
      host = config.baseUrl.replace(/[^a-z0-9-]/gi, '') || host;
    }

    return `uniarr-${host}-${username}`.slice(0, 50);
  }

  private extractDeviceId(session: AuthSession): string {
    const contextDeviceId = typeof session.context?.deviceId === 'string' ? session.context.deviceId : undefined;
    return contextDeviceId ?? 'uniarr-device';
  }

  private normalizeErrorMessage(error: AxiosError<{ Message?: string }>): string {
    if (error.response?.status === 401) {
      const serverMessage = error.response.data?.Message;
      return serverMessage ? `Authentication failed: ${serverMessage}` : 'Authentication failed. Check your credentials.';
    }

    if (error.response?.status === 403) {
      return 'Authentication is forbidden. Verify the Jellyfin account permissions.';
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
