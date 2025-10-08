import { authManager } from './AuthManager';
import { ApiKeyAuthProvider } from './providers/ApiKeyAuthProvider';
import { BasicAuthProvider } from './providers/BasicAuthProvider';
import { SessionAuthProvider } from './providers/SessionAuthProvider';
import type { ServiceType } from '@/models/service.types';

/**
 * Factory for registering authentication providers for different service types
 */
export class AuthProviderFactory {
  private static initialized = false;

  /**
   * Initialize all authentication providers
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register providers for each service type
    authManager.registerProvider('sonarr', new ApiKeyAuthProvider());
    authManager.registerProvider('radarr', new ApiKeyAuthProvider());
    authManager.registerProvider('jellyseerr', new ApiKeyAuthProvider());
    authManager.registerProvider('qbittorrent', new SessionAuthProvider());
    authManager.registerProvider('prowlarr', new ApiKeyAuthProvider());

    this.initialized = true;
  }

  /**
   * Get the authentication method for a service type
   */
  static getAuthMethod(serviceType: ServiceType): string {
    const provider = authManager.getProvider(serviceType);
    return provider?.getAuthMethod() || 'none';
  }

  /**
   * Check if a service type requires authentication
   */
  static requiresAuth(serviceType: ServiceType): boolean {
    const method = this.getAuthMethod(serviceType);
    return method !== 'none';
  }

  /**
   * Get required credentials for a service type
   */
  static getRequiredCredentials(serviceType: ServiceType): string[] {
    const method = this.getAuthMethod(serviceType);
    
    switch (method) {
      case 'api-key':
        return ['apiKey'];
      case 'basic':
      case 'session':
        return ['username', 'password'];
      case 'bearer':
        return ['token'];
      default:
        return [];
    }
  }
}

// Auto-initialize when module is imported
AuthProviderFactory.initialize();