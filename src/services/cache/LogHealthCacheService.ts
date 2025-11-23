/**
 * Log and Health Cache Service
 *
 * Provides MMKV-based caching for logs and health status with TTL and eviction policies.
 * - Logs: 15-minute TTL
 * - Health status: 5-minute TTL
 * - Cache eviction when storage exceeds 50MB
 * - Cache timestamp tracking for offline support
 *
 * Requirements: 7.1, 7.2, 7.5
 */

import { storageAdapter } from "@/services/storage/StorageAdapter";
import type { ServiceLog } from "@/models/logger.types";
import type { AggregatedHealth } from "@/services/health/HealthAggregationService";
import { logger } from "@/services/logger/LoggerService";

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number;
}

/**
 * Cache statistics
 */
interface CacheStats {
  totalSize: number;
  logEntries: number;
  healthEntries: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  logTTL: number; // milliseconds
  healthTTL: number; // milliseconds
  maxCacheSize: number; // bytes
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  logTTL: 15 * 60 * 1000, // 15 minutes
  healthTTL: 5 * 60 * 1000, // 5 minutes
  maxCacheSize: 50 * 1024 * 1024, // 50MB
};

/**
 * Cache key prefixes
 */
const CACHE_KEYS = {
  LOG_PREFIX: "cache:logs:",
  HEALTH_PREFIX: "cache:health:",
  STATS: "cache:stats",
} as const;

/**
 * Service for caching logs and health data with TTL and eviction policies
 */
export class LogHealthCacheService {
  private static instance: LogHealthCacheService | null = null;
  private config: CacheConfig;

  private constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance of LogHealthCacheService
   */
  static getInstance(config?: Partial<CacheConfig>): LogHealthCacheService {
    if (!LogHealthCacheService.instance) {
      LogHealthCacheService.instance = new LogHealthCacheService(config);
    }
    return LogHealthCacheService.instance;
  }

