import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import type {
  SearchHistoryEntry,
  SearchableServiceSummary,
  UnifiedSearchError,
  UnifiedSearchMediaType,
  UnifiedSearchOptions,
  UnifiedSearchResponse,
  UnifiedSearchResult,
} from "@/models/search.types";
import { queryKeys } from "@/hooks/queryKeys";
import {
  UnifiedSearchService,
  createUnifiedSearchHistoryKey,
} from "@/services/search/UnifiedSearchService";

interface UseUnifiedSearchConfig {
  readonly serviceIds?: string[];
  readonly mediaTypes?: UnifiedSearchMediaType[];
  readonly limitPerService?: number;
  readonly enabled?: boolean;
  readonly autoRecordHistory?: boolean;
  readonly quality?: string;
  readonly status?: string;
  readonly genres?: string[];
  readonly releaseYearMin?: number;
  readonly releaseYearMax?: number;
  readonly releaseType?: string;
}

interface UseUnifiedSearchResult {
  readonly results: UnifiedSearchResult[];
  readonly errors: UnifiedSearchError[];
  readonly durationMs: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<UnifiedSearchResponse, Error>>;
  readonly history: SearchHistoryEntry[];
  readonly isHistoryLoading: boolean;
  readonly searchableServices: SearchableServiceSummary[];
  readonly areServicesLoading: boolean;
  readonly recordSearch: (
    term?: string,
    overrides?: Pick<UnifiedSearchOptions, "serviceIds" | "mediaTypes">,
  ) => Promise<void>;
  readonly removeHistoryEntry: (entry: SearchHistoryEntry) => Promise<void>;
  readonly clearHistory: () => Promise<void>;
}

// Cache for normalized arrays to ensure reference stability
// This prevents unnecessary re-renders by returning the same reference
// when the normalized result is equivalent
const normalizedArrayCache = new WeakMap<
  readonly string[],
  string[] | undefined
>();

const normalizeArrayStable = <T extends string>(
  values?: readonly T[],
): T[] | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  // Check cache for stable reference
  const cached = normalizedArrayCache.get(values as readonly string[]);
  if (cached !== undefined) {
    return cached as T[] | undefined;
  }

  const deduped = Array.from(new Set(values.filter(Boolean) as T[]));
  const result = deduped.length > 0 ? deduped : undefined;

  // Store in cache for future calls
  normalizedArrayCache.set(
    values as readonly string[],
    result as string[] | undefined,
  );

  return result;
};

