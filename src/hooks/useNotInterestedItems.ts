import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { RecommendationLearningService } from "@/services/ai/recommendations/RecommendationLearningService";
import { queryKeys } from "@/hooks/queryKeys";
import { logger } from "@/services/logger/LoggerService";
import type { FeedbackEvent } from "@/models/recommendation.schemas";

export type NotInterestedItem = Pick<
  FeedbackEvent,
  "recommendationId" | "recommendation" | "reason" | "timestamp"
>;

export function useNotInterestedItems(userId?: string): {
  items: NotInterestedItem[];
  isLoading: boolean;
  error: Error | null;
  remove: (recommendationId: string) => Promise<void>;
  clear: () => Promise<void>;
} {
  const service = RecommendationLearningService.getInstance();
  const queryClient = useQueryClient();
  // NotInterestedItem defined above

  const { data, isLoading, error } = useQuery<NotInterestedItem[], Error>({
    queryKey: userId
      ? queryKeys.recommendations.notInterested(userId)
      : ["recommendations", "notInterested", "global"],
    queryFn: async () => {
      if (!userId) return [];
      return service.getRejectedRecommendations(userId);
    },
  });

  const { mutateAsync: removeItem } = useMutation<void, Error, string>({
    mutationFn: async (recommendationId: string) => {
      if (!userId) return;
      await service.removeRejectedRecommendation(userId, recommendationId);
    },
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.notInterested(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.list(userId),
      });
      void logger.info("Removed not-interested recommendation from list", {
        userId,
      });
    },
  });

  const { mutateAsync: clearAll } = useMutation<void, Error, void>({
    mutationFn: async () => {
      if (!userId) return;
      await service.clearRejectedRecommendations(userId);
    },
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.notInterested(userId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations.list(userId),
      });
      void logger.info("Cleared all not-interested recommendations for user", {
        userId,
      });
    },
  });

  const remove = useCallback(
    (recommendationId: string) => removeItem(recommendationId),
    [removeItem],
  );
  const clear = useCallback(() => clearAll(), [clearAll]);

  return {
    items: data || [],
    isLoading,
    error: error as Error | null,
    remove,
    clear,
  };
}

export default useNotInterestedItems;
