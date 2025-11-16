import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ContentRecommendationService } from "@/services/ai/recommendations/ContentRecommendationService";
import { queryKeys } from "@/hooks/queryKeys";
import { RETRY_CONFIG } from "@/hooks/queryConfig";
import type { RecommendationResponseData } from "@/models/recommendation.types";
import { logger } from "@/services/logger/LoggerService";

/**
 * Hook options for useRecommendations
 */
export interface UseRecommendationsOptions {
  /** User ID for recommendations */
  userId: string;
  /** Number of recommendations to fetch (default 5, max 10) */
  limit?: number;
  /** Whether to include hidden gem recommendations */
  includeHiddenGems?: boolean;
  /** Whether to enable the query (default true) */
  enabled?: boolean;
}

/**
 * Return type for useRecommendations hook
 */
export interface UseRecommendationsReturn {
  /** Recommendation data */
  recommendations: RecommendationResponseData["recommendations"];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether data is being fetched */
  isFetching: boolean;
  /** Whether the data is from cache */
  isStale: boolean;
  /** Age of cached data in milliseconds */
  cacheAge?: number;
  /** Whether in offline mode */
  isOffline: boolean;
  /** Context information */
  context?: RecommendationResponseData["context"];
  /** Refetch recommendations (uses cache if valid) */
  refetch: () => Promise<void>;
  /** Force refresh recommendations (bypasses cache) */
  refresh: () => Promise<void>;
  /** Check if cache is stale */
  checkStaleness: () => Promise<{
    isStale: boolean;
    cacheAge: number | null;
    shouldRefresh: boolean;
  }>;
}

/**
 * Hook for fetching and managing content recommendations
 *
 * Features:
 * - Cache-first strategy with 24-hour stale time
 * - Automatic offline support
 * - Loading and error states
 * - Cache age tracking
 * - Manual refresh capability
 *
 * @example
 * ```tsx
 * const {
 *   recommendations,
 *   isLoading,
 *   error,
 *   cacheAge,
 *   refetch,
 *   refresh
 * } = useRecommendations({ userId: 'user123' });
 * ```
 */
export function useRecommendations(
  options: UseRecommendationsOptions,
): UseRecommendationsReturn {
  const {
    userId,
    limit = 5,
    includeHiddenGems = true,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const recommendationService = ContentRecommendationService.getInstance();

  // Query for recommendations
  const {
    data,
    isLoading,
    error,
    isFetching,
    isStale,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: queryKeys.recommendations.list(userId),
    queryFn: async (): Promise<RecommendationResponseData> => {
      void logger.info("Fetching recommendations via hook", {
        userId,
        limit,
        includeHiddenGems,
      });

      return await recommendationService.getRecommendations({
        userId,
        limit,
        includeHiddenGems,
        forceRefresh: false,
      });
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days (formerly cacheTime)
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  /**
   * Refetch recommendations (uses cache if valid)
   */
  const refetch = useCallback(async () => {
    void logger.info("Refetching recommendations", { userId });
    await queryRefetch();
  }, [queryRefetch, userId]);

  /**
   * Force refresh recommendations (bypasses cache)
   */
  const refresh = useCallback(async () => {
    void logger.info("Force refreshing recommendations", { userId });

    try {
      // Invalidate the query to force a fresh fetch
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.list(userId),
      });

      // Fetch fresh recommendations
      const freshData =
        await recommendationService.refreshRecommendations(userId);

      // Update the query cache with fresh data
      queryClient.setQueryData(
        queryKeys.recommendations.list(userId),
        freshData,
      );

      void logger.info("Recommendations refreshed successfully", { userId });
    } catch (error) {
      void logger.error("Failed to refresh recommendations", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [queryClient, userId, recommendationService]);

  /**
   * Check if cache is stale and should be refreshed
   */
  const checkStaleness = useCallback(async () => {
    return await recommendationService.checkCacheStaleness(userId);
  }, [recommendationService, userId]);

  return {
    recommendations: data?.recommendations ?? [],
    isLoading,
    error: error as Error | null,
    isFetching,
    isStale,
    cacheAge: data?.cacheAge,
    isOffline: data?.isOffline ?? false,
    context: data?.context,
    refetch,
    refresh,
    checkStaleness,
  };
}
