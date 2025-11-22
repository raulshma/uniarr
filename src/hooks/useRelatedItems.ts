import { useMemo } from "react";
import { useTmdbDetails } from "@/hooks/tmdb/useTmdbDetails";
import type { DiscoverMediaItem } from "@/models/discover.types";
import type {
  DiscoverMovieResponse,
  DiscoverTvResponse,
} from "@/connectors/implementations/TmdbConnector";

type MovieListItem = NonNullable<DiscoverMovieResponse["results"]>[number];
type TvListItem = NonNullable<DiscoverTvResponse["results"]>[number];

/**
 * Helper to build a DiscoverMediaItem from TMDB movie data
 */
const buildMovieDiscoverItem = (movie: MovieListItem): DiscoverMediaItem => {
  const tmdbId =
    typeof movie.id === "number" ? movie.id : Number(movie.id ?? 0);
  const title =
    typeof movie.title === "string"
      ? movie.title
      : typeof movie.original_title === "string"
        ? movie.original_title
        : "Untitled Movie";

  return {
    id: `movie-${tmdbId}`,
    title,
    mediaType: "movie",
    overview: typeof movie.overview === "string" ? movie.overview : undefined,
    posterUrl: movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : undefined,
    backdropUrl: movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
      : undefined,
    rating:
      typeof movie.vote_average === "number" ? movie.vote_average : undefined,
    releaseDate:
      typeof movie.release_date === "string" ? movie.release_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount:
      typeof movie.vote_count === "number" ? movie.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

/**
 * Helper to build a DiscoverMediaItem from TMDB TV data
 */
const buildTvDiscoverItem = (tv: TvListItem): DiscoverMediaItem => {
  const tmdbId = typeof tv.id === "number" ? tv.id : Number(tv.id ?? 0);
  const title =
    typeof tv.name === "string"
      ? tv.name
      : typeof tv.original_name === "string"
        ? tv.original_name
        : "Untitled Series";

  return {
    id: `series-${tmdbId}`,
    title,
    mediaType: "series",
    overview: typeof tv.overview === "string" ? tv.overview : undefined,
    posterUrl: tv.poster_path
      ? `https://image.tmdb.org/t/p/w500${tv.poster_path}`
      : undefined,
    backdropUrl: tv.backdrop_path
      ? `https://image.tmdb.org/t/p/w1280${tv.backdrop_path}`
      : undefined,
    rating: typeof tv.vote_average === "number" ? tv.vote_average : undefined,
    releaseDate:
      typeof tv.first_air_date === "string" ? tv.first_air_date : undefined,
    tmdbId: tmdbId || undefined,
    sourceId: tmdbId || undefined,
    voteCount: typeof tv.vote_count === "number" ? tv.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

export interface UseRelatedItemsResult {
  recommendations: DiscoverMediaItem[];
  similar: DiscoverMediaItem[];
  isLoading: boolean;
}

/**
 * Hook to fetch real related items (recommendations and similar) from TMDB
 * @param mediaType - 'movie' or 'series'
 * @param tmdbId - TMDB ID for the media
 * @param enabled - Whether to fetch the items
 * @returns Object containing recommendations, similar items, and loading state
 */
export const useRelatedItems = (
  mediaType: "movie" | "series" | undefined,
  tmdbId: number | undefined,
  enabled: boolean = true,
): UseRelatedItemsResult => {
  const tmdbMediaType = mediaType === "series" ? "tv" : "movie";

  const detailsQuery = useTmdbDetails(tmdbMediaType, tmdbId ?? null, {
    enabled: enabled && !!tmdbId && !!mediaType,
  });

  const recommendations = useMemo(() => {
    if (!detailsQuery.data || !mediaType) {
      return [];
    }

    // Optimized: Combine map and filter into single pass using reduce
    // This reduces O(2n) to O(n) and avoids creating intermediate array
    if (mediaType === "movie") {
      const results = (detailsQuery.data.recommendations?.results ??
        []) as MovieListItem[];
      return results.reduce<DiscoverMediaItem[]>((acc, entry) => {
        const item = buildMovieDiscoverItem(entry);
        if (typeof item.tmdbId === "number" && item.tmdbId > 0) {
          acc.push(item);
        }
        return acc;
      }, []);
    }

    const results = (detailsQuery.data.recommendations?.results ??
      []) as TvListItem[];
    return results.reduce<DiscoverMediaItem[]>((acc, entry) => {
      const item = buildTvDiscoverItem(entry);
      if (typeof item.tmdbId === "number" && item.tmdbId > 0) {
        acc.push(item);
      }
      return acc;
    }, []);
  }, [detailsQuery.data, mediaType]);

  const similar = useMemo(() => {
    if (!detailsQuery.data || !mediaType) {
      return [];
    }

    // Optimized: Combine map and filter into single pass using reduce
    // This reduces O(2n) to O(n) and avoids creating intermediate array
    if (mediaType === "movie") {
      const results = (detailsQuery.data.similar?.results ??
        []) as MovieListItem[];
      return results.reduce<DiscoverMediaItem[]>((acc, entry) => {
        const item = buildMovieDiscoverItem(entry);
        if (typeof item.tmdbId === "number" && item.tmdbId > 0) {
          acc.push(item);
        }
        return acc;
      }, []);
    }

    const results = (detailsQuery.data.similar?.results ?? []) as TvListItem[];
    return results.reduce<DiscoverMediaItem[]>((acc, entry) => {
      const item = buildTvDiscoverItem(entry);
      if (typeof item.tmdbId === "number" && item.tmdbId > 0) {
        acc.push(item);
      }
      return acc;
    }, []);
  }, [detailsQuery.data, mediaType]);

  return {
    recommendations,
    similar,
    isLoading: detailsQuery.isLoading,
  };
};
