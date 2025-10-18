import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/queryKeys";
import { JikanClient } from "@/services/jikan/JikanClient";
import type { JikanAnimeFull } from "@/models/jikan.types";

export const useJikanAnimeDetails = (malId?: number) => {
  const numericMalId =
    typeof malId === "number" && Number.isFinite(malId) && malId > 0
      ? malId
      : undefined;

  // Main anime details query
  const animeQuery = useQuery<JikanAnimeFull, Error>({
    queryKey: queryKeys.discover.jikanDetail(numericMalId ?? 0),
    enabled: Boolean(numericMalId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!numericMalId) {
        throw new Error("Invalid MyAnimeList id");
      }
      return JikanClient.getAnimeFullById(numericMalId);
    },
  });

  // Additional data queries with staggered execution
  const recommendationsQuery = useQuery({
    queryKey: [
      ...queryKeys.discover.jikanDetail(numericMalId ?? 0),
      "recommendations",
    ],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 30 * 60 * 1000, // 30 minutes - recommendations don't change often
    gcTime: 60 * 60 * 1000, // 1 hour
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 100));
      return JikanClient.getAnimeRecommendations(numericMalId);
    },
  });

  const reviewsQuery = useQuery({
    queryKey: [...queryKeys.discover.jikanDetail(numericMalId ?? 0), "reviews"],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 60 * 60 * 1000, // 1 hour - reviews are relatively stable
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 200));
      return JikanClient.getAnimeReviews(numericMalId);
    },
  });

  const picturesQuery = useQuery({
    queryKey: [
      ...queryKeys.discover.jikanDetail(numericMalId ?? 0),
      "pictures",
    ],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 2 * 60 * 60 * 1000, // 2 hours - pictures rarely change
    gcTime: 4 * 60 * 60 * 1000, // 4 hours
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 300));
      return JikanClient.getAnimePictures(numericMalId);
    },
  });

  const episodesQuery = useQuery({
    queryKey: [
      ...queryKeys.discover.jikanDetail(numericMalId ?? 0),
      "episodes",
    ],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 60 * 60 * 1000, // 1 hour - episode lists are stable
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 400));
      return JikanClient.getAnimeEpisodes(numericMalId);
    },
  });

  const statisticsQuery = useQuery({
    queryKey: [
      ...queryKeys.discover.jikanDetail(numericMalId ?? 0),
      "statistics",
    ],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 15 * 60 * 1000, // 15 minutes - statistics change more frequently
    gcTime: 30 * 60 * 1000, // 30 minutes
    queryFn: async () => {
      if (!numericMalId) throw new Error("Invalid MyAnimeList id");
      // Small delay to space out requests
      await new Promise((resolve) => setTimeout(resolve, 500));
      return JikanClient.getAnimeStatistics(numericMalId);
    },
  });

  const streamingQuery = useQuery({
    queryKey: [
      ...queryKeys.discover.jikanDetail(numericMalId ?? 0),
      "streaming",
    ],
    enabled: Boolean(numericMalId) && animeQuery.isSuccess,
    staleTime: 60 * 60 * 1000, // 1 hour - streaming info is relatively stable
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
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
