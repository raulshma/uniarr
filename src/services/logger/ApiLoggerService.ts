import { storageAdapter } from "@/services/storage/StorageAdapter";
import { storageInitPromise } from "@/services/storage/MMKVStorage";
import { errorDetailsStorage } from "@/services/storage/ErrorDetailsStorage";
import { useSettingsStore } from "@/store/settingsStore";
import type {
  ApiErrorLogEntry,
  ApiErrorLogFilter,
  GroupedErrorStats,
  HistogramData,
  AiApiLogEntry,
  AiApiLogFilter,
  AiLogStats,
  AiHistogramData,
} from "@/models/apiLogger.types";
import type { ApiError, ErrorContext } from "@/utils/error.utils";

const ERROR_STORAGE_PREFIX = "ApiLoggerError";
const AI_STORAGE_PREFIX = "ApiLoggerAi";
const ERROR_INDEX_KEY = `${ERROR_STORAGE_PREFIX}_index`;
const AI_INDEX_KEY = `${AI_STORAGE_PREFIX}_index`;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ERROR_ENTRIES = 10_000;
const MAX_AI_ENTRIES = 5_000;
const ERROR_AUDIT_TRAIL_RETENTION_DAYS = 30;
const ERROR_SIZE_BASED_EVICTION_THRESHOLD = 0.95;
const AI_SIZE_BASED_EVICTION_THRESHOLD = 0.95;
const AI_TEXT_TRUNCATE_MAX = 7_500; // Soft-limit prompt/response payloads

const isDevelopment = typeof __DEV__ !== "undefined" && __DEV__;