  /**
   * Cache logs for a service
   * @param serviceId - Service ID
   * @param logs - Logs to cache
   */
  async cacheLogs(serviceId: string, logs: ServiceLog[]): Promise<void> {
    try {
      const key = `${CACHE_KEYS.LOG_PREFIX}${serviceId}`;
      const data = JSON.stringify(logs);
      const size = this.calculateSize(data);

      const entry: CacheEntry<ServiceLog[]> = {
        data: logs,
        timestamp: Date.now(),
        size,
      };

      await storageAdapter.setItem(key, JSON.stringify(entry));

      void logger.debug("Cached logs for service", {
        serviceId,
        logCount: logs.length,
        size,
      });

      // Check if cache size exceeds limit and evict if necessary
      await this.checkAndEvict();
    } catch (error) {
      void logger.error("Failed to cache logs", {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cached logs for a service
   * @param serviceId - Service ID
   * @returns Cached logs or null if not found or expired
   */
  async getCachedLogs(serviceId: string): Promise<ServiceLog[] | null> {
    try {
      const key = `${CACHE_KEYS.LOG_PREFIX}${serviceId}`;
      const cached = await storageAdapter.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<ServiceLog[]> = JSON.parse(cached);

      // Check if entry is expired
      const age = Date.now() - entry.timestamp;
      if (age > this.config.logTTL) {
        void logger.debug("Cached logs expired", {
          serviceId,
          age,
          ttl: this.config.logTTL,
        });

        // Remove expired entry
        await storageAdapter.removeItem(key);
        return null;
      }

      // Parse dates in logs
      const logs = entry.data.map((log) => ({
        ...log,
        timestamp: new Date(log.timestamp),
      }));

      void logger.debug("Retrieved cached logs", {
        serviceId,
        logCount: logs.length,
        age,
      });

      return logs;
    } catch (error) {
      void logger.error("Failed to get cached logs", {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache health status
   * @param health - Health status to cache
   */
  async cacheHealth(health: AggregatedHealth): Promise<void> {
    try {
      const key = `${CACHE_KEYS.HEALTH_PREFIX}all`;
      const data = JSON.stringify(health);
      const size = this.calculateSize(data);

      const entry: CacheEntry<AggregatedHealth> = {
        data: health,
        timestamp: Date.now(),
        size,
      };

      await storageAdapter.setItem(key, JSON.stringify(entry));

      void logger.debug("Cached health status", {
        serviceCount: health.services.length,
        size,
      });

      // Check if cache size exceeds limit and evict if necessary
      await this.checkAndEvict();
    } catch (error) {
      void logger.error("Failed to cache health status", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get cached health status
   * @returns Cached health status or null if not found or expired
   */
  async getCachedHealth(): Promise<AggregatedHealth | null> {
    try {
      const key = `${CACHE_KEYS.HEALTH_PREFIX}all`;
      const cached = await storageAdapter.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<AggregatedHealth> = JSON.parse(cached);

      // Check if entry is expired
      const age = Date.now() - entry.timestamp;
      if (age > this.config.healthTTL) {
        void logger.debug("Cached health status expired", {
          age,
          ttl: this.config.healthTTL,
        });

        // Remove expired entry
        await storageAdapter.removeItem(key);
        return null;
      }

      // Parse dates in health status
      const health: AggregatedHealth = {
        ...entry.data,
        lastUpdated: new Date(entry.data.lastUpdated),
        services: entry.data.services.map((service) => ({
          ...service,
          lastChecked: new Date(service.lastChecked),
          messages: service.messages.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
        })),
        criticalIssues: entry.data.criticalIssues.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
        warnings: entry.data.warnings.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      };

      void logger.debug("Retrieved cached health status", {
        serviceCount: health.services.length,
        age,
      });

      return health;
    } catch (error) {
      void logger.error("Failed to get cached health status", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get cache timestamp for logs
   * @param serviceId - Service ID
   * @returns Timestamp when logs were cached, or null if not cached
   */
  async getLogsCacheTimestamp(serviceId: string): Promise<Date | null> {
    try {
      const key = `${CACHE_KEYS.LOG_PREFIX}${serviceId}`;
      const cached = await storageAdapter.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<ServiceLog[]> = JSON.parse(cached);
      return new Date(entry.timestamp);
    } catch (error) {
      void logger.error("Failed to get logs cache timestamp", {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get cache timestamp for health status
   * @returns Timestamp when health status was cached, or null if not cached
   */
  async getHealthCacheTimestamp(): Promise<Date | null> {
    try {
      const key = `${CACHE_KEYS.HEALTH_PREFIX}all`;
      const cached = await storageAdapter.getItem(key);

      if (!cached) {
        return null;
      }

      const entry: CacheEntry<AggregatedHealth> = JSON.parse(cached);
      return new Date(entry.timestamp);
    } catch (error) {
      void logger.error("Failed to get health cache timestamp", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics including size and entry counts
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const keys = await storageAdapter.getAllKeys();
      const logKeys = keys.filter((key) =>
        key.startsWith(CACHE_KEYS.LOG_PREFIX),
      );
      const healthKeys = keys.filter((key) =>
        key.startsWith(CACHE_KEYS.HEALTH_PREFIX),
      );

      let totalSize = 0;
      let oldestEntry: number | null = null;
      let newestEntry: number | null = null;

      // Calculate total size and timestamps
      for (const key of [...logKeys, ...healthKeys]) {
        const cached = await storageAdapter.getItem(key);
        if (cached) {
          const entry: CacheEntry<unknown> = JSON.parse(cached);
          totalSize += entry.size;

          if (oldestEntry === null || entry.timestamp < oldestEntry) {
            oldestEntry = entry.timestamp;
          }

          if (newestEntry === null || entry.timestamp > newestEntry) {
            newestEntry = entry.timestamp;
          }
        }
      }

      return {
        totalSize,
        logEntries: logKeys.length,
        healthEntries: healthKeys.length,
        oldestEntry,
        newestEntry,
      };
    } catch (error) {
      void logger.error("Failed to get cache stats", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        totalSize: 0,
        logEntries: 0,
        healthEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }
  }

  /**
   * Clear all cached logs
   */
  async clearLogCache(): Promise<void> {
    try {
      const keys = await storageAdapter.getAllKeys();
      const logKeys = keys.filter((key) =>
        key.startsWith(CACHE_KEYS.LOG_PREFIX),
      );

      for (const key of logKeys) {
        await storageAdapter.removeItem(key);
      }

      void logger.debug("Cleared log cache", {
        clearedCount: logKeys.length,
      });
    } catch (error) {
      void logger.error("Failed to clear log cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear cached health status
   */
  async clearHealthCache(): Promise<void> {
    try {
      const keys = await storageAdapter.getAllKeys();
      const healthKeys = keys.filter((key) =>
        key.startsWith(CACHE_KEYS.HEALTH_PREFIX),
      );

      for (const key of healthKeys) {
        await storageAdapter.removeItem(key);
      }

      void logger.debug("Cleared health cache", {
        clearedCount: healthKeys.length,
      });
    } catch (error) {
      void logger.error("Failed to clear health cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear all cache (logs and health)
   */
  async clearAllCache(): Promise<void> {
    await this.clearLogCache();
    await this.clearHealthCache();

    void logger.debug("Cleared all cache");
  }

  /**
   * Check cache size and evict oldest entries if exceeds limit
   * Implements cache eviction policy (Requirement 7.5)
   */
  private async checkAndEvict(): Promise<void> {
    try {
      const stats = await this.getCacheStats();

      if (stats.totalSize <= this.config.maxCacheSize) {
        return;
      }

      void logger.info("Cache size exceeds limit, evicting oldest entries", {
        currentSize: stats.totalSize,
        maxSize: this.config.maxCacheSize,
      });

      // Get all cache entries with timestamps
      const keys = await storageAdapter.getAllKeys();
      const cacheKeys = keys.filter(
        (key) =>
          key.startsWith(CACHE_KEYS.LOG_PREFIX) ||
          key.startsWith(CACHE_KEYS.HEALTH_PREFIX),
      );

      const entries: { key: string; timestamp: number; size: number }[] = [];

      for (const key of cacheKeys) {
        const cached = await storageAdapter.getItem(key);
        if (cached) {
          const entry: CacheEntry<unknown> = JSON.parse(cached);
          entries.push({
            key,
            timestamp: entry.timestamp,
            size: entry.size,
          });
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.timestamp - b.timestamp);

      // Evict oldest entries until size is under limit
      let currentSize = stats.totalSize;
      let evictedCount = 0;

      for (const entry of entries) {
        if (currentSize <= this.config.maxCacheSize) {
          break;
        }

        await storageAdapter.removeItem(entry.key);
        currentSize -= entry.size;
        evictedCount++;

        void logger.debug("Evicted cache entry", {
          key: entry.key,
          size: entry.size,
          age: Date.now() - entry.timestamp,
        });
      }

      void logger.info("Cache eviction complete", {
        evictedCount,
        newSize: currentSize,
        maxSize: this.config.maxCacheSize,
      });
    } catch (error) {
      void logger.error("Failed to check and evict cache", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Calculate size of data in bytes
   */
  private calculateSize(data: string): number {
    // Use Blob API if available (web), otherwise estimate
    if (typeof Blob !== "undefined") {
      return new Blob([data]).size;
    }

    // Estimate: UTF-8 encoding, most characters are 1 byte
    // This is a rough estimate for React Native
    return data.length;
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    void logger.debug("LogHealthCacheService disposed");
  }
}
