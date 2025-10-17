import { BaseAuthProvider } from "./BaseAuthProvider";
import type { AuthConfig, AuthResult, AuthSession, AuthMethod } from "../types";

/**
 * Authentication provider for services that use API key authentication (Sonarr, Radarr)
 */
export class ApiKeyAuthProvider extends BaseAuthProvider {
  getAuthMethod(): AuthMethod {
    return "api-key";
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

    // Prefer provided detection endpoint (from SERVICE_DETECTION_CONFIGS) if available
    const preferredPath = config.detectionEndpoint || "/api/v3/system/status";
    const primaryUrl = `${config.baseUrl}${preferredPath.startsWith("/") ? "" : "/"}${preferredPath}`;
    const primaryResult = await this.testConnection(config, primaryUrl);

    if (primaryResult.success) {
      return primaryResult;
    }

    // If primary endpoint is unavailable (404), attempt sensible fallbacks
    if (primaryResult.error === "Service not found or endpoint not available") {
      // Try v3 and v1 status endpoints explicitly as fallbacks
      const candidates = [
        `${config.baseUrl}/api/v3/system/status`,
        `${config.baseUrl}/api/v1/system/status`,
      ];

      for (const url of candidates) {
        const result = await this.testConnection(config, url);
        if (result.success) return result;
      }
    }

    return primaryResult;
  }

  getAuthHeaders(session: AuthSession): Record<string, string> {
    // API key auth doesn't use session tokens
    // The API key should be provided in the config for each request
    return {};
  }
}