const createEntryId = (): string =>
  `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const getErrorStorageKey = (id: string): string =>
  `${ERROR_STORAGE_PREFIX}_${id}`;

const getAiStorageKey = (id: string): string => `${AI_STORAGE_PREFIX}_${id}`;

type PersistKind = "error" | "ai";

class ApiLoggerService {
  private static instance: ApiLoggerService | null = null;

  private errorEntries: ApiErrorLogEntry[] = [];

  private aiEntries: AiApiLogEntry[] = [];

  private isInitialized = false;

  private pendingPersists: Record<PersistKind, Promise<void> | null> = {
    error: null,
    ai: null,
  };

  private cleanupTimer: NodeJS.Timeout | null = null;

  private isRunning = false;

  static getInstance(): ApiLoggerService {
    if (!ApiLoggerService.instance) {
      ApiLoggerService.instance = new ApiLoggerService();
    }

    return ApiLoggerService.instance;
  }

  /**
   * Start the logger service (enables periodic cleanup)
   * Called when app comes to foreground via AppState listener
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    const settings = useSettingsStore.getState();
    if (!settings.apiLoggerEnabled && !settings.apiLoggerAiLoggingEnabled) {
      if (isDevelopment) {
        console.log(
          "[ApiLoggerService] Skipping start – all logging features disabled.",
        );
      }
      return;
    }

    await this.ensureInitialized();

    this.isRunning = true;

    await this.performPeriodicCleanup();

    this.cleanupTimer = setInterval(() => {
      void this.performPeriodicCleanup();
    }, CLEANUP_INTERVAL_MS);

    if (isDevelopment) {
      console.log(
        "[ApiLoggerService] Started with periodic cleanup every 15 minutes.",
      );
    }
  }

  /**
   * Stop the logger service (cancels periodic cleanup)
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
      console.log("[ApiLoggerService] Stopped periodic cleanup.");
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

    try {
      this.errorEntries = await this.loadEntries<ApiErrorLogEntry>(
        ERROR_INDEX_KEY,
        ERROR_STORAGE_PREFIX,
      );
    } catch (error) {
      if (isDevelopment) {
        console.error(
          "[ApiLoggerService] Failed to load persisted error entries.",
          error,
        );
      }
      this.errorEntries = [];
    }

    try {
      this.aiEntries = await this.loadEntries<AiApiLogEntry>(
        AI_INDEX_KEY,
        AI_STORAGE_PREFIX,
      );
    } catch (error) {
      if (isDevelopment) {
        console.error(
          "[ApiLoggerService] Failed to load persisted AI log entries.",
          error,
        );
      }
      this.aiEntries = [];
    }

    this.isInitialized = true;
  }

  private async loadEntries<T>(
    indexKey: string,
    storagePrefix: string,
  ): Promise<T[]> {
    const indexData = await storageAdapter.getItem(indexKey);
    if (!indexData) {
      return [];
    }

    const index = JSON.parse(indexData) as string[];
    const loadedEntries: T[] = [];

    for (const id of index) {
      const entryData = await storageAdapter.getItem(`${storagePrefix}_${id}`);
      if (!entryData) {
        continue;
      }

      try {
        loadedEntries.push(JSON.parse(entryData) as T);
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiLoggerService] Failed to parse entry ${id} from ${storagePrefix}.`,
            error,
          );
        }
      }
    }

    return loadedEntries;
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

    if (details) {
      const settings = useSettingsStore.getState();
      const hasContent =
        (settings.apiLoggerCaptureRequestBody && details.requestBody) ||
        (settings.apiLoggerCaptureResponseBody && details.responseBody) ||
        (settings.apiLoggerCaptureRequestHeaders && details.requestHeaders);

      if (hasContent) {
        const capturedDetails = {
          requestBody: settings.apiLoggerCaptureRequestBody
            ? details.requestBody
            : undefined,
          responseBody: settings.apiLoggerCaptureResponseBody
            ? details.responseBody
            : undefined,
          requestHeaders: settings.apiLoggerCaptureRequestHeaders
            ? details.requestHeaders
            : undefined,
        };

        void errorDetailsStorage.storeErrorDetails(id, capturedDetails);
      }
    }

    this.errorEntries = [...this.errorEntries, entry].slice(-MAX_ERROR_ENTRIES);

    await this.evictErrorEntriesIfNeeded();
    await this.persistErrorEntries();
  }

  async getErrors(filter?: ApiErrorLogFilter): Promise<ApiErrorLogEntry[]> {
    await this.ensureInitialized();

    let filtered = [...this.errorEntries];

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

  async getErrorDetails(errorId: string) {
    return errorDetailsStorage.getErrorDetails(errorId);
  }

  async deleteErrors(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const idSet = new Set(ids);
    const now = new Date().toISOString();

    this.errorEntries = this.errorEntries.map((e) =>
      idSet.has(e.id) ? { ...e, deletedAt: now } : e,
    );

    await this.persistErrorEntries();

    if (isDevelopment) {
      console.log(
        `[ApiLoggerService] Soft-deleted ${ids.length} error entries.`,
      );
    }
  }

  async clearAllErrors(): Promise<void> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    this.errorEntries = this.errorEntries.map((e) => ({
      ...e,
      deletedAt: now,
    }));

    await this.persistErrorEntries();

    if (isDevelopment) {
      console.log(
        `[ApiLoggerService] Soft-deleted all ${this.errorEntries.length} error entries.`,
      );
    }
  }

  async clearAll(): Promise<void> {
    await this.clearAllErrors();
  }

  async clearOldErrorEntries(retentionDays: number): Promise<number> {
    await this.ensureInitialized();

    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - retentionDays);

    const oldEntries = this.errorEntries.filter(
      (e) => new Date(e.timestamp) < cutoffTime,
    );
    const oldIds = oldEntries.map((e) => e.id);

    if (oldIds.length === 0) {
      return 0;
    }

    await errorDetailsStorage.deleteOldErrorDetails(retentionDays);

    this.errorEntries = this.errorEntries.filter((e) => !oldIds.includes(e.id));

    for (const id of oldIds) {
      try {
        await storageAdapter.removeItem(getErrorStorageKey(id));
        await errorDetailsStorage.deleteErrorDetails(id);
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiLoggerService] Failed to hard-delete old error entry ${id}.`,
            error,
          );
        }
      }
    }

    await this.persistErrorEntries();
    return oldIds.length;
  }

  private async performPeriodicCleanup(): Promise<void> {
    try {
      const settings = useSettingsStore.getState();

      if (!settings.apiLoggerEnabled && !settings.apiLoggerAiLoggingEnabled) {
        return;
      }

      if (settings.apiLoggerEnabled) {
        await this.cleanupErrors(settings.apiLoggerRetentionDays);
      }

      if (settings.apiLoggerAiLoggingEnabled) {
        await this.cleanupAiLogs(settings.apiLoggerAiRetentionDays);
      }
    } catch (error) {
      if (isDevelopment) {
        console.error("[ApiLoggerService] Periodic cleanup failed.", error);
      }
    }
  }

  private async cleanupErrors(retentionDays: number): Promise<void> {
    const auditCutoffTime = new Date();
    auditCutoffTime.setDate(
      auditCutoffTime.getDate() - ERROR_AUDIT_TRAIL_RETENTION_DAYS,
    );

    const entriesForHardDelete = this.errorEntries.filter(
      (e) => e.deletedAt && new Date(e.deletedAt) < auditCutoffTime,
    );

    if (entriesForHardDelete.length > 0) {
      const hardDeleteIds = entriesForHardDelete.map((e) => e.id);
      this.errorEntries = this.errorEntries.filter(
        (e) => !hardDeleteIds.includes(e.id),
      );

      for (const id of hardDeleteIds) {
        try {
          await storageAdapter.removeItem(getErrorStorageKey(id));
          await errorDetailsStorage.deleteErrorDetails(id);
        } catch (error) {
          if (isDevelopment) {
            console.warn(
              `[ApiLoggerService] Failed to hard-delete audit-expired error entry ${id}.`,
              error,
            );
          }
        }
      }

      await this.persistErrorEntries();

      if (isDevelopment) {
        console.log(
          `[ApiLoggerService] Permanently removed ${hardDeleteIds.length} audit-expired error entries.`,
        );
      }
    }

    const removed = await this.clearOldErrorEntries(retentionDays);

    if (isDevelopment && removed > 0) {
      console.log(
        `[ApiLoggerService] Cleaned up ${removed} expired error entries.`,
      );
    }
  }

  private async cleanupAiLogs(retentionDays: number): Promise<void> {
    await this.ensureInitialized();

    if (retentionDays <= 0) {
      return;
    }

    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - retentionDays);

    const removedIds: string[] = [];
    this.aiEntries = this.aiEntries.filter((entry) => {
      if (entry.deletedAt && new Date(entry.deletedAt) < cutoffTime) {
        removedIds.push(entry.id);
        return false;
      }

      if (!entry.deletedAt && new Date(entry.timestamp) < cutoffTime) {
        removedIds.push(entry.id);
        return false;
      }

      return true;
    });

    if (removedIds.length === 0) {
      return;
    }

    for (const id of removedIds) {
      try {
        await storageAdapter.removeItem(getAiStorageKey(id));
      } catch (error) {
        if (isDevelopment) {
          console.warn(
            `[ApiLoggerService] Failed to remove AI log entry ${id} during retention cleanup.`,
            error,
          );
        }
      }
    }

    await this.persistAiEntries();

    if (isDevelopment) {
      console.log(
        `[ApiLoggerService] Cleaned up ${removedIds.length} AI log entries older than ${retentionDays} days.`,
      );
    }
  }

  private async evictErrorEntriesIfNeeded(): Promise<void> {
    const evictionThreshold = Math.floor(
      MAX_ERROR_ENTRIES * ERROR_SIZE_BASED_EVICTION_THRESHOLD,
    );

    if (this.errorEntries.length >= evictionThreshold) {
      const entriesToRemove = Math.floor(MAX_ERROR_ENTRIES * 0.1);
      const idsToRemove = this.errorEntries
        .slice(0, entriesToRemove)
        .map((e) => e.id);

      this.errorEntries = this.errorEntries.slice(entriesToRemove);

      for (const id of idsToRemove) {
        try {
          await errorDetailsStorage.deleteErrorDetails(id);
        } catch (error) {
          if (isDevelopment) {
            console.warn(
              `[ApiLoggerService] Failed to clean up details for evicted error entry ${id}.`,
              error,
            );
          }
        }
      }

      if (isDevelopment) {
        console.log(
          `[ApiLoggerService] LRU eviction: removed ${entriesToRemove} error entries. Current count: ${this.errorEntries.length}`,
        );
      }

      await this.persistErrorEntries();
    }
  }

  private async evictAiEntriesIfNeeded(): Promise<void> {
    const evictionThreshold = Math.floor(
      MAX_AI_ENTRIES * AI_SIZE_BASED_EVICTION_THRESHOLD,
    );

    if (this.aiEntries.length >= evictionThreshold) {
      const entriesToRemove = Math.floor(MAX_AI_ENTRIES * 0.1);
      const idsToRemove = this.aiEntries
        .slice(0, entriesToRemove)
        .map((e) => e.id);

      this.aiEntries = this.aiEntries.slice(entriesToRemove);

      if (isDevelopment) {
        console.log(
          `[ApiLoggerService] LRU eviction: removed ${entriesToRemove} AI entries. Current count: ${this.aiEntries.length}`,
        );
      }

      for (const id of idsToRemove) {
        try {
          await storageAdapter.removeItem(getAiStorageKey(id));
        } catch (error) {
          if (isDevelopment) {
            console.warn(
              `[ApiLoggerService] Failed to remove AI entry ${id} during eviction.`,
              error,
            );
          }
        }
      }

      await this.persistAiEntries();
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
      total: this.errorEntries.filter((entry) => !entry.deletedAt).length,
    };

    for (const entry of this.errorEntries) {
      if (entry.deletedAt) {
        continue;
      }

      stats.byService.set(
        entry.serviceId,
        (stats.byService.get(entry.serviceId) ?? 0) + 1,
      );

      const codeKey = entry.statusCode ?? entry.errorCode ?? "Unknown";
      stats.byStatusCode.set(
        codeKey,
        (stats.byStatusCode.get(codeKey) ?? 0) + 1,
      );

      stats.byEndpoint.set(
        entry.endpoint,
        (stats.byEndpoint.get(entry.endpoint) ?? 0) + 1,
      );

      const dateStr = entry.timestamp.split("T")[0];
      if (dateStr) {
        stats.byDate.set(dateStr, (stats.byDate.get(dateStr) ?? 0) + 1);
      }

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
    return JSON.stringify(this.errorEntries, null, 2);
  }

  getEntriesSync(): ApiErrorLogEntry[] {
    return [...this.errorEntries];
  }

  async addAiCall(entry: {
    provider: string;
    model?: string;
    operation: string;
    status: "success" | "error";
    prompt?: string;
    response?: string;
    metadata?: AiApiLogEntry["metadata"];
    errorMessage?: string;
    durationMs?: number;
    serviceId?: string;
    tags?: string[];
  }): Promise<void> {
    await this.ensureInitialized();

    const settings = useSettingsStore.getState();
    if (!settings.apiLoggerAiLoggingEnabled) {
      return;
    }

    const id = createEntryId();
    const timestamp = new Date().toISOString();

    const sanitizedPrompt = settings.apiLoggerAiCapturePrompt
      ? truncateText(entry.prompt)
      : undefined;

    const sanitizedResponse = settings.apiLoggerAiCaptureResponse
      ? truncateText(entry.response)
      : undefined;

    const sanitizedMetadata = settings.apiLoggerAiCaptureMetadata
      ? entry.metadata
      : undefined;

    const aiEntry: AiApiLogEntry = {
      id,
      timestamp,
      provider: entry.provider,
      model: entry.model,
      operation: entry.operation,
      status: entry.status,
      prompt: sanitizedPrompt,
      response: sanitizedResponse,
      metadata: sanitizedMetadata,
      errorMessage: entry.errorMessage,
      durationMs: entry.durationMs,
      serviceId: entry.serviceId,
      tags: entry.tags,
      settingsSnapshot: {
        capturePrompt: settings.apiLoggerAiCapturePrompt,
        captureResponse: settings.apiLoggerAiCaptureResponse,
        captureMetadata: settings.apiLoggerAiCaptureMetadata,
      },
    };

    this.aiEntries = [...this.aiEntries, aiEntry].slice(-MAX_AI_ENTRIES);

    await this.evictAiEntriesIfNeeded();
    await this.persistAiEntries();
  }

  async getAiLogs(filter?: AiApiLogFilter): Promise<AiApiLogEntry[]> {
    await this.ensureInitialized();

    let filtered = [...this.aiEntries];

    if (!filter?.includeDeleted) {
      filtered = filtered.filter((entry) => !entry.deletedAt);
    }

    if (filter?.provider) {
      filtered = filtered.filter((entry) => entry.provider === filter.provider);
    }

    if (filter?.model) {
      filtered = filtered.filter((entry) => entry.model === filter.model);
    }

    if (filter?.operation) {
      filtered = filtered.filter(
        (entry) => entry.operation === filter.operation,
      );
    }

    if (filter?.status) {
      filtered = filtered.filter((entry) => entry.status === filter.status);
    }

    if (filter?.startDate) {
      const start = filter.startDate.getTime();
      filtered = filtered.filter(
        (entry) => new Date(entry.timestamp).getTime() >= start,
      );
    }

    if (filter?.endDate) {
      const end = filter.endDate.getTime();
      filtered = filtered.filter(
        (entry) => new Date(entry.timestamp).getTime() <= end,
      );
    }

    if (filter?.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter((entry) => {
        const haystacks = [
          entry.provider,
          entry.model,
          entry.operation,
          entry.prompt,
          entry.response,
          entry.errorMessage,
        ]
          .filter(Boolean)
          .map((value) => value!.toLowerCase());

        return haystacks.some((value) => value.includes(search));
      });
    }

    return filtered;
  }

  async deleteAiLogs(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    const idSet = new Set(ids);
    const now = new Date().toISOString();

    this.aiEntries = this.aiEntries.map((entry) =>
      idSet.has(entry.id) ? { ...entry, deletedAt: now } : entry,
    );

    await this.persistAiEntries();
  }

  async clearAllAiLogs(): Promise<void> {
    await this.ensureInitialized();

    const now = new Date().toISOString();
    this.aiEntries = this.aiEntries.map((entry) => ({
      ...entry,
      deletedAt: now,
    }));

    await this.persistAiEntries();
  }

  async exportAiLogsAsJson(): Promise<string> {
    await this.ensureInitialized();
    return JSON.stringify(this.aiEntries, null, 2);
  }

  async getAiStats(): Promise<AiLogStats> {
    await this.ensureInitialized();

    const stats: AiLogStats = {
      total: 0,
      success: 0,
      failure: 0,
      byProvider: new Map(),
      byModel: new Map(),
      byOperation: new Map(),
      tokenUsage: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      lastCallAt: undefined,
    };

    for (const entry of this.aiEntries) {
      if (entry.deletedAt) {
        continue;
      }

      stats.total++;
      if (entry.status === "success") {
        stats.success++;
      } else {
        stats.failure++;
      }

      stats.byProvider.set(
        entry.provider,
        (stats.byProvider.get(entry.provider) ?? 0) + 1,
      );

      if (entry.model) {
        stats.byModel.set(
          entry.model,
          (stats.byModel.get(entry.model) ?? 0) + 1,
        );
      }

      stats.byOperation.set(
        entry.operation,
        (stats.byOperation.get(entry.operation) ?? 0) + 1,
      );

      if (entry.metadata?.tokenUsage) {
        stats.tokenUsage.prompt += entry.metadata.tokenUsage.promptTokens ?? 0;
        stats.tokenUsage.completion +=
          entry.metadata.tokenUsage.completionTokens ?? 0;
        stats.tokenUsage.total += entry.metadata.tokenUsage.totalTokens ?? 0;
      }

      if (!stats.lastCallAt) {
        stats.lastCallAt = entry.timestamp;
      } else if (new Date(entry.timestamp) > new Date(stats.lastCallAt)) {
        stats.lastCallAt = entry.timestamp;
      }
    }

    return stats;
  }

  async getAiProviderHistogram(): Promise<AiHistogramData[]> {
    await this.ensureInitialized();

    const map = new Map<string, number>();

    for (const entry of this.aiEntries) {
      if (entry.deletedAt) {
        continue;
      }
      map.set(entry.provider, (map.get(entry.provider) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  async getAiOperationHistogram(): Promise<AiHistogramData[]> {
    await this.ensureInitialized();

    const map = new Map<string, number>();

    for (const entry of this.aiEntries) {
      if (entry.deletedAt) {
        continue;
      }
      map.set(entry.operation, (map.get(entry.operation) ?? 0) + 1);
    }

    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  private async persistErrorEntries(): Promise<void> {
    await this.persistEntries("error", this.errorEntries, ERROR_INDEX_KEY);
  }

  private async persistAiEntries(): Promise<void> {
    await this.persistEntries("ai", this.aiEntries, AI_INDEX_KEY);
  }

  private async persistEntries<T extends { id: string }>(
    kind: PersistKind,
    entries: T[],
    indexKey: string,
  ): Promise<void> {
    const write = async (): Promise<void> => {
      try {
        const index = entries.map((e) => e.id);
        await storageAdapter.setItem(indexKey, JSON.stringify(index));

        for (const entry of entries) {
          const storageKey =
            kind === "error"
              ? getErrorStorageKey(entry.id)
              : getAiStorageKey(entry.id);
          await storageAdapter.setItem(storageKey, JSON.stringify(entry));
        }
      } catch (err: unknown) {
        if (isDevelopment) {
          console.error(
            `[ApiLoggerService] Failed to persist ${kind} entries.`,
            err,
          );
        }
      }
    };

    if (!this.pendingPersists[kind]) {
      this.pendingPersists[kind] = write();
      try {
        await this.pendingPersists[kind];
      } finally {
        this.pendingPersists[kind] = null;
      }
      return;
    }

    this.pendingPersists[kind] = this.pendingPersists[kind]!.then(() =>
      write(),
    );
    try {
      await this.pendingPersists[kind];
    } finally {
      this.pendingPersists[kind] = null;
    }
  }
}

const truncateText = (value?: string): string | undefined => {
  if (!value) {
    return value;
  }

  if (value.length <= AI_TEXT_TRUNCATE_MAX) {
    return value;
  }

  return `${value.slice(0, AI_TEXT_TRUNCATE_MAX)}…`;
};

export const apiLogger = ApiLoggerService.getInstance();
