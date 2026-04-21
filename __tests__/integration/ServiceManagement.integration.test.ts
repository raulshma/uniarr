import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { ServiceConfig } from "@/models/service.types";
import { secureStorage } from "@/services/storage/SecureStorage";
import { SonarrConnector } from "@/connectors/implementations/SonarrConnector";

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

jest.mock("@/services/logger/ApiLoggerService", () => ({
  apiLogger: {
    log: jest.fn(async () => undefined),
    getEntries: jest.fn(() => []),
    persistEntries: jest.fn(async () => undefined),
  },
}));

jest.mock("@/store/settingsStore", () => ({
  useSettingsStore: Object.assign(
    () => ({
      logLevel: 0,
      apiLoggingEnabled: false,
    }),
    { getState: () => ({ logLevel: 0, apiLoggingEnabled: false }) },
  ),
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

jest.mock("@/services/auth/ServiceAuthHelper", () => ({
  ServiceAuthHelper: {
    clearSession: jest.fn(),
    clearServiceSession: jest.fn(),
  },
}));

jest.mock("@/services/storage/SecureStorage", () => ({
  secureStorage: {
    getServiceConfigs: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    saveServiceConfig: jest
      .fn<() => Promise<any>>()
      .mockResolvedValue(undefined),
    removeServiceConfig: jest
      .fn<() => Promise<any>>()
      .mockResolvedValue(undefined),
    clearAll: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
  },
}));

jest.mock("@/connectors/implementations/SonarrConnector", () => ({
  SonarrConnector: jest
    .fn<(config: any) => any>()
    .mockImplementation((config) => ({
      config,
      testConnection: jest.fn<() => Promise<any>>().mockResolvedValue({
        success: true,
        version: "4.0.0",
        latency: 100,
      }),
      getSeries: jest.fn<() => Promise<any>>().mockResolvedValue([
        { id: 1, title: "Test Series 1", status: "continuing" },
        { id: 2, title: "Test Series 2", status: "ended" },
      ]),
      search: jest.fn<() => Promise<any>>().mockResolvedValue([]),
      add: jest
        .fn<() => Promise<any>>()
        .mockResolvedValue({ id: 1, title: "Test Series" }),
      initialize: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
      dispose: jest.fn<() => any>().mockReturnValue(undefined),
      getHealth: jest
        .fn<() => Promise<any>>()
        .mockResolvedValue({ status: "healthy", lastChecked: new Date() }),
      getVersion: jest.fn<() => Promise<any>>().mockResolvedValue("4.0.0"),
    })),
}));

jest.mock("@/connectors/implementations/RadarrConnector", () => {
  const impl = jest.fn<(config: any) => any>().mockImplementation((config) => ({
    config,
    testConnection: jest.fn<() => Promise<any>>().mockResolvedValue({
      success: true,
      version: "5.0.0",
      latency: 150,
    }),
    getMovies: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    search: jest.fn<() => Promise<any>>().mockResolvedValue([]),
    add: jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({ id: 1, title: "Test Movie" }),
    initialize: jest.fn<() => Promise<any>>().mockResolvedValue(undefined),
    dispose: jest.fn<() => any>().mockReturnValue(undefined),
  }));
  return { RadarrConnector: impl };
});

const mockRadarrConnector: jest.MockedFunction<() => any> = (
  jest.requireMock("@/connectors/implementations/RadarrConnector") as any
).RadarrConnector;

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

  afterEach(() => {
    manager.dispose();
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

      await manager.addConnector(serviceConfig);

      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeDefined();
      expect(connector?.config).toEqual(serviceConfig);

      expect(secureStorage.saveServiceConfig).toHaveBeenCalledWith(
        serviceConfig,
      );

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

      (SonarrConnector as any).mockImplementationOnce(() => {
        throw new Error("Invalid configuration");
      });

      await expect(manager.addConnector(serviceConfig)).rejects.toThrow(
        "Invalid configuration",
      );

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

      await manager.addConnector(serviceConfig);
      expect(manager.getConnector(serviceConfig.id)).toBeDefined();

      await manager.removeConnector(serviceConfig.id);

      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeUndefined();

      expect(secureStorage.removeServiceConfig).toHaveBeenCalledWith(
        serviceConfig.id,
      );
    });

    it("should handle removal of non-existent service gracefully", async () => {
      const nonExistentId = "non-existent-service";

      await expect(
        manager.removeConnector(nonExistentId),
      ).resolves.toBeUndefined();

      expect(secureStorage.removeServiceConfig).not.toHaveBeenCalled();
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

      await manager.addConnector(serviceConfig);

      expect(manager.getConnector(serviceConfig.id)).toBeDefined();
      expect(secureStorage.saveServiceConfig).toHaveBeenCalledWith(
        serviceConfig,
      );

      (secureStorage.getServiceConfigs as any).mockResolvedValue([
        serviceConfig,
      ]);

      await manager.loadSavedServices();

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

      (secureStorage.saveServiceConfig as any).mockRejectedValue(
        new Error("Storage failure"),
      );

      await expect(manager.addConnector(serviceConfig)).rejects.toThrow(
        "Storage failure",
      );

      expect(manager.getConnector(serviceConfig.id)).toBeDefined();
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

      const failingConnector = {
        config: services[1],
        testConnection: jest
          .fn<() => Promise<any>>()
          .mockRejectedValue(new Error("Connection failed")),
        dispose: jest.fn<() => any>().mockReturnValue(undefined),
      };
      mockRadarrConnector.mockImplementationOnce(() => failingConnector);

      (secureStorage.getServiceConfigs as any).mockResolvedValue(services);

      await manager.loadSavedServices();

      expect(manager.getAllConnectors()).toHaveLength(2);

      const results = await manager.testAllConnections();
      expect(results.size).toBe(2);

      const successCount = Array.from(results.values()).filter(
        (r) => r.success,
      ).length;
      expect(successCount).toBe(1);
    });
  });
});
