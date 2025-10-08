import { BaseAuthProvider } from './BaseAuthProvider';
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from '../types';

/**
 * Authentication provider for services that use basic HTTP authentication (qBittorrent)
 */
export class BasicAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return 'basic';
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

    // For basic auth, we test the connection with credentials
    const testUrl = `${config.baseUrl}/api/v1/status`;
    
    return this.testConnection(config, testUrl);
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    // Basic auth doesn't use session tokens
    // The credentials should be provided in the config for each request
    return {};
  }
}