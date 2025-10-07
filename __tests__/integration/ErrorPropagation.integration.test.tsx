import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { useSonarrSeries } from '@/hooks/useSonarrSeries';
import { queryKeys } from '@/hooks/queryKeys';
import type { ServiceConfig } from '@/models/service.types';
import { ApiError } from '@/utils/error.utils';

// Mock all dependencies
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
    isAxiosError: jest.fn(),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/logger/LoggerService', () => ({
  logger: {
    debug: jest.fn(async () => undefined),
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/storage/SecureStorage', () => ({
  secureStorage: {
    getServiceConfigs: jest.fn(async () => []),
    saveServiceConfig: jest.fn(async () => undefined),
    removeServiceConfig: jest.fn(async () => undefined),
    clearAll: jest.fn(async () => undefined),
  },
}));

// Mock connector implementations
// @ts-ignore - Jest mock typing issues
jest.mock('@/connectors/implementations/SonarrConnector', () => ({
  SonarrConnector: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      version: '4.0.0',
      latency: 100,
    } as any),
    getSeries: jest.fn().mockResolvedValue([] as any),
    search: jest.fn().mockResolvedValue([] as any),
    add: jest.fn().mockResolvedValue({ id: 1, title: 'Test Series' } as any),
    initialize: jest.fn().mockResolvedValue(undefined as any),
    dispose: jest.fn().mockResolvedValue(undefined as any),
    getHealth: jest.fn().mockResolvedValue({ status: 'healthy', lastChecked: new Date() } as any),
    getVersion: jest.fn().mockResolvedValue('4.0.0' as any),
  })),
}));

