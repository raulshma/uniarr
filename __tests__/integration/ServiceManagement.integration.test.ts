import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { ServiceConfig } from "@/models/service.types";
import { secureStorage } from "@/services/storage/SecureStorage";
import { SonarrConnector } from "@/connectors/implementations/SonarrConnector";

// Mock all dependencies
jest.mock("axios", () => ({
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

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    debug: jest.fn(async () => undefined),
    info: jest.fn(async () => undefined),
    warn: jest.fn(async () => undefined),
    error: jest.fn(async () => undefined),
  },
}));

jest.mock("@/utils/error.utils", () => {
  const actual = jest.requireActual<typeof import("@/utils/error.utils")>(
    "@/utils/error.utils",
  );
  return {
    ...actual,
    handleApiError: jest.fn((error: unknown) => {
      if (error instanceof actual.ApiError) {
        return error;
      }
      if (error instanceof Error) {
        return new actual.ApiError({
          message: error.message,
          cause: error,
        });
      }
      return new actual.ApiError({
        message: "Mock error",
        cause: error,
      });
    }),
  };
});

jest.mock("@/services/storage/SecureStorage", () => ({
  secureStorage: {
    getServiceConfigs: jest.fn(async () => []),
    saveServiceConfig: jest.fn(async () => undefined),
    removeServiceConfig: jest.fn(async () => undefined),
    clearAll: jest.fn(async () => undefined),
  },
}));

// Mock connector implementations
jest.mock("@/connectors/implementations/SonarrConnector", () => ({
  SonarrConnector: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      version: "4.0.0",
      latency: 100,
    }),
    getSeries: jest.fn().mockResolvedValue([
      { id: 1, title: "Test Series 1", status: "continuing" },
      { id: 2, title: "Test Series 2", status: "ended" },
    ]),
    search: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue({ id: 1, title: "Test Series" }),
    initialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    getHealth: jest
      .fn()
      .mockResolvedValue({ status: "healthy", lastChecked: new Date() }),
    getVersion: jest.fn().mockResolvedValue("4.0.0"),
  })),
}));

const mockRadarrConnector = jest.fn().mockImplementation(() => ({
  testConnection: jest.fn().mockResolvedValue({
    success: true,
    version: "5.0.0",
    latency: 150,
  }),
  getMovies: jest.fn().mockResolvedValue([]),
  search: jest.fn().mockResolvedValue([]),
  add: jest.fn().mockResolvedValue({ id: 1, title: "Test Movie" }),
  initialize: jest.fn().mockResolvedValue(undefined),
  dispose: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/connectors/implementations/RadarrConnector", () => ({
  RadarrConnector: mockRadarrConnector,
}));

// Mock QueryClient for testing React Query integration
const mockQueryClient = {
  invalidateQueries: jest.fn(),
  setQueryData: jest.fn(),
  getQueryData: jest.fn(),
  removeQueries: jest.fn(),
};

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));

