import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type RefetchOptions,
} from "@tanstack/react-query";

import type { AddMovieRequest, Movie } from "@/models/movie.types";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { LibraryFilters } from "@/store/libraryFilterStore";

interface UseRadarrMoviesOptions {
  serviceId: string;
  filters?: LibraryFilters;
}

interface UseRadarrMoviesResult {
  movies: Movie[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: unknown;
  refetch: (
    options?: RefetchOptions,
  ) => Promise<QueryObserverResult<Movie[], Error>>;
  addMovie: (request: AddMovieRequest) => void;
  addMovieAsync: (request: AddMovieRequest) => Promise<Movie>;
  isAdding: boolean;
  addError: unknown;
}

const RADARR_SERVICE_TYPE = "radarr";

export const useRadarrMovies = ({
  serviceId,
  filters,
}: UseRadarrMoviesOptions): UseRadarrMoviesResult => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === RADARR_SERVICE_TYPE;

  const queryClient = useQueryClient();

  const moviesQuery = useQuery({
    queryKey: queryKeys.radarr.moviesList(
      serviceId,
      filters as Record<string, unknown> | undefined,
    ),
    queryFn: async () => {
      return (connector as RadarrConnector).getMovies(filters);
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addMovieMutation = useMutation({
    mutationKey: queryKeys.radarr.moviesList(serviceId),
    mutationFn: async (request: AddMovieRequest) => {
      return (connector as RadarrConnector).add(request);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.radarr.moviesList(serviceId),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.radarr.queue(serviceId),
      });
    },
  });

  return {
    movies: moviesQuery.data,
    isLoading: moviesQuery.isLoading,
    isFetching: moviesQuery.isFetching,
    isError: moviesQuery.isError,
    error: moviesQuery.error,
    refetch: moviesQuery.refetch,
    addMovie: addMovieMutation.mutate,
    addMovieAsync: addMovieMutation.mutateAsync,
    isAdding: addMovieMutation.isPending,
    addError: addMovieMutation.error,
  };
};
