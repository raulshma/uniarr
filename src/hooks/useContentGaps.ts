import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { ContentRecommendationService } from "@/services/ai/recommendations/ContentRecommendationService";
import { queryKeys } from "@/hooks/queryKeys";
import { RETRY_CONFIG } from "@/hooks/queryConfig";
import type { Recommendation } from "@/models/recommendation.schemas";
import { logger } from "@/services/logger/LoggerService";

/**
 * Hook options for useContentGaps
 */
export interface UseContentGapsOptions {
  /** User ID for content gap analysis */
  userId: string;
  /** Whether to enable the query (default true) */
  enabled?: boolean;
}

/**
 * Return type for useContentGaps hook
 */
export interface UseContentGapsReturn {
  /** List of content gaps (ranked by relevance) */
  contentGaps: Recommendation[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether data is being fetched */
  isFetching: boolean;
  /** Refetch content gaps */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching content gaps in user's library
 *
 * Content gaps are popular or critically acclaimed items that:
 * - Match the user's favorite genres
 * - Have high ratings (>8.0)
 * - Are NOT in their current library
 * - Would fill notable gaps in their collection
 *
 * Features:
 * - Automatic caching with TanStack Query
 * - Loading and error states
 * - Ranked list of gaps by relevance
 * - Offline detection
 *
 * @example
 * ```tsx
 * const {
 *   contentGaps,
 *   isLoading,
 *   error,
 *   refetch
 * } = useContentGaps({ userId: 'user123' });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error.message} />;
 *
 * return (
 *   <ContentGapsList gaps={contentGaps} />
 * );
 * ```
 */
export function useContentGaps(
  options: UseContentGapsOptions,
): UseContentGapsReturn {
  const { userId, enabled = true } = options;

  const recommendationService = ContentRecommendationService.getInstance();

  // Query for content gaps
  const {
    data,
    isLoading,
    error,
    isFetching,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: queryKeys.recommendations.contentGaps(userId),
    queryFn: async (): Promise<Recommendation[]> => {
      void logger.info("Fetching content gaps via hook", { userId });

      return await recommendationService.getContentGaps(userId);
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - content gaps don't change frequently
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days (formerly cacheTime)
    ...RETRY_CONFIG.DEFAULT,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false, // Don't refetch on mount to reduce API calls
  });

  /**
   * Refetch content gaps
   */
  const refetch = useCallback(async () => {
    void logger.info("Refetching content gaps", { userId });
    await queryRefetch();
  }, [queryRefetch, userId]);

  return {
    contentGaps: data ?? [],
    isLoading,
    error: error as Error | null,
    isFetching,
    refetch,
  };
}
