/**
 * Recommendation hooks for content recommendation engine
 *
 * This module provides React hooks for interacting with the content recommendation system:
 * - useRecommendations: Fetch and manage personalized recommendations
 * - useRecommendationFeedback: Record user feedback (accept/reject)
 * - useContentGaps: Identify missing content in user's library
 */

export {
  useRecommendations,
  type UseRecommendationsOptions,
  type UseRecommendationsReturn,
} from "../useRecommendations";

export {
  useRecommendationFeedback,
  type UseRecommendationFeedbackReturn,
} from "../useRecommendationFeedback";

export {
  useContentGaps,
  type UseContentGapsOptions,
  type UseContentGapsReturn,
} from "../useContentGaps";
