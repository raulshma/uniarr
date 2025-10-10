import { logger } from '@/services/logger/LoggerService';
import type { IAuthManager, IAuthProvider, AuthConfig, AuthResult, AuthSession } from './types';

/**
 * Centralized authentication manager for all services
 */
export class AuthManager implements IAuthManager {
  private providers = new Map<string, IAuthProvider>();
  private sessions = new Map<string, AuthSession>();
  // Keep an explicit mapping from serviceId to serviceType so we can
  // resolve providers reliably when service IDs do not follow the
  // "type-id" naming convention.
  private serviceTypes = new Map<string, string>();

  registerProvider(serviceType: string, provider: IAuthProvider): void {
    this.providers.set(serviceType, provider);
    void logger.debug('Authentication provider registered.', {
      serviceType,
      authMethod: provider.getAuthMethod(),
    });
  }

  getProvider(serviceType: string): IAuthProvider | undefined {
    return this.providers.get(serviceType);
  }

  async authenticate(serviceId: string, serviceType: string, config: AuthConfig): Promise<AuthResult> {
    const provider = this.getProvider(serviceType);
    // Remember the mapping for later header resolution
    this.serviceTypes.set(serviceId, serviceType);
    
    if (!provider) {
      const error = `No authentication provider found for service type: ${serviceType}`;
      void logger.error('Authentication failed - no provider.', {
        serviceId,
        serviceType,
        authMethod: config.method,
      });
      return {
        success: false,
        authenticated: false,
        error,
      };
    }

    try {
      void logger.debug('Starting authentication.', {
        serviceId,
        serviceType,
        authMethod: config.method,
        hasCredentials: Boolean(config.credentials.username || config.credentials.apiKey || config.credentials.token),
      });

      const result = await provider.authenticate(config);
      
      if (result.success && result.authenticated) {
        const session: AuthSession = {
          isAuthenticated: true,
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
          lastAuthenticated: new Date(),
          retryCount: 0,
          context: result.context,
        };
        
        this.sessions.set(serviceId, session);
        
        void logger.debug('Authentication successful.', {
          serviceId,
          serviceType,
          authMethod: config.method,
          hasToken: Boolean(result.token),
          hasRefreshToken: Boolean(result.refreshToken),
          expiresAt: result.expiresAt,
        });
      } else {
        void logger.warn('Authentication failed.', {
          serviceId,
          serviceType,
          authMethod: config.method,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      
      void logger.error('Authentication error.', {
        serviceId,
        serviceType,
        authMethod: config.method,
        error: errorMessage,
      });

      return {
        success: false,
        authenticated: false,
        error: errorMessage,
      };
    }
  }

  getSession(serviceId: string): AuthSession | undefined {
    return this.sessions.get(serviceId);
  }

  updateSession(serviceId: string, session: AuthSession): void {
    this.sessions.set(serviceId, session);
    void logger.debug('Session updated.', {
      serviceId,
      isAuthenticated: session.isAuthenticated,
      hasToken: Boolean(session.token),
    });
  }

  clearSession(serviceId: string): void {
    this.sessions.delete(serviceId);
    void logger.debug('Session cleared.', { serviceId });
  }

  getAuthHeaders(serviceId: string): Record<string, string> {
    const session = this.getSession(serviceId);
    // Prefer explicitly recorded service type. If not available, fall back
    // to the temporary heuristic for backwards-compatibility.
    const serviceType = this.serviceTypes.get(serviceId) ?? this.determineServiceTypeFromId(serviceId);
    const provider = this.getProvider(serviceType);
    
    if (!session || !session.isAuthenticated || !provider) {
      return {};
    }

    return provider.getAuthHeaders(session);
  }

  /**
   * Check if a session needs refresh
   */
  needsRefresh(serviceId: string): boolean {
    const session = this.getSession(serviceId);
    if (!session || !session.isAuthenticated) {
      return false;
    }

    if (session.expiresAt && new Date() >= session.expiresAt) {
      return true;
    }

    return false;
  }

  /**
   * Attempt to refresh authentication for a service
   */
  async refreshAuthentication(serviceId: string, config: AuthConfig): Promise<AuthResult> {
    const serviceType = this.determineServiceTypeFromId(serviceId);
    const provider = this.getProvider(serviceType);
    const session = this.getSession(serviceId);
    
    if (!provider || !session || !provider.refresh) {
      return {
        success: false,
        authenticated: false,
        error: 'Refresh not supported or no active session',
      };
    }

    try {
      const result = await provider.refresh(config, session);
      
      if (result.success && result.authenticated) {
        const updatedSession: AuthSession = {
          ...session,
          token: result.token || session.token,
          refreshToken: result.refreshToken || session.refreshToken,
          expiresAt: result.expiresAt || session.expiresAt,
          lastAuthenticated: new Date(),
          retryCount: 0,
          context: result.context ?? session.context,
        };
        
        this.updateSession(serviceId, updatedSession);
      } else {
        // Increment retry count on failure
        const updatedSession: AuthSession = {
          ...session,
          retryCount: session.retryCount + 1,
          context: session.context,
        };
        this.updateSession(serviceId, updatedSession);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown refresh error';
      
      void logger.error('Authentication refresh error.', {
        serviceId,
        error: errorMessage,
      });

      return {
        success: false,
        authenticated: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Determine service type from service ID
   * This is a temporary solution - ideally we'd store service type with the session
   */
  private determineServiceTypeFromId(serviceId: string): string {
    // Try to extract service type from service ID
    // Service IDs typically follow patterns like "jellyseerr-123", "sonarr-456", etc.
    const parts = serviceId.split('-');
    return parts[0] || 'unknown';
  }
}

// Global instance
export const authManager = new AuthManager();