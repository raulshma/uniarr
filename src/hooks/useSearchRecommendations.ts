import { useCallback, useEffect, useState } from "react";
import { SearchRecommendationsService } from "@/services/search/SearchRecommendationsService";
import { logger } from "@/services/logger/LoggerService";
import type { RecommendationItem } from "@/services/search/SearchRecommendationsService";

interface UseSearchRecommendationsReturn {
  recommendations: RecommendationItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  getGenreRecommendations: (genre: string) => Promise<RecommendationItem[]>;
}

/**
 * Hook for fetching and managing search recommendations
 */
export function useSearchRecommendations(): UseSearchRecommendationsReturn {
  const recommendationsService = SearchRecommendationsService.getInstance();

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Load recommendations
   */
  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await recommendationsService.generateRecommendations();
      setRecommendations(result.recommendations);

      logger.debug("Recommendations loaded", {
        count: result.recommendations.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = new Error(errorMessage);
      setError(error);
      logger.error("Failed to load recommendations", { error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [recommendationsService]);

  /**
   * Refresh recommendations
   */
  const refreshRecommendations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await recommendationsService.generateRecommendations();
      setRecommendations(result.recommendations);

      logger.debug("Recommendations refreshed", {
        count: result.recommendations.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const error = new Error(errorMessage);
      setError(error);
      logger.error("Failed to refresh recommendations", {
        error: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }, [recommendationsService]);

  /**
   * Get genre-specific recommendations
   */
  const getGenreRecommendations = useCallback(
    async (genre: string): Promise<RecommendationItem[]> => {
      try {
        const result =
          await recommendationsService.getGenreRecommendations(genre);
        return result.recommendations;
      } catch (err) {
        logger.error("Failed to get genre recommendations", {
          error: err instanceof Error ? err.message : String(err),
          genre,
        });
        return [];
      }
    },
    [recommendationsService],
  );

  /**
   * Load recommendations on mount
   */
  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  return {
    recommendations,
    isLoading,
    error,
    refetch: loadRecommendations,
    refreshRecommendations,
    getGenreRecommendations,
  };
}
