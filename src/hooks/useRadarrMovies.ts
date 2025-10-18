import { useCallback } from "react";
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
  selectGetConnector,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import { IConnector } from "@/connectors/base/IConnector";

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

const ensureRadarrConnector = (
  getConnector: (id: string) => IConnector | undefined,
  serviceId: string,
): RadarrConnector => {
  const connector = getConnector(serviceId);
  if (!connector || connector.config.type !== RADARR_SERVICE_TYPE) {
    throw new Error(
      `Radarr connector not registered for service ${serviceId}.`,
    );
  }

  return connector as RadarrConnector;
};

export const useRadarrMovies = (serviceId: string): UseRadarrMoviesResult => {
  const getConnector = useConnectorsStore(selectGetConnector);
  const connector = getConnector(serviceId);
  const hasConnector = connector?.config.type === RADARR_SERVICE_TYPE;

  const resolveConnector = useCallback(
    () => ensureRadarrConnector(getConnector, serviceId),
    [getConnector, serviceId],
  );

  const queryClient = useQueryClient();

  const moviesQuery = useQuery({
    queryKey: queryKeys.radarr.moviesList(serviceId),
    queryFn: async () => {
      const connector = resolveConnector();
      return connector.getMovies();
    },
    enabled: hasConnector,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const addMovieMutation = useMutation({
    mutationKey: queryKeys.radarr.moviesList(serviceId),
    mutationFn: async (request: AddMovieRequest) => {
      const connector = resolveConnector();
      return connector.add(request);
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
