import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import {
  useConnectorsStore,
  selectConnectorById,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
type JellyseerrSearchResult =
  | components["schemas"]["MovieResult"]
  | components["schemas"]["TvResult"];
type JellyseerrPagedResult<T> = {
  items: T[];
  total: number;
  pageInfo?: components["schemas"]["PageInfo"];
};

const JELLYSEERR_SERVICE_TYPE = "jellyseerr";

interface UseAnimeDiscoverOptions {
  serviceId: string;
  page?: number;
  enabled?: boolean;
}

export const useAnimeRecommendations = ({
  serviceId,
  page = 1,
  enabled = true,
}: UseAnimeDiscoverOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === JELLYSEERR_SERVICE_TYPE;

  return useQuery<JellyseerrPagedResult<JellyseerrSearchResult>, Error>({
    queryKey: queryKeys.jellyseerr.animeRecommendations(serviceId, page),
    queryFn: async ({ signal }) => {
      return (connector as JellyseerrConnector).getAnimeRecommendations(
        {
          page,
        },
        { signal },
      );
    },
    enabled: hasConnector && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useAnimeUpcoming = ({
  serviceId,
  page = 1,
  enabled = true,
}: UseAnimeDiscoverOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === JELLYSEERR_SERVICE_TYPE;

  return useQuery<JellyseerrPagedResult<JellyseerrSearchResult>, Error>({
    queryKey: queryKeys.jellyseerr.animeUpcoming(serviceId, page),
    queryFn: async ({ signal }) => {
      return (connector as JellyseerrConnector).getAnimeUpcoming(
        { page },
        { signal },
      );
    },
    enabled: hasConnector && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useTrendingAnime = ({
  serviceId,
  page = 1,
  enabled = true,
}: UseAnimeDiscoverOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === JELLYSEERR_SERVICE_TYPE;

  return useQuery<JellyseerrPagedResult<JellyseerrSearchResult>, Error>({
    queryKey: queryKeys.jellyseerr.trendingAnime(serviceId, page),
    queryFn: async ({ signal }) => {
      return (connector as JellyseerrConnector).getTrendingAnime(
        { page },
        { signal },
      );
    },
    enabled: hasConnector && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useAnimeMovies = ({
  serviceId,
  page = 1,
  enabled = true,
}: UseAnimeDiscoverOptions) => {
  const connector = useConnectorsStore(selectConnectorById(serviceId));
  const hasConnector = connector?.config.type === JELLYSEERR_SERVICE_TYPE;

  return useQuery<JellyseerrPagedResult<JellyseerrSearchResult>, Error>({
    queryKey: queryKeys.jellyseerr.animeMovies(serviceId, page),
    queryFn: async ({ signal }) => {
      return (connector as JellyseerrConnector).getAnimeMovies(
        { page },
        { signal },
      );
    },
    enabled: hasConnector && enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

export const useAnimeDiscover = ({
  serviceId,
  enabled = true,
}: {
  serviceId: string;
  enabled?: boolean;
}) => {
  const recommendations = useAnimeRecommendations({
    serviceId,
    page: 1,
    enabled,
  });
  const upcoming = useAnimeUpcoming({ serviceId, page: 1, enabled });
  const trending = useTrendingAnime({ serviceId, page: 1, enabled });
  const movies = useAnimeMovies({ serviceId, page: 1, enabled });

  const isLoading = useMemo(
    () =>
      recommendations.isLoading ||
      upcoming.isLoading ||
      trending.isLoading ||
      movies.isLoading,
    [
      recommendations.isLoading,
      upcoming.isLoading,
      trending.isLoading,
      movies.isLoading,
    ],
  );

  const isError = useMemo(
    () =>
      recommendations.isError ||
      upcoming.isError ||
      trending.isError ||
      movies.isError,
    [
      recommendations.isError,
      upcoming.isError,
      trending.isError,
      movies.isError,
    ],
  );

  return {
    recommendations: recommendations.data?.items ?? [],
    upcoming: upcoming.data?.items ?? [],
    trending: trending.data?.items ?? [],
    movies: movies.data?.items ?? [],
    isLoading,
    isError,
    refetch: async () => {
      await Promise.all([
        recommendations.refetch(),
        upcoming.refetch(),
        trending.refetch(),
        movies.refetch(),
      ]);
    },
  };
};
