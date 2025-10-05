import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';

import { logger } from '@/services/logger/LoggerService';

export type ImageCacheUsage = {
  size: number;
  fileCount: number;
  formattedSize: string;
};

const STORAGE_KEY = 'ImageCacheService:trackedUris';
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class ImageCacheService {
  private static instance: ImageCacheService | null = null;

  private trackedUris: Set<string> = new Set();

  private isInitialized = false;

  private inFlightPrefetches = new Map<string, Promise<string | null>>();

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
        return cachedPath;
      }

      const localPath = await this.prefetchInternal(uri);
      if (localPath) {
        this.trackUri(uri);
        return localPath;
      }
    } catch (error) {
      void logger.warn('ImageCacheService: resolveUri failed, falling back to remote URI.', {
        uri,
        error: this.stringifyError(error),
      });
    }

    return uri;
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
          void logger.warn('ImageCacheService: prefetch failed.', {
            uri: url,
            error: this.stringifyError(error),
          });
        }
      }),
    );
  }

  /**
   * Compute the total disk usage for cached images tracked by the service.
   */
  async getCacheUsage(): Promise<ImageCacheUsage> {
    await this.ensureInitialized();

    const uris = Array.from(this.trackedUris);
    if (!uris.length) {
      return {
        size: 0,
        fileCount: 0,
        formattedSize: ImageCacheService.formatBytes(0),
      };
    }

    let totalSize = 0;
    let fileCount = 0;
    const missingUris: string[] = [];

    await Promise.all(
      uris.map(async (uri) => {
        const cachedPath = await this.getCachedPath(uri);
        if (!cachedPath) {
          missingUris.push(uri);
          return;
        }

        const fileInfo = await FileSystem.getInfoAsync(cachedPath);
        if (!fileInfo.exists || fileInfo.isDirectory) {
          missingUris.push(uri);
          return;
        }

        const modifiedAt = fileInfo.modificationTime ? fileInfo.modificationTime * 1000 : undefined;
        if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
          // Stale cache entry; schedule cleanup by removing file and skipping from usage count.
          missingUris.push(uri);
          try {
            await FileSystem.deleteAsync(cachedPath, { idempotent: true });
          } catch (deleteError) {
            void logger.warn('ImageCacheService: failed to delete stale cache file.', {
              cachedPath,
              error: this.stringifyError(deleteError),
            });
          }
          return;
        }

        totalSize += fileInfo.size ?? 0;
        fileCount += 1;
      }),
    );

    if (missingUris.length) {
      missingUris.forEach((missingUri) => this.trackedUris.delete(missingUri));
      await this.persistTrackedUris();
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
      await Promise.allSettled([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);
      this.trackedUris.clear();
      await this.persistTrackedUris();
      void logger.info('ImageCacheService: cleared image cache.');
    } catch (error) {
      void logger.error('ImageCacheService: failed to clear cache.', {
        error: this.stringifyError(error),
      });
      throw error;
    }
  }

  static formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;

    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
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
          parsed.forEach((uri) => {
            if (typeof uri === 'string' && uri.length) {
              this.trackedUris.add(uri);
            }
          });
        }
      }
    } catch (error) {
      void logger.warn('ImageCacheService: failed to restore tracked URIs.', {
        error: this.stringifyError(error),
      });
    }

    this.isInitialized = true;
  }

  private async persistTrackedUris(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.trackedUris)));
    } catch (error) {
      void logger.warn('ImageCacheService: failed to persist tracked URIs.', {
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

      const success = await Image.prefetch(uri, { cachePolicy: 'disk' });
      if (!success) {
        return null;
      }

      const cachedPath = await this.getCachedPath(uri);
      return cachedPath;
    })();

    this.inFlightPrefetches.set(uri, prefetchPromise);

    try {
      const result = await prefetchPromise;
      if (!result) {
        void logger.debug('ImageCacheService: prefetch returned empty result.', { uri });
      }
      return result;
    } finally {
      this.inFlightPrefetches.delete(uri);
    }
  }

  private async getCachedPath(uri: string): Promise<string | null> {
    const cachedPath = await Image.getCachePathAsync(uri);
    if (!cachedPath) {
      return null;
    }

    const info = await FileSystem.getInfoAsync(cachedPath);
    if (!info.exists) {
      return null;
    }

    const modifiedAt = info.modificationTime ? info.modificationTime * 1000 : undefined;
    if (modifiedAt && Date.now() - modifiedAt > CACHE_MAX_AGE_MS) {
      try {
        await FileSystem.deleteAsync(cachedPath, { idempotent: true });
        void logger.debug('ImageCacheService: removed stale cached image.', { cachedPath, uri });
      } catch (error) {
        void logger.warn('ImageCacheService: failed to delete stale cached image.', {
          cachedPath,
          uri,
          error: this.stringifyError(error),
        });
      }
      return null;
    }

    return cachedPath;
  }

  private trackUri(uri: string): void {
    if (!this.trackedUris.has(uri)) {
      this.trackedUris.add(uri);
      void this.persistTrackedUris();
    }
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
}

export const imageCacheService = ImageCacheService.getInstance();
export { ImageCacheService };
