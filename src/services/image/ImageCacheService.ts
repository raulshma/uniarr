import AsyncStorage from "@react-native-async-storage/async-storage";
// Use legacy FileSystem API to avoid deprecation warnings for getInfoAsync.
// TODO: migrate to the new File/Directory API from `expo-file-system` to remove
// the legacy dependency and use the modern APIs for file info and operations.
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import * as ImageManipulator from 'expo-image-manipulator';
import { PixelRatio } from 'react-native';
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";

import { logger } from "@/services/logger/LoggerService";

export type ImageCacheUsage = {
  size: number;
  fileCount: number;
  formattedSize: string;
};

const STORAGE_KEY = "ImageCacheService:trackedUris";
const STORAGE_KEY_VARIANT_STATS = "ImageCacheService:variantStats";
const STORAGE_KEY_THUMBHASH = "ImageCacheService:thumbhashes";
const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

class ImageCacheService {
  private static instance: ImageCacheService | null = null;

  private trackedUris: Set<string> = new Set();
  // Telemetry: track how often each URI variant resolves to a cache path.
  // Map keys are descriptive variant labels (eg. 'original', 'encoded', 'decoded', 'stripped').
  private variantStats: Map<string, number> = new Map();
  // Map of sanitized URI -> thumbhash string
  private thumbhashes: Map<string, string> = new Map();

  private isInitialized = false;

