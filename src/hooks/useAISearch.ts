import { useCallback, useEffect, useRef, useState } from "react";
import { IntelligentSearchService } from "@/services/search/IntelligentSearchService";
import {
  SearchHistoryService,
  AISearchHistoryEntry,
} from "@/services/search/SearchHistoryService";
import { SearchRecommendationsService } from "@/services/search/SearchRecommendationsService";
import { UnifiedSearchService } from "@/services/search/UnifiedSearchService";
import { useSettingsStore } from "@/store/settingsStore";
import { logger } from "@/services/logger/LoggerService";
import type { SearchInterpretation } from "@/utils/validation/searchSchemas";
import type {
  UnifiedSearchError,
  UnifiedSearchMediaType,
  UnifiedSearchResult,
  UnifiedSearchResponse,
} from "@/models/search.types";
import type { RecommendationItem } from "@/services/search/SearchRecommendationsService";

interface UseAISearchOptions {
  debounceMs?: number;
  autoSearch?: boolean;
}

interface UseAISearchReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  interpretation: SearchInterpretation | null;
  partialInterpretation: Partial<SearchInterpretation>;
  isInterpretingSearch: boolean;
  interpretationError: Error | null;
  interpretedQuery: string | null;
  recommendedServiceIds: string[];
  results: UnifiedSearchResult[];
  isSearching: boolean;
  searchError: Error | null;
  searchErrors: UnifiedSearchError[];
  lastSearchDurationMs: number;
  hasPerformedSearch: boolean;
  recommendations: RecommendationItem[];
  isLoadingRecommendations: boolean;
  recommendationsError: Error | null;
  searchHistory: AISearchHistoryEntry[];
  lastHistoryEntry: AISearchHistoryEntry | null;
  clearHistory: () => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  performSearch: (query?: string) => Promise<void>;
  refineInterpretation: (changes: Partial<SearchInterpretation>) => void;
  bookmarkResult: (result: UnifiedSearchResult) => Promise<void>;
  clearSearch: () => void;
}

