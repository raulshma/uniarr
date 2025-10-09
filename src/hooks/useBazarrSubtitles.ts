import { useCallback, useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from '@tanstack/react-query';

import type {
  BazarrMovie,
  BazarrEpisode,
  BazarrSubtitle,
  BazarrMissingSubtitle,
  BazarrStatistics,
  BazarrSearchRequest,
  BazarrDownloadRequest,
} from '@/models/bazarr.types';
import type { BazarrConnector } from '@/connectors/implementations/BazarrConnector';
import { ConnectorManager } from '@/connectors/manager/ConnectorManager';
import { queryKeys } from '@/hooks/queryKeys';

interface UseBazarrSubtitlesResult {
  movies: BazarrMovie[] | undefined;
  episodes: BazarrEpisode[] | undefined;
  subtitles: BazarrSubtitle[] | undefined;
  missingSubtitles: BazarrMissingSubtitle[] | undefined;
  statistics: BazarrStatistics | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (options?: RefetchOptions) => Promise<QueryObserverResult>;
  searchSubtitles: (request: BazarrSearchRequest) => void;
  searchSubtitlesAsync: (request: BazarrSearchRequest) => Promise<any[]>;
  downloadSubtitle: (request: BazarrDownloadRequest) => void;
  downloadSubtitleAsync: (request: BazarrDownloadRequest) => Promise<boolean>;
  isSearching: boolean;
  isDownloading: boolean;
  searchError: unknown;
  downloadError: unknown;
}

const BAZARR_SERVICE_TYPE = 'bazarr';

const ensureBazarrConnector = (
  manager: ConnectorManager,
  serviceId: string,
): BazarrConnector => {
  const connector = manager.getConnector(serviceId);
  if (!connector || connector.config.type !== BAZARR_SERVICE_TYPE) {
    throw new Error(`Bazarr connector not registered for service ${serviceId}.`);
  }

  return connector as BazarrConnector;
};

export const useBazarrSubtitles = (serviceId: string): UseBazarrSubtitlesResult => {
  const queryClient = useQueryClient();
  const manager = useMemo(() => ConnectorManager.getInstance(), []);
  const hasConnector = manager.getConnector(serviceId)?.config.type === BAZARR_SERVICE_TYPE;

  const resolveConnector = useCallback(() => ensureBazarrConnector(manager, serviceId), [manager, serviceId]);

  // Movies query
  const moviesQuery = useQuery({
    queryKey: queryKeys.bazarr.moviesList(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return await connector.getMovies();
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Episodes query
  const episodesQuery = useQuery({
    queryKey: queryKeys.bazarr.episodesList(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return await connector.getEpisodes();
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Subtitles query
  const subtitlesQuery = useQuery({
    queryKey: queryKeys.bazarr.subtitlesList(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return await connector.getSubtitles();
    },
    enabled: hasConnector,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Statistics query
  const statisticsQuery = useQuery({
    queryKey: queryKeys.bazarr.statistics(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return await connector.getStatistics();
    },
    enabled: hasConnector,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Search subtitles mutation
  const searchSubtitlesMutation = useMutation({
    mutationFn: async (request: BazarrSearchRequest) => {
      const connector = resolveConnector();
      return await connector.searchSubtitles(request);
    },
    onSuccess: (data, variables) => {
      // Optionally update cache or trigger other queries
      queryClient.invalidateQueries({ queryKey: queryKeys.bazarr.subtitlesList(serviceId) });
    },
  });

  // Download subtitle mutation
  const downloadSubtitleMutation = useMutation({
    mutationFn: async (request: BazarrDownloadRequest) => {
      const connector = resolveConnector();
      return await connector.downloadSubtitle(request);
    },
    onSuccess: (data, variables) => {
      // Invalidate subtitles and statistics after download
      queryClient.invalidateQueries({ queryKey: queryKeys.bazarr.subtitlesList(serviceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bazarr.statistics(serviceId) });
    },
  });

  // Combined loading state
  const isLoading = moviesQuery.isLoading || episodesQuery.isLoading || subtitlesQuery.isLoading || statisticsQuery.isLoading;
  const isFetching = moviesQuery.isFetching || episodesQuery.isFetching || subtitlesQuery.isFetching || statisticsQuery.isFetching;
  const isError = moviesQuery.isError || episodesQuery.isError || subtitlesQuery.isError || statisticsQuery.isError;

  // Combined error state (using first error)
  const error = moviesQuery.error || episodesQuery.error || subtitlesQuery.error || statisticsQuery.error;

  // Combined refetch function
  const refetch = useCallback(async (options?: RefetchOptions) => {
    const results = await Promise.all([
      moviesQuery.refetch(options),
      episodesQuery.refetch(options),
      subtitlesQuery.refetch(options),
      statisticsQuery.refetch(options),
    ]);
    return results[0]; // Return first result for compatibility
  }, [moviesQuery, episodesQuery, subtitlesQuery, statisticsQuery]);

  // Get missing subtitles from movies and episodes
  const missingSubtitles = useMemo(() => {
    if (!moviesQuery.data || !episodesQuery.data) return undefined;

    return [
      ...(moviesQuery.data.flatMap(movie => movie.missingSubtitles || [])),
      ...(episodesQuery.data.flatMap(episode => episode.missingSubtitles || [])),
    ];
  }, [moviesQuery.data, episodesQuery.data]);

  return {
    movies: moviesQuery.data,
    episodes: episodesQuery.data,
    subtitles: subtitlesQuery.data,
    missingSubtitles,
    statistics: statisticsQuery.data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    searchSubtitles: searchSubtitlesMutation.mutate,
    searchSubtitlesAsync: searchSubtitlesMutation.mutateAsync,
    downloadSubtitle: downloadSubtitleMutation.mutate,
    downloadSubtitleAsync: downloadSubtitleMutation.mutateAsync,
    isSearching: searchSubtitlesMutation.isPending,
    isDownloading: downloadSubtitleMutation.isPending,
    searchError: searchSubtitlesMutation.error,
    downloadError: downloadSubtitleMutation.error,
  };
};
