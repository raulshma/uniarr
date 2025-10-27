import AsyncStorage from "@react-native-async-storage/async-storage";
// Use legacy FileSystem API to avoid deprecation warnings for getInfoAsync.
// TODO: migrate to the new File/Directory API from `expo-file-system` to remove
// the legacy dependency and use the modern APIs for file info and operations.
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";

import { logger } from "@/services/logger/LoggerService";
import { useSettingsStore } from "@/store/settingsStore";

export type ImageCacheUsage = {
  size: number;
  fileCount: number;
  formattedSize: string;
};

export interface CacheFileInfo {
  uri: string;
  path: string;
  size: number;
  modifiedAt: number;
  service?: string;
  type: "poster" | "fanart" | "thumbnail" | "other";
  format: string;
  formattedSize: string;
  age: number; // in milliseconds
  ageFormatted: string;
}

export interface CacheAnalysis {
  totalSize: number;
  fileCount: number;
  formattedSize: string;
  byService: Record<
    string,
    { size: number; count: number; percentage: number }
  >;
  byType: Record<string, { size: number; count: number; percentage: number }>;
  byAge: {
    fresh: { size: number; count: number; percentage: number }; // < 1 day
    recent: { size: number; count: number; percentage: number }; // 1-7 days
    old: { size: number; count: number; percentage: number }; // 7-30 days
    stale: { size: number; count: number; percentage: number }; // > 30 days
  };
  averageFileSize: number;
  oldestFile: number;
  newestFile: number;
}

export type CacheSortField =
  | "name"
  | "size"
  | "date"
  | "service"
  | "type"
  | "age";
export type CacheFilterOptions = {
  services?: string[];
  types?: string[];
  ageRange?: { min: number; max: number }; // in days
  sizeRange?: { min: number; max: number }; // in bytes
  searchTerm?: string;
};

