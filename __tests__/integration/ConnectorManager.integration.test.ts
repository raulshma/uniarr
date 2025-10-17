import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { ServiceConfig } from "@/models/service.types";

// Mock all the dependencies
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
  const actual = jest.requireActual("@/utils/error.utils");
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
// @ts-ignore - Jest mock typing issues
jest.mock("@/connectors/implementations/SonarrConnector", () => ({
  SonarrConnector: jest.fn().mockImplementation(() => ({
    // @ts-ignore
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      version: "4.0.0",
      latency: 100,
    }),
    // @ts-ignore
    getSeries: jest.fn().mockResolvedValue([]),
    // @ts-ignore
    search: jest.fn().mockResolvedValue([]),
    // @ts-ignore
    add: jest.fn().mockResolvedValue({ id: 1, title: "Test Series" }),
    // @ts-ignore
    initialize: jest.fn().mockResolvedValue(undefined),
    // @ts-ignore
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

// @ts-ignore - Jest mock typing issues
jest.mock("@/connectors/implementations/RadarrConnector", () => ({
  RadarrConnector: jest.fn().mockImplementation(() => ({
    // @ts-ignore
    testConnection: jest.fn().mockResolvedValue({
      success: true,
      version: "5.0.0",
      latency: 150,
    }),
    // @ts-ignore
    getMovies: jest.fn().mockResolvedValue([]),
    // @ts-ignore
    search: jest.fn().mockResolvedValue([]),
    // @ts-ignore
    add: jest.fn().mockResolvedValue({ id: 1, title: "Test Movie" }),
    // @ts-ignore
    initialize: jest.fn().mockResolvedValue(undefined),
    // @ts-ignore
    dispose: jest.fn().mockResolvedValue(undefined),
  })),
}));

const createTestServiceConfig = (
  id: string,
  type: "sonarr" | "radarr" | "jellyseerr" | "qbittorrent" | "prowlarr",
): ServiceConfig => ({
  id,
  name: `Test ${type} Service`,
  type,
  url: `http://${type}.local`,
  apiKey: "test-api-key",
  enabled: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
});

describe("ConnectorManager Integration Tests", () => {
  let manager: ConnectorManager;

  beforeEach(() => {
    manager = ConnectorManager.getInstance();
    jest.clearAllMocks();
  });

  describe("Multi-Service Management", () => {
    it("should handle multiple services of different types", async () => {
      const services: ServiceConfig[] = [
        createTestServiceConfig("sonarr-1", "sonarr"),
        createTestServiceConfig("radarr-1", "radarr"),
        createTestServiceConfig("sonarr-2", "sonarr"),
      ];

      // Mock secure storage to return our test services
      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      await manager.loadSavedServices();

      const connectors = manager.getAllConnectors();
      expect(connectors).toHaveLength(3);

      const sonarrConnectors = manager.getConnectorsByType("sonarr");
      const radarrConnectors = manager.getConnectorsByType("radarr");

      expect(sonarrConnectors).toHaveLength(2);
      expect(radarrConnectors).toHaveLength(1);
    });

    it("should test all connections in parallel", async () => {
      const services: ServiceConfig[] = [
        createTestServiceConfig("sonarr-1", "sonarr"),
        createTestServiceConfig("radarr-1", "radarr"),
      ];

      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      await manager.loadSavedServices();

      const results = await manager.testAllConnections();

      expect(results.size).toBe(2);
      expect(results.get("sonarr-1")?.success).toBe(true);
      expect(results.get("radarr-1")?.success).toBe(true);
    });

    it("should handle mixed success/failure scenarios", async () => {
      const services: ServiceConfig[] = [
        createTestServiceConfig("sonarr-1", "sonarr"),
        createTestServiceConfig("radarr-1", "radarr"),
      ];

      // Mock one service to fail
      const { SonarrConnector } = jest.requireMock(
        "@/connectors/implementations/SonarrConnector",
      );
      const failingConnector = {
        // @ts-ignore
        testConnection: jest.fn().mockResolvedValue({
          success: false,
          message: "Connection failed",
          latency: 0,
        }),
      };
      SonarrConnector.mockImplementationOnce(() => failingConnector);

      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      await manager.loadSavedServices();

      const results = await manager.testAllConnections();

      expect(results.size).toBe(2);
      expect(results.get("sonarr-1")?.success).toBe(false);
      expect(results.get("radarr-1")?.success).toBe(true);
    });
  });

  describe("Service Lifecycle Management", () => {
    it("should properly initialize and dispose connectors", async () => {
      const service = createTestServiceConfig("sonarr-1", "sonarr");

      await manager.addConnector(service);

      const connector = manager.getConnector(service.id);
      expect(connector).toBeDefined();
      expect(connector?.config).toEqual(service);

      await manager.removeConnector(service.id);

      const removedConnector = manager.getConnector(service.id);
      expect(removedConnector).toBeUndefined();
    });

    it("should handle service configuration updates", async () => {
      const originalService = createTestServiceConfig("sonarr-1", "sonarr");
      const updatedService = {
        ...originalService,
        name: "Updated Sonarr Service",
      };

      await manager.addConnector(originalService);

      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.saveServiceConfig.mockResolvedValue();

      // Simulate configuration update
      await manager.addConnector(updatedService);

      const connector = manager.getConnector(originalService.id);
      expect(connector?.config.name).toBe("Updated Sonarr Service");
    });
  });

  describe("Error Handling and Resilience", () => {
    it("should gracefully handle connector initialization failures", async () => {
      const service = createTestServiceConfig("sonarr-1", "sonarr");

      // Mock connector creation to fail
      const { SonarrConnector } = jest.requireMock(
        "@/connectors/implementations/SonarrConnector",
      );
      SonarrConnector.mockImplementationOnce(() => {
        throw new Error("Failed to create connector");
      });

      await expect(manager.addConnector(service)).rejects.toThrow(
        "Failed to create connector",
      );

      const connector = manager.getConnector(service.id);
      expect(connector).toBeUndefined();
    });

    it("should continue operation when individual services fail", async () => {
      const services: ServiceConfig[] = [
        createTestServiceConfig("sonarr-1", "sonarr"),
        createTestServiceConfig("radarr-1", "radarr"),
      ];

      // Mock one service to fail during connection test
      const { RadarrConnector } = jest.requireMock(
        "@/connectors/implementations/RadarrConnector",
      );
      const failingConnector = {
        // @ts-ignore
        testConnection: jest
          .fn()
          .mockRejectedValue(new Error("Connection failed")),
      };
      RadarrConnector.mockImplementationOnce(() => failingConnector);

      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      await manager.loadSavedServices();

      // Should not throw, should handle the error gracefully
      const results = await manager.testAllConnections();
      expect(results.size).toBe(2);

      // One should succeed, one should fail
      const successCount = Array.from(results.values()).filter(
        (r) => r.success,
      ).length;
      const failureCount = Array.from(results.values()).filter(
        (r) => !r.success,
      ).length;

      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe("Performance and Resource Management", () => {
    it("should efficiently handle large numbers of services", async () => {
      const services: ServiceConfig[] = [];
      for (let i = 0; i < 10; i++) {
        services.push(
          createTestServiceConfig(
            `service-${i}`,
            i % 2 === 0 ? "sonarr" : "radarr",
          ),
        );
      }

      const secureStorage = jest.requireMock(
        "@/services/storage/SecureStorage",
      ).secureStorage;
      secureStorage.getServiceConfigs.mockResolvedValue(services);

      const startTime = Date.now();
      await manager.loadSavedServices();
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(1000); // Should load within 1 second
      expect(manager.getAllConnectors()).toHaveLength(10);
    });

    it("should properly clean up resources on disposal", async () => {
      const service = createTestServiceConfig("sonarr-1", "sonarr");
      await manager.addConnector(service);

      // Verify connector exists
      expect(manager.getConnector(service.id)).toBeDefined();

      // The manager doesn't have a dispose method in the current implementation
      // but we can test that removing all connectors works
      await manager.removeConnector(service.id);
      expect(manager.getConnector(service.id)).toBeUndefined();
    });
  });
});