export const useUnifiedSearch = (
  term: string,
  config: UseUnifiedSearchConfig = {},
): UseUnifiedSearchResult => {
  const service = useMemo(() => UnifiedSearchService.getInstance(), []);
  const queryClient = useQueryClient();

  // React Compiler handles simple string operations
  const normalizedTerm = term.trim();

  // Use stable normalization to ensure reference equality when values don't change
  // This prevents unnecessary re-renders in child components
  const normalizedServiceIds = useMemo(
    () => normalizeArrayStable(config.serviceIds),
    [config.serviceIds],
  );
  const normalizedMediaTypes = useMemo(
    () => normalizeArrayStable(config.mediaTypes),
    [config.mediaTypes],
  );
  const normalizedGenres = useMemo(
    () => normalizeArrayStable(config.genres),
    [config.genres],
  );

  // React Compiler handles simple object literals
  const searchOptions: UnifiedSearchOptions = {
    serviceIds: normalizedServiceIds,
    mediaTypes: normalizedMediaTypes,
    limitPerService: config.limitPerService,
    quality: config.quality,
    status: config.status,
    genres: normalizedGenres,
    releaseYearMin: config.releaseYearMin,
    releaseYearMax: config.releaseYearMax,
    releaseType: config.releaseType,
  };

  const searchQuery = useQuery<UnifiedSearchResponse, Error>({
    queryKey: queryKeys.unifiedSearch.results(normalizedTerm, {
      serviceIds: normalizedServiceIds,
      mediaTypes: normalizedMediaTypes,
    }),
    queryFn: () => service.search(normalizedTerm, searchOptions),
    enabled: (config.enabled ?? true) && normalizedTerm.length >= 2,
    // Search results are relatively short-lived; keep previous data while
    // parameters change to avoid UI flicker when typing/paging. KeepPreviousData
    // isn't available in the strict option types here; components can opt-in
    // when needed via the consumer-level useQuery call overload.
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const historyQuery = useQuery<SearchHistoryEntry[]>({
    queryKey: queryKeys.unifiedSearch.history,
    queryFn: () => service.getHistory(),
    // History is user-managed and rarely changing; mark as never stale to
    // avoid unnecessary refetches.
    staleTime: Infinity,
  });

  const servicesQuery = useQuery<SearchableServiceSummary[]>({
    queryKey: queryKeys.unifiedSearch.services,
    queryFn: () => service.getSearchableServices(),
    staleTime: 5 * 60 * 1000,
  });

  const recordedKeyRef = useRef<string | null>(null);

  // Optimized automatic history recording effect
  // Only records when search succeeds and only invalidates history query
  useEffect(() => {
    if (config.autoRecordHistory === false) {
      return;
    }

    if (!searchQuery.isSuccess || normalizedTerm.length < 2) {
      return;
    }

    // Generate history key using optimized function
    const historyKey = createUnifiedSearchHistoryKey(
      normalizedTerm,
      normalizedServiceIds,
      normalizedMediaTypes,
    );

    // Skip if this exact search was already recorded
    if (historyKey === recordedKeyRef.current) {
      return;
    }

    recordedKeyRef.current = historyKey;

    // Record search and only invalidate history query (not search results)
    // This ensures history recording doesn't cause unnecessary search refetches
    void service
      .recordSearch(normalizedTerm, normalizedServiceIds, normalizedMediaTypes)
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.unifiedSearch.history,
        }),
      )
      .catch(() => {
        // Ignore history persistence failures at the hook level
        // History is a nice-to-have feature and shouldn't break search
      });
  }, [
    config.autoRecordHistory,
    normalizedMediaTypes,
    normalizedServiceIds,
    normalizedTerm,
    queryClient,
    searchQuery.isSuccess,
    service,
  ]);

  const recordSearch = useCallback<UseUnifiedSearchResult["recordSearch"]>(
    async (overrideTerm, overrides) => {
      const nextTerm = (overrideTerm ?? normalizedTerm).trim();
      if (nextTerm.length < 2) {
        return;
      }

      // Use stable normalization for consistent references
      const serviceIds = normalizeArrayStable(
        overrides?.serviceIds ?? config.serviceIds,
      );
      const mediaTypes = normalizeArrayStable(
        overrides?.mediaTypes ?? config.mediaTypes,
      );

      // Generate history key to check if we've already recorded this exact search
      const historyKey = createUnifiedSearchHistoryKey(
        nextTerm,
        serviceIds,
        mediaTypes,
      );

      // Skip recording and invalidation if this exact search was just recorded
      // This prevents unnecessary query invalidations and re-renders
      if (historyKey === recordedKeyRef.current) {
        return;
      }

      await service.recordSearch(nextTerm, serviceIds, mediaTypes);
      recordedKeyRef.current = historyKey;

      // Only invalidate the history query, not the search results query
      // This ensures search history recording doesn't trigger unnecessary refetches
      await queryClient.invalidateQueries({
        queryKey: queryKeys.unifiedSearch.history,
      });
    },
    [
      config.mediaTypes,
      config.serviceIds,
      normalizedTerm,
      queryClient,
      service,
    ],
  );

  const removeHistoryEntry = useCallback<
    UseUnifiedSearchResult["removeHistoryEntry"]
  >(
    async (entry) => {
      await service.removeHistoryEntry(entry);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.unifiedSearch.history,
      });
    },
    [queryClient, service],
  );

  const clearHistory = useCallback<
    UseUnifiedSearchResult["clearHistory"]
  >(async () => {
    await service.clearHistory();
    recordedKeyRef.current = null;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.unifiedSearch.history,
    });
  }, [queryClient, service]);

  const response = searchQuery.data ?? {
    results: [],
    errors: [],
    durationMs: 0,
  };

  return {
    results: response.results,
    errors: response.errors,
    durationMs: response.durationMs,
    isLoading: searchQuery.isLoading,
    isFetching: searchQuery.isFetching,
    isError: searchQuery.isError,
    error: searchQuery.error,
    refetch: searchQuery.refetch,
    history: historyQuery.data ?? [],
    isHistoryLoading: historyQuery.isLoading,
    searchableServices: servicesQuery.data ?? [],
    areServicesLoading: servicesQuery.isLoading,
    recordSearch,
    removeHistoryEntry,
    clearHistory,
  };
};
