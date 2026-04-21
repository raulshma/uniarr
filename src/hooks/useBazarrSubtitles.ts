import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import type {
  BazarrMovie,
  BazarrEpisode,
  BazarrSubtitle,
  BazarrMissingSubtitle,
  BazarrStatistics,
  BazarrSearchRequest,
  BazarrDownloadRequest,
} from "@/models/bazarr.types";
import type { BazarrConnector } from "@/connectors/implementations/BazarrConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";

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

const BAZARR_SERVICE_TYPE = "bazarr";

export const useBazarrSubtitles = (
  serviceId: string,
): UseBazarrSubtitlesResult => {
  const queryClient = useQueryClient();
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === BAZARR_SERVICE_TYPE;

  const bazarrConnector = connector as BazarrConnector;

  const moviesQuery = useQuery({
    queryKey: queryKeys.bazarr.moviesList(serviceId),
    queryFn: async () => {
      return await bazarrConnector.getMovies();
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
  });

  const episodesQuery = useQuery({
    queryKey: queryKeys.bazarr.episodesList(serviceId),
    queryFn: async () => {
      return await bazarrConnector.getEpisodes();
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
  });

  const subtitlesQuery = useQuery({
    queryKey: queryKeys.bazarr.subtitlesList(serviceId),
    queryFn: async () => {
      return await bazarrConnector.getSubtitles();
    },
    enabled: hasConnector,
    staleTime: 2 * 60 * 1000,
  });

  const statisticsQuery = useQuery({
    queryKey: queryKeys.bazarr.statistics(serviceId),
    queryFn: async () => {
      return await bazarrConnector.getStatistics();
    },
    enabled: hasConnector,
    staleTime: 10 * 60 * 1000,
  });

  const searchSubtitlesMutation = useMutation({
    mutationFn: async (request: BazarrSearchRequest) => {
      return await bazarrConnector.searchSubtitles(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bazarr.subtitlesList(serviceId),
      });
    },
  });

  const downloadSubtitleMutation = useMutation({
    mutationFn: async (request: BazarrDownloadRequest) => {
      return await bazarrConnector.downloadSubtitle(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bazarr.subtitlesList(serviceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bazarr.statistics(serviceId),
      });
    },
  });

  const isLoading =
    moviesQuery.isLoading ||
    episodesQuery.isLoading ||
    subtitlesQuery.isLoading ||
    statisticsQuery.isLoading;
  const isFetching =
    moviesQuery.isFetching ||
    episodesQuery.isFetching ||
    subtitlesQuery.isFetching ||
    statisticsQuery.isFetching;
  const isError =
    moviesQuery.isError ||
    episodesQuery.isError ||
    subtitlesQuery.isError ||
    statisticsQuery.isError;

  const error =
    moviesQuery.error ||
    episodesQuery.error ||
    subtitlesQuery.error ||
    statisticsQuery.error;

  const refetch = useCallback(
    async (options?: RefetchOptions) => {
      const results = await Promise.all([
        moviesQuery.refetch(options),
        episodesQuery.refetch(options),
        subtitlesQuery.refetch(options),
        statisticsQuery.refetch(options),
      ]);
      return results[0];
    },
    [moviesQuery, episodesQuery, subtitlesQuery, statisticsQuery],
  );

  const missingSubtitles = useMemo(() => {
    if (!moviesQuery.data || !episodesQuery.data) return undefined;

    return [
      ...moviesQuery.data.flatMap((movie) => movie.missingSubtitles || []),
      ...episodesQuery.data.flatMap(
        (episode) => episode.missingSubtitles || [],
      ),
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
