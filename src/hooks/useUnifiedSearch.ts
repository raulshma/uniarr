import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, type QueryObserverResult, type RefetchOptions } from '@tanstack/react-query';

import type {
  SearchHistoryEntry,
  SearchableServiceSummary,
  UnifiedSearchError,
  UnifiedSearchMediaType,
  UnifiedSearchOptions,
  UnifiedSearchResponse,
  UnifiedSearchResult,
} from '@/models/search.types';
import { queryKeys } from '@/hooks/queryKeys';
import { UnifiedSearchService, createUnifiedSearchHistoryKey } from '@/services/search/UnifiedSearchService';

interface UseUnifiedSearchConfig {
  readonly serviceIds?: string[];
  readonly mediaTypes?: UnifiedSearchMediaType[];
  readonly limitPerService?: number;
  readonly enabled?: boolean;
  readonly autoRecordHistory?: boolean;
}

interface UseUnifiedSearchResult {
  readonly results: UnifiedSearchResult[];
  readonly errors: UnifiedSearchError[];
  readonly durationMs: number;
  readonly isLoading: boolean;
  readonly isFetching: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: (options?: RefetchOptions) => Promise<QueryObserverResult<UnifiedSearchResponse, Error>>;
  readonly history: SearchHistoryEntry[];
  readonly isHistoryLoading: boolean;
  readonly searchableServices: SearchableServiceSummary[];
  readonly areServicesLoading: boolean;
  readonly recordSearch: (
    term?: string,
    overrides?: Pick<UnifiedSearchOptions, 'serviceIds' | 'mediaTypes'>,
  ) => Promise<void>;
  readonly removeHistoryEntry: (entry: SearchHistoryEntry) => Promise<void>;
  readonly clearHistory: () => Promise<void>;
}

const normalizeArray = <T extends string>(values?: readonly T[]): T[] | undefined => {
  if (!values || values.length === 0) {
    return undefined;
  }

  const deduped = Array.from(new Set(values.filter(Boolean) as T[]));
  return deduped.length > 0 ? deduped : undefined;
};

export const useUnifiedSearch = (term: string, config: UseUnifiedSearchConfig = {}): UseUnifiedSearchResult => {
  const service = useMemo(() => UnifiedSearchService.getInstance(), []);
  const queryClient = useQueryClient();

  const normalizedTerm = useMemo(() => term.trim(), [term]);
  const normalizedServiceIds = useMemo(() => normalizeArray(config.serviceIds), [config.serviceIds]);
  const normalizedMediaTypes = useMemo(() => normalizeArray(config.mediaTypes), [config.mediaTypes]);

  const searchOptions = useMemo<UnifiedSearchOptions>(
    () => ({
      serviceIds: normalizedServiceIds,
      mediaTypes: normalizedMediaTypes,
      limitPerService: config.limitPerService,
    }),
    [config.limitPerService, normalizedMediaTypes, normalizedServiceIds],
  );

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

  useEffect(() => {
    if (config.autoRecordHistory === false) {
      return;
    }

    if (!searchQuery.isSuccess || normalizedTerm.length < 2) {
      return;
    }

    const historyKey = createUnifiedSearchHistoryKey(normalizedTerm, normalizedServiceIds, normalizedMediaTypes);
    if (historyKey === recordedKeyRef.current) {
      return;
    }

    recordedKeyRef.current = historyKey;

    void service
      .recordSearch(normalizedTerm, normalizedServiceIds, normalizedMediaTypes)
      .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.unifiedSearch.history }))
      .catch(() => {
        // ignore history persistence failures at the hook level
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

  const recordSearch = useCallback<UseUnifiedSearchResult['recordSearch']>(
    async (overrideTerm, overrides) => {
      const nextTerm = (overrideTerm ?? normalizedTerm).trim();
      if (nextTerm.length < 2) {
        return;
      }

      const serviceIds = normalizeArray(overrides?.serviceIds ?? config.serviceIds);
      const mediaTypes = normalizeArray(overrides?.mediaTypes ?? config.mediaTypes);

      await service.recordSearch(nextTerm, serviceIds, mediaTypes);
      recordedKeyRef.current = createUnifiedSearchHistoryKey(nextTerm, serviceIds, mediaTypes);
      await queryClient.invalidateQueries({ queryKey: queryKeys.unifiedSearch.history });
    },
    [config.mediaTypes, config.serviceIds, normalizedTerm, queryClient, service],
  );

  const removeHistoryEntry = useCallback<UseUnifiedSearchResult['removeHistoryEntry']>(
    async (entry) => {
      await service.removeHistoryEntry(entry);
      await queryClient.invalidateQueries({ queryKey: queryKeys.unifiedSearch.history });
    },
    [queryClient, service],
  );

  const clearHistory = useCallback<UseUnifiedSearchResult['clearHistory']>(async () => {
    await service.clearHistory();
    recordedKeyRef.current = null;
    await queryClient.invalidateQueries({ queryKey: queryKeys.unifiedSearch.history });
  }, [queryClient, service]);

  const response = searchQuery.data ?? { results: [], errors: [], durationMs: 0 };

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