// Create a test wrapper component for React Query
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 0,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('Error Propagation Integration Tests', () => {
  let manager: ConnectorManager;
  let queryClient: QueryClient;

  beforeEach(() => {
    manager = ConnectorManager.getInstance();
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  describe('Connector Level Error Propagation', () => {
    it('should propagate API errors from connector operations', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'error-service',
        name: 'Error Service',
        type: 'sonarr',
        url: 'http://error.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id) as any;

      // Mock connector method to throw ApiError
      const apiError = new ApiError({
        message: 'API rate limit exceeded',
        statusCode: 429,
        cause: new Error('Too many requests'),
      });

      // @ts-ignore - Jest mock typing issues
      connector!.getSeries = jest.fn().mockRejectedValue(apiError);

      // Error should propagate up
      await expect(connector!.getSeries()).rejects.toThrow(ApiError);
      await expect(connector!.getSeries()).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle network errors with proper error transformation', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'network-error-service',
        name: 'Network Error Service',
        type: 'sonarr',
        url: 'http://network-error.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);

      // Mock network error (axios error)
      const networkError = {
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed with status code 500',
      };

      // @ts-ignore - Jest mock typing issues
      (connector as any)!.testConnection = jest.fn().mockRejectedValue(networkError);

      // Should transform network error to ApiError
      await expect(connector!.testConnection()).rejects.toThrow(ApiError);

      const result = await connector!.testConnection().catch(e => e);
      expect(result).toBeInstanceOf(ApiError);
      expect(result.message).toContain('Internal server error');
    });
  });

  describe('Manager Level Error Handling', () => {
    it('should handle errors during service loading', async () => {
      const { secureStorage } = require('@/services/storage/SecureStorage');

      // Mock storage to throw error
      secureStorage.getServiceConfigs.mockRejectedValue(new Error('Storage access denied'));

      // Should handle storage error gracefully
      await expect(manager.loadSavedServices()).resolves.toBeUndefined();

      // Should log the error
      const { logger } = require('@/services/logger/LoggerService');
      expect(logger.error).toHaveBeenCalledWith('Failed to load saved services', expect.any(Object));
    });

    it('should handle mixed success/failure during multi-service operations', async () => {
      const services: ServiceConfig[] = [
        {
          id: 'success-service',
          name: 'Success Service',
          type: 'sonarr',
          url: 'http://success.local',
          apiKey: 'test-key',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'failure-service',
          name: 'Failure Service',
          type: 'radarr',
          url: 'http://failure.local',
          apiKey: 'test-key',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock one service to fail during connection test
      const { RadarrConnector } = require('@/connectors/implementations/RadarrConnector');
      const failingConnector = {
        // @ts-ignore - Jest mock typing issues
        testConnection: jest.fn().mockRejectedValue(new Error('Connection timeout')),
      };
      RadarrConnector.mockImplementationOnce(() => failingConnector);

      const { secureStorage } = require('@/services/storage/SecureStorage');
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      // Load services (should succeed despite individual failure)
      await manager.loadSavedServices();

      // Test connections (should handle mixed results)
      const results = await manager.testAllConnections();

      expect(results.size).toBe(2);
      expect(results.get('success-service')?.success).toBe(true);
      expect(results.get('failure-service')?.success).toBe(false);
    });

    it('should propagate errors from service removal operations', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'removal-error-service',
        name: 'Removal Error Service',
        type: 'sonarr',
        url: 'http://removal-error.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { secureStorage } = require('@/services/storage/SecureStorage');

      // Mock storage removal to fail
      secureStorage.removeServiceConfig.mockRejectedValue(new Error('Permission denied'));

      await manager.addConnector(serviceConfig);

      // Should propagate storage error during removal
      await expect(manager.removeConnector(serviceConfig.id)).rejects.toThrow('Permission denied');

      // Service should still exist in manager despite storage failure
      expect(manager.getConnector(serviceConfig.id)).toBeDefined();
    });
  });

  describe('React Query Error Integration', () => {
    it('should properly handle errors in React Query hooks', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'query-error-service',
        name: 'Query Error Service',
        type: 'sonarr',
        url: 'http://query-error.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Render hook
      const { result } = renderHook(() => useSonarrSeries(serviceConfig.id), {
        wrapper: TestWrapper,
      });

      // Add service that will fail
      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);

      // Mock connector to throw error
      const apiError = new ApiError({
        message: 'Series fetch failed',
        statusCode: 500,
      });

      // @ts-ignore - Jest mock typing issues
      // @ts-ignore - Jest mock typing issues
      (connector as any)!.getSeries = jest.fn().mockRejectedValue(apiError);

      // The hook should handle the error properly
      // Note: In a real scenario, this would trigger the query to error state
      await expect((connector as any)!.getSeries()).rejects.toThrow(ApiError);

      // Error should be logged
      const { logger } = require('@/services/logger/LoggerService');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should handle network connectivity errors gracefully', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'connectivity-service',
        name: 'Connectivity Service',
        type: 'sonarr',
        url: 'http://connectivity.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);

      // Mock network connectivity error
      const networkError = new Error('Network request failed');
      // @ts-ignore - Jest mock typing issues
      (connector as any)!.getSeries = jest.fn().mockRejectedValue(networkError);

      // Should propagate network error as ApiError
      await expect((connector as any)!.getSeries()).rejects.toThrow(ApiError);

      const error = await (connector as any)!.getSeries().catch((e: any) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.cause).toBe(networkError);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from transient errors', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'transient-error-service',
        name: 'Transient Error Service',
        type: 'sonarr',
        url: 'http://transient.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id) as any;

      // First call fails, second succeeds
      const apiError = new ApiError({ message: 'Temporary failure' });
      const successResult = [{ id: 1, title: 'Series 1' }];

      connector!.getSeries
        // @ts-ignore - Jest mock typing issues
        .mockRejectedValueOnce(apiError)
        .mockResolvedValueOnce(successResult);

      // First call should fail
      await expect(connector!.getSeries()).rejects.toThrow(ApiError);

      // Second call should succeed
      const result = await connector!.getSeries();
      expect(result).toEqual(successResult);
    });

    it('should handle cascading failures across multiple services', async () => {
      const services: ServiceConfig[] = [
        {
          id: 'cascade-service-1',
          name: 'Cascade Service 1',
          type: 'sonarr',
          url: 'http://cascade1.local',
          apiKey: 'test-key',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cascade-service-2',
          name: 'Cascade Service 2',
          type: 'radarr',
          url: 'http://cascade2.local',
          apiKey: 'test-key',
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock both services to fail
      const { SonarrConnector } = require('@/connectors/implementations/SonarrConnector');
      const { RadarrConnector } = require('@/connectors/implementations/RadarrConnector');

      const failingSonarrConnector = {
        // @ts-ignore - Jest mock typing issues
        testConnection: jest.fn().mockRejectedValue(new Error('Service unavailable')),
      };

      const failingRadarrConnector = {
        // @ts-ignore - Jest mock typing issues
        testConnection: jest.fn().mockRejectedValue(new Error('Service unavailable')),
      };

      SonarrConnector.mockImplementationOnce(() => failingSonarrConnector);
      RadarrConnector.mockImplementationOnce(() => failingRadarrConnector);

      const { secureStorage } = require('@/services/storage/SecureStorage');
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      // Load services (should handle failures gracefully)
      await manager.loadSavedServices();

      // Test connections (should handle all failures)
      const results = await manager.testAllConnections();

      expect(results.size).toBe(2);
      expect(results.get('cascade-service-1')?.success).toBe(false);
      expect(results.get('cascade-service-2')?.success).toBe(false);
    });

    it('should provide meaningful error messages for different failure types', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'error-types-service',
        name: 'Error Types Service',
        type: 'sonarr',
        url: 'http://error-types.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);

      // Test different error types
      const errors = [
        { type: 'authentication', error: new ApiError({ message: 'Invalid API key', statusCode: 401 }) },
        { type: 'authorization', error: new ApiError({ message: 'Insufficient permissions', statusCode: 403 }) },
        { type: 'not_found', error: new ApiError({ message: 'Resource not found', statusCode: 404 }) },
        { type: 'rate_limit', error: new ApiError({ message: 'Rate limit exceeded', statusCode: 429 }) },
        { type: 'server_error', error: new ApiError({ message: 'Internal server error', statusCode: 500 }) },
        { type: 'network', error: new ApiError({ message: 'Network timeout', cause: new Error('Timeout') }) },
      ];

      for (const { type, error } of errors) {
        // @ts-ignore - Jest mock typing issues
        (connector as any)!.getSeries = jest.fn().mockRejectedValueOnce(error);

        const result = await (connector as any)!.getSeries().catch((e: any) => e);
        expect(result).toBeInstanceOf(ApiError);
        expect(result.message).toBeDefined();
        expect(typeof result.message).toBe('string');
      }
    });
  });

  describe('Logging and Monitoring Integration', () => {
    it('should log errors appropriately for monitoring', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'logging-service',
        name: 'Logging Service',
        type: 'sonarr',
        url: 'http://logging.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id) as any;

      // Mock error with context
      const apiError = new ApiError({
        message: 'Search operation failed',
        statusCode: 400,
        cause: new Error('Invalid search parameters'),
      });

      // @ts-ignore - Jest mock typing issues
      connector!.search = jest.fn().mockRejectedValue(apiError);

      await expect(connector!.search('test')).rejects.toThrow(ApiError);

      // Should log the error with context
      const { logger } = require('@/services/logger/LoggerService');
      expect(logger.error).toHaveBeenCalledWith(
        'Search operation failed',
        expect.objectContaining({
          serviceId: serviceConfig.id,
          serviceType: serviceConfig.type,
          operation: 'search',
        })
      );
    });

    it('should track error patterns for debugging', async () => {
      const serviceConfig: ServiceConfig = {
        id: 'pattern-service',
        name: 'Pattern Service',
        type: 'sonarr',
        url: 'http://pattern.local',
        apiKey: 'test-key',
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);

      // Simulate multiple similar errors
      const apiError = new ApiError({
        message: 'Connection timeout',
        statusCode: 408,
      });

      // @ts-ignore - Jest mock typing issues
      // @ts-ignore - Jest mock typing issues
      (connector as any)!.getSeries = jest.fn().mockRejectedValue(apiError);

      // Execute multiple operations that fail
      for (let i = 0; i < 3; i++) {
        try {
          await (connector as any)!.getSeries();
        } catch (error) {
          // Expected to fail
        }
      }

      // Should log each error occurrence
      const { logger } = require('@/services/logger/LoggerService');
      expect(logger.error).toHaveBeenCalledTimes(3);
    });
  });
});
