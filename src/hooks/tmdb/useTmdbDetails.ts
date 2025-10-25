import { useQuery } from "@tanstack/react-query";

import type {
  DiscoverMovieResponse,
  DiscoverTvResponse,
  MovieCreditsResponse,
  MovieDetailsWithExtrasResponse,
  MovieImagesResponse,
  MovieVideosResponse,
  MovieWatchProvidersResponse,
  TmdbMediaType,
  TvCreditsResponse,
  TvDetailsWithExtrasResponse,
  TvImagesResponse,
  TvVideosResponse,
  TvWatchProvidersResponse,
} from "@/connectors/implementations/TmdbConnector";
import { ensureTmdbConnector } from "@/services/tmdb/TmdbConnectorProvider";
import { queryKeys } from "@/hooks/queryKeys";
import { logger } from "@/services/logger/LoggerService";

type MediaDetailsMap = {
  movie: {
    details: MovieDetailsWithExtrasResponse;
    images?: MovieImagesResponse;
    videos?: MovieVideosResponse;
    watchProviders?: MovieWatchProvidersResponse;
    credits?: MovieCreditsResponse;
    recommendations?: DiscoverMovieResponse;
    similar?: DiscoverMovieResponse;
  };
  tv: {
    details: TvDetailsWithExtrasResponse;
    images?: TvImagesResponse;
    videos?: TvVideosResponse;
    watchProviders?: TvWatchProvidersResponse;
    credits?: TvCreditsResponse;
    recommendations?: DiscoverTvResponse;
    similar?: DiscoverTvResponse;
  };
};

export interface UseTmdbDetailsOptions {
  enabled?: boolean;
  language?: string;
}

/**
 * Gets the device locale language code (e.g., "en", "es", "fr").
 * Fallback to "en" if unavailable.
 */
const getDeviceLanguage = (): string => {
  try {
    // Use JS-only Intl fallback to avoid native modules in Expo managed workflow.
    const resolved = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.locale;
    if (typeof resolved === "string" && resolved.length > 0) {
      // locale may be like 'en-US' -> take primary language
      const split = resolved.split("-");
      const primary = split && split[0] ? split[0] : "en";
      return primary.toLowerCase();
    }
  } catch (error) {
    logger.warn(
      "Failed to get device language via Intl",
      error as unknown as Record<string | number, unknown>,
    );
  }

  // Last-resort default
  return "en";
};

/**
 * Gets the device region code (e.g., "US", "GB", "CA").
 * Used for watch provider region-aware selection (TMDB watchProviders).
 * Fallback to "US" if unavailable.
 */
export const getDeviceRegion = (): string => {
  try {
    // Use JS-only Intl fallback
    const resolved = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.locale;
    if (typeof resolved === "string" && resolved.length > 0) {
      // locale may be like 'en-US' -> extract region part
      const split = resolved.split("-");
      if (split.length > 1 && split[1]) {
        return split[1].toUpperCase();
      }
    }
  } catch (error) {
    logger.warn(
      "Failed to get device region via Intl",
      error as unknown as Record<string | number, unknown>,
    );
  }

  // Last-resort default
  return "US";
};

export const useTmdbDetails = <TType extends TmdbMediaType>(
  mediaType: TType,
  tmdbId: number | null,
  options: UseTmdbDetailsOptions = {},
) => {
  const { enabled = true } = options;
  // Use provided language or auto-detect device language
  const language = options.language ?? getDeviceLanguage();

  return useQuery<MediaDetailsMap[TType], Error>({
    enabled: enabled && Boolean(tmdbId),
    queryKey: queryKeys.tmdb.details(mediaType, tmdbId ?? 0, language),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    networkMode: "offlineFirst",
    queryFn: async () => {
      if (!tmdbId) {
        throw new Error("TMDB id is required for details lookup.");
      }

      const connector = await ensureTmdbConnector();
      const appendExtras = [
        "images",
        "videos",
        "watch/providers",
        "credits",
        "recommendations",
        "similar",
      ];

      if (mediaType === "movie") {
        const details = await connector.getDetails("movie", tmdbId, {
          language,
          appendToResponse: appendExtras,
        });
        const movieDetails = details as MovieDetailsWithExtrasResponse;

        return {
          details: movieDetails,
          images: movieDetails.images,
          videos: movieDetails.videos,
          watchProviders: movieDetails["watch/providers"],
          credits: movieDetails.credits,
          recommendations: movieDetails.recommendations,
          similar: movieDetails.similar,
        } as MediaDetailsMap[TType];
      }

      const details = await connector.getDetails("tv", tmdbId, {
        language,
        appendToResponse: appendExtras,
      });
      const tvDetails = details as TvDetailsWithExtrasResponse;

      return {
        details: tvDetails,
        images: tvDetails.images,
        videos: tvDetails.videos,
        watchProviders: tvDetails["watch/providers"],
        credits: tvDetails.credits,
        recommendations: tvDetails.recommendations,
        similar: tvDetails.similar,
      } as MediaDetailsMap[TType];
    },
  });
};
