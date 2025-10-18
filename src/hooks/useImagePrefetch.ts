import { useCallback, useEffect, useRef } from "react";

import { imageCacheService } from "@/services/image/ImageCacheService";

export interface UseImagePrefetchOptions {
  /**
   * Number of items to prefetch before and after visible range
   * @default { before: 1, after: 3 }
   */
  prefetchRange?: { before: number; after: number };
  /**
   * Prefetch priority strategy
   * @default 'adaptive'
   */
  priority?: "immediate" | "low" | "background" | "adaptive";
  /**
   * Maximum concurrent prefetch requests
   * @default 3
   */
  maxConcurrent?: number;
  /**
   * Debounce time in ms for prefetch updates
   * @default 100
   */
  debounce?: number;
}

/**
 * Hook for intelligent image prefetching in lists
 * Optimizes prefetching based on scroll position and visibility
 */
export const useImagePrefetch = (
  getImageUrls: (index: number) => string | string[] | undefined,
  options: UseImagePrefetchOptions = {},
) => {
  const {
    prefetchRange = { before: 1, after: 3 },
    priority = "adaptive",
    maxConcurrent = 3,
    debounce = 100,
  } = options;

  const lastVisibleRangeRef = useRef<{ start: number; end: number } | null>(
    null,
  );
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const allUrlsRef = useRef<string[]>([]);

  /**
   * Prefetch images for the given visible range
   */
  const prefetchForRange = useCallback(
    async (start: number, end: number, totalItems: number) => {
      // Calculate prefetch range
      const prefetchStart = Math.max(0, start - prefetchRange.before);
      const prefetchEnd = Math.min(totalItems - 1, end + prefetchRange.after);

      // Collect all URLs in the prefetch range
      const urlsToPrefetch: string[] = [];
      for (let i = prefetchStart; i <= prefetchEnd; i++) {
        const urls = getImageUrls(i);
        if (urls) {
          if (Array.isArray(urls)) {
            urlsToPrefetch.push(...urls);
          } else {
            urlsToPrefetch.push(urls);
          }
        }
      }

      // Filter out already processed URLs
      const uniqueUrls = [...new Set(urlsToPrefetch.filter(Boolean))];

      if (uniqueUrls.length === 0) return;

      // Determine priority based on strategy
      let prefetchPriority: "immediate" | "low" | "background" = priority as
        | "immediate"
        | "low"
        | "background";
      if (priority === "adaptive") {
        // If this is the first prefetch or user is scrolling slowly, use immediate
        const isInitialPrefetch = !lastVisibleRangeRef.current;
        const scrollDistance = lastVisibleRangeRef.current
          ? Math.abs(start - lastVisibleRangeRef.current.start)
          : 0;

        if (isInitialPrefetch || scrollDistance <= 2) {
          prefetchPriority = "immediate";
        } else if (scrollDistance <= 5) {
          prefetchPriority = "low";
        } else {
          prefetchPriority = "background";
        }
      }

      try {
        await imageCacheService.prefetchList(uniqueUrls, {
          visibleRange: { start, end },
          priority: prefetchPriority,
          maxConcurrent,
        });
      } catch (error) {
        console.warn("Prefetch failed:", error);
      }
    },
    [getImageUrls, prefetchRange, priority, maxConcurrent],
  );

  /**
   * Debounced prefetch function
   */
  const debouncedPrefetch = useCallback(
    (start: number, end: number, totalItems: number) => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }

      prefetchTimeoutRef.current = setTimeout(() => {
        void prefetchForRange(start, end, totalItems);
        lastVisibleRangeRef.current = { start, end };
      }, debounce);
    },
    [prefetchForRange, debounce],
  );

  /**
   * Call this when visible items change
   */
  const onVisibleItemsChange = useCallback(
    (visibleRange: { start: number; end: number }, totalItems: number) => {
      // Update cached URLs if needed
      if (allUrlsRef.current.length !== totalItems) {
        allUrlsRef.current = Array.from({ length: totalItems }, (_, i) => {
          const urls = getImageUrls(i);
          if (urls) {
            return Array.isArray(urls) ? urls[0] : urls;
          }
          return "";
        }).filter((url): url is string => Boolean(url));
      }

      debouncedPrefetch(visibleRange.start, visibleRange.end, totalItems);
    },
    [debouncedPrefetch, getImageUrls],
  );

  /**
   * Preload initial visible items immediately
   */
  const preloadInitial = useCallback(
    async (
      visibleRange: { start: number; end: number },
      totalItems: number,
    ) => {
      await prefetchForRange(visibleRange.start, visibleRange.end, totalItems);
      lastVisibleRangeRef.current = visibleRange;
    },
    [prefetchForRange],
  );

  /**
   * Get cache performance stats
   */
  const getCacheStats = useCallback(() => {
    return imageCacheService.getCacheStats();
  }, []);

  /**
   * Reset cache stats
   */
  const resetCacheStats = useCallback(() => {
    imageCacheService.resetCacheStats();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, []);

  return {
    onVisibleItemsChange,
    preloadInitial,
    getCacheStats,
    resetCacheStats,
  };
};
