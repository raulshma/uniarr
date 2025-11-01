import { storageAdapter } from "@/services/storage/StorageAdapter";
import { storageInitPromise } from "@/services/storage/MMKVStorage";
import { errorDetailsStorage } from "@/services/storage/ErrorDetailsStorage";
import { useSettingsStore } from "@/store/settingsStore";
import type {
  ApiErrorLogEntry,
  ApiErrorLogFilter,
  GroupedErrorStats,
  HistogramData,
} from "@/models/apiErrorLog.types";
import type { ApiError, ErrorContext } from "@/utils/error.utils";

const STORAGE_PREFIX = "ApiErrorLog";
const INDEX_KEY = `${STORAGE_PREFIX}_index`;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ENTRIES = 10_000; // Higher limit for error logs
const AUDIT_TRAIL_RETENTION_DAYS = 30; // Keep deleted entries for 30 days for audit trail
const SIZE_BASED_EVICTION_THRESHOLD = 0.95; // Evict when at 95% of max entries (9,500 entries)

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

const createEntryId = (): string =>
  `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const getStorageKey = (id: string): string => `${STORAGE_PREFIX}_${id}`;

class ApiErrorLoggerService {
  private static instance: ApiErrorLoggerService | null = null;

  private entries: ApiErrorLogEntry[] = [];

  private isInitialized = false;

  private pendingPersist: Promise<void> | null = null;

  private cleanupTimer: NodeJS.Timeout | null = null;

  private isRunning = false;

  static getInstance(): ApiErrorLoggerService {
    if (!ApiErrorLoggerService.instance) {
      ApiErrorLoggerService.instance = new ApiErrorLoggerService();
    }

    return ApiErrorLoggerService.instance;
  }

  /**
   * Start the error logger service (enables periodic cleanup)
   * Called when app comes to foreground via AppState listener
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    await this.ensureInitialized();

    this.isRunning = true;

    // Perform cleanup immediately on start
    await this.performPeriodicCleanup();

    // Schedule periodic cleanup
    this.cleanupTimer = setInterval(() => {
      void this.performPeriodicCleanup();
    }, CLEANUP_INTERVAL_MS);

    if (isDevelopment) {
      console.log(
        "[ApiErrorLoggerService] Started with periodic cleanup every 15 minutes.",
      );
    }
  }

  /**
   * Stop the error logger service (cancels periodic cleanup)
   * Called when app goes to background via AppState listener
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (isDevelopment) {
      console.log("[ApiErrorLoggerService] Stopped periodic cleanup.");
    }
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
    details?: {
      requestBody?: string;
      responseBody?: string;
      requestHeaders?: string;
    },
    sensitiveDataDetection?: {
      patterns: string[];
      location: "headers" | "body" | "both";
      timestamp: string;
    },
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
      sensitiveDataDetected: sensitiveDataDetection,
    };

    // Store detailed information (body/headers) if capture is enabled and details provided
    if (details) {
      const settings = useSettingsStore.getState();
      const hasContent =
        (settings.apiErrorLoggerCaptureRequestBody && details.requestBody) ||
        (settings.apiErrorLoggerCaptureResponseBody && details.responseBody) ||
        (settings.apiErrorLoggerCaptureRequestHeaders &&
          details.requestHeaders);

      if (hasContent) {
        const capturedDetails = {
          requestBody: settings.apiErrorLoggerCaptureRequestBody
            ? details.requestBody
            : undefined,
          responseBody: settings.apiErrorLoggerCaptureResponseBody
            ? details.responseBody
            : undefined,
          requestHeaders: settings.apiErrorLoggerCaptureRequestHeaders
            ? details.requestHeaders
            : undefined,
        };

        // Non-blocking store of details - don't await to avoid slowing down error logging
        void errorDetailsStorage.storeErrorDetails(id, capturedDetails);
      }
    }

    this.entries = [...this.entries, entry].slice(-MAX_ENTRIES);

    // Perform size-based eviction if approaching limit
    await this.evictIfNeeded();

    await this.persistEntries();
  }

  async getErrors(filter?: ApiErrorLogFilter): Promise<ApiErrorLogEntry[]> {
    await this.ensureInitialized();

    let filtered = [...this.entries];

    // Exclude soft-deleted entries by default (unless explicitly requested for audit)
    if (!filter?.includeDeleted) {
      filtered = filtered.filter((e) => !e.deletedAt);
    }

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

  /**
   * Get detailed information (body/headers) for an error by ID
   */
  async getErrorDetails(errorId: string) {
    return errorDetailsStorage.getErrorDetails(errorId);
  }

  async deleteErrors(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const idSet = new Set(ids);
    const now = new Date().toISOString();

    // Soft-delete: mark with deletedAt timestamp instead of removing
    this.entries = this.entries.map((e) =>
      idSet.has(e.id) ? { ...e, deletedAt: now } : e,
    );

    // Persist the soft-delete markers
    await this.persistEntries();

    if (isDevelopment) {
      console.log(
        `[ApiErrorLoggerService] Soft-deleted ${ids.length} entries. Will be permanently removed after ${AUDIT_TRAIL_RETENTION_DAYS} days.`,
      );
    }
  }

  async clearAll(): Promise<void> {
    await this.ensureInitialized();

    const allIds = this.entries.map((e) => e.id);
    const now = new Date().toISOString();

    // Soft-delete all entries instead of hard-deleting
    this.entries = this.entries.map((e) => ({ ...e, deletedAt: now }));

    await this.persistEntries();

    if (isDevelopment) {
      console.log(
        `[ApiErrorLoggerService] Soft-deleted all ${allIds.length} entries. Will be permanently removed after ${AUDIT_TRAIL_RETENTION_DAYS} days.`,
      );
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

    // Also clear old entries from ErrorDetailsStorage
    await errorDetailsStorage.deleteOldErrorDetails(retentionDays);

    // Hard-delete entries after retention window
    this.entries = this.entries.filter((e) => !oldIds.includes(e.id));

    for (const id of oldIds) {
      try {
        await storageAdapter.removeItem(getStorageKey(id));
        await errorDetailsStorage.deleteErrorDetails(id);
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiErrorLoggerService] Failed to hard-delete old entry ${id}.`,
            error,
          );
        }
      }
    }

    await this.persistEntries();
    return oldIds.length;
  }

  /**
   * Performs periodic cleanup:
   * 1. Soft-deleted entries older than AUDIT_TRAIL_RETENTION_DAYS are permanently removed
   * 2. Active entries older than apiErrorLoggerRetentionDays are deleted
   *
   * Called automatically every 15 minutes when app is in foreground.
   * @private
   */
  private async performPeriodicCleanup(): Promise<void> {
    try {
      const settings = useSettingsStore.getState();

      if (!settings.apiErrorLoggerEnabled) {
        return; // Skip cleanup if disabled
      }

      // Remove permanently soft-deleted entries that are past audit trail retention
      const auditCutoffTime = new Date();
      auditCutoffTime.setDate(
        auditCutoffTime.getDate() - AUDIT_TRAIL_RETENTION_DAYS,
      );

      const entriesForHardDelete = this.entries.filter(
        (e) => e.deletedAt && new Date(e.deletedAt) < auditCutoffTime,
      );

      if (entriesForHardDelete.length > 0) {
        const hardDeleteIds = entriesForHardDelete.map((e) => e.id);
        this.entries = this.entries.filter(
          (e) => !hardDeleteIds.includes(e.id),
        );

        for (const id of hardDeleteIds) {
          try {
            await storageAdapter.removeItem(getStorageKey(id));
            await errorDetailsStorage.deleteErrorDetails(id);
          } catch (error) {
            if (isDevelopment) {
              console.warn(
                `[ApiErrorLoggerService] Failed to hard-delete audit-expired entry ${id}.`,
                error,
              );
            }
          }
        }

        await this.persistEntries();

        if (isDevelopment) {
          console.log(
            `[ApiErrorLoggerService] Permanently removed ${hardDeleteIds.length} audit-expired entries.`,
          );
        }
      }

      // Remove active entries past retention window
      const removed = await this.clearOldEntries(
        settings.apiErrorLoggerRetentionDays,
      );

      if (isDevelopment && removed > 0) {
        console.log(
          `[ApiErrorLoggerService] Cleaned up ${removed} expired active entries.`,
        );
      }
    } catch (error) {
      if (isDevelopment) {
        console.error(
          "[ApiErrorLoggerService] Periodic cleanup failed.",
          error,
        );
      }
    }
  }

  /**
   * Size-based eviction using LRU strategy
   * Triggered when entries reach 95% of MAX_ENTRIES
   * Removes oldest 10% of entries to reduce memory pressure
   * @private
   */
  private async evictIfNeeded(): Promise<void> {
    const evictionThreshold = Math.floor(
      MAX_ENTRIES * SIZE_BASED_EVICTION_THRESHOLD,
    );

    if (this.entries.length >= evictionThreshold) {
      // Calculate how many entries to remove (10% of max)
      const entriesToRemove = Math.floor(MAX_ENTRIES * 0.1);
      const idsToRemove = this.entries
        .slice(0, entriesToRemove)
        .map((e) => e.id);

      this.entries = this.entries.slice(entriesToRemove);

      // Clean up details storage for removed entries
      for (const id of idsToRemove) {
        try {
          await errorDetailsStorage.deleteErrorDetails(id);
        } catch (error) {
          if (isDevelopment) {
            console.warn(
              `[ApiErrorLoggerService] Failed to clean up details for evicted entry ${id}.`,
              error,
            );
          }
        }
      }

      if (isDevelopment) {
        console.log(
          `[ApiErrorLoggerService] LRU eviction: removed ${entriesToRemove} entries to reduce memory pressure. Current count: ${this.entries.length}`,
        );
      }

      await this.persistEntries();
    }
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