const mergeInterpretationPartial = (
  previous: Partial<SearchInterpretation>,
  update: Partial<SearchInterpretation>,
): Partial<SearchInterpretation> => {
  const next: Partial<SearchInterpretation> = { ...previous };

  const target = next as Record<
    keyof SearchInterpretation,
    SearchInterpretation[keyof SearchInterpretation] | undefined
  >;

  (Object.keys(update) as (keyof SearchInterpretation)[]).forEach((key) => {
    const value = update[key];

    if (value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      target[key] = [...value] as unknown as SearchInterpretation[typeof key];
      return;
    }

    if (value && typeof value === "object") {
      const existing = next[key];
      const existingObject =
        existing && typeof existing === "object" ? existing : {};
      target[key] = {
        ...(existingObject as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      } as unknown as SearchInterpretation[typeof key];
      return;
    }

    target[key] = value as unknown as SearchInterpretation[typeof key];
  });

  return next;
};

const mapInterpretationMediaTypes = (
  mediaTypes?: SearchInterpretation["mediaTypes"],
): UnifiedSearchMediaType[] | undefined => {
  if (!mediaTypes?.length) {
    return undefined;
  }

  const mapped = new Set<UnifiedSearchMediaType>();

  mediaTypes.forEach((type) => {
    if (type === "anime") {
      mapped.add("series");
      mapped.add("movie");
      return;
    }

    if (type === "series" || type === "movie") {
      mapped.add(type);
    }
  });

  return mapped.size ? Array.from(mapped) : undefined;
};

export function useAISearch(
  options: UseAISearchOptions = {},
): UseAISearchReturn {
  const { debounceMs = 500, autoSearch = false } = options;

  const intelligentSearchService = IntelligentSearchService.getInstance();
  const recommendationsService = SearchRecommendationsService.getInstance();
  const searchHistoryService = SearchHistoryService.getInstance();
  const unifiedSearchService = UnifiedSearchService.getInstance();

  const enableAISearch = useSettingsStore((state) => state.enableAISearch);

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
  const [searchErrors, setSearchErrors] = useState<UnifiedSearchError[]>([]);
  const [lastSearchDurationMs, setLastSearchDurationMs] = useState(0);
  const [hasPerformedSearch, setHasPerformedSearch] = useState(false);

  const [recommendations, setRecommendations] = useState<RecommendationItem[]>(
    [],
  );
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState(false);
  const [recommendationsError, setRecommendationsError] =
    useState<Error | null>(null);

  const [searchHistory, setSearchHistory] = useState<AISearchHistoryEntry[]>(
    [],
  );
  const [lastHistoryEntry, setLastHistoryEntry] =
    useState<AISearchHistoryEntry | null>(null);

  const interpretationRef = useRef<SearchInterpretation | null>(null);
  const interpretedQueryRef = useRef<string | null>(null);
  const interpretationRequestIdRef = useRef(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const history = await searchHistoryService.getHistory();
      setSearchHistory(history);
      setLastHistoryEntry(history[0] ?? null);
    } catch (error) {
      logger.error("Failed to load search history", { error });
    }
  }, [searchHistoryService]);

  const refreshRecommendations = useCallback(async () => {
    try {
      setIsLoadingRecommendations(true);
      setRecommendationsError(null);
      // Force refresh to bypass 24-hour cache on manual refresh
      const { recommendations: items } =
        await recommendationsService.generateRecommendations(true);
      setRecommendations(items);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const err = new Error(errorMessage);
      setRecommendationsError(err);
      logger.error("Failed to load recommendations", { error: errorMessage });
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [recommendationsService]);

  const loadRecommendations = useCallback(async () => {
    try {
      setIsLoadingRecommendations(true);
      setRecommendationsError(null);
      // Initial load uses cache if valid (false = use cache)
      const { recommendations: items } =
        await recommendationsService.generateRecommendations(false);
      setRecommendations(items);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const err = new Error(errorMessage);
      setRecommendationsError(err);
      logger.error("Failed to load recommendations", { error: errorMessage });
    } finally {
      setIsLoadingRecommendations(false);
    }
  }, [recommendationsService]);

  const interpretQuery = useCallback(
    async (query: string): Promise<SearchInterpretation | null> => {
      const trimmed = query.trim();

      if (!enableAISearch) {
        logger.debug("AI Search is disabled in settings");
        setInterpretation(null);
        setPartialInterpretation({});
        interpretationRef.current = null;
        interpretedQueryRef.current = null;
        return null;
      }

      if (trimmed.length < 2) {
        setInterpretation(null);
        setPartialInterpretation({});
        interpretationRef.current = null;
        interpretedQueryRef.current = null;
        return null;
      }

      const requestId = interpretationRequestIdRef.current + 1;
      interpretationRequestIdRef.current = requestId;

      setIsInterpretingSearch(true);
      setInterpretationError(null);
      setPartialInterpretation({});

      let latestSnapshot: Partial<SearchInterpretation> = {};

      try {
        for await (const chunk of intelligentSearchService.streamInterpretation(
          trimmed,
        )) {
          if (interpretationRequestIdRef.current !== requestId) {
            return null;
          }

          if (chunk.type === "partial") {
            latestSnapshot = mergeInterpretationPartial(
              latestSnapshot,
              chunk.data,
            );
            setPartialInterpretation((previous) =>
              mergeInterpretationPartial(previous, chunk.data),
            );
            continue;
          }

          interpretationRef.current = chunk.data;
          interpretedQueryRef.current = trimmed;
          setInterpretation(chunk.data);
          setPartialInterpretation(chunk.data);

          logger.debug("Query interpretation completed", {
            query: trimmed,
            confidence: chunk.data.confidence,
          });

          return chunk.data;
        }

        return interpretationRef.current;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const err = new Error(errorMessage);
        setInterpretationError(err);
        interpretationRef.current = null;
        interpretedQueryRef.current = null;
        logger.error("Failed to interpret query", { error: errorMessage });
        return null;
      } finally {
        if (interpretationRequestIdRef.current === requestId) {
          setIsInterpretingSearch(false);
          if (
            !interpretationRef.current &&
            Object.keys(latestSnapshot).length
          ) {
            setPartialInterpretation(latestSnapshot);
          }
        }
      }
    },
    [enableAISearch, intelligentSearchService],
  );

  const performSearch = useCallback(
    async (query?: string) => {
      const queryToSearch = (query ?? searchQuery).trim();

      if (queryToSearch.length < 2) {
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setSearchErrors([]);
      setLastSearchDurationMs(0);

      try {
        let currentInterpretation = interpretationRef.current;

        if (
          !currentInterpretation ||
          interpretedQueryRef.current !== queryToSearch
        ) {
          currentInterpretation = await interpretQuery(queryToSearch);
        }

        if (!currentInterpretation) {
          setResults([]);
          return;
        }

        const response: UnifiedSearchResponse =
          await unifiedSearchService.search(queryToSearch, {
            serviceIds: currentInterpretation.recommendedServices,
            mediaTypes: mapInterpretationMediaTypes(
              currentInterpretation.mediaTypes,
            ),
            genres: currentInterpretation.genres,
            releaseYearMin: currentInterpretation.yearRange?.start,
            releaseYearMax: currentInterpretation.yearRange?.end,
            aiInterpretation: currentInterpretation,
          });

        setResults(response.results);
        setSearchErrors(response.errors);
        setLastSearchDurationMs(response.durationMs);
        setHasPerformedSearch(true);

        await searchHistoryService.addSearch({
          query: queryToSearch,
          mediaTypes: currentInterpretation.mediaTypes,
          genres: currentInterpretation.genres,
          confidence: currentInterpretation.confidence,
          resultsCount: response.results.length,
          resultServices: currentInterpretation.recommendedServices,
          resultMediaTypes: currentInterpretation.mediaTypes,
        });

        await loadHistory();

        logger.debug("Search completed", {
          query: queryToSearch,
          resultsCount: response.results.length,
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
      interpretQuery,
      unifiedSearchService,
      searchHistoryService,
      loadHistory,
    ],
  );

  const refineInterpretation = useCallback(
    (changes: Partial<SearchInterpretation>) => {
      setInterpretation((previous) => {
        const next = {
          ...(previous ?? {}),
        } as SearchInterpretation;

        (Object.keys(changes) as (keyof SearchInterpretation)[]).forEach(
          (key) => {
            const value = changes[key];

            if (value === null || value === undefined) {
              delete (next as Record<string, unknown>)[key as string];
              return;
            }

            if (Array.isArray(value)) {
              (next as Record<string, unknown>)[key as string] = [...value];
              return;
            }

            if (typeof value === "object") {
              (next as Record<string, unknown>)[key as string] = {
                ...(value as Record<string, unknown>),
              };
              return;
            }

            (next as Record<string, unknown>)[key as string] = value;
          },
        );

        interpretationRef.current = next;
        return next;
      });

      setPartialInterpretation((previous) => {
        const next: Partial<SearchInterpretation> = { ...previous };

        (Object.keys(changes) as (keyof SearchInterpretation)[]).forEach(
          (key) => {
            const value = changes[key];

            if (value === null || value === undefined) {
              delete (next as Record<string, unknown>)[key as string];
              return;
            }

            if (Array.isArray(value)) {
              (next as Record<string, unknown>)[key as string] = [...value];
              return;
            }

            if (typeof value === "object") {
              (next as Record<string, unknown>)[key as string] = {
                ...(value as Record<string, unknown>),
              };
              return;
            }

            (next as Record<string, unknown>)[key as string] = value;
          },
        );

        return next;
      });
    },
    [],
  );

  const bookmarkResult = useCallback(
    async (result: UnifiedSearchResult) => {
      try {
        await searchHistoryService.addSearch({
          query: searchQuery || result.title,
          mediaTypes: interpretationRef.current?.mediaTypes,
          genres: interpretationRef.current?.genres,
          confidence: interpretationRef.current?.confidence,
          resultsCount: 1,
          resultServices: [result.serviceId],
          resultMediaTypes: interpretationRef.current?.mediaTypes,
          userSelected: true,
          selectedResultId: result.id,
          notes: "Bookmarked from AI Search",
        });
        await loadHistory();
        logger.debug("Result bookmarked", { resultId: result.id });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to bookmark result", { error: errorMessage });
        throw error;
      }
    },
    [loadHistory, searchHistoryService, searchQuery],
  );

  const clearSearch = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    interpretationRequestIdRef.current += 1;
    interpretationRef.current = null;
    interpretedQueryRef.current = null;

    setSearchQuery("");
    setInterpretation(null);
    setPartialInterpretation({});
    setResults([]);
    setSearchError(null);
    setInterpretationError(null);
    setSearchErrors([]);
    setLastSearchDurationMs(0);
    setHasPerformedSearch(false);
    setLastHistoryEntry(null);
  }, []);

  const clearHistoryCallback = useCallback(async () => {
    try {
      await searchHistoryService.clearHistory();
      setSearchHistory([]);
      setLastHistoryEntry(null);
      logger.debug("Search history cleared");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Failed to clear history", { error: errorMessage });
      throw error;
    }
  }, [searchHistoryService]);

  useEffect(() => {
    if (!autoSearch || !enableAISearch) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      const trimmed = searchQuery.trim();
      if (trimmed.length >= 2) {
        void interpretQuery(trimmed);
      } else {
        interpretationRequestIdRef.current += 1;
        interpretationRef.current = null;
        interpretedQueryRef.current = null;
        setInterpretation(null);
        setPartialInterpretation({});
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, autoSearch, debounceMs, enableAISearch, interpretQuery]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    void loadRecommendations();
  }, [loadRecommendations]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
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
    searchErrors,
    lastSearchDurationMs,
    hasPerformedSearch,
    recommendations,
    isLoadingRecommendations,
    recommendationsError,
    interpretedQuery: interpretedQueryRef.current,
    recommendedServiceIds: interpretationRef.current?.recommendedServices ?? [],
    searchHistory,
    lastHistoryEntry,
    clearHistory: clearHistoryCallback,
    refreshRecommendations,
    performSearch,
    refineInterpretation,
    bookmarkResult,
    clearSearch,
  };
}
