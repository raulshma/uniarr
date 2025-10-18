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

export const useTmdbDetails = <TType extends TmdbMediaType>(
  mediaType: TType,
  tmdbId: number | null,
  options: UseTmdbDetailsOptions = {},
) => {
  const { enabled = true, language } = options;

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
