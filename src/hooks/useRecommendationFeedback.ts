import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ContentRecommendationService } from "@/services/ai/recommendations/ContentRecommendationService";
import { queryKeys } from "@/hooks/queryKeys";
import { logger } from "@/services/logger/LoggerService";
import type { Recommendation } from "@/models/recommendation.schemas";

/**
 * Feedback mutation variables
 */
interface FeedbackVariables {
  /** User ID */
  userId: string;
  /** Recommendation ID */
  recommendationId: string;
  recommendation?: Recommendation;
  /** Feedback type */
  feedback: "accepted" | "rejected";
  /** Optional reason for feedback */
  reason?: string;
}

/**
 * Return type for useRecommendationFeedback hook
 */
export interface UseRecommendationFeedbackReturn {
  /** Record acceptance of a recommendation */
  acceptRecommendation: (
    userId: string,
    recommendationIdOrRecommendation: string | Recommendation,
    reason?: string,
  ) => Promise<void>;
  /** Record rejection of a recommendation */
  rejectRecommendation: (
    userId: string,
    recommendationIdOrRecommendation: string | Recommendation,
    reason?: string,
  ) => Promise<void>;
  /** Whether feedback is being submitted */
  isSubmitting: boolean;
  /** Error from feedback submission */
  error: Error | null;
  /** Reset error state */
  reset: () => void;
}

/**
 * Hook for recording user feedback on recommendations
 *
 * Features:
 * - Optimistic updates for immediate UI feedback
 * - Automatic cache invalidation after feedback
 * - Error handling and rollback
 * - Loading states
 *
 * @example
 * ```tsx
 * const {
 *   acceptRecommendation,
 *   rejectRecommendation,
 *   isSubmitting,
 *   error
 * } = useRecommendationFeedback();
 *
 * // Accept a recommendation
 * await acceptRecommendation('user123', 'rec_123', 'Looks interesting');
 *
 * // Reject a recommendation
 * await rejectRecommendation('user123', 'rec_456', 'Not my style');
 * ```
 */
export function useRecommendationFeedback(): UseRecommendationFeedbackReturn {
  const queryClient = useQueryClient();
  const recommendationService = ContentRecommendationService.getInstance();

  // Mutation for recording feedback
  const {
    mutateAsync,
    isPending: isSubmitting,
    error,
    reset,
  } = useMutation({
    mutationFn: async (variables: FeedbackVariables) => {
      const { userId, recommendationId, feedback, reason, recommendation } =
        variables;

      void logger.info("Recording recommendation feedback", {
        userId,
        recommendationId,
        feedback,
      });

      await recommendationService.recordFeedback(
        userId,
        recommendationId,
        feedback,
        reason,
        recommendation,
      );
    },
    onMutate: async (variables: FeedbackVariables) => {
      const { userId, recommendationId, feedback } = variables;

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.recommendations.list(userId),
      });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(
        queryKeys.recommendations.list(userId),
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        queryKeys.recommendations.list(userId),
        (old: any) => {
          if (!old) return old;

          return {
            ...old,
            recommendations:
              feedback === "rejected"
                ? old.recommendations.filter(
                    (rec: Recommendation) => rec.id !== recommendationId,
                  )
                : old.recommendations.map((rec: Recommendation) => {
                    if (rec.id === recommendationId) {
                      return {
                        ...rec,
                        // Add a temporary flag to indicate feedback was recorded
                        _feedbackRecorded: feedback,
                      };
                    }
                    return rec;
                  }),
          };
        },
      );

      void logger.debug("Optimistic update applied", {
        userId,
        recommendationId,
        feedback,
      });

      // Return context for rollback
      return { previousData, userId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.recommendations.list(context.userId),
          context.previousData,
        );

        void logger.warn("Rolled back optimistic update due to error", {
          userId: context.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    onSuccess: async (data, variables) => {
      const { userId } = variables;

      void logger.info("Feedback recorded successfully", {
        userId,
        recommendationId: variables.recommendationId,
      });

      // Note: We do NOT invalidate the cache here to avoid triggering automatic refresh
      // The optimistic update already removed the card from the UI
      // The preference will be applied on the next manual refresh or cache expiration
    },
  });

  /**
   * Record acceptance of a recommendation
   */
  const acceptRecommendation = useCallback(
    async (
      userId: string,
      recommendationIdOrRecommendation: string | Recommendation,
      reason?: string,
    ) => {
      const recommendation =
        typeof recommendationIdOrRecommendation === "string"
          ? undefined
          : (recommendationIdOrRecommendation as Recommendation);
      const recommendationId =
        typeof recommendationIdOrRecommendation === "string"
          ? recommendationIdOrRecommendation
          : (recommendation as Recommendation).id;

      if (!recommendationId) {
        throw new Error("Recommendation ID is required to record feedback");
      }
      try {
        await mutateAsync({
          userId,
          recommendationId,
          feedback: "accepted",
          reason,
          recommendation,
        });
      } catch (error) {
        void logger.error("Failed to accept recommendation", {
          userId,
          recommendationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [mutateAsync],
  );

  /**
   * Record rejection of a recommendation
   */
  const rejectRecommendation = useCallback(
    async (
      userId: string,
      recommendationIdOrRecommendation: string | Recommendation,
      reason?: string,
    ) => {
      const recommendation =
        typeof recommendationIdOrRecommendation === "string"
          ? undefined
          : (recommendationIdOrRecommendation as Recommendation);
      const recommendationId =
        typeof recommendationIdOrRecommendation === "string"
          ? recommendationIdOrRecommendation
          : (recommendation as Recommendation).id;

      if (!recommendationId) {
        throw new Error("Recommendation ID is required to record feedback");
      }
      try {
        await mutateAsync({
          userId,
          recommendationId,
          feedback: "rejected",
          reason,
          recommendation,
        });
      } catch (error) {
        void logger.error("Failed to reject recommendation", {
          userId,
          recommendationId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    [mutateAsync],
  );

  return {
    acceptRecommendation,
    rejectRecommendation,
    isSubmitting,
    error: error as Error | null,
    reset,
  };
}
