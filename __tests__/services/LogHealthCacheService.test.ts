/**
 * Unit tests for LogHealthCacheService
 */

import { LogHealthCacheService } from "@/services/cache/LogHealthCacheService";
import type { ServiceLog } from "@/models/logger.types";
import type { AggregatedHealth } from "@/services/health/HealthAggregationService";
import { storageAdapter } from "@/services/storage/StorageAdapter";

// Mock storage adapter
jest.mock("@/services/storage/StorageAdapter", () => ({
  storageAdapter: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/services/logger/LoggerService", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe("LogHealthCacheService", () => {
  let cacheService: LogHealthCacheService;
  const mockStorageAdapter = storageAdapter as jest.Mocked<
    typeof storageAdapter
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (LogHealthCacheService as any).instance = null;
    cacheService = LogHealthCacheService.getInstance();
  });

  describe("cacheLogs", () => {
    it("should cache logs for a service", async () => {
      const serviceId = "sonarr-1";
      const logs: ServiceLog[] = [
        {
          id: "log-1",
          serviceId,
          serviceName: "Sonarr",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T12:00:00Z"),
          level: "info",
          message: "Test log message",
        },
      ];

      mockStorageAdapter.getAllKeys.mockResolvedValue([]);

      await cacheService.cacheLogs(serviceId, logs);

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        `cache:logs:${serviceId}`,
        expect.any(String),
      );

      const cachedData = JSON.parse(
        (mockStorageAdapter.setItem as jest.Mock).mock.calls[0][1],
      );
      // Dates are serialized as strings in JSON
      expect(cachedData.data[0].id).toBe(logs[0].id);
      expect(cachedData.data[0].message).toBe(logs[0].message);
      expect(cachedData.timestamp).toBeGreaterThan(0);
      expect(cachedData.size).toBeGreaterThan(0);
    });

    it("should handle caching errors gracefully", async () => {
      const serviceId = "sonarr-1";
      const logs: ServiceLog[] = [];

      mockStorageAdapter.setItem.mockRejectedValue(new Error("Storage error"));

      await expect(
        cacheService.cacheLogs(serviceId, logs),
      ).resolves.not.toThrow();
    });
  });

  describe("getCachedLogs", () => {
    it("should return cached logs if not expired", async () => {
      const serviceId = "sonarr-1";
      const logs: ServiceLog[] = [
        {
          id: "log-1",
          serviceId,
          serviceName: "Sonarr",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T12:00:00Z"),
          level: "info",
          message: "Test log message",
        },
      ];

      const cacheEntry = {
        data: logs,
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago (within 15-minute TTL)
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getCachedLogs(serviceId);

      expect(result).toHaveLength(1);
      expect(result![0].id).toBe("log-1");
      expect(result![0].timestamp).toBeInstanceOf(Date);
    });

    it("should return null if cache is expired", async () => {
      const serviceId = "sonarr-1";
      const logs: ServiceLog[] = [
        {
          id: "log-1",
          serviceId,
          serviceName: "Sonarr",
          serviceType: "sonarr",
          timestamp: new Date("2024-01-01T12:00:00Z"),
          level: "info",
          message: "Test log message",
        },
      ];

      const cacheEntry = {
        data: logs,
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (expired)
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getCachedLogs(serviceId);

      expect(result).toBeNull();
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        `cache:logs:${serviceId}`,
      );
    });

    it("should return null if cache does not exist", async () => {
      const serviceId = "sonarr-1";

      mockStorageAdapter.getItem.mockResolvedValue(null);

      const result = await cacheService.getCachedLogs(serviceId);

      expect(result).toBeNull();
    });

    it("should handle retrieval errors gracefully", async () => {
      const serviceId = "sonarr-1";

      mockStorageAdapter.getItem.mockRejectedValue(new Error("Storage error"));

      const result = await cacheService.getCachedLogs(serviceId);

      expect(result).toBeNull();
    });
  });

  describe("cacheHealth", () => {
    it("should cache health status", async () => {
      const health: AggregatedHealth = {
        overall: "healthy",
        services: [],
        criticalIssues: [],
        warnings: [],
        lastUpdated: new Date("2024-01-01T12:00:00Z"),
      };

      mockStorageAdapter.getAllKeys.mockResolvedValue([]);

      await cacheService.cacheHealth(health);

      expect(mockStorageAdapter.setItem).toHaveBeenCalledWith(
        "cache:health:all",
        expect.any(String),
      );

      const cachedData = JSON.parse(
        (mockStorageAdapter.setItem as jest.Mock).mock.calls[0][1],
      );
      // Dates are serialized as strings in JSON
      expect(cachedData.data.overall).toBe(health.overall);
      expect(cachedData.data.services).toEqual(health.services);
      expect(cachedData.timestamp).toBeGreaterThan(0);
      expect(cachedData.size).toBeGreaterThan(0);
    });

    it("should handle caching errors gracefully", async () => {
      const health: AggregatedHealth = {
        overall: "healthy",
        services: [],
        criticalIssues: [],
        warnings: [],
        lastUpdated: new Date(),
      };

      mockStorageAdapter.setItem.mockRejectedValue(new Error("Storage error"));

      await expect(cacheService.cacheHealth(health)).resolves.not.toThrow();
    });
  });

  describe("getCachedHealth", () => {
    it("should return cached health if not expired", async () => {
      const health: AggregatedHealth = {
        overall: "healthy",
        services: [],
        criticalIssues: [],
        warnings: [],
        lastUpdated: new Date("2024-01-01T12:00:00Z"),
      };

      const cacheEntry = {
        data: health,
        timestamp: Date.now() - 2 * 60 * 1000, // 2 minutes ago (within 5-minute TTL)
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getCachedHealth();

      expect(result).not.toBeNull();
      expect(result!.overall).toBe("healthy");
      expect(result!.lastUpdated).toBeInstanceOf(Date);
    });

    it("should return null if cache is expired", async () => {
      const health: AggregatedHealth = {
        overall: "healthy",
        services: [],
        criticalIssues: [],
        warnings: [],
        lastUpdated: new Date("2024-01-01T12:00:00Z"),
      };

      const cacheEntry = {
        data: health,
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago (expired)
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getCachedHealth();

      expect(result).toBeNull();
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        "cache:health:all",
      );
    });

    it("should return null if cache does not exist", async () => {
      mockStorageAdapter.getItem.mockResolvedValue(null);

      const result = await cacheService.getCachedHealth();

      expect(result).toBeNull();
    });

    it("should handle retrieval errors gracefully", async () => {
      mockStorageAdapter.getItem.mockRejectedValue(new Error("Storage error"));

      const result = await cacheService.getCachedHealth();

      expect(result).toBeNull();
    });
  });

  describe("getLogsCacheTimestamp", () => {
    it("should return cache timestamp for logs", async () => {
      const serviceId = "sonarr-1";
      const timestamp = Date.now() - 5 * 60 * 1000;

      const cacheEntry = {
        data: [],
        timestamp,
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getLogsCacheTimestamp(serviceId);

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBe(timestamp);
    });

    it("should return null if cache does not exist", async () => {
      const serviceId = "sonarr-1";

      mockStorageAdapter.getItem.mockResolvedValue(null);

      const result = await cacheService.getLogsCacheTimestamp(serviceId);

      expect(result).toBeNull();
    });
  });

  describe("getHealthCacheTimestamp", () => {
    it("should return cache timestamp for health", async () => {
      const timestamp = Date.now() - 2 * 60 * 1000;

      const cacheEntry = {
        data: {},
        timestamp,
        size: 100,
      };

      mockStorageAdapter.getItem.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheService.getHealthCacheTimestamp();

      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBe(timestamp);
    });

    it("should return null if cache does not exist", async () => {
      mockStorageAdapter.getItem.mockResolvedValue(null);

      const result = await cacheService.getHealthCacheTimestamp();

      expect(result).toBeNull();
    });
  });

  describe("getCacheStats", () => {
    it("should return cache statistics", async () => {
      const logEntry1 = {
        data: [],
        timestamp: Date.now() - 10 * 60 * 1000,
        size: 1000,
      };

      const logEntry2 = {
        data: [],
        timestamp: Date.now() - 5 * 60 * 1000,
        size: 2000,
      };

      const healthEntry = {
        data: {},
        timestamp: Date.now() - 2 * 60 * 1000,
        size: 500,
      };

      mockStorageAdapter.getAllKeys.mockResolvedValue([
        "cache:logs:sonarr-1",
        "cache:logs:radarr-1",
        "cache:health:all",
        "other:key",
      ]);

      mockStorageAdapter.getItem
        .mockResolvedValueOnce(JSON.stringify(logEntry1))
        .mockResolvedValueOnce(JSON.stringify(logEntry2))
        .mockResolvedValueOnce(JSON.stringify(healthEntry));

      const stats = await cacheService.getCacheStats();

      expect(stats.totalSize).toBe(3500);
      expect(stats.logEntries).toBe(2);
      expect(stats.healthEntries).toBe(1);
      expect(stats.oldestEntry).toBe(logEntry1.timestamp);
      expect(stats.newestEntry).toBe(healthEntry.timestamp);
    });

    it("should handle errors gracefully", async () => {
      mockStorageAdapter.getAllKeys.mockRejectedValue(
        new Error("Storage error"),
      );

      const stats = await cacheService.getCacheStats();

      expect(stats.totalSize).toBe(0);
      expect(stats.logEntries).toBe(0);
      expect(stats.healthEntries).toBe(0);
    });
  });

  describe("clearLogCache", () => {
    it("should clear all log cache entries", async () => {
      mockStorageAdapter.getAllKeys.mockResolvedValue([
        "cache:logs:sonarr-1",
        "cache:logs:radarr-1",
        "cache:health:all",
        "other:key",
      ]);

      await cacheService.clearLogCache();

      expect(mockStorageAdapter.removeItem).toHaveBeenCalledTimes(2);
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        "cache:logs:sonarr-1",
      );
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        "cache:logs:radarr-1",
      );
    });
  });

  describe("clearHealthCache", () => {
    it("should clear all health cache entries", async () => {
      mockStorageAdapter.getAllKeys.mockResolvedValue([
        "cache:logs:sonarr-1",
        "cache:health:all",
        "other:key",
      ]);

      await cacheService.clearHealthCache();

      expect(mockStorageAdapter.removeItem).toHaveBeenCalledTimes(1);
      expect(mockStorageAdapter.removeItem).toHaveBeenCalledWith(
        "cache:health:all",
      );
    });
  });

  describe("clearAllCache", () => {
    it("should clear all cache entries", async () => {
      mockStorageAdapter.getAllKeys.mockResolvedValue([
        "cache:logs:sonarr-1",
        "cache:health:all",
        "other:key",
      ]);

      await cacheService.clearAllCache();

      expect(mockStorageAdapter.removeItem).toHaveBeenCalledTimes(2);
    });
  });

  describe("cache eviction", () => {
    it("should not evict entries when cache is under limit", async () => {
      // Create a cache service with large max size
      (LogHealthCacheService as any).instance = null;
      const testCacheService = LogHealthCacheService.getInstance({
        maxCacheSize: 50 * 1024 * 1024, // 50MB - default large limit
      });

      mockStorageAdapter.getAllKeys.mockResolvedValue([]);

      const logs: ServiceLog[] = [
        {
          id: "log-1",
          serviceId: "test",
          serviceName: "Test",
          serviceType: "test",
          timestamp: new Date(),
          level: "info",
          message: "Test",
        },
      ];

      await testCacheService.cacheLogs("test", logs);

      // Should have cached the logs
      expect(mockStorageAdapter.setItem).toHaveBeenCalled();

      // Should not have evicted anything since we're under the limit
      expect(mockStorageAdapter.removeItem).not.toHaveBeenCalled();
    });

    it("should calculate cache stats correctly", async () => {
      const entry1 = {
        data: [],
        timestamp: Date.now() - 10 * 60 * 1000,
        size: 1000,
      };

      const entry2 = {
        data: [],
        timestamp: Date.now() - 5 * 60 * 1000,
        size: 2000,
      };

      mockStorageAdapter.getAllKeys.mockResolvedValue([
        "cache:logs:service1",
        "cache:logs:service2",
      ]);

      mockStorageAdapter.getItem
        .mockResolvedValueOnce(JSON.stringify(entry1))
        .mockResolvedValueOnce(JSON.stringify(entry2));

      const stats = await cacheService.getCacheStats();

      // Verify stats are calculated correctly
      expect(stats.totalSize).toBe(3000);
      expect(stats.logEntries).toBe(2);
      expect(stats.oldestEntry).toBe(entry1.timestamp);
      expect(stats.newestEntry).toBe(entry2.timestamp);
    });
  });
});
