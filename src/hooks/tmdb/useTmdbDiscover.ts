import { useInfiniteQuery } from "@tanstack/react-query";

import type {
  DiscoverMovieResponse,
  DiscoverTvResponse,
} from "@/connectors/implementations/TmdbConnector";
import { ensureTmdbConnector } from "@/services/tmdb/TmdbConnectorProvider";
import { queryKeys } from "@/hooks/queryKeys";

export type TmdbDiscoverMediaType = "movie" | "tv";

export interface TmdbDiscoverFilters {
  mediaType: TmdbDiscoverMediaType;
  genreId?: number;
  sortBy?: string;
  year?: number;
  language?: string;
  includeAdult?: boolean;
  watchRegion?: string;
}

interface DiscoverPageResult {
  page: number;
  totalPages: number;
  totalResults: number;
  results: DiscoverMovieResponse["results"] | DiscoverTvResponse["results"];
}

const mapFiltersToParams = (
  filters: TmdbDiscoverFilters,
  page: number,
): {
  mediaType: TmdbDiscoverMediaType;
  params: Record<string, unknown>;
} => {
  const base = {
    page,
    language: filters.language,
    include_adult: filters.includeAdult,
    sort_by: filters.sortBy,
    watch_region: filters.watchRegion,
  } as Record<string, unknown>;

  if (filters.genreId) {
    base.with_genres = String(filters.genreId);
  }

  if (filters.mediaType === "movie") {
    if (filters.year) {
      base.year = filters.year;
    }
    return { mediaType: "movie", params: base };
  }

  if (filters.year) {
    base.first_air_date_year = filters.year;
  }

  return { mediaType: "tv", params: base };
};

const serializeFilterKey = (filters: TmdbDiscoverFilters) => ({
  mediaType: filters.mediaType,
  genreId: filters.genreId ?? null,
  sortBy: filters.sortBy ?? "popularity.desc",
  year: filters.year ?? null,
  language: filters.language ?? null,
  includeAdult: filters.includeAdult ?? false,
  watchRegion: filters.watchRegion ?? null,
});

export const useTmdbDiscover = (
  filters: TmdbDiscoverFilters,
  options?: {
    enabled?: boolean;
  },
) => {
  const enabled = options?.enabled ?? true;

  return useInfiniteQuery<DiscoverPageResult, Error>({
    queryKey: queryKeys.tmdb.discover(
      filters.mediaType,
      serializeFilterKey(filters),
    ),
    enabled,
    getNextPageParam: (lastPage) => {
      if (!lastPage) return undefined;
      return lastPage.page < lastPage.totalPages
        ? lastPage.page + 1
        : undefined;
    },
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: async ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      const connector = await ensureTmdbConnector();
      const { mediaType, params } = mapFiltersToParams(filters, page);

      if (mediaType === "movie") {
        const response = await connector.discoverMovies(params);
        return {
          page: response.page,
          totalPages: response.total_pages ?? 0,
          totalResults: response.total_results ?? 0,
          results: response.results ?? [],
        } satisfies DiscoverPageResult;
      }

      const response = await connector.discoverTv(params);
      return {
        page: response.page,
        totalPages: response.total_pages ?? 0,
        totalResults: response.total_results ?? 0,
        results: response.results ?? [],
      } satisfies DiscoverPageResult;
    },
  });
};
