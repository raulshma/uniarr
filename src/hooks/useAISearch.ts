import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SearchableServiceSummary,
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
  recommendedServices: SearchableServiceSummary[];
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
  const [searchableServices, setSearchableServices] = useState<
    SearchableServiceSummary[]
  >([]);

  useEffect(() => {
    console.warn("[useAISearch] isSearching state updated", {
      isSearching,
      resultsCount: results.length,
      hasPerformedSearch,
    });
  }, [isSearching, results.length, hasPerformedSearch]);

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

      try {
        const interpretationResult =
          await intelligentSearchService.interpretQuery(trimmed);

        if (interpretationRequestIdRef.current !== requestId) {
          return null;
        }

        interpretationRef.current = interpretationResult;
        interpretedQueryRef.current = trimmed;
        setInterpretation(interpretationResult);
        setPartialInterpretation(interpretationResult);

        logger.debug("Query interpretation completed", {
          query: trimmed,
          confidence: interpretationResult.confidence,
        });

        return interpretationResult;
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
          console.warn(
            "[useAISearch] No interpretation result, setting empty results",
          );
          setResults([]);
          return;
        }

        console.warn("[useAISearch] Current interpretation:", {
          mediaTypes: currentInterpretation.mediaTypes,
          genres: currentInterpretation.genres,
          recommendedServices: currentInterpretation.recommendedServices,
          yearRange: currentInterpretation.yearRange,
        });

        const mappedMediaTypes = mapInterpretationMediaTypes(
          currentInterpretation.mediaTypes,
        );
        console.warn("[useAISearch] Mapped media types:", mappedMediaTypes);

        const resolvedServices = mapRecommendedServices(
          currentInterpretation.recommendedServices,
        );
        const resolvedServiceIds = resolvedServices.map(
          (service) => service.serviceId,
        );
        if (resolvedServiceIds.length > 0) {
          console.warn("[useAISearch] Mapped service IDs:", resolvedServiceIds);
        } else if (currentInterpretation.recommendedServices?.length) {
          console.warn(
            "[useAISearch] No matching connectors for recommended services",
            {
              recommendedServices: currentInterpretation.recommendedServices,
            },
          );
        }

        const response: UnifiedSearchResponse =
          await unifiedSearchService.search(queryToSearch, {
            serviceIds:
              resolvedServiceIds.length > 0 ? resolvedServiceIds : undefined,
            mediaTypes: mappedMediaTypes,
            genres: currentInterpretation.genres,
            releaseYearMin: currentInterpretation.yearRange?.start,
            releaseYearMax: currentInterpretation.yearRange?.end,
            aiInterpretation: currentInterpretation,
          });

        console.warn("[useAISearch] Search response:", {
          resultCount: response.results.length,
          errorCount: response.errors.length,
          durationMs: response.durationMs,
          firstResult: response.results[0],
        });

        let finalResults = response.results;
        let finalErrors = response.errors;
        let finalDuration = response.durationMs;

        if (finalResults.length === 0 && resolvedServiceIds.length > 0) {
          const fallback = await unifiedSearchService.search(queryToSearch, {
            mediaTypes: mappedMediaTypes,
            genres: currentInterpretation.genres,
            releaseYearMin: currentInterpretation.yearRange?.start,
            releaseYearMax: currentInterpretation.yearRange?.end,
            aiInterpretation: currentInterpretation,
          });

          if (fallback.results.length > 0 || fallback.errors.length > 0) {
            finalResults = fallback.results;
            finalErrors = [...finalErrors, ...fallback.errors];
            finalDuration += fallback.durationMs;
          }
        }

        setResults(finalResults);
        setSearchErrors(finalErrors);
        setLastSearchDurationMs(finalDuration);
        setHasPerformedSearch(true);

        const historyServices =
          resolvedServiceIds.length > 0
            ? resolvedServiceIds
            : currentInterpretation.recommendedServices;

        await searchHistoryService.addSearch({
          query: queryToSearch,
          mediaTypes: currentInterpretation.mediaTypes,
          genres: currentInterpretation.genres,
          confidence: currentInterpretation.confidence,
          resultsCount: response.results.length,
          resultServices: historyServices,
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
    // eslint-disable-next-line react-compiler/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    let isMounted = true;

    const loadSearchableServices = async () => {
      try {
        const services = await unifiedSearchService.getSearchableServices();
        if (isMounted) {
          setSearchableServices(services);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to load searchable services", {
          error: errorMessage,
        });
      }
    };

    void loadSearchableServices();

    return () => {
      isMounted = false;
    };
  }, [unifiedSearchService]);

  const mapRecommendedServices = useCallback(
    (serviceTypes?: SearchInterpretation["recommendedServices"]) => {
      if (!serviceTypes?.length || searchableServices.length === 0) {
        return [];
      }

      const typeSet = new Set<string>(serviceTypes);
      return searchableServices.filter((service) =>
        typeSet.has(service.serviceType),
      );
    },
    [searchableServices],
  );

  const activeRecommendedServiceTypes = useMemo(() => {
    if (interpretation?.recommendedServices?.length) {
      return interpretation.recommendedServices;
    }

    return partialInterpretation?.recommendedServices ?? [];
  }, [interpretation, partialInterpretation]);

  const recommendedServices = useMemo(
    () => mapRecommendedServices(activeRecommendedServiceTypes),
    [activeRecommendedServiceTypes, mapRecommendedServices],
  );

  const recommendedServiceIds = useMemo(
    () => recommendedServices.map((service) => service.serviceId),
    [recommendedServices],
  );

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
    recommendedServiceIds,
    recommendedServices,
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
