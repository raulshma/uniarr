import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { Movie } from "@/models/movie.types";
import { queryKeys } from "@/hooks/queryKeys";

interface UseRadarrMovieDetailsParams {
  serviceId: string;
  movieId: number;
}

export interface UseRadarrMovieDetailsResult {
  movie: Movie | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<Movie, Error>>;
  toggleMonitor: (nextState: boolean) => void;
  toggleMonitorAsync: (nextState: boolean) => Promise<void>;
  isTogglingMonitor: boolean;
  toggleMonitorError: unknown;
  triggerSearch: () => void;
  triggerSearchAsync: () => Promise<void>;
  isTriggeringSearch: boolean;
  triggerSearchError: unknown;
  deleteMovie: (options?: {
    deleteFiles?: boolean;
    addImportListExclusion?: boolean;
  }) => void;
  deleteMovieAsync: (options?: {
    deleteFiles?: boolean;
    addImportListExclusion?: boolean;
  }) => Promise<void>;
  isDeleting: boolean;
  deleteError: unknown;
}

const RADARR_SERVICE_TYPE = "radarr";

export const useRadarrMovieDetails = ({
  serviceId,
  movieId,
}: UseRadarrMovieDetailsParams): UseRadarrMovieDetailsResult => {
  const queryClient = useQueryClient();
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === RADARR_SERVICE_TYPE;

  const radarrConnector = connector as RadarrConnector;

  const detailsQuery = useQuery({
    queryKey: queryKeys.radarr.movieDetail(serviceId, movieId),
    queryFn: async () => {
      return radarrConnector.getById(movieId);
    },
    enabled: hasConnector && Number.isFinite(movieId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const toggleMonitorMutation = useMutation({
    mutationKey: [
      ...queryKeys.radarr.movieDetail(serviceId, movieId),
      "monitor",
    ],
    mutationFn: async (nextState: boolean) => {
      await radarrConnector.setMonitored(movieId, nextState);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.movieDetail(serviceId, movieId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.moviesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.queue(serviceId),
        }),
      ]);
    },
  });

  const triggerSearchMutation = useMutation({
    mutationKey: [
      ...queryKeys.radarr.movieDetail(serviceId, movieId),
      "search",
    ],
    mutationFn: async () => {
      await radarrConnector.triggerSearch(movieId);
    },
  });

  const deleteMovieMutation = useMutation({
    mutationKey: [
      ...queryKeys.radarr.movieDetail(serviceId, movieId),
      "delete",
    ],
    mutationFn: async (options?: {
      deleteFiles?: boolean;
      addImportListExclusion?: boolean;
    }) => {
      await radarrConnector.deleteMovie(movieId, options);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.movieDetail(serviceId, movieId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.moviesList(serviceId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.radarr.queue(serviceId),
        }),
      ]);
      queryClient.removeQueries({
        queryKey: queryKeys.radarr.movieDetail(serviceId, movieId),
      });
    },
  });

  return {
    movie: detailsQuery.data,
    isLoading: detailsQuery.isLoading,
    isFetching: detailsQuery.isFetching,
    isError: detailsQuery.isError,
    error: detailsQuery.error,
    refetch: detailsQuery.refetch,
    toggleMonitor: toggleMonitorMutation.mutate,
    toggleMonitorAsync: toggleMonitorMutation.mutateAsync,
    isTogglingMonitor: toggleMonitorMutation.isPending,
    toggleMonitorError: toggleMonitorMutation.error,
    triggerSearch: triggerSearchMutation.mutate,
    triggerSearchAsync: triggerSearchMutation.mutateAsync,
    isTriggeringSearch: triggerSearchMutation.isPending,
    triggerSearchError: triggerSearchMutation.error,
    deleteMovie: deleteMovieMutation.mutate,
    deleteMovieAsync: deleteMovieMutation.mutateAsync,
    isDeleting: deleteMovieMutation.isPending,
    deleteError: deleteMovieMutation.error,
  };
};