describe("Service Management Integration Tests", () => {
  let manager: ConnectorManager;

  beforeEach(() => {
    manager = ConnectorManager.getInstance();
    jest.clearAllMocks();
  });

  describe("Service Addition Flow", () => {
    it("should successfully add a new service and make it available for queries", async () => {
      const serviceConfig: ServiceConfig = {
        id: "new-sonarr-service",
        name: "New Sonarr Instance",
        type: "sonarr",
        url: "http://new-sonarr.local",
        apiKey: "new-api-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add service to manager
      await manager.addConnector(serviceConfig);

      // Verify service was added
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeDefined();
      expect(connector?.config).toEqual(serviceConfig);

      // Verify secure storage was called
      expect(secureStorage.saveServiceConfig).toHaveBeenCalledWith(
        serviceConfig,
      );

      // Test that queries work with the new service
      const mockSeries = await (connector as any)?.getSeries();

      expect(mockSeries).toHaveLength(2);
      expect(mockSeries?.[0]?.title).toBe("Test Series 1");
    });

    it("should handle service addition failures gracefully", async () => {
      const serviceConfig: ServiceConfig = {
        id: "failing-service",
        name: "Failing Service",
        type: "sonarr",
        url: "http://failing.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock connector creation to fail
      SonarrConnector.mockImplementationOnce(() => {
        throw new Error("Invalid configuration");
      });

      await expect(manager.addConnector(serviceConfig)).rejects.toThrow(
        "Invalid configuration",
      );

      // Verify service was not added
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeUndefined();
    });
  });

  describe("Service Removal Flow", () => {
    it("should successfully remove a service and clean up resources", async () => {
      const serviceConfig: ServiceConfig = {
        id: "service-to-remove",
        name: "Service to Remove",
        type: "sonarr",
        url: "http://remove.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add service first
      await manager.addConnector(serviceConfig);
      expect(manager.getConnector(serviceConfig.id)).toBeDefined();

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Verify service was removed
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeUndefined();

      // Verify secure storage was called for removal
      expect(secureStorage.removeServiceConfig).toHaveBeenCalledWith(
        serviceConfig.id,
      );
    });

    it("should handle removal of non-existent service gracefully", async () => {
      const nonExistentId = "non-existent-service";

      // Should not throw
      await expect(
        manager.removeConnector(nonExistentId),
      ).resolves.toBeUndefined();

      // Verify secure storage was still called (even for non-existent)
      expect(secureStorage.removeServiceConfig).toHaveBeenCalledWith(
        nonExistentId,
      );
    });
  });

  describe("Service State Synchronization", () => {
    it("should maintain consistent state across manager and storage", async () => {
      const serviceConfig: ServiceConfig = {
        id: "sync-test-service",
        name: "Sync Test Service",
        type: "sonarr",
        url: "http://sync.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add service
      await manager.addConnector(serviceConfig);

      // Verify both manager and storage have the service
      expect(manager.getConnector(serviceConfig.id)).toBeDefined();
      expect(secureStorage.saveServiceConfig).toHaveBeenCalledWith(
        serviceConfig,
      );

      // Simulate storage returning the service on load
      secureStorage.getServiceConfigs.mockResolvedValue([serviceConfig]);

      // Load services (simulating app restart)
      await manager.loadSavedServices();

      // Verify service is still available
      expect(manager.getConnector(serviceConfig.id)).toBeDefined();
    });

    it("should handle storage failures during service operations", async () => {
      const serviceConfig: ServiceConfig = {
        id: "storage-fail-service",
        name: "Storage Fail Service",
        type: "sonarr",
        url: "http://storage-fail.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      secureStorage.saveServiceConfig.mockRejectedValue(
        new Error("Storage failure"),
      );

      // Should handle storage failure gracefully
      await expect(manager.addConnector(serviceConfig)).rejects.toThrow(
        "Storage failure",
      );

      // Service should not be in manager after storage failure
      expect(manager.getConnector(serviceConfig.id)).toBeUndefined();
    });
  });

  describe("Query Integration", () => {
    it("should invalidate queries when services are added or removed", async () => {
      const serviceConfig: ServiceConfig = {
        id: "query-test-service",
        name: "Query Test Service",
        type: "sonarr",
        url: "http://query.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add service
      await manager.addConnector(serviceConfig);

      // Verify query invalidation was called
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalled();

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Verify query invalidation was called again
      expect(mockQueryClient.invalidateQueries).toHaveBeenCalledTimes(2);
    });

    it("should handle query data consistency across service changes", async () => {
      const serviceConfig: ServiceConfig = {
        id: "consistency-service",
        name: "Consistency Service",
        type: "sonarr",
        url: "http://consistency.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock query data
      const mockSeriesData = [{ id: 1, title: "Series 1" }];
      mockQueryClient.getQueryData.mockReturnValue(mockSeriesData);

      // Add service
      await manager.addConnector(serviceConfig);

      // Verify query data is still accessible
      expect(mockQueryClient.getQueryData()).toEqual(mockSeriesData);

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Query data should still be available (not removed by service removal)
      expect(mockQueryClient.getQueryData()).toEqual(mockSeriesData);
    });
  });

  describe("Error Recovery", () => {
    it("should recover from partial failures during multi-service operations", async () => {
      const services: ServiceConfig[] = [
        {
          id: "service-1",
          name: "Service 1",
          type: "sonarr",
          url: "http://service1.local",
          apiKey: "test-key",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "service-2",
          name: "Service 2",
          type: "radarr",
          url: "http://service2.local",
          apiKey: "test-key",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Mock one service to fail during connection test
      const failingConnector = {
        testConnection: jest
          .fn()
          .mockRejectedValue(new Error("Connection failed")),
      };
      mockRadarrConnector.mockImplementationOnce(() => failingConnector);

      secureStorage.getServiceConfigs.mockResolvedValue(services);

      // Load services (should succeed despite one failure)
      await manager.loadSavedServices();

      // Should have both services despite one failure
      expect(manager.getAllConnectors()).toHaveLength(2);

      // Test connections (should handle mixed results)
      const results = await manager.testAllConnections();
      expect(results.size).toBe(2);

      const successCount = Array.from(results.values()).filter(
        (r) => r.success,
      ).length;
      expect(successCount).toBe(1); // One success, one failure
    });
  });
});
