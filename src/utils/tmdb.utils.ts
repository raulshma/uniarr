import type {
  DiscoverMediaItem,
  DiscoverMediaKind,
} from "@/models/discover.types";
import type {
  DiscoverMovieResponse,
  DiscoverTvResponse,
} from "@/connectors/implementations/TmdbConnector";

const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/original";
const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

export const buildPosterUrl = (path?: string | null): string | undefined => {
  if (!path) {
    return undefined;
  }
  return `${TMDB_POSTER_BASE}${path}`;
};

export const buildBackdropUrl = (path?: string | null): string | undefined => {
  if (!path) {
    return undefined;
  }
  return `${TMDB_BACKDROP_BASE}${path}`;
};

export const buildProfileUrl = (path?: string | null): string | undefined => {
  if (!path) {
    return undefined;
  }
  return `${TMDB_PROFILE_BASE}${path}`;
};

const extractYear = (date?: string | null): number | undefined => {
  if (!date || date.length < 4) {
    return undefined;
  }

  const parsed = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const createDiscoverId = (
  mediaType: DiscoverMediaKind,
  tmdbId: number | undefined,
): string => {
  const prefix = mediaType === "movie" ? "movie" : "series";
  return tmdbId ? `${prefix}-${tmdbId}` : `${prefix}-unknown-${Date.now()}`;
};

type MovieResult = NonNullable<DiscoverMovieResponse["results"]>[number];
type TvResult = NonNullable<DiscoverTvResponse["results"]>[number];

export const mapTmdbMovieToDiscover = (
  movie: MovieResult,
): DiscoverMediaItem => {
  const tmdbId = movie.id;
  const title = movie.title ?? movie.original_title ?? "Untitled Movie";

  return {
    id: createDiscoverId("movie", tmdbId),
    title,
    mediaType: "movie",
    overview: movie.overview,
    posterUrl: buildPosterUrl(movie.poster_path),
    backdropUrl: buildBackdropUrl(movie.backdrop_path),
    rating:
      typeof movie.vote_average === "number" ? movie.vote_average : undefined,
    popularity:
      typeof movie.popularity === "number" ? movie.popularity : undefined,
    releaseDate: movie.release_date,
    year: extractYear(movie.release_date),
    sourceId: movie.id,
    tmdbId: movie.id,
    voteCount:
      typeof movie.vote_count === "number" ? movie.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};

export const mapTmdbTvToDiscover = (series: TvResult): DiscoverMediaItem => {
  const tmdbId = series.id;
  const title = series.name ?? series.original_name ?? "Untitled Series";

  return {
    id: createDiscoverId("series", tmdbId),
    title,
    mediaType: "series",
    overview: series.overview,
    posterUrl: buildPosterUrl(series.poster_path),
    backdropUrl: buildBackdropUrl(series.backdrop_path),
    rating:
      typeof series.vote_average === "number" ? series.vote_average : undefined,
    popularity:
      typeof series.popularity === "number" ? series.popularity : undefined,
    releaseDate: series.first_air_date,
    year: extractYear(series.first_air_date),
    sourceId: series.id,
    tmdbId: series.id,
    voteCount:
      typeof series.vote_count === "number" ? series.vote_count : undefined,
    source: "tmdb",
  } satisfies DiscoverMediaItem;
};
