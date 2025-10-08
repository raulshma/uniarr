import { AuthProviderFactory } from '@/services/auth/AuthProviderFactory';
import { ServiceAuthHelper } from '@/services/auth/ServiceAuthHelper';
import type { ServiceConfig } from '@/models/service.types';

describe('Authentication System', () => {
  beforeEach(() => {
    // Reset any existing state
    jest.clearAllMocks();
  });

  describe('AuthProviderFactory', () => {
    it('should initialize all authentication providers', () => {
      expect(() => AuthProviderFactory.initialize()).not.toThrow();
    });

    it('should return correct authentication methods for each service type', () => {
      expect(AuthProviderFactory.getAuthMethod('sonarr')).toBe('api-key');
      expect(AuthProviderFactory.getAuthMethod('radarr')).toBe('api-key');
      expect(AuthProviderFactory.getAuthMethod('jellyseerr')).toBe('api-key');
      expect(AuthProviderFactory.getAuthMethod('qbittorrent')).toBe('session');
      expect(AuthProviderFactory.getAuthMethod('prowlarr')).toBe('api-key');
    });

    it('should correctly identify which services require authentication', () => {
      expect(AuthProviderFactory.requiresAuth('sonarr')).toBe(true);
      expect(AuthProviderFactory.requiresAuth('radarr')).toBe(true);
      expect(AuthProviderFactory.requiresAuth('jellyseerr')).toBe(true);
      expect(AuthProviderFactory.requiresAuth('qbittorrent')).toBe(true);
      expect(AuthProviderFactory.requiresAuth('prowlarr')).toBe(true);
    });

    it('should return correct required credentials for each service type', () => {
      expect(AuthProviderFactory.getRequiredCredentials('sonarr')).toEqual(['apiKey']);
      expect(AuthProviderFactory.getRequiredCredentials('radarr')).toEqual(['apiKey']);
      expect(AuthProviderFactory.getRequiredCredentials('jellyseerr')).toEqual(['apiKey']);
      expect(AuthProviderFactory.getRequiredCredentials('qbittorrent')).toEqual(['username', 'password']);
      expect(AuthProviderFactory.getRequiredCredentials('prowlarr')).toEqual(['apiKey']);
    });
  });

  describe('ServiceAuthHelper', () => {
    const createMockServiceConfig = (type: ServiceConfig['type'], overrides: Partial<ServiceConfig> = {}): ServiceConfig => ({
      id: 'test-service',
      name: 'Test Service',
      type,
      url: 'http://localhost:8080',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should validate service configuration correctly', () => {
      // Valid API key service
      const validApiKeyConfig = createMockServiceConfig('sonarr', {
        apiKey: 'test-api-key',
      });
      const validation = ServiceAuthHelper.validateServiceConfig(validApiKeyConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Invalid API key service (missing API key)
      const invalidApiKeyConfig = createMockServiceConfig('sonarr');
      const invalidValidation = ServiceAuthHelper.validateServiceConfig(invalidApiKeyConfig);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors).toContain('API key is required for this service type');

      // Valid API key service
      const validJellyseerrConfig = createMockServiceConfig('jellyseerr', {
        apiKey: 'test-api-key',
      });
      const jellyseerrValidation = ServiceAuthHelper.validateServiceConfig(validJellyseerrConfig);
      expect(jellyseerrValidation.valid).toBe(true);
      expect(jellyseerrValidation.errors).toHaveLength(0);

      // Invalid API key service (missing API key)
      const invalidJellyseerrConfig = createMockServiceConfig('jellyseerr');
      const invalidJellyseerrValidation = ServiceAuthHelper.validateServiceConfig(invalidJellyseerrConfig);
      expect(invalidJellyseerrValidation.valid).toBe(false);
      expect(invalidJellyseerrValidation.errors).toContain('API key is required for this service type');

      // Invalid service (missing URL)
      const invalidUrlConfig = createMockServiceConfig('sonarr', {
        url: '',
        apiKey: 'test-key',
      });
      const urlValidation = ServiceAuthHelper.validateServiceConfig(invalidUrlConfig);
      expect(urlValidation.valid).toBe(false);
      expect(urlValidation.errors).toContain('Service URL is required');
    });

    it('should create correct authentication configuration', () => {
      const config = createMockServiceConfig('jellyseerr', {
        apiKey: 'test-api-key',
        url: 'http://localhost:8080',
        timeout: 30000,
      });

      const authConfig = ServiceAuthHelper.createAuthConfig(config);

      expect(authConfig.method).toBe('api-key');
      expect(authConfig.credentials.apiKey).toBe('test-api-key');
      expect(authConfig.baseUrl).toBe('http://localhost:8080');
      expect(authConfig.timeout).toBe(30000);
    });

    it('should handle different service types correctly', () => {
      // API key service
      const apiKeyConfig = createMockServiceConfig('sonarr', { apiKey: 'test-key' });
      const apiKeyAuthConfig = ServiceAuthHelper.createAuthConfig(apiKeyConfig);
      expect(apiKeyAuthConfig.method).toBe('api-key');
      expect(apiKeyAuthConfig.credentials.apiKey).toBe('test-key');

      // Session service
      const sessionConfig = createMockServiceConfig('qbittorrent', {
        username: 'admin',
        password: 'adminadmin',
      });
      const sessionAuthConfig = ServiceAuthHelper.createAuthConfig(sessionConfig);
      expect(sessionAuthConfig.method).toBe('session');
      expect(sessionAuthConfig.credentials.username).toBe('admin');
      expect(sessionAuthConfig.credentials.password).toBe('adminadmin');
    });
  });

  describe('Authentication Flow', () => {
    const createMockServiceConfig = (type: ServiceConfig['type'], overrides: Partial<ServiceConfig> = {}): ServiceConfig => ({
      id: 'test-service',
      name: 'Test Service',
      type,
      url: 'http://localhost:8080',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should handle authentication errors gracefully', async () => {
      const invalidConfig = createMockServiceConfig('jellyseerr', {
        url: 'http://invalid-url-that-does-not-exist',
        apiKey: 'invalid-key',
      });

      // This should not throw an error, but return a failed result
      const result = await ServiceAuthHelper.authenticateService(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.authenticated).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});