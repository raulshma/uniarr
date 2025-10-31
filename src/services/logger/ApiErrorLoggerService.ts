import { storageAdapter } from "@/services/storage/StorageAdapter";
import { storageInitPromise } from "@/services/storage/MMKVStorage";
import type {
  ApiErrorLogEntry,
  ApiErrorLogFilter,
  GroupedErrorStats,
  HistogramData,
} from "@/models/apiErrorLog.types";
import type { ApiError, ErrorContext } from "@/utils/error.utils";

const STORAGE_PREFIX = "ApiErrorLog";
const INDEX_KEY = `${STORAGE_PREFIX}_index`;
const MAX_ENTRIES = 10_000; // Higher limit for error logs

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

const createEntryId = (): string =>
  `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const getStorageKey = (id: string): string => `${STORAGE_PREFIX}_${id}`;

class ApiErrorLoggerService {
  private static instance: ApiErrorLoggerService | null = null;

  private entries: ApiErrorLogEntry[] = [];

  private isInitialized = false;

  private pendingPersist: Promise<void> | null = null;

  static getInstance(): ApiErrorLoggerService {
    if (!ApiErrorLoggerService.instance) {
      ApiErrorLoggerService.instance = new ApiErrorLoggerService();
    }

    return ApiErrorLoggerService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await storageInitPromise;
    } catch {
      // storageInitPromise swallows errors; ignore here.
    }

    // Load persisted entries
    try {
      const indexData = await storageAdapter.getItem(INDEX_KEY);
      if (indexData) {
        const index = JSON.parse(indexData) as string[];
        const loadedEntries: ApiErrorLogEntry[] = [];

        for (const id of index) {
          const entryData = await storageAdapter.getItem(getStorageKey(id));
          if (entryData) {
            try {
              const entry = JSON.parse(entryData) as ApiErrorLogEntry;
              loadedEntries.push(entry);
            } catch (error) {
              if (isDevelopment) {
                console.warn(
                  `[ApiErrorLoggerService] Failed to parse entry ${id}.`,
                  error,
                );
              }
            }
          }
        }

        this.entries = loadedEntries;
      }
    } catch (error) {
      if (isDevelopment) {
        console.error(
          "[ApiErrorLoggerService] Failed to load persisted error entries.",
          error,
        );
      }
      this.entries = [];
    }

    this.isInitialized = true;
  }

  async addError(
    error: ApiError,
    context?: ErrorContext,
    retryCount = 0,
  ): Promise<void> {
    await this.ensureInitialized();

    const id = createEntryId();
    const timestamp = new Date().toISOString();

    // Extract method from context or use GET as default
    const method =
      (context as Record<string, unknown> & { method?: string })?.method ||
      "GET";

    const entry: ApiErrorLogEntry = {
      id,
      timestamp,
      method,
      endpoint: context?.endpoint || "unknown",
      statusCode: error.statusCode,
      errorCode: error.code,
      serviceId: context?.serviceId || "unknown",
      serviceType: context?.serviceType,
      operation: context?.operation,
      message: error.message,
      isNetworkError: error.isNetworkError,
      retryCount,
      context: error.details,
    };

    this.entries = [...this.entries, entry].slice(-MAX_ENTRIES);
    await this.persistEntries();
  }

  async getErrors(filter?: ApiErrorLogFilter): Promise<ApiErrorLogEntry[]> {
    await this.ensureInitialized();

    let filtered = [...this.entries];

    if (filter) {
      if (filter.serviceId) {
        filtered = filtered.filter((e) => e.serviceId === filter.serviceId);
      }

      if (filter.statusCode !== undefined) {
        filtered = filtered.filter((e) => e.statusCode === filter.statusCode);
      }

      if (filter.errorCode) {
        filtered = filtered.filter((e) => e.errorCode === filter.errorCode);
      }

      if (filter.isNetworkError !== undefined) {
        filtered = filtered.filter(
          (e) => e.isNetworkError === filter.isNetworkError,
        );
      }

      if (filter.operation) {
        filtered = filtered.filter((e) => e.operation === filter.operation);
      }

      if (filter.endpoint) {
        filtered = filtered.filter((e) =>
          e.endpoint.includes(filter.endpoint!),
        );
      }

      if (filter.startDate) {
        const startTime = filter.startDate.getTime();
        filtered = filtered.filter(
          (e) => new Date(e.timestamp).getTime() >= startTime,
        );
      }

      if (filter.endDate) {
        const endTime = filter.endDate.getTime();
        filtered = filtered.filter(
          (e) => new Date(e.timestamp).getTime() <= endTime,
        );
      }

      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(
          (e) =>
            e.message.toLowerCase().includes(searchLower) ||
            e.endpoint.toLowerCase().includes(searchLower) ||
            e.operation?.toLowerCase().includes(searchLower),
        );
      }
    }

    return filtered;
  }

  async deleteErrors(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const idSet = new Set(ids);
    this.entries = this.entries.filter((e) => !idSet.has(e.id));

    // Remove from individual storage
    for (const id of ids) {
      try {
        await storageAdapter.removeItem(getStorageKey(id));
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiErrorLoggerService] Failed to delete entry ${id}.`,
            error,
          );
        }
      }
    }

    await this.persistEntries();
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const allIds = this.entries.map((e) => e.id);
    this.entries = [];

    // Remove all individual entries
    for (const id of allIds) {
      try {
        await storageAdapter.removeItem(getStorageKey(id));
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiErrorLoggerService] Failed to delete entry ${id}.`,
            error,
          );
        }
      }
    }

    // Clear index
    try {
      await storageAdapter.removeItem(INDEX_KEY);
    } catch (error) {
      if (isDevelopment) {
        console.error("[ApiErrorLoggerService] Failed to clear index.", error);
      }
    }
  }

  async clearOldEntries(retentionDays: number): Promise<number> {
    await this.ensureInitialized();

    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - retentionDays);

    const oldEntries = this.entries.filter(
      (e) => new Date(e.timestamp) < cutoffTime,
    );
    const oldIds = oldEntries.map((e) => e.id);

    if (oldIds.length === 0) {
      return 0;
    }

    await this.deleteErrors(oldIds);
    return oldIds.length;
  }

  async getGroupedStats(): Promise<GroupedErrorStats> {
    await this.ensureInitialized();

    const stats: GroupedErrorStats = {
      byService: new Map(),
      byStatusCode: new Map(),
      byEndpoint: new Map(),
      byDate: new Map(),
      byErrorType: {
        network: 0,
        server: 0,
        client: 0,
        other: 0,
      },
      total: this.entries.length,
    };

    for (const entry of this.entries) {
      // By Service
      stats.byService.set(
        entry.serviceId,
        (stats.byService.get(entry.serviceId) ?? 0) + 1,
      );

      // By Status Code
      const codeKey = entry.statusCode ?? entry.errorCode ?? "Unknown";
      stats.byStatusCode.set(
        codeKey,
        (stats.byStatusCode.get(codeKey) ?? 0) + 1,
      );

      // By Endpoint
      stats.byEndpoint.set(
        entry.endpoint,
        (stats.byEndpoint.get(entry.endpoint) ?? 0) + 1,
      );

      // By Date
      const dateStr = entry.timestamp.split("T")[0];
      if (dateStr) {
        stats.byDate.set(dateStr, (stats.byDate.get(dateStr) ?? 0) + 1);
      }

      // By Error Type
      if (entry.isNetworkError) {
        stats.byErrorType.network++;
      } else if (entry.statusCode && entry.statusCode >= 500) {
        stats.byErrorType.server++;
      } else if (entry.statusCode && entry.statusCode >= 400) {
        stats.byErrorType.client++;
      } else {
        stats.byErrorType.other++;
      }
    }

    return stats;
  }

  async getServiceHistogram(): Promise<HistogramData[]> {
    const stats = await this.getGroupedStats();
    return Array.from(stats.byService.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  async getStatusCodeHistogram(): Promise<HistogramData[]> {
    const stats = await this.getGroupedStats();
    return Array.from(stats.byStatusCode.entries())
      .map(([label, value]) => ({ label: String(label), value }))
      .sort((a, b) => b.value - a.value);
  }

  async getEndpointHistogram(): Promise<HistogramData[]> {
    const stats = await this.getGroupedStats();
    return Array.from(stats.byEndpoint.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  async exportAsJson(): Promise<string> {
    await this.ensureInitialized();
    return JSON.stringify(this.entries, null, 2);
  }

  getEntriesSync(): ApiErrorLogEntry[] {
    return [...this.entries];
  }

  private async persistEntries(): Promise<void> {
    // Use a simple pending promise chain to avoid overlapping writes.
    const write = async (): Promise<void> => {
      try {
        const index = this.entries.map((e) => e.id);
        await storageAdapter.setItem(INDEX_KEY, JSON.stringify(index));

        // Store each entry individually
        for (const entry of this.entries) {
          await storageAdapter.setItem(
            getStorageKey(entry.id),
            JSON.stringify(entry),
          );
        }
      } catch (err: unknown) {
        if (isDevelopment) {
          console.error(
            "[ApiErrorLoggerService] Failed to persist entries.",
            err,
          );
        }
      }
    };

    if (!this.pendingPersist) {
      this.pendingPersist = write();
      try {
        await this.pendingPersist;
      } finally {
        this.pendingPersist = null;
      }
      return;
    }

    // Chain onto the existing pending write
    this.pendingPersist = this.pendingPersist.then(() => write());
    try {
      await this.pendingPersist;
    } finally {
      this.pendingPersist = null;
    }
  }
}

export const apiErrorLogger = ApiErrorLoggerService.getInstance();
