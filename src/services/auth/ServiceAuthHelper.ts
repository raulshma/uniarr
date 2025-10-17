import { authManager } from "./AuthManager";
import { AuthProviderFactory } from "./AuthProviderFactory";
import type { ServiceConfig } from "@/models/service.types";
import type { AuthConfig, AuthResult, AuthSession } from "./types";
import { SERVICE_DETECTION_CONFIGS } from "@/services/network/NetworkScannerService";

/**
 * Helper class for managing service authentication
 */
export class ServiceAuthHelper {
  /**
   * Create authentication configuration from service config
   */
  static createAuthConfig(serviceConfig: ServiceConfig): AuthConfig {
    const authMethod = AuthProviderFactory.getAuthMethod(serviceConfig.type);

    const detectionEndpoint =
      SERVICE_DETECTION_CONFIGS[serviceConfig.type]?.detectionEndpoint;

    return {
      method: authMethod as any,
      credentials: {
        username: serviceConfig.username,
        password: serviceConfig.password,
        apiKey: serviceConfig.apiKey,
      },
      baseUrl: serviceConfig.url,
      detectionEndpoint,
      timeout: serviceConfig.timeout,
      retryAttempts: 3,
      retryDelay: 1000,
    };
  }

  /**
   * Authenticate a service using its configuration
   */
  static async authenticateService(
    serviceConfig: ServiceConfig,
  ): Promise<AuthResult> {
    const authConfig = this.createAuthConfig(serviceConfig);
    return authManager.authenticate(
      serviceConfig.id,
      serviceConfig.type,
      authConfig,
    );
  }

  /**
   * Get authentication headers for a service
   */
  static getServiceAuthHeaders(
    serviceConfig: ServiceConfig,
  ): Record<string, string> {
    return authManager.getAuthHeaders(serviceConfig.id);
  }

  /**
   * Check if a service is currently authenticated
   */
  static isServiceAuthenticated(serviceConfig: ServiceConfig): boolean {
    const session = authManager.getSession(serviceConfig.id);
    return session?.isAuthenticated ?? false;
  }

  /**
   * Get current session for a service
   */
  static getServiceSession(
    serviceConfig: ServiceConfig,
  ): AuthSession | undefined {
    return authManager.getSession(serviceConfig.id);
  }

  /**
   * Clear authentication session for a service
   */
  static clearServiceSession(serviceConfig: ServiceConfig): void {
    authManager.clearSession(serviceConfig.id);
  }

  /**
   * Check if a service needs authentication refresh
   */
  static needsRefresh(serviceConfig: ServiceConfig): boolean {
    return authManager.needsRefresh(serviceConfig.id);
  }

  /**
   * Refresh authentication for a service
   */
  static async refreshServiceAuth(
    serviceConfig: ServiceConfig,
  ): Promise<AuthResult> {
    const authConfig = this.createAuthConfig(serviceConfig);
    return authManager.refreshAuthentication(serviceConfig.id, authConfig);
  }

  /**
   * Validate service configuration for authentication
   */
  static validateServiceConfig(serviceConfig: ServiceConfig): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!serviceConfig.url) {
      errors.push("Service URL is required");
    }

    if (!serviceConfig.type) {
      errors.push("Service type is required");
    }

    if (AuthProviderFactory.requiresAuth(serviceConfig.type)) {
      const requiredCredentials = AuthProviderFactory.getRequiredCredentials(
        serviceConfig.type,
      );

      for (const credential of requiredCredentials) {
        if (credential === "apiKey" && !serviceConfig.apiKey) {
          errors.push("API key is required for this service type");
        }
        if (credential === "username" && !serviceConfig.username) {
          errors.push("Username is required for this service type");
        }
        if (credential === "password" && !serviceConfig.password) {
          errors.push("Password is required for this service type");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get authentication method for a service type
   */
  static getAuthMethod(serviceType: string): string {
    return AuthProviderFactory.getAuthMethod(serviceType as any);
  }

  /**
   * Check if a service type requires authentication
   */
  static requiresAuth(serviceType: string): boolean {
    return AuthProviderFactory.requiresAuth(serviceType as any);
  }
}