  private inFlightPrefetches = new Map<string, Promise<string | null>>();
  // Semaphore to limit concurrent image manipulations/downloads
  private concurrentOps = 0;
  // default, overridden dynamically from settings store
  private readonly DEFAULT_MAX_CONCURRENT_OPS = 3;
  private opQueue: Array<() => void> = [];

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
      void logger.warn(
        "ImageCacheService: resolveUri failed, falling back to remote URI.",
        {
          uri,
          error: this.stringifyError(error),
        }
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
  async resolveForSize(uri: string, widthPx: number, heightPx: number): Promise<string> {
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
      })
    );
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
              }
            );
          }
          return;
        }

        totalSize += fileInfo.size ?? 0;
        fileCount += 1;
        countedPaths.add(cachedPath);
      })
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
                    { path }
                  );
                } catch (err) {
                  void logger.warn(
                    "ImageCacheService: failed to delete stale fallback cached image during directory scan.",
                    { path, error: this.stringifyError(err) }
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
        { error: this.stringifyError(err) }
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
      await Promise.allSettled([
        Image.clearMemoryCache(),
        Image.clearDiskCache(),
      ]);
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

  static formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
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

    // Restore variant stats
    try {
      const serializedStats = await AsyncStorage.getItem(
        STORAGE_KEY_VARIANT_STATS
      );
      if (serializedStats) {
        const parsed = JSON.parse(serializedStats) as Record<
          string,
          number
        > | null;
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === "number" && Number.isFinite(v)) {
              this.variantStats.set(k, v);
            }
          });
        }
      }
    } catch (err) {
      void logger.warn("ImageCacheService: failed to restore variant stats.", {
        error: this.stringifyError(err),
      });
    }

    // Restore thumbhash map
    try {
      const serializedThumbs = await AsyncStorage.getItem(STORAGE_KEY_THUMBHASH);
      if (serializedThumbs) {
        const parsed = JSON.parse(serializedThumbs) as Record<string, string> | null;
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === "string" && v.length) {
              this.thumbhashes.set(k, v);
            }
          });
        }
      }
    } catch (err) {
      void logger.warn("ImageCacheService: failed to restore thumbhashes.", {
        error: this.stringifyError(err),
      });
    }

    this.isInitialized = true;
  }

  private async persistTrackedUris(): Promise<void> {
    try {
      // Ensure we never persist secrets (eg. apikey query param). Persist a
      // sanitized copy of the current URIs.
      const sanitized = Array.from(this.trackedUris).map((u) =>
        this.sanitizeUriForStorage(u)
      );
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      // Persist variant stats alongside tracked URIs (best-effort)
      try {
        const statsObj: Record<string, number> = {};
        this.variantStats.forEach((v, k) => {
          statsObj[k] = v;
        });
        await AsyncStorage.setItem(
          STORAGE_KEY_VARIANT_STATS,
          JSON.stringify(statsObj)
        );
      } catch (err) {
        // non-fatal
        void logger.warn(
          "ImageCacheService: failed to persist variant stats.",
          { error: this.stringifyError(err) }
        );
      }
      // Persist thumbhashes alongside tracked URIs (best-effort)
      try {
        const thumbsObj: Record<string, string> = {};
        this.thumbhashes.forEach((v, k) => {
          thumbsObj[k] = v;
        });
        await AsyncStorage.setItem(STORAGE_KEY_THUMBHASH, JSON.stringify(thumbsObj));
      } catch (err) {
        void logger.warn("ImageCacheService: failed to persist thumbhashes.", {
          error: this.stringifyError(err),
        });
      }
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
          // Telemetry: record a fallback-download occurrence (prefetch path)
          try {
            this.incrementVariantStat('fallback-download-prefetch');
          } catch {
            // ignore
          }
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
          { uri, fetchUri }
        );
        const downloadPath = await this.fallbackDownload(uri, fetchUri);
        if (downloadPath) {
          // Telemetry: fallback used after prefetch reported success but cache was missing
          try {
            this.incrementVariantStat('fallback-download-after-prefetch');
          } catch {
            // ignore
          }
          void logger.info(
            "ImageCacheService: fallback download succeeded after missing cache path.",
            { uri, fetchUri, downloadPath }
          );
          return downloadPath;
        }
        void logger.warn(
          "ImageCacheService: prefetch succeeded but no cache path available and fallback download failed.",
          { uri, fetchUri }
        );
        return null;
      }
      // If we have a cached path, try to generate a thumbhash (do not await)
      try {
        void this.maybeGenerateThumbhash(uri, cachedPath);
      } catch {
        // ignore
      }

      return cachedPath;
    })();

    this.inFlightPrefetches.set(uri, prefetchPromise);

    try {
      const result = await prefetchPromise;
      if (!result) {
        void logger.debug(
          "ImageCacheService: prefetch returned empty result.",
          { uri }
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
              { cachedPath, uri: attemptUri }
            );
          } catch (error) {
            void logger.warn(
              "ImageCacheService: failed to delete stale cached image.",
              {
                cachedPath,
                uri: attemptUri,
                error: this.stringifyError(error),
              }
            );
          }
          continue;
        }

        // Record which variant succeeded
        try {
          const label =
            attemptUri === uri
              ? "original"
              : attemptUri === encodeURI(uri)
              ? "encoded"
              : attemptUri === decodeURI(uri)
              ? "decoded"
              : "normalized";
          const prev = this.variantStats.get(label) ?? 0;
          this.variantStats.set(label, prev + 1);
          // Persist stats best-effort, but don't await in the hot path
          void AsyncStorage.setItem(
            STORAGE_KEY_VARIANT_STATS,
            JSON.stringify(Object.fromEntries(this.variantStats))
          );
        } catch {
          // ignore telemetry errors
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
            { dest, uri }
          );
        } catch (error) {
          void logger.warn(
            "ImageCacheService: failed to delete stale fallback cached image.",
            {
              dest,
              uri,
              error: this.stringifyError(error),
            }
          );
        }
        return null;
      }

      // Telemetry: deterministic fallback cached file was found on disk
      try {
        this.incrementVariantStat('fallback-cache-file');
      } catch {
        // ignore
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
    fetchUri: string
  ): Promise<string | null> {
    try {
      const ext = ImageCacheService.extractExt(originalUri || fetchUri);
      const filename = `image-${ImageCacheService.hashUri(
        originalUri || fetchUri
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
          // Generate thumbhash for downloaded image (fire-and-forget)
          try {
            void this.maybeGenerateThumbhash(originalUri, dest);
          } catch {
            // ignore
          }
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
              return dest;
            }
          }
        } catch (err2) {
          // keep falling through to return null
          void logger.debug(
            "ImageCacheService: fallback download with originalUri failed.",
            { originalUri, error: this.stringifyError(err2) }
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

  /**
   * Return a stored thumbhash for the given URI if available.
   * The URI is sanitized before lookup so stored entries don't contain secrets.
   */
  getThumbhash(uri: string): string | undefined {
    try {
      const key = this.sanitizeUriForStorage(uri);
      return this.thumbhashes.get(key);
    } catch {
      return undefined;
    }
  }

  /**
   * Generate a thumbhash for a source (URL or file path) and store it keyed by
   * the sanitized originalUri. This is best-effort and doesn't throw on errors.
   */
  private async maybeGenerateThumbhash(origUri: string, source?: string): Promise<void> {
    try {
      const key = this.sanitizeUriForStorage(origUri);
      if (this.thumbhashes.has(key)) return;
      const src = source ?? origUri;
      if (!src) return;
      // generateThumbhashAsync accepts a URL string or ImageRef
      const th = await Image.generateThumbhashAsync(src);
      if (th && typeof th === 'string' && th.length) {
        this.thumbhashes.set(key, th);
        // Persist thumbhashes (best-effort)
        try {
          const thumbsObj: Record<string, string> = {};
          this.thumbhashes.forEach((v, k) => {
            thumbsObj[k] = v;
          });
          await AsyncStorage.setItem(STORAGE_KEY_THUMBHASH, JSON.stringify(thumbsObj));
        } catch {
          // ignore persistence failures
        }
        try {
          this.incrementVariantStat('thumbhash-generated');
        } catch {
          // ignore
        }
      }
    } catch (err) {
      // non-fatal
      void logger.debug('ImageCacheService: failed to generate thumbhash.', { error: this.stringifyError(err) });
    }
  }

  private trackUri(uri: string): void {
    const sanitized = this.sanitizeUriForStorage(uri);
    if (!this.trackedUris.has(sanitized)) {
      this.trackedUris.add(sanitized);
      void this.persistTrackedUris();
    }
  }

  /**
   * Increment a named variant stat and persist the stats (best-effort).
   */
  private incrementVariantStat(name: string): void {
    const prev = this.variantStats.get(name) ?? 0;
    this.variantStats.set(name, prev + 1);
    // Persist asynchronously (don't await in hot path)
    void AsyncStorage.setItem(
      STORAGE_KEY_VARIANT_STATS,
      JSON.stringify(Object.fromEntries(this.variantStats))
    ).catch(() => {
      // ignore persistence failures
    });
  }

  /**
   * Return a snapshot of variant success statistics for telemetry/debugging.
   */
  getVariantStats(): Record<string, number> {
    const out: Record<string, number> = {};
    this.variantStats.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }

  // Remove known sensitive query parameters before persisting URIs and when
  // storing tracked URIs so we never save API keys to storage.
  private sanitizeUriForStorage(uri: string): string {
    try {
      const parsed = new URL(uri);
      // Remove apikey and other potentially sensitive params
      ["apikey", "token", "access_token"].forEach((p) =>
        parsed.searchParams.delete(p)
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

  // Thumbnail helper methods removed

  private acquireOp(): Promise<void> {
    const max = this.DEFAULT_MAX_CONCURRENT_OPS;

    if (this.concurrentOps < max) {
      this.concurrentOps += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.opQueue.push(() => {
        this.concurrentOps += 1;
        resolve();
      });
    });
  }

  private releaseOp(): void {
    this.concurrentOps = Math.max(0, this.concurrentOps - 1);
    const next = this.opQueue.shift();
    if (next) next();
    // Try to release next queued op up to the default max
    if (this.opQueue.length > 0 && this.concurrentOps < this.DEFAULT_MAX_CONCURRENT_OPS) {
      const next = this.opQueue.shift()!;
      this.concurrentOps += 1;
      next();
    }
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
