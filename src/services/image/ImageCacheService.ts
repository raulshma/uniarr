import AsyncStorage from '@react-native-async-storage/async-storage';
// Use legacy FileSystem API to avoid deprecation warnings for getInfoAsync.
// TODO: migrate to the new File/Directory API from `expo-file-system` to remove
// the legacy dependency and use the modern APIs for file info and operations.
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';

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

    // If the image couldn't be resolved to a cached path, check whether the
    // URI belongs to one of our registered connectors and, if so, append an
    // apikey query parameter so the native image loader can authenticate the
    // request. This mirrors the behavior used when prefetching images.
    try {
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      for (const connector of connectors) {
        try {
          const base = connector.config.url.replace(/\/+$/, '');
          if (uri.startsWith(base) && connector.config.apiKey) {
            const parsed = new URL(uri);
            if (!parsed.searchParams.has('apikey')) {
              parsed.searchParams.set('apikey', connector.config.apiKey);
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

  // Create a short hash for a URI to use in generating cache filenames.
  static hashUri(uri: string): string {
    let hash = 5381;
    for (let i = 0; i < uri.length; i++) {
      // djb2
      hash = ((hash << 5) + hash) + uri.charCodeAt(i);
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
    return '.img';
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

      // If the image is hosted by one of the configured connectors and that connector
      // requires an API key, append the apikey query parameter so the image fetch
      // is authenticated. We prefer appending the query string over relying on
      // request headers because the native image loader APIs may not forward
      // custom headers for remote image requests.
      const connectors = ConnectorManager.getInstance().getAllConnectors();
      let fetchUri = uri;

      for (const connector of connectors) {
        try {
          const base = connector.config.url.replace(/\/+$/, '');
          if (fetchUri.startsWith(base) && connector.config.apiKey) {
            // Only add apikey if it's not already present
            const parsed = new URL(fetchUri);
            if (!parsed.searchParams.has('apikey')) {
              parsed.searchParams.set('apikey', connector.config.apiKey);
              fetchUri = parsed.toString();
            }
            break;
          }
        } catch {
          // Ignore any URL parsing issues and continue
        }
      }

      const success = await Image.prefetch(fetchUri, { cachePolicy: 'disk' });

      void logger.debug('ImageCacheService: prefetch result.', { uri, fetchUri, success });

      if (!success) {
        // Prefetch via expo-image failed — attempt a robust fallback by downloading
        // the image directly into the app cache and returning that path. This
        // helps on platforms or cases where the native image cache doesn't
        // expose a disk path via Image.getCachePathAsync.
        try {
          const ext = ImageCacheService.extractExt(uri);
          const filename = `image-${ImageCacheService.hashUri(uri)}${ext}`;
          const dest = `${FileSystem.cacheDirectory}${filename}`;
          void logger.debug('ImageCacheService: attempting fallback download.', { uri, dest });
          const download = await FileSystem.downloadAsync(fetchUri, dest);
          // downloadAsync returns an object with status on some platforms
          if (download && (download.status === 200 || download.status === 0 || download.uri)) {
            // Make sure file exists
            const info = await FileSystem.getInfoAsync(dest);
            if (info.exists && !info.isDirectory) {
              return dest;
            }
          }
        } catch (downloadError) {
          void logger.warn('ImageCacheService: fallback download failed.', {
            uri: fetchUri,
            error: this.stringifyError(downloadError),
          });
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
        void logger.debug('ImageCacheService: prefetch succeeded but cache path missing.', { uri, fetchUri });
      }

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
