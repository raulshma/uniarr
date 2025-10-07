import axios, { AxiosError } from 'axios';
import { logger } from '@/services/logger/LoggerService';
import type { IAuthProvider, AuthConfig, AuthResult, AuthSession, AuthMethod } from '../types';

/**
 * Base authentication provider with common functionality
 */
export abstract class BaseAuthProvider implements IAuthProvider {
  protected readonly timeout: number;

  constructor(timeout = 30000) {
    this.timeout = timeout;
  }

  abstract authenticate(config: AuthConfig): Promise<AuthResult>;
  abstract getAuthMethod(): AuthMethod;
  abstract getAuthHeaders(session: AuthSession): Record<string, string>;

  refresh?(config: AuthConfig, session: AuthSession): Promise<AuthResult> {
    // Default implementation - no refresh support
    return Promise.resolve({
      success: false,
      authenticated: false,
      error: 'Refresh not supported',
    });
  }

  logout?(config: AuthConfig, session: AuthSession): Promise<boolean> {
    // Default implementation - no logout required
    return Promise.resolve(true);
  }

  isSessionValid?(session: AuthSession): boolean {
    if (!session.isAuthenticated) {
      return false;
    }

    if (session.expiresAt && new Date() >= session.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Make an authenticated request to test credentials
   */
  protected async testConnection(config: AuthConfig, testUrl: string): Promise<AuthResult> {
    try {
      const headers = this.buildRequestHeaders(config);
      
      const response = await axios.get(testUrl, {
        timeout: config.timeout || this.timeout,
        headers,
        auth: this.getBasicAuth(config),
      });

      return {
        success: true,
        authenticated: true,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const message = axiosError.message;

      void logger.debug('Connection test failed.', {
        url: testUrl,
        status,
        message,
        authMethod: config.method,
      });

      // Handle different error scenarios
      if (status === 401 || status === 403) {
        return {
          success: false,
          authenticated: false,
          error: 'Invalid credentials',
        };
      }

      if (status === 404) {
        return {
          success: false,
          authenticated: false,
          error: 'Service not found or endpoint not available',
        };
      }

      return {
        success: false,
        authenticated: false,
        error: `Connection failed: ${message}`,
      };
    }
  }

  /**
   * Build request headers for authentication
   */
  protected buildRequestHeaders(config: AuthConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'UniArr/1.0.0',
    };

    if (config.credentials.apiKey) {
      headers['X-Api-Key'] = config.credentials.apiKey;
    }

    if (config.credentials.token) {
      headers['Authorization'] = `Bearer ${config.credentials.token}`;
    }

    return headers;
  }

  /**
   * Get basic auth configuration for axios
   */
  protected getBasicAuth(config: AuthConfig): { username: string; password: string } | undefined {
    if (config.method === 'basic' && config.credentials.username && config.credentials.password) {
      return {
        username: config.credentials.username,
        password: config.credentials.password,
      };
    }
    return undefined;
  }

  /**
   * Validate credentials are present for the authentication method
   */
  protected validateCredentials(config: AuthConfig): string | null {
    const { credentials, method } = config;

    switch (method) {
      case 'api-key':
        if (!credentials.apiKey) {
          return 'API key is required for API key authentication';
        }
        break;
      
      case 'basic':
        if (!credentials.username || !credentials.password) {
          return 'Username and password are required for basic authentication';
        }
        break;
      
      case 'bearer':
        if (!credentials.token) {
          return 'Token is required for bearer authentication';
        }
        break;
      
      case 'session':
        if (!credentials.username || !credentials.password) {
          return 'Username and password are required for session authentication';
        }
        break;
      
      case 'none':
        // No credentials required
        break;
      
      default:
        return `Unsupported authentication method: ${method}`;
    }

    return null;
  }
}