const STORAGE_KEY = "ImageCacheService:trackedUris";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class ImageCacheService {
  private static instance: ImageCacheService | null = null;

  private trackedUris: Set<string> = new Set();
  private isInitialized = false;
  private inFlightPrefetches = new Map<string, Promise<string | null>>();
  private prefetchQueue: string[] = [];
  private queuedPrefetches = new Set<string>();
  private isProcessingQueue = false;
  private memoryCacheHits = 0;
  private diskCacheHits = 0;
  private cacheMisses = 0;

  static getInstance(): ImageCacheService {
    if (!ImageCacheService.instance) {
      ImageCacheService.instance = new ImageCacheService();
    }

    return ImageCacheService.instance;
  }

  /**
   * Resolve a remote image URL to a cached local URI when available.
   * Falls back to the original URL when caching is not possible.
   */
  async resolveUri(uri: string): Promise<string> {
    await this.ensureInitialized();

    if (!uri) {
      return uri;
    }

    try {
      const cachedPath = await this.getCachedPath(uri);
      if (cachedPath) {
        this.trackUri(uri);
        this.diskCacheHits++;
        return cachedPath;
      }

      // Check if image is in memory cache (fast path)
      const memoryCachePath = await this.checkMemoryCache(uri);
      if (memoryCachePath) {
        this.trackUri(uri);
        this.memoryCacheHits++;
        return memoryCachePath;
      }

      const localPath = await this.prefetchInternal(uri);
      if (localPath) {
        this.trackUri(uri);
        return localPath;
      }

      this.cacheMisses++;
    } catch (error) {
      void logger.warn(
        "ImageCacheService: resolveUri failed, falling back to remote URI.",
        {
          uri,
          error: this.stringifyError(error),
        },
      );
    }

    // If the image couldn't be resolved to a cached path, check whether the
    // URI belongs to one of our registered connectors and, if so, append an
    // apikey query parameter so the native image loader can authenticate the
    // request. This mirrors the behavior used when prefetching images.
    try {
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      for (const connector of connectors) {
        try {
          const base = connector.config.url.replace(/\/+$/, "");
          if (uri.startsWith(base) && connector.config.apiKey) {
            const parsed = new URL(uri);
            if (!parsed.searchParams.has("apikey")) {
              parsed.searchParams.set("apikey", connector.config.apiKey);
              return parsed.toString();
            }
          }
        } catch {
          // ignore URL parsing errors
        }
      }
    } catch {
      // ignore failures looking up connectors
    }

    return uri;
  }

  /**
   * Resolve a URI for a target display size (CSS points). This will attempt to
   * return a cached resized thumbnail appropriate for the device pixel ratio
   * and requested size. Falls back to resolveUri when resizing isn't possible.
   */
  async resolveForSize(
    uri: string,
    widthPx: number,
    heightPx: number,
  ): Promise<string> {
    await this.ensureInitialized();

    if (!uri) return uri;
    // Thumbnail generation removed — always resolve to original/cached URI
    return this.resolveUri(uri);
  }

  /**
   * Prefetch one or many image URLs into the Expo Image disk cache.
   */
  async prefetch(urls: string | string[]): Promise<void> {
    const targetUrls = Array.isArray(urls) ? urls.filter(Boolean) : [urls];
    if (!targetUrls.length) {
      return;
    }

    await this.ensureInitialized();

    await Promise.all(
      targetUrls.map(async (url) => {
        try {
          const localPath = await this.prefetchInternal(url);
          if (localPath) {
            this.trackUri(url);
          }
        } catch (error) {
          void logger.warn("ImageCacheService: prefetch failed.", {
            uri: url,
            error: this.stringifyError(error),
          });
        }
      }),
    );
  }

  /**
   * Enforce cache size limits by removing oldest files when exceeding max size.
   */
  async enforceCacheLimit(maxSizeBytes: number): Promise<void> {
    await this.ensureInitialized();

    try {
      const usage = await this.getCacheUsage();

      if (usage.size <= maxSizeBytes) {
        // Cache is within limits, no cleanup needed
        return;
      }

      const bytesToFree = usage.size - maxSizeBytes;
      void logger.info(
        `ImageCacheService: cache exceeds limit, freeing ${ImageCacheService.formatBytes(bytesToFree)}`,
      );

      // Get all cache files sorted by modification time (oldest first)
      const cacheFiles = await this.getCacheFilesSortedByAge();

      let freedBytes = 0;
      const filesToDelete: string[] = [];

      // Select oldest files to delete until we've freed enough space
      for (const { path, size } of cacheFiles) {
        if (freedBytes >= bytesToFree) {
          break;
        }

        filesToDelete.push(path);
        freedBytes += size;
      }

      // Delete selected files
      await Promise.allSettled(
        filesToDelete.map(async (path) => {
          try {
            await FileSystem.deleteAsync(path, { idempotent: true });
            void logger.debug(
              "ImageCacheService: deleted file during cache cleanup",
              { path },
            );
          } catch (error) {
            void logger.warn(
              "ImageCacheService: failed to delete file during cache cleanup",
              {
                path,
                error: this.stringifyError(error),
              },
            );
          }
        }),
      );

      void logger.info(
        `ImageCacheService: freed ${ImageCacheService.formatBytes(freedBytes)} by deleting ${filesToDelete.length} files`,
      );
    } catch (error) {
      void logger.error("ImageCacheService: failed to enforce cache limit", {
        error: this.stringifyError(error),
        maxSize: maxSizeBytes,
      });
    }
  }

  /**
   * Get cache files sorted by modification time (oldest first).
   */
  private async getCacheFilesSortedByAge(): Promise<
    { path: string; size: number; modifiedAt: number }[]
  > {
    const files: { path: string; size: number; modifiedAt: number }[] = [];

    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return files;

      const entries = await FileSystem.readDirectoryAsync(cacheDir);
      if (!Array.isArray(entries)) return files;

      const imageExtRegex = /\.(jpg|jpeg|png|webp|gif|bmp|img)$/i;

      for (const name of entries) {
        if (typeof name !== "string") continue;

        if (imageExtRegex.test(name) || name.startsWith("image-")) {
          const path = `${cacheDir}${name}`;

          try {
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists && !info.isDirectory && info.size) {
              const modifiedAt = info.modificationTime
                ? info.modificationTime * 1000
                : Date.now();
              files.push({
                path,
                size: info.size,
                modifiedAt,
              });
            }
          } catch {
            // Ignore errors reading file info
          }
        }
      }

      // Sort by modification time (oldest first)
      files.sort((a, b) => a.modifiedAt - b.modifiedAt);
    } catch (error) {
      void logger.warn("ImageCacheService: failed to scan cache directory", {
        error: this.stringifyError(error),
      });
    }

    return files;
  }

  /**
   * Check if image is available in expo-image memory cache
   */
  private async checkMemoryCache(uri: string): Promise<string | null> {
    try {
      // expo-image doesn't expose direct memory cache access, but we can check
      // if it can provide a cache path immediately (indicating it's in memory)
      const cachePath = await Image.getCachePathAsync(uri);
      return cachePath;
    } catch {
      return null;
    }
  }

  /**
   * Smart prefetching for lists - prefetch visible and nearby items
   */
  async prefetchList(
    urls: string[],
    options: {
      visibleRange?: { start: number; end: number };
      priority?: "immediate" | "low" | "background";
      maxConcurrent?: number;
    } = {},
  ): Promise<void> {
    const { visibleRange, priority = "low", maxConcurrent = 3 } = options;

    if (!urls.length) return;

    // Prioritize visible items
    let urlsToPrefetch: string[] = [];
    if (visibleRange) {
      // Add visible items immediately
      urlsToPrefetch.push(
        ...urls.slice(visibleRange.start, visibleRange.end + 1),
      );

      // Add nearby items (next 3, previous 1)
      const beforeStart = Math.max(0, visibleRange.start - 1);
      const afterEnd = Math.min(urls.length, visibleRange.end + 4);

      urlsToPrefetch.push(
        ...urls.slice(beforeStart, visibleRange.start),
        ...urls.slice(visibleRange.end + 1, afterEnd),
      );
    } else {
      urlsToPrefetch = urls;
    }

    // Remove duplicates and filter invalid URLs
    const uniqueUrls = [...new Set(urlsToPrefetch.filter(Boolean))];

    if (priority === "immediate") {
      // High priority - prefetch immediately with higher concurrency
      await this.prefetchConcurrent(uniqueUrls, maxConcurrent * 2);
    } else {
      // Low priority - add to queue for background processing
      this.addToPrefetchQueue(uniqueUrls);
    }
  }

  /**
   * Concurrent prefetching with limit
   */
  private async prefetchConcurrent(
    urls: string[],
    concurrency: number,
  ): Promise<void> {
    const chunks: string[][] = [];
    for (let i = 0; i < urls.length; i += concurrency) {
      chunks.push(urls.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map((url) =>
          this.prefetch(url).catch((error) => {
            void logger.debug("Prefetch failed for URL", {
              url,
              error: this.stringifyError(error),
            });
          }),
        ),
      );
    }
  }

  /**
   * Add URLs to background prefetch queue
   */
  private addToPrefetchQueue(urls: string[]): void {
    let addedAny = false;

    for (const url of urls) {
      if (!url) {
        continue;
      }

      if (this.queuedPrefetches.has(url) || this.inFlightPrefetches.has(url)) {
        continue;
      }

      this.prefetchQueue.push(url);
      this.queuedPrefetches.add(url);
      addedAny = true;
    }

    if (addedAny) {
      void this.processPrefetchQueue();
    }
  }

  /**
   * Process background prefetch queue
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.isProcessingQueue || this.prefetchQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Process queue in small batches to avoid blocking UI
      while (this.prefetchQueue.length > 0) {
        const batch = this.prefetchQueue.splice(0, 2); // Process 2 at a time

        await Promise.allSettled(
          batch.map((url) =>
            this.prefetch(url).catch((error) => {
              void logger.debug("Background prefetch failed", {
                url,
                error: this.stringifyError(error),
              });
            }),
          ),
        );

        batch.forEach((url) => this.queuedPrefetches.delete(url));

        // Small delay between batches to allow UI work
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats() {
    return {
      memoryHits: this.memoryCacheHits,
      diskHits: this.diskCacheHits,
      misses: this.cacheMisses,
      totalRequests:
        this.memoryCacheHits + this.diskCacheHits + this.cacheMisses,
      hitRate:
        this.memoryCacheHits + this.diskCacheHits > 0
          ? ((this.memoryCacheHits + this.diskCacheHits) /
              (this.memoryCacheHits + this.diskCacheHits + this.cacheMisses)) *
            100
          : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetCacheStats(): void {
    this.memoryCacheHits = 0;
    this.diskCacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get detailed cache file information for all cached files
   */
  async getDetailedCacheInfo(
    filters?: CacheFilterOptions,
    sortField: CacheSortField = "date",
    sortOrder: "asc" | "desc" = "desc",
  ): Promise<CacheFileInfo[]> {
    await this.ensureInitialized();

    const files: CacheFileInfo[] = [];
    const uris = Array.from(this.trackedUris);
    const countedPaths = new Set<string>();

    // Process tracked URIs
    await Promise.all(
      uris.map(async (uri) => {
        try {
          let cachedPath = await this.getCachedPath(uri);
          let effectiveUri = uri;

          // Try connector-aware variants if not found
          if (!cachedPath) {
            try {
              const connectors =
                ConnectorManager.getInstance().getAllConnectors();
              for (const connector of connectors) {
                try {
                  const base = connector.config.url.replace(/\/+$/, "");
                  if (uri.startsWith(base) && connector.config.apiKey) {
                    const parsed = new URL(uri);
                    if (!parsed.searchParams.has("apikey")) {
                      parsed.searchParams.set(
                        "apikey",
                        connector.config.apiKey,
                      );
                    }
                    const fetchUri = parsed.toString();
                    const altCachedPath = await this.getCachedPath(fetchUri);
                    if (altCachedPath) {
                      cachedPath = altCachedPath;
                      effectiveUri = fetchUri;
                      break;
                    }
                  }
                } catch {
                  // Ignore URL parsing / connector errors
                }
              }
            } catch {
              // Ignore failures looking up connectors
            }
          }

          if (!cachedPath || countedPaths.has(cachedPath)) {
            return;
          }

          const fileInfo = await FileSystem.getInfoAsync(cachedPath);
          if (!fileInfo.exists || fileInfo.isDirectory) {
            return;
          }

          const modifiedAt = fileInfo.modificationTime
            ? fileInfo.modificationTime * 1000
            : Date.now();
          const age = Date.now() - modifiedAt;

          if (age > CACHE_MAX_AGE_MS) {
            // Skip stale files
            return;
          }

          const cacheFileInfo = this.createCacheFileInfo(
            effectiveUri,
            cachedPath,
            fileInfo.size ?? 0,
            modifiedAt,
            age,
          );

          if (this.matchesFilters(cacheFileInfo, filters)) {
            files.push(cacheFileInfo);
          }
          countedPaths.add(cachedPath);
        } catch (error) {
          void logger.debug("Error processing cache file", {
            uri,
            error: this.stringifyError(error),
          });
        }
      }),
    );

    // Also scan for untracked files
    await this.scanUntrackedFiles(files, countedPaths, filters);

    // Sort the results
    files.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.path.localeCompare(b.path);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "date":
        case "age":
          comparison = a.modifiedAt - b.modifiedAt;
          break;
        case "service":
          comparison = (a.service || "").localeCompare(b.service || "");
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        default:
          comparison = a.modifiedAt - b.modifiedAt;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return files;
  }

  /**
   * Get comprehensive cache analysis
   */
  async getCacheAnalysis(): Promise<CacheAnalysis> {
    const files = await this.getDetailedCacheInfo();
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const fileCount = files.length;

    // Group by service
    const byService: Record<
      string,
      { size: number; count: number; percentage: number }
    > = {};
    files.forEach((file) => {
      const service = file.service || "Unknown";
      if (!byService[service]) {
        byService[service] = { size: 0, count: 0, percentage: 0 };
      }
      byService[service]!.size += file.size;
      byService[service]!.count += 1;
    });

    // Calculate percentages
    Object.values(byService).forEach((service) => {
      service.percentage = totalSize > 0 ? (service.size / totalSize) * 100 : 0;
    });

    // Group by type
    const byType: Record<
      string,
      { size: number; count: number; percentage: number }
    > = {};
    files.forEach((file) => {
      if (!byType[file.type]) {
        byType[file.type] = { size: 0, count: 0, percentage: 0 };
      }
      byType[file.type]!.size += file.size;
      byType[file.type]!.count += 1;
    });

    Object.values(byType).forEach((type) => {
      type.percentage = totalSize > 0 ? (type.size / totalSize) * 100 : 0;
    });

    // Group by age
    const byAge = {
      fresh: { size: 0, count: 0, percentage: 0 }, // < 1 day
      recent: { size: 0, count: 0, percentage: 0 }, // 1-7 days
      old: { size: 0, count: 0, percentage: 0 }, // 7-30 days
      stale: { size: 0, count: 0, percentage: 0 }, // > 30 days
    };
    const dayMs = 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const ageInDays = file.age / dayMs;
      if (ageInDays < 1) {
        byAge.fresh.size += file.size;
        byAge.fresh.count += 1;
      } else if (ageInDays < 7) {
        byAge.recent.size += file.size;
        byAge.recent.count += 1;
      } else if (ageInDays < 30) {
        byAge.old.size += file.size;
        byAge.old.count += 1;
      } else {
        byAge.stale.size += file.size;
        byAge.stale.count += 1;
      }
    });

    Object.values(byAge).forEach((category) => {
      category.percentage =
        totalSize > 0 ? (category.size / totalSize) * 100 : 0;
    });

    const timestamps = files.map((f) => f.modifiedAt);
    const oldestFile = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestFile = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalSize,
      fileCount,
      formattedSize: ImageCacheService.formatBytes(totalSize),
      byService,
      byType,
      byAge,
      averageFileSize: fileCount > 0 ? totalSize / fileCount : 0,
      oldestFile,
      newestFile,
    };
  }

  /**
   * Clear selected cache files
   */
  async clearSelectedFiles(
    filePaths: string[],
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    await Promise.allSettled(
      filePaths.map(async (path) => {
        try {
          await FileSystem.deleteAsync(path, { idempotent: true });
          success++;

          // Remove from tracked URIs
          for (const [, trackedUri] of this.trackedUris.entries()) {
            const cachedPath = await this.getCachedPath(trackedUri);
            if (cachedPath === path) {
              this.trackedUris.delete(trackedUri);
              break;
            }
          }
        } catch (error) {
          failed++;
          void logger.warn("Failed to delete cache file", {
            path,
            error: this.stringifyError(error),
          });
        }
      }),
    );

    // Persist changes to tracked URIs
    if (success > 0) {
      await this.persistTrackedUris();
    }

    return { success, failed };
  }

  /**
   * Helper method to create CacheFileInfo objects
   */
  private createCacheFileInfo(
    uri: string,
    path: string,
    size: number,
    modifiedAt: number,
    age: number,
  ): CacheFileInfo {
    const service = this.extractServiceFromUri(uri);
    const type = this.extractFileTypeFromUri(uri);
    const format = this.extractFileFormat(path);

    // For expo-image, we want to keep the raw file path without file:// prefix
    let resolvedPath = path;

    // Only add file:// prefix for absolute paths that aren't in cache directory
    if (
      path &&
      !path.startsWith("http") &&
      !path.startsWith("file://") &&
      !path.startsWith("content://")
    ) {
      // If it's not a cache file and starts with /, add file:// prefix
      if (path.startsWith("/") && !path.includes("/cache/")) {
        resolvedPath = `file://${path}`;
      }
      // For cache files and relative paths, keep them as-is for expo-image compatibility
    }

    return {
      uri,
      path: resolvedPath,
      size,
      modifiedAt,
      service,
      type,
      format,
      formattedSize: ImageCacheService.formatBytes(size),
      age,
      ageFormatted: this.formatAge(age),
    };
  }

  /**
   * Helper method to extract service name from URI
   */
  private extractServiceFromUri(uri: string): string | undefined {
    try {
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      for (const connector of connectors) {
        const base = connector.config.url.replace(/\/+$/, "");
        if (uri.startsWith(base)) {
          return connector.config.name || "Unknown Service";
        }
      }
    } catch {
      // Ignore errors
    }
    return undefined;
  }

  /**
   * Helper method to extract file type from URI
   */
  private extractFileTypeFromUri(
    uri: string,
  ): "poster" | "fanart" | "thumbnail" | "other" {
    const lowerUri = uri.toLowerCase();
    if (lowerUri.includes("poster")) return "poster";
    if (lowerUri.includes("fanart") || lowerUri.includes("backdrop"))
      return "fanart";
    if (lowerUri.includes("thumb") || lowerUri.includes("thumbnail"))
      return "thumbnail";
    return "other";
  }

  /**
   * Helper method to extract file format from path
   */
  private extractFileFormat(path: string): string {
    try {
      const match = path.match(/\.([a-z0-9]+)(?:\?|$)/i);
      return match?.[1]?.toUpperCase() || "Unknown";
    } catch {
      return "Unknown";
    }
  }

  /**
   * Helper method to format age in human readable form
   */
  private formatAge(ageMs: number): string {
    const minutes = Math.floor(ageMs / (60 * 1000));
    const hours = Math.floor(ageMs / (60 * 60 * 1000));
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  }

  /**
   * Helper method to check if file matches filters
   */
  private matchesFilters(
    file: CacheFileInfo,
    filters?: CacheFilterOptions,
  ): boolean {
    if (!filters) return true;

    // Service filter
    if (filters.services && filters.services.length > 0) {
      if (!file.service || !filters.services.includes(file.service)) {
        return false;
      }
    }

    // Type filter
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(file.type)) {
        return false;
      }
    }

    // Age filter
    if (filters.ageRange) {
      const ageInDays = file.age / (24 * 60 * 60 * 1000);
      if (
        ageInDays < filters.ageRange.min ||
        ageInDays > filters.ageRange.max
      ) {
        return false;
      }
    }

    // Size filter
    if (filters.sizeRange) {
      if (
        file.size < filters.sizeRange.min ||
        file.size > filters.sizeRange.max
      ) {
        return false;
      }
    }

    // Search term filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      if (
        !file.path.toLowerCase().includes(term) &&
        !file.service?.toLowerCase().includes(term) &&
        !file.type.toLowerCase().includes(term)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Scan for untracked files in cache directory
   */
  private async scanUntrackedFiles(
    files: CacheFileInfo[],
    countedPaths: Set<string>,
    filters?: CacheFilterOptions,
  ): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const entries = await FileSystem.readDirectoryAsync(cacheDir);
      if (!Array.isArray(entries)) return;

      const imageExtRegex = /\.(jpg|jpeg|png|webp|gif|bmp|img)$/i;

      for (const name of entries) {
        if (typeof name !== "string") continue;
        const path = `${cacheDir}${name}`;

        // Direct image files
        if (imageExtRegex.test(name)) {
          await this.processUntrackedFile(path, files, countedPaths, filters);
          continue;
        }

        // Check subdirectories
        try {
          const info = await FileSystem.getInfoAsync(path);
          if (info.exists && info.isDirectory) {
            const subEntries = await FileSystem.readDirectoryAsync(path);
            for (const subName of subEntries) {
              if (
                typeof subName === "string" &&
                (imageExtRegex.test(subName) || subName.startsWith("image-"))
              ) {
                await this.processUntrackedFile(
                  `${path}/${subName}`,
                  files,
                  countedPaths,
                  filters,
                );
              }
            }
          }
        } catch {
          // Ignore directory errors
        }
      }
    } catch (error) {
      void logger.debug("Failed to scan untracked files", {
        error: this.stringifyError(error),
      });
    }
  }

  /**
   * Process a single untracked file
   */
  private async processUntrackedFile(
    path: string,
    files: CacheFileInfo[],
    countedPaths: Set<string>,
    filters?: CacheFilterOptions,
  ): Promise<void> {
    try {
      if (countedPaths.has(path)) return;

      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists || info.isDirectory) return;

      const modifiedAt = info.modificationTime
        ? info.modificationTime * 1000
        : Date.now();
      const age = Date.now() - modifiedAt;

      if (age > CACHE_MAX_AGE_MS) {
        // Remove stale files
        await FileSystem.deleteAsync(path, { idempotent: true });
        return;
      }

      const cacheFileInfo = this.createCacheFileInfo(
        path, // Use path as URI for untracked files
        path,
        info.size ?? 0,
        modifiedAt,
        age,
      );

      if (this.matchesFilters(cacheFileInfo, filters)) {
        files.push(cacheFileInfo);
      }
      countedPaths.add(path);
    } catch (error) {
      void logger.debug("Error processing untracked file", {
        path,
        error: this.stringifyError(error),
      });
    }
  }

  /**
   * Enforce cache limits after a download (best effort, doesn't block).
   */
  private async enforceCacheLimitAfterDownload(): Promise<void> {
    try {
      const { maxImageCacheSize } = useSettingsStore.getState();

      // Only enforce if we have a reasonable limit set
      if (maxImageCacheSize > 0) {
        void this.enforceCacheLimit(maxImageCacheSize);
      }
    } catch (error) {
      void logger.debug(
        "ImageCacheService: failed to enforce cache limit after download",
        {
          error: this.stringifyError(error),
        },
      );
    }
  }

  /**
   * Compute the total disk usage for cached images tracked by the service.
   */
  async getCacheUsage(): Promise<ImageCacheUsage> {
    await this.ensureInitialized();

    const uris = Array.from(this.trackedUris);

    let totalSize = 0;
    let fileCount = 0;
    const missingUris: string[] = [];
    let addedTrackedUris = false;
    const countedPaths = new Set<string>();

    await Promise.all(
      uris.map(async (uri) => {
        let cachedPath = await this.getCachedPath(uri);
        let effectiveUri = uri;

        if (!cachedPath) {
          // Try the same fetch logic used during prefetch/resolve: some caches
          // are created for a modified "fetchUri" (for example when an API key
          // query param is appended). If we don't find a cache for the original
          // URI, try the connector-aware variants so we can still account for
          // disk usage.
          try {
            const connectors =
              ConnectorManager.getInstance().getAllConnectors();
            for (const connector of connectors) {
              try {
                const base = connector.config.url.replace(/\/+$/, "");
                if (uri.startsWith(base) && connector.config.apiKey) {
                  const parsed = new URL(uri);
                  if (!parsed.searchParams.has("apikey")) {
                    parsed.searchParams.set("apikey", connector.config.apiKey);
                  }
                  const fetchUri = parsed.toString();
                  const altCachedPath = await this.getCachedPath(fetchUri);
                  if (altCachedPath) {
                    cachedPath = altCachedPath;
                    effectiveUri = fetchUri;
                    // Ensure we persist the fact that the cache is tied to the
                    // fetch URI so future scans will find it directly.
                    if (!this.trackedUris.has(effectiveUri)) {
                      this.trackedUris.add(effectiveUri);
                      addedTrackedUris = true;
                    }
                    // Remove the stale/original tracked URI in favor of the
                    // effective one; defer actual deletion until after the
                    // scan so persistent storage is updated in a single write.
                    missingUris.push(uri);
                    break;
                  }
                }
              } catch {
                // Ignore URL parsing / connector errors and continue
              }
            }
          } catch {
            // Ignore failures looking up connectors
          }
        }

        if (!cachedPath) {
          missingUris.push(uri);
          return;
        }

        const fileInfo = await FileSystem.getInfoAsync(cachedPath);
        if (!fileInfo.exists || fileInfo.isDirectory) {
          missingUris.push(uri);
          return;
        }

        const modifiedAt = fileInfo.modificationTime
          ? fileInfo.modificationTime * 1000
          : undefined;
        if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
          // Stale cache entry; schedule cleanup by removing file and skipping from usage count.
          missingUris.push(uri);
          try {
            await FileSystem.deleteAsync(cachedPath, { idempotent: true });
          } catch (deleteError) {
            void logger.warn(
              "ImageCacheService: failed to delete stale cache file.",
              {
                cachedPath,
                error: this.stringifyError(deleteError),
              },
            );
          }
          return;
        }

        totalSize += fileInfo.size ?? 0;
        fileCount += 1;
        countedPaths.add(cachedPath);
      }),
    );

    if (missingUris.length) {
      missingUris.forEach((missingUri) => this.trackedUris.delete(missingUri));
      // Persist if we've removed stale entries or added new effective ones.
      if (missingUris.length || addedTrackedUris) {
        await this.persistTrackedUris();
      }
    }

    // If nothing was tracked (or there are untracked direct downloads), scan
    // the app cache directory for files that match our fallback download
    // naming pattern (image-<hash>.<ext>) so we can report disk usage even
    // when URIs aren't present in the tracked set.
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (cacheDir) {
        const entries = await FileSystem.readDirectoryAsync(cacheDir);
        if (Array.isArray(entries) && entries.length) {
          const imageExtRegex = /\.(jpg|jpeg|png|webp|gif|bmp|img)$/i;
          const work: Promise<void>[] = [];

          const maybeCountFile = async (path: string) => {
            try {
              if (countedPaths.has(path)) return;
              const info = await FileSystem.getInfoAsync(path);
              if (!info.exists || info.isDirectory) return;
              const modifiedAt = info.modificationTime
                ? info.modificationTime * 1000
                : undefined;
              if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
                try {
                  await FileSystem.deleteAsync(path, { idempotent: true });
                  void logger.debug(
                    "ImageCacheService: removed stale fallback cached image during directory scan.",
                    { path },
                  );
                } catch (err) {
                  void logger.warn(
                    "ImageCacheService: failed to delete stale fallback cached image during directory scan.",
                    { path, error: this.stringifyError(err) },
                  );
                }
                return;
              }
              totalSize += info.size ?? 0;
              fileCount += 1;
              countedPaths.add(path);
            } catch {
              // ignore
            }
          };

          for (const name of entries) {
            if (typeof name !== "string") continue;
            const path = `${cacheDir}${name}`;
            // If it's a file with an image extension, count it directly.
            if (imageExtRegex.test(name)) {
              work.push(maybeCountFile(path));
              continue;
            }

            // If it's a directory, inspect one level deep for image files.
            try {
              const info = await FileSystem.getInfoAsync(path);
              if (info.exists && info.isDirectory) {
                try {
                  const sub = await FileSystem.readDirectoryAsync(path);
                  for (const subName of sub) {
                    if (typeof subName !== "string") continue;
                    if (
                      imageExtRegex.test(subName) ||
                      subName.startsWith("image-")
                    ) {
                      work.push(maybeCountFile(`${path}/${subName}`));
                    }
                  }
                } catch {
                  // ignore per-dir errors
                }
              }
            } catch {
              // ignore
            }
          }

          await Promise.all(work);
        }
      }
    } catch (err) {
      void logger.debug(
        "ImageCacheService: failed to scan cache directory for images.",
        { error: this.stringifyError(err) },
      );
    }

    return {
      size: totalSize,
      fileCount,
      formattedSize: ImageCacheService.formatBytes(totalSize),
    };
  }

  /**
   * Clear both disk and memory caches and reset tracked URIs.
   */
  async clearCache(): Promise<void> {
    await this.ensureInitialized();

    try {
      // Clear expo-image caches
      await Promise.allSettled([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);

      // Clear our fallback downloaded files from cache directory
      await this.clearFallbackCacheFiles();

      // Clear tracked URIs and persist
      this.trackedUris.clear();
      await this.persistTrackedUris();

      void logger.info("ImageCacheService: cleared image cache.");
    } catch (error) {
      void logger.error("ImageCacheService: failed to clear cache.", {
        error: this.stringifyError(error),
      });
      throw error;
    }
  }

  /**
   * Clear fallback cache files created by direct downloads.
   */
  private async clearFallbackCacheFiles(): Promise<void> {
    try {
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) return;

      const entries = await FileSystem.readDirectoryAsync(cacheDir);
      if (!Array.isArray(entries)) return;

      const imageExtRegex = /\.(jpg|jpeg|png|webp|gif|bmp|img)$/i;
      const work: Promise<void>[] = [];

      for (const name of entries) {
        if (typeof name !== "string") continue;

        // Check for image files with our fallback naming pattern
        if (imageExtRegex.test(name) || name.startsWith("image-")) {
          const path = `${cacheDir}${name}`;
          work.push(this.deleteFileIfExists(path));
        }

        // Also check subdirectories for fallback images
        const subPath = `${cacheDir}${name}`;
        try {
          const info = await FileSystem.getInfoAsync(subPath);
          if (info.exists && info.isDirectory) {
            const subEntries = await FileSystem.readDirectoryAsync(subPath);
            for (const subName of subEntries) {
              if (
                typeof subName === "string" &&
                (imageExtRegex.test(subName) || subName.startsWith("image-"))
              ) {
                work.push(this.deleteFileIfExists(`${subPath}/${subName}`));
              }
            }
          }
        } catch {
          // Ignore directory errors
        }
      }

      await Promise.allSettled(work);
    } catch (error) {
      void logger.warn(
        "ImageCacheService: failed to clear fallback cache files.",
        {
          error: this.stringifyError(error),
        },
      );
    }
  }

  /**
   * Delete a file if it exists, with error handling.
   */
  private async deleteFileIfExists(path: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
    } catch (error) {
      void logger.debug(
        "ImageCacheService: failed to delete file during cache clear.",
        {
          path,
          error: this.stringifyError(error),
        },
      );
    }
  }

  static formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1,
    );
    const value = bytes / 1024 ** index;

    return `${
      value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)
    } ${units[index]}`;
  }

  // Create a short hash for a URI to use in generating cache filenames.
  static hashUri(uri: string): string {
    let hash = 5381;
    for (let i = 0; i < uri.length; i++) {
      // djb2
      hash = (hash << 5) + hash + uri.charCodeAt(i);
      hash = hash & hash; // keep in 32-bit
    }
    return (hash >>> 0).toString(36);
  }

  // Attempt to preserve a reasonable file extension from the original URI.
  static extractExt(uri: string): string {
    try {
      const m = uri.match(/\.(jpg|jpeg|png|webp|gif|bmp)(?:\?|$)/i);
      if (m && m[1]) {
        return `.${m[1].toLowerCase()}`;
      }
    } catch {
      // ignore
    }
    return ".img";
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEY);
      if (serialized) {
        const parsed = JSON.parse(serialized) as string[];
        if (Array.isArray(parsed)) {
          let sanitizedAny = false;
          parsed.forEach((uri) => {
            if (typeof uri === "string" && uri.length) {
              const sanitized = this.sanitizeUriForStorage(uri);
              if (sanitized !== uri) {
                sanitizedAny = true;
              }
              this.trackedUris.add(sanitized);
            }
          });
          // If any URI contained sensitive query params (eg. apikey), rewrite
          // the persisted list to the sanitized form so we never persist
          // secrets.
          if (sanitizedAny) {
            await this.persistTrackedUris();
          }
        }
      }
    } catch (error) {
      void logger.warn("ImageCacheService: failed to restore tracked URIs.", {
        error: this.stringifyError(error),
      });
    }

    this.isInitialized = true;
  }

  private async persistTrackedUris(): Promise<void> {
    try {
      // Ensure we never persist secrets (eg. apikey query param). Persist a
      // sanitized copy of the current URIs.
      const sanitized = Array.from(this.trackedUris).map((u) =>
        this.sanitizeUriForStorage(u),
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (error) {
      void logger.warn("ImageCacheService: failed to persist tracked URIs.", {
        error: this.stringifyError(error),
      });
    }
  }

  private async prefetchInternal(uri: string): Promise<string | null> {
    if (!uri) {
      return null;
    }

    const inFlight = this.inFlightPrefetches.get(uri);
    if (inFlight) {
      return inFlight;
    }

    const prefetchPromise = (async () => {
      const prefetchedPath = await this.getCachedPath(uri);
      if (prefetchedPath) {
        return prefetchedPath;
      }

      // If the image is hosted by one of the configured connectors and that connector
      // requires an API key, append the apikey query parameter so the image fetch
      // is authenticated. We prefer appending the query string over relying on
      // request headers because the native image loader APIs may not forward
      // custom headers for remote image requests.
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      let fetchUri = uri;

      for (const connector of connectors) {
        try {
          const base = connector.config.url.replace(/\/+$/, "");
          if (fetchUri.startsWith(base) && connector.config.apiKey) {
            // Only add apikey if it's not already present
            const parsed = new URL(fetchUri);
            if (!parsed.searchParams.has("apikey")) {
              parsed.searchParams.set("apikey", connector.config.apiKey);
              fetchUri = parsed.toString();
            }
            break;
          }
        } catch {
          // Ignore any URL parsing issues and continue
        }
      }

      const success = await Image.prefetch(fetchUri, { cachePolicy: "disk" });

      void logger.debug("ImageCacheService: prefetch result.", {
        uri,
        fetchUri,
        success,
      });

      // If prefetch failed, try a robust fallback by downloading the image
      // directly into the app cache so we can return a filesystem path. If
      // prefetch succeeded but the image cache doesn't expose a disk path, we
      // also attempt the same fallback download — some implementations simply
      // don't provide a cache path even when prefetch reports success.
      if (!success) {
        const downloadPath = await this.fallbackDownload(uri, fetchUri);
        if (downloadPath) {
          return downloadPath;
        }
        return null;
      }

      // If prefetch succeeded, attempt to resolve the cached path. Some image
      // cache implementations may not expose a path for the original URI; if
      // that happens, try to resolve by checking the fetchUri as well.
      let cachedPath = await this.getCachedPath(uri);
      if (!cachedPath && fetchUri !== uri) {
        cachedPath = await this.getCachedPath(fetchUri);
      }

      if (!cachedPath) {
        void logger.debug(
          "ImageCacheService: prefetch succeeded but cache path missing; attempting fallback download.",
          { uri, fetchUri },
        );
        const downloadPath = await this.fallbackDownload(uri, fetchUri);
        if (downloadPath) {
          void logger.info(
            "ImageCacheService: fallback download succeeded after missing cache path.",
            { uri, fetchUri, downloadPath },
          );
          // Enforce cache limits after successful download (fire-and-forget)
          void this.enforceCacheLimitAfterDownload();
          return downloadPath;
        }
        void logger.warn(
          "ImageCacheService: prefetch succeeded but no cache path available and fallback download failed.",
          { uri, fetchUri },
        );
        return null;
      }
      return cachedPath;
    })();

    this.inFlightPrefetches.set(uri, prefetchPromise);

    try {
      const result = await prefetchPromise;
      if (!result) {
        void logger.debug(
          "ImageCacheService: prefetch returned empty result.",
          { uri },
        );
      }
      return result;
    } finally {
      this.inFlightPrefetches.delete(uri);
    }
  }

  private async getCachedPath(uri: string): Promise<string | null> {
    // First, try to resolve the cache path via expo-image. This is the
    // preferred source of truth for cache locations on platforms where it
    // exposes filesystem paths. Some native implementations normalize or
    // encode the request URL before storing it in the disk cache which can
    // cause `getCachePathAsync` to return null for the exact input string.
    // Try a few common URI variants to improve our chances of resolving a
    // cached path without falling back to a download.
    const triedUris = new Set<string>();

    const variants: string[] = [uri];
    try {
      const encoded = encodeURI(uri);
      if (encoded !== uri) variants.push(encoded);
    } catch {
      // ignore
    }
    try {
      const decoded = decodeURI(uri);
      if (decoded !== uri) variants.push(decoded);
    } catch {
      // ignore
    }
    try {
      // strip trailing slashes which sometimes differ between callers
      const stripped = uri.replace(/\/+$/, "");
      if (stripped !== uri) variants.push(stripped);
    } catch {
      // ignore
    }

    for (const attemptUri of variants) {
      if (triedUris.has(attemptUri)) continue;
      triedUris.add(attemptUri);
      try {
        const cachedPath = await Image.getCachePathAsync(attemptUri);
        if (!cachedPath) continue;

        const info = await FileSystem.getInfoAsync(cachedPath);
        if (!info.exists) {
          continue;
        }

        const modifiedAt = info.modificationTime
          ? info.modificationTime * 1000
          : undefined;
        if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
          try {
            await FileSystem.deleteAsync(cachedPath, { idempotent: true });
            void logger.debug(
              "ImageCacheService: removed stale cached image.",
              { cachedPath, uri: attemptUri },
            );
          } catch (error) {
            void logger.warn(
              "ImageCacheService: failed to delete stale cached image.",
              {
                cachedPath,
                uri: attemptUri,
                error: this.stringifyError(error),
              },
            );
          }
          continue;
        }

        return cachedPath;
      } catch {
        // ignore per-attempt errors and continue to other variants
      }
    }

    // If expo-image doesn't provide a cache path, check our deterministic
    // fallback filename that we use when performing a direct download.
    try {
      const ext = ImageCacheService.extractExt(uri);
      const filename = `image-${ImageCacheService.hashUri(uri)}${ext}`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      const info = await FileSystem.getInfoAsync(dest);
      if (!info.exists || info.isDirectory) {
        return null;
      }

      const modifiedAt = info.modificationTime
        ? info.modificationTime * 1000
        : undefined;
      if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
        try {
          await FileSystem.deleteAsync(dest, { idempotent: true });
          void logger.debug(
            "ImageCacheService: removed stale fallback cached image.",
            { dest, uri },
          );
        } catch (error) {
          void logger.warn(
            "ImageCacheService: failed to delete stale fallback cached image.",
            {
              dest,
              uri,
              error: this.stringifyError(error),
            },
          );
        }
        return null;
      }

      return dest;
    } catch {
      return null;
    }
  }

  /**
   * Attempt to download an image directly into the app cache and return the
   * local filesystem path. This is used as a fallback when Image.prefetch
   * either fails or reports success but no cache path is exposed.
   */
  private async fallbackDownload(
    originalUri: string,
    fetchUri: string,
  ): Promise<string | null> {
    try {
      const ext = ImageCacheService.extractExt(originalUri || fetchUri);
      const filename = `image-${ImageCacheService.hashUri(
        originalUri || fetchUri,
      )}${ext}`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      void logger.debug("ImageCacheService: attempting fallback download.", {
        originalUri,
        fetchUri,
        dest,
      });
      const download = await FileSystem.downloadAsync(fetchUri, dest);
      // downloadAsync returns an object with status on some platforms
      if (
        download &&
        (download.status === 200 || download.status === 0 || download.uri)
      ) {
        // Make sure file exists
        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists && !info.isDirectory) {
          // Enforce cache limits after successful download (fire-and-forget)
          void this.enforceCacheLimitAfterDownload();
          return dest;
        }
      }
      // If fetchUri download did not create a file try originalUri as a last effort
      if (fetchUri !== originalUri) {
        try {
          const download2 = await FileSystem.downloadAsync(originalUri, dest);
          if (
            download2 &&
            (download2.status === 200 ||
              download2.status === 0 ||
              download2.uri)
          ) {
            const info2 = await FileSystem.getInfoAsync(dest);
            if (info2.exists && !info2.isDirectory) {
              // Enforce cache limits after successful download (fire-and-forget)
              void this.enforceCacheLimitAfterDownload();
              return dest;
            }
          }
        } catch (err2) {
          // keep falling through to return null
          void logger.debug(
            "ImageCacheService: fallback download with originalUri failed.",
            { originalUri, error: this.stringifyError(err2) },
          );
        }
      }
    } catch (downloadError) {
      void logger.warn("ImageCacheService: fallback download failed.", {
        uri: fetchUri,
        error: this.stringifyError(downloadError),
      });
    }

    return null;
  }

  private trackUri(uri: string): void {
    const sanitized = this.sanitizeUriForStorage(uri);
    if (!this.trackedUris.has(sanitized)) {
      this.trackedUris.add(sanitized);
      void this.persistTrackedUris();
    }
  }

  // Remove known sensitive query parameters before persisting URIs and when
  // storing tracked URIs so we never save API keys to storage.
  private sanitizeUriForStorage(uri: string): string {
    try {
      const parsed = new URL(uri);
      // Remove apikey and other potentially sensitive params
      ["apikey", "token", "access_token"].forEach((p) =>
        parsed.searchParams.delete(p),
      );
      parsed.hash = "";
      return parsed.toString();
    } catch {
      return uri;
    }
  }

  /**
   * Generate a deterministic filename for a thumbnail variant.
   */
  private static thumbFilename(uri: string, w: number, h: number): string {
    // prefer webp extension for thumbnails
    return `image-${ImageCacheService.hashUri(uri)}-${w}x${h}.webp`;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error";
    }
  }
}

export const imageCacheService = ImageCacheService.getInstance();
export { ImageCacheService };
