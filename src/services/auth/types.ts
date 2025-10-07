/**
 * Core authentication types and interfaces for the service authentication system
 */

export type AuthMethod = 'api-key' | 'basic' | 'session' | 'bearer' | 'none';

export interface AuthCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  refreshToken?: string;
}

export interface AuthConfig {
  method: AuthMethod;
  credentials: AuthCredentials;
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface AuthResult {
  success: boolean;
  authenticated: boolean;
  error?: string;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  headers?: Record<string, string>;
}

export interface AuthSession {
  isAuthenticated: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: Date;
  lastAuthenticated?: Date;
  retryCount: number;
}

export interface IAuthProvider {
  /**
   * Authenticate with the service using the provided credentials
   */
  authenticate(config: AuthConfig): Promise<AuthResult>;

  /**
   * Refresh authentication if supported by the service
   */
  refresh?(config: AuthConfig, session: AuthSession): Promise<AuthResult>;

  /**
   * Logout from the service
   */
  logout?(config: AuthConfig, session: AuthSession): Promise<boolean>;

  /**
   * Check if the current session is still valid
   */
  isSessionValid?(session: AuthSession): boolean;

  /**
   * Get headers required for authenticated requests
   */
  getAuthHeaders(session: AuthSession): Record<string, string>;

  /**
   * Get the authentication method this provider supports
   */
  getAuthMethod(): AuthMethod;
}

export interface IAuthManager {
  /**
   * Register an authentication provider for a specific service type
   */
  registerProvider(serviceType: string, provider: IAuthProvider): void;

  /**
   * Get authentication provider for a service type
   */
  getProvider(serviceType: string): IAuthProvider | undefined;

  /**
   * Authenticate a service
   */
  authenticate(serviceType: string, config: AuthConfig): Promise<AuthResult>;

  /**
   * Get current session for a service
   */
  getSession(serviceId: string): AuthSession | undefined;

  /**
   * Update session for a service
   */
  updateSession(serviceId: string, session: AuthSession): void;

  /**
   * Clear session for a service
   */
  clearSession(serviceId: string): void;

  /**
   * Get authentication headers for a service
   */
  getAuthHeaders(serviceId: string): Record<string, string>;
}