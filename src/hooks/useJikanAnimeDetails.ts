import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/queryKeys";
import { QUERY_CONFIG } from "@/hooks/queryConfig";
import { JikanClient } from "@/services/jikan/JikanClient";
import type { JikanAnimeFull } from "@/models/jikan.types";

export const useJikanAnimeDetails = (malId?: number) => {
  const numericMalId =
    typeof malId === "number" && Number.isFinite(malId) && malId > 0
      ? malId
      : undefined;

  // Main anime details query
  const animeQuery = useQuery<JikanAnimeFull, Error>({
    queryKey: queryKeys.discover.jikan.detail(numericMalId ?? 0),
    enabled: Boolean(numericMalId),
    ...QUERY_CONFIG.ANIME,
    queryFn: async () => {
      if (!numericMalId) {
        throw new Error("Invalid MyAnimeList id");
      }
      return JikanClient.getAnimeFullById(numericMalId);
    },
  });

  // Additional data queries with staggered execution
  const recommendationsQuery = useQuery({
    queryKey: queryKeys.discover.jikan.detailRecommendations(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 100));
      return JikanClient.getAnimeRecommendations(numericMalId);
    },
  });

  const reviewsQuery = useQuery({
    queryKey: queryKeys.discover.jikan.reviews(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 200));
      return JikanClient.getAnimeReviews(numericMalId);
    },
  });

  const picturesQuery = useQuery({
    queryKey: queryKeys.discover.jikan.pictures(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 300));
      return JikanClient.getAnimePictures(numericMalId);
    },
  });

  const episodesQuery = useQuery({
    queryKey: queryKeys.discover.jikan.episodes(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 400));
      return JikanClient.getAnimeEpisodes(numericMalId);
    },
  });

  const statisticsQuery = useQuery({
    queryKey: queryKeys.discover.jikan.statistics(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 500));
      return JikanClient.getAnimeStatistics(numericMalId);
    },
  });

  const streamingQuery = useQuery({
    queryKey: queryKeys.discover.jikan.streaming(numericMalId ?? 0),
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    ...QUERY_CONFIG.ANIME_DETAIL,
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 600));
      return JikanClient.getAnimeStreaming(numericMalId);
    },
  });

  // Combine all data
  const anime = animeQuery.data
    ? {
        ...animeQuery.data,
        recommendations: recommendationsQuery.data || [],
        reviews: reviewsQuery.data || [],
        pictures: picturesQuery.data || [],
        episodes: episodesQuery.data || [],
        statistics: statisticsQuery.data || null,
        streaming: streamingQuery.data || [],
      }
    : undefined;

  return {
    anime,
    isLoading:
      animeQuery.isLoading ||
      (animeQuery.isSuccess &&
        (recommendationsQuery.isLoading ||
          reviewsQuery.isLoading ||
          picturesQuery.isLoading ||
          episodesQuery.isLoading ||
          statisticsQuery.isLoading ||
          streamingQuery.isLoading)),
    isError:
      animeQuery.isError ||
      recommendationsQuery.isError ||
      reviewsQuery.isError ||
      picturesQuery.isError ||
      episodesQuery.isError ||
      statisticsQuery.isError ||
      streamingQuery.isError,
    error:
      animeQuery.error ||
      recommendationsQuery.error ||
      reviewsQuery.error ||
      picturesQuery.error ||
      episodesQuery.error ||
      statisticsQuery.error ||
      streamingQuery.error,
    refetch: animeQuery.refetch,
  };
};
