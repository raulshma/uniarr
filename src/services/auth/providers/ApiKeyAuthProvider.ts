import { BaseAuthProvider } from './BaseAuthProvider';
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from '../types';

/**
 * Authentication provider for services that use API key authentication (Sonarr, Radarr)
 */
export class ApiKeyAuthProvider extends BaseAuthProvider {
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

    // For API key auth, we just need to test the connection
    // The actual API key will be included in headers for each request
    const testUrl = `${config.baseUrl}/api/v3/system/status`;
    
    return this.testConnection(config, testUrl);
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    // API key auth doesn't use session tokens
    // The API key should be provided in the config for each request
    return {};
  }
}