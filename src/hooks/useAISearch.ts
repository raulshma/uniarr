import { useCallback, useEffect, useRef, useState } from "react";
import { IntelligentSearchService } from "@/services/search/IntelligentSearchService";
import {
  SearchHistoryService,
  AISearchHistoryEntry,
} from "@/services/search/SearchHistoryService";
import { UnifiedSearchService } from "@/services/search/UnifiedSearchService";
import { useSettingsStore } from "@/store/settingsStore";
import { logger } from "@/services/logger/LoggerService";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";
import type {
  UnifiedSearchResult,
  UnifiedSearchResponse,
} from "@/models/search.types";

interface UseAISearchOptions {
  debounceMs?: number;
  autoSearch?: boolean;
}

interface UseAISearchReturn {
  // Input management
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Interpretation
  interpretation: SearchInterpretation | null;
  partialInterpretation: Partial<SearchInterpretation>;
  isInterpretingSearch: boolean;
  interpretationError: Error | null;

  // Results
  results: UnifiedSearchResult[];
  isSearching: boolean;
  searchError: Error | null;

  // Recommendations
  recommendations: any[];
  isLoadingRecommendations: boolean;

  // History
  searchHistory: AISearchHistoryEntry[];
  clearHistory: () => Promise<void>;

  // Actions
  performSearch: (query?: string) => Promise<void>;
  refineInterpretation: (changes: Partial<SearchInterpretation>) => void;
  bookmarkResult: (result: UnifiedSearchResult) => Promise<void>;
  clearSearch: () => void;
}

/**
 * Hook for AI-powered search with interpretation and recommendations
 */
