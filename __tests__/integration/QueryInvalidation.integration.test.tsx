import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { renderHook } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { useSonarrSeries } from "@/hooks/useSonarrSeries";
import { queryKeys } from "@/hooks/queryKeys";
import type { ServiceConfig } from "@/models/service.types";
import { secureStorage } from "@/services/storage/SecureStorage";

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
      { id: 1, title: "Series 1", status: "continuing" },
      { id: 2, title: "Series 2", status: "ended" },
    ]),
    search: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue({ id: 1, title: "New Series" }),
    initialize: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    getHealth: jest
      .fn()
      .mockResolvedValue({ status: "healthy", lastChecked: new Date() }),
    getVersion: jest.fn().mockResolvedValue("4.0.0"),
  })),
}));

// Create a test wrapper component for React Query
const createTestQueryClient = () => {
  const queryClient = new QueryClient({
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

  // Spy on invalidateQueries method
  jest.spyOn(queryClient, "invalidateQueries");

  return queryClient;
};

const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("Query Invalidation Integration Tests", () => {
  let manager: ConnectorManager;
  let queryClient: QueryClient;

  beforeEach(() => {
    manager = ConnectorManager.getInstance();
    queryClient = createTestQueryClient();
    jest.clearAllMocks();
  });

  describe("Service Addition Query Invalidation", () => {
    it("should invalidate relevant queries when a service is added", async () => {
      const serviceConfig: ServiceConfig = {
        id: "new-sonarr-service",
        name: "New Sonarr Service",
        type: "sonarr",
        url: "http://new-sonarr.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Set up initial query data
      queryClient.setQueryData(queryKeys.services.overview, []);

      // Add service
      await manager.addConnector(serviceConfig);

      // Verify that service overview queries were invalidated
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });

      // Verify that service-specific queries were invalidated
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [serviceConfig.type],
      });
    });

    it("should invalidate related queries when service configuration changes", async () => {
      const originalService: ServiceConfig = {
        id: "service-1",
        name: "Original Service",
        type: "sonarr",
        url: "http://original.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedService: ServiceConfig = {
        ...originalService,
        name: "Updated Service",
      };

      // Add original service
      await manager.addConnector(originalService);

      // Update service (simulate configuration change)
      await manager.addConnector(updatedService);

      // Should invalidate service overview and related queries
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [originalService.type],
      });
    });
  });

  describe("Service Removal Query Invalidation", () => {
    it("should invalidate queries when a service is removed", async () => {
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

      // Set up query data that includes this service
      queryClient.setQueryData(queryKeys.services.overview, [serviceConfig]);

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Should invalidate service overview queries
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });

      // Should invalidate service-specific queries
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [serviceConfig.type],
      });
    });

    it("should handle removal of non-existent services gracefully", async () => {
      const nonExistentId = "non-existent-service";

      // Should not throw and should still invalidate queries
      await expect(
        manager.removeConnector(nonExistentId),
      ).resolves.toBeUndefined();

      // Should still invalidate service overview queries
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });
    });
  });

  describe("Multi-Service Query Coordination", () => {
    it("should invalidate all relevant queries when multiple services are affected", async () => {
      const services: ServiceConfig[] = [
        {
          id: "sonarr-1",
          name: "Sonarr 1",
          type: "sonarr",
          url: "http://sonarr1.local",
          apiKey: "test-key",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "sonarr-2",
          name: "Sonarr 2",
          type: "sonarr",
          url: "http://sonarr2.local",
          apiKey: "test-key",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "radarr-1",
          name: "Radarr 1",
          type: "radarr",
          url: "http://radarr1.local",
          apiKey: "test-key",
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      secureStorage.getServiceConfigs.mockResolvedValue(services);

      // Load multiple services
      await manager.loadSavedServices();

      // Test all connections (this should invalidate queries)
      await manager.testAllConnections();

      // Should invalidate service overview queries
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });

      // Should invalidate queries for each service type
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["sonarr"],
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["radarr"],
      });
    });

    it("should handle partial failures during query invalidation", async () => {
      const serviceConfig: ServiceConfig = {
        id: "partial-fail-service",
        name: "Partial Fail Service",
        type: "sonarr",
        url: "http://partial.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock query invalidation to fail for one query type
      queryClient.invalidateQueries = jest
        .fn()
        .mockImplementation((queryKey: any) => {
          if (queryKey === queryKeys.services.overview) {
            throw new Error("Invalidation failed");
          }
          return Promise.resolve();
        }) as any;

      // Should not throw despite invalidation failure
      await expect(manager.addConnector(serviceConfig)).resolves.toBeDefined();

      // Service should still be added despite invalidation failure
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeDefined();
    });
  });

  describe("React Query Hook Integration", () => {
    it("should properly integrate with React Query hooks", async () => {
      const serviceConfig: ServiceConfig = {
        id: "hook-integration-service",
        name: "Hook Integration Service",
        type: "sonarr",
        url: "http://hook.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Render hook with test wrapper
      const { result } = renderHook(() => useSonarrSeries(serviceConfig.id), {
        wrapper: TestWrapper,
      });

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      // Add service
      await manager.addConnector(serviceConfig);

      // After adding service, queries should be invalidated and hook should work
      expect(queryClient.invalidateQueries).toHaveBeenCalled();

      // The hook should eventually have data (mocked in connector)
      const connector = manager.getConnector(serviceConfig.id) as any;
      const series = await connector?.getSeries();

      expect(series).toBeDefined();
      expect(series?.length).toBe(2);
    });

    it("should handle service removal in React Query hooks", async () => {
      const serviceConfig: ServiceConfig = {
        id: "hook-removal-service",
        name: "Hook Removal Service",
        type: "sonarr",
        url: "http://removal.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add service first
      await manager.addConnector(serviceConfig);

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Queries should be invalidated on removal
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: queryKeys.services.overview,
      });

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: [serviceConfig.type],
      });

      // Service should be removed
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector).toBeUndefined();
    });
  });

  describe("Query Cache Consistency", () => {
    it("should maintain query cache consistency across service operations", async () => {
      const serviceConfig: ServiceConfig = {
        id: "cache-consistency-service",
        name: "Cache Consistency Service",
        type: "sonarr",
        url: "http://cache.local",
        apiKey: "test-key",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Set up initial cache state
      const initialSeries = [{ id: 1, title: "Initial Series" }];
      queryClient.setQueryData(
        [serviceConfig.type, serviceConfig.id, "series"],
        initialSeries,
      );

      // Add service
      await manager.addConnector(serviceConfig);

      // Cache should still contain initial data
      const cachedData = queryClient.getQueryData([
        serviceConfig.type,
        serviceConfig.id,
        "series",
      ]);
      expect(cachedData).toEqual(initialSeries);

      // Remove service
      await manager.removeConnector(serviceConfig.id);

      // Cache should still contain data (not automatically cleared on service removal)
      expect(
        queryClient.getQueryData([
          serviceConfig.type,
          serviceConfig.id,
          "series",
        ]),
      ).toEqual(initialSeries);
    });

    it("should handle query cache cleanup when services are disabled", async () => {
      const serviceConfig: ServiceConfig = {
        id: "disabled-service",
        name: "Disabled Service",
        type: "sonarr",
        url: "http://disabled.local",
        apiKey: "test-key",
        enabled: false, // Disabled service
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Set up cache data for disabled service
      queryClient.setQueryData(
        [serviceConfig.type, serviceConfig.id, "series"],
        [],
      );

      // Add disabled service
      await manager.addConnector(serviceConfig);

      // Should still invalidate queries for consistency
      expect(queryClient.invalidateQueries).toHaveBeenCalled();

      // Service should be added but marked as disabled
      const connector = manager.getConnector(serviceConfig.id);
      expect(connector?.config.enabled).toBe(false);
    });
  });
});