export function useAISearch(
  options: UseAISearchOptions = {},
): UseAISearchReturn {
  const { debounceMs = 500, autoSearch = false } = options;

  const intelligentSearchService = IntelligentSearchService.getInstance();
  const searchHistoryService = SearchHistoryService.getInstance();
  const unifiedSearchService = UnifiedSearchService.getInstance();

  // Get AI Search toggle from settings
  const enableAISearch = useSettingsStore((s) => s.enableAISearch);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [interpretation, setInterpretation] =
    useState<SearchInterpretation | null>(null);
  const [partialInterpretation, setPartialInterpretation] = useState<
    Partial<SearchInterpretation>
  >({});
  const [isInterpretingSearch, setIsInterpretingSearch] = useState(false);
  const [interpretationError, setInterpretationError] = useState<Error | null>(
    null,
  );

  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<Error | null>(null);

  const [recommendations] = useState<any[]>([]);
  const [isLoadingRecommendations] = useState(false);

  const [searchHistory, setSearchHistory] = useState<any[]>([]);

  // Refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Load search history
   */
  const loadHistory = useCallback(async () => {
    try {
      const history = await searchHistoryService.getHistory();
      setSearchHistory(history);
    } catch (error) {
      logger.error("Failed to load search history", { error });
    }
  }, [searchHistoryService]);

  /**
   * Interpret search query with streaming
   */
  const interpretQuery = useCallback(
    async (query: string) => {
      if (!enableAISearch) {
        logger.debug("AI Search is disabled in settings");
        setInterpretation(null);
        setPartialInterpretation({});
        return;
      }

      if (!query || query.trim().length < 2) {
        setInterpretation(null);
        setPartialInterpretation({});
        return;
      }

      setIsInterpretingSearch(true);
      setInterpretationError(null);
      setPartialInterpretation({});

      try {
        // Interpret query using generateObject
        const result = await intelligentSearchService.interpretQuery(query);

        setInterpretation(result);
        setPartialInterpretation(result);

        logger.debug("Query interpretation completed", {
          query,
          confidence: result.confidence,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const err = new Error(errorMessage);
        setInterpretationError(err);
        logger.error("Failed to interpret query", { error: errorMessage });
      } finally {
        setIsInterpretingSearch(false);
      }
    },
    [intelligentSearchService, enableAISearch],
  );

  /**
   * Perform unified search with interpretation
   */
  const performSearch = useCallback(
    async (query?: string) => {
      const queryToSearch = query || searchQuery;

      if (!queryToSearch || queryToSearch.trim().length < 2) {
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        // Get current interpretation or interpret if not available
        let currentInterpretation = interpretation;
        if (!currentInterpretation) {
          await interpretQuery(queryToSearch);
          currentInterpretation = interpretation;
        }

        // Search services
        if (
          currentInterpretation &&
          currentInterpretation.recommendedServices &&
          currentInterpretation.recommendedServices.length > 0
        ) {
          const searchResponse: UnifiedSearchResponse =
            await unifiedSearchService.search(queryToSearch, {
              serviceIds: currentInterpretation.recommendedServices,
              mediaTypes: currentInterpretation.mediaTypes as any,
              aiInterpretation: currentInterpretation,
              // Add other filter options as needed
            });

          setResults(searchResponse.results);

          // Record in history
          await searchHistoryService.addSearch({
            query: queryToSearch,
            mediaTypes: currentInterpretation.mediaTypes,
            genres: currentInterpretation.genres,
            confidence: currentInterpretation.confidence,
            resultsCount: searchResponse.results.length,
            resultServices: currentInterpretation.recommendedServices,
            resultMediaTypes: currentInterpretation.mediaTypes,
          });
        } else {
          setResults([]);
        }

        logger.debug("Search completed", {
          query: queryToSearch,
          resultsCount: results.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const err = new Error(errorMessage);
        setSearchError(err);
        logger.error("Search failed", { error: errorMessage });
      } finally {
        setIsSearching(false);
      }
    },
    [
      searchQuery,
      interpretation,
      interpretQuery,
      unifiedSearchService,
      searchHistoryService,
      results.length,
    ],
  );

  /**
   * Refine interpretation with manual changes
   */
  const refineInterpretation = useCallback(
    (changes: Partial<SearchInterpretation>) => {
      setInterpretation((prev) => (prev ? { ...prev, ...changes } : null));
    },
    [],
  );

  /**
   * Bookmark a search result
   */
  const bookmarkResult = useCallback(async (result: UnifiedSearchResult) => {
    try {
      // This would typically save to a bookmarks service
      logger.debug("Result bookmarked", { resultId: result.id });
    } catch (error) {
      logger.error("Failed to bookmark result", { error });
      throw error;
    }
  }, []);

  /**
   * Clear search state
   */
  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setInterpretation(null);
    setPartialInterpretation({});
    setResults([]);
    setSearchError(null);
    setInterpretationError(null);
  }, []);

  /**
   * Clear search history
   */
  const clearHistoryCallback = useCallback(async () => {
    try {
      await searchHistoryService.clearHistory();
      setSearchHistory([]);
      logger.debug("Search history cleared");
    } catch (error) {
      logger.error("Failed to clear history", { error });
      throw error;
    }
  }, [searchHistoryService]);

  /**
   * Debounced search query interpretation
   */
  useEffect(() => {
    if (!autoSearch || !enableAISearch) return;

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        interpretQuery(searchQuery);
      } else {
        setInterpretation(null);
        setPartialInterpretation({});
      }
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, autoSearch, debounceMs, interpretQuery, enableAISearch]);

  /**
   * Load history on mount
   */
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    const abortController = abortControllerRef.current;
    const debounceTimer = debounceTimerRef.current;

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (abortController) {
        abortController.abort();
      }
    };
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    interpretation,
    partialInterpretation,
    isInterpretingSearch,
    interpretationError,
    results,
    isSearching,
    searchError,
    recommendations,
    isLoadingRecommendations,
    searchHistory,
    clearHistory: clearHistoryCallback,
    performSearch,
    refineInterpretation,
    bookmarkResult,
    clearSearch,
  };
}
