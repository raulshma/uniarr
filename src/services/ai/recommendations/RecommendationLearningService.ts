/**
 * Recommendation Learning Service
 *
 * Tracks user feedback on recommendations and learns patterns to improve
 * future recommendation accuracy. Stores feedback events and analyzes
 * acceptance/rejection patterns to adjust scoring weights.
 */

import { StorageBackendManager } from "@/services/storage/MMKVStorage";
import type {
  FeedbackPattern,
  LearningWeights,
  UserContext,
} from "@/models/recommendation.types";
import type {
  FeedbackEvent,
  Recommendation,
} from "@/models/recommendation.schemas";

/**
 * Default weights for recommendation scoring factors
 */
const DEFAULT_WEIGHTS: LearningWeights = {
  genreWeight: 30,
  ratingWeight: 25,
  popularityWeight: 15,
  themeWeight: 20,
  freshnessWeight: 10,
};

/**
 * Minimum number of feedback events required before applying learned adjustments
 */
const MIN_SAMPLE_SIZE = 10;

/**
 * Minimum acceptance rate to consider a pattern significant
 */
const SIGNIFICANT_ACCEPTANCE_RATE = 0.6;

/**
 * Number of feedback events that trigger cache invalidation
 */
const CACHE_INVALIDATION_THRESHOLD = 10;

/**
 * Service for learning from user feedback and adjusting recommendation weights
 */
export class RecommendationLearningService {
  private static instance: RecommendationLearningService;
  private storage = StorageBackendManager.getInstance().getAdapter();
  private readonly FEEDBACK_EVENTS_KEY = "recommendation:feedback:events";
  private readonly FEEDBACK_PATTERNS_KEY = "recommendation:feedback:patterns";

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): RecommendationLearningService {
    if (!RecommendationLearningService.instance) {
      RecommendationLearningService.instance =
        new RecommendationLearningService();
    }
    return RecommendationLearningService.instance;
  }

  /**
   * Record user feedback on a recommendation
   *
   * @param userId - User ID
   * @param recommendationId - ID of the recommendation
   * @param recommendation - Full recommendation object
   * @param feedback - Whether user accepted or rejected
   * @param reason - Optional reason for the feedback
   * @param context - User context at time of feedback
   */
  async recordFeedback(
    userId: string,
    recommendationId: string,
    recommendation: Recommendation,
    feedback: "accepted" | "rejected",
    context: UserContext,
    reason?: string,
  ): Promise<void> {
    const event: FeedbackEvent = {
      id: this.generateId(),
      userId,
      recommendationId,
      recommendation,
      feedback,
      reason,
      timestamp: new Date(),
      contextSnapshot: {
        watchHistoryCount: context.watchHistory.length,
        favoriteGenres: context.preferences.favoriteGenres,
        recentWatches: context.watchHistory
          .slice(0, 5)
          .map((item) => item.title),
      },
    };

    // Store feedback event
    await this.storeFeedbackEvent(userId, event);

    // Update patterns based on new feedback
    await this.updatePatternsFromFeedback(userId, event);
  }

  /**
   * Store a feedback event in MMKV storage
   */
  private async storeFeedbackEvent(
    userId: string,
    event: FeedbackEvent,
  ): Promise<void> {
    const key = `${this.FEEDBACK_EVENTS_KEY}:${userId}`;
    const existingData = await this.storage.getItem(key);
    const events: FeedbackEvent[] = existingData
      ? JSON.parse(existingData, this.dateReviver)
      : [];

    events.push(event);

    // Keep only the most recent 100 events to manage storage
    const recentEvents = events.slice(-100);

    await this.storage.setItem(key, JSON.stringify(recentEvents));
  }

  /**
   * Get all feedback events for a user
   */
  private async getFeedbackEvents(userId: string): Promise<FeedbackEvent[]> {
    const key = `${this.FEEDBACK_EVENTS_KEY}:${userId}`;
    const data = await this.storage.getItem(key);

    if (!data) {
      return [];
    }

    return JSON.parse(data, this.dateReviver);
  }

  /**
   * Update feedback patterns based on new feedback event
   */
  private async updatePatternsFromFeedback(
    userId: string,
    event: FeedbackEvent,
  ): Promise<void> {
    const allEvents = await this.getFeedbackEvents(userId);
    const patterns = this.analyzeFeedbackPatterns(allEvents);

    // Store updated patterns
    const key = `${this.FEEDBACK_PATTERNS_KEY}:${userId}`;
    await this.storage.setItem(key, JSON.stringify(patterns));
  }

  /**
   * Analyze feedback events to identify acceptance/rejection patterns
   *
   * @param events - All feedback events for a user
   * @returns Array of identified patterns
   */
  analyzeFeedbackPatterns(events: FeedbackEvent[]): FeedbackPattern[] {
    if (events.length === 0) {
      return [];
    }

    const patterns: Map<string, { accepted: number; total: number }> =
      new Map();

    // Analyze patterns for each event
    for (const event of events) {
      const factors = this.extractFactors(event);

      for (const factor of factors) {
        const current = patterns.get(factor) || { accepted: 0, total: 0 };
        current.total += 1;
        if (event.feedback === "accepted") {
          current.accepted += 1;
        }
        patterns.set(factor, current);
      }
    }

    // Convert to FeedbackPattern array
    const feedbackPatterns: FeedbackPattern[] = [];

    for (const [factor, stats] of patterns.entries()) {
      const acceptanceRate = stats.total > 0 ? stats.accepted / stats.total : 0;
      const confidence = this.calculateConfidence(stats.total);

      feedbackPatterns.push({
        factor,
        acceptanceRate,
        sampleSize: stats.total,
        confidence,
        lastUpdated: new Date(),
      });
    }

    return this.identifySignificantPatterns(feedbackPatterns);
  }

  /**
   * Extract factors from a feedback event for pattern analysis
   */
  private extractFactors(event: FeedbackEvent): string[] {
    const factors: string[] = [];
    const rec = event.recommendation;

    // Genre factors
    for (const genre of rec.metadata.genres) {
      factors.push(`genre:${genre.toLowerCase()}`);
    }

    // Rating factors
    if (rec.metadata.rating >= 8.5) {
      factors.push("rating:very-high");
    } else if (rec.metadata.rating >= 7.5) {
      factors.push("rating:high");
    } else if (rec.metadata.rating >= 6.5) {
      factors.push("rating:medium");
    } else {
      factors.push("rating:low");
    }

    // Popularity factors
    if (rec.metadata.popularity >= 80) {
      factors.push("popularity:very-high");
    } else if (rec.metadata.popularity >= 60) {
      factors.push("popularity:high");
    } else if (rec.metadata.popularity >= 40) {
      factors.push("popularity:medium");
    } else {
      factors.push("popularity:low");
    }

    // Hidden gem factor
    if (rec.isHiddenGem) {
      factors.push("type:hidden-gem");
    }

    // Content type factor
    factors.push(`type:${rec.type}`);

    // Match score factors
    if (rec.matchScore >= 85) {
      factors.push("match:very-high");
    } else if (rec.matchScore >= 70) {
      factors.push("match:high");
    } else if (rec.matchScore >= 55) {
      factors.push("match:medium");
    } else {
      factors.push("match:low");
    }

    return factors;
  }

  /**
   * Calculate confidence level based on sample size
   * Uses a logarithmic scale to provide confidence between 0 and 1
   */
  private calculateConfidence(sampleSize: number): number {
    if (sampleSize < MIN_SAMPLE_SIZE) {
      return 0;
    }

    // Logarithmic confidence: reaches ~0.9 at 100 samples
    const confidence = Math.min(
      1,
      (Math.log10(sampleSize) / Math.log10(100)) * 0.9,
    );
    return Math.max(0, confidence);
  }

  /**
   * Filter patterns to only include those with sufficient sample size
   *
   * @param patterns - All identified patterns
   * @returns Patterns with sample size >= MIN_SAMPLE_SIZE
   */
  identifySignificantPatterns(patterns: FeedbackPattern[]): FeedbackPattern[] {
    return patterns.filter((pattern) => pattern.sampleSize >= MIN_SAMPLE_SIZE);
  }

  /**
   * Get adjusted scoring weights based on learned patterns
   *
   * @param userId - User ID
   * @returns Adjusted weights for recommendation scoring
   */
  async getAdjustedWeights(userId: string): Promise<LearningWeights> {
    const patterns = await this.getStoredPatterns(userId);

    if (patterns.length === 0) {
      return DEFAULT_WEIGHTS;
    }

    const weights = { ...DEFAULT_WEIGHTS };

    // Adjust genre weight based on genre acceptance patterns
    const genrePatterns = patterns.filter((p) => p.factor.startsWith("genre:"));
    if (genrePatterns.length > 0) {
      const avgAcceptance =
        genrePatterns.reduce((sum, p) => sum + p.acceptanceRate, 0) /
        genrePatterns.length;
      if (avgAcceptance >= SIGNIFICANT_ACCEPTANCE_RATE) {
        weights.genreWeight += this.calculateWeightAdjustment(avgAcceptance);
      }
    }

    // Adjust rating weight based on rating acceptance patterns
    const ratingPatterns = patterns.filter((p) =>
      p.factor.startsWith("rating:"),
    );
    if (ratingPatterns.length > 0) {
      const highRatingPattern = ratingPatterns.find(
        (p) => p.factor === "rating:very-high" || p.factor === "rating:high",
      );
      if (
        highRatingPattern &&
        highRatingPattern.acceptanceRate >= SIGNIFICANT_ACCEPTANCE_RATE
      ) {
        weights.ratingWeight += this.calculateWeightAdjustment(
          highRatingPattern.acceptanceRate,
        );
      }
    }

    // Adjust popularity weight based on popularity acceptance patterns
    const popularityPatterns = patterns.filter((p) =>
      p.factor.startsWith("popularity:"),
    );
    if (popularityPatterns.length > 0) {
      const avgAcceptance =
        popularityPatterns.reduce((sum, p) => sum + p.acceptanceRate, 0) /
        popularityPatterns.length;
      if (avgAcceptance >= SIGNIFICANT_ACCEPTANCE_RATE) {
        weights.popularityWeight +=
          this.calculateWeightAdjustment(avgAcceptance);
      }
    }

    // Adjust theme weight based on hidden gem acceptance
    const hiddenGemPattern = patterns.find(
      (p) => p.factor === "type:hidden-gem",
    );
    if (
      hiddenGemPattern &&
      hiddenGemPattern.acceptanceRate >= SIGNIFICANT_ACCEPTANCE_RATE
    ) {
      weights.themeWeight += this.calculateWeightAdjustment(
        hiddenGemPattern.acceptanceRate,
      );
    }

    // Normalize weights to ensure they sum to 100
    return this.normalizeWeights(weights);
  }

  /**
   * Calculate weight adjustment based on acceptance rate
   * Returns a value between 5 and 15 points
   */
  private calculateWeightAdjustment(acceptanceRate: number): number {
    // Linear scale: 60% acceptance = +5 points, 100% acceptance = +15 points
    const adjustment = 5 + (acceptanceRate - 0.6) * 25;
    return Math.min(15, Math.max(5, adjustment));
  }

  /**
   * Normalize weights to sum to 100
   */
  private normalizeWeights(weights: LearningWeights): LearningWeights {
    const total =
      weights.genreWeight +
      weights.ratingWeight +
      weights.popularityWeight +
      weights.themeWeight +
      weights.freshnessWeight;

    if (total === 0) {
      return DEFAULT_WEIGHTS;
    }

    return {
      genreWeight: (weights.genreWeight / total) * 100,
      ratingWeight: (weights.ratingWeight / total) * 100,
      popularityWeight: (weights.popularityWeight / total) * 100,
      themeWeight: (weights.themeWeight / total) * 100,
      freshnessWeight: (weights.freshnessWeight / total) * 100,
    };
  }

  /**
   * Get stored feedback patterns for a user
   */
  private async getStoredPatterns(userId: string): Promise<FeedbackPattern[]> {
    const key = `${this.FEEDBACK_PATTERNS_KEY}:${userId}`;
    const data = await this.storage.getItem(key);

    if (!data) {
      return [];
    }

    return JSON.parse(data, this.dateReviver);
  }

  /**
   * Determine if new feedback requires cache invalidation
   *
   * @param userId - User ID
   * @param newFeedback - The new feedback event
   * @returns True if cache should be invalidated
   */
  async shouldInvalidateCache(
    userId: string,
    newFeedback: FeedbackEvent,
  ): Promise<boolean> {
    const events = await this.getFeedbackEvents(userId);

    // Get recent events (last 10)
    const recentEvents = events.slice(-CACHE_INVALIDATION_THRESHOLD);

    // If we don't have enough recent events, don't invalidate yet
    if (recentEvents.length < CACHE_INVALIDATION_THRESHOLD) {
      return false;
    }

    // Check if recent feedback shows new patterns
    const recentPatterns = this.analyzeFeedbackPatterns(recentEvents);
    const allPatterns = this.analyzeFeedbackPatterns(events);

    // Compare patterns to detect significant changes
    for (const recentPattern of recentPatterns) {
      const overallPattern = allPatterns.find(
        (p) => p.factor === recentPattern.factor,
      );

      if (!overallPattern) {
        continue;
      }

      // If acceptance rate changed by more than 20%, invalidate cache
      const rateDifference = Math.abs(
        recentPattern.acceptanceRate - overallPattern.acceptanceRate,
      );
      if (rateDifference > 0.2) {
        return true;
      }
    }

    // Check if we have 10+ new feedback events since last cache
    // This is a simple heuristic - in production, you'd track last cache time
    return recentEvents.length >= CACHE_INVALIDATION_THRESHOLD;
  }

  /**
   * Calculate acceptance rate for a specific factor
   *
   * @param factor - The factor to analyze (e.g., "genre:action")
   * @param events - Feedback events to analyze
   * @returns Acceptance rate (0-1)
   */
  calculateAcceptanceRate(factor: string, events: FeedbackEvent[]): number {
    const relevantEvents = events.filter((event) => {
      const factors = this.extractFactors(event);
      return factors.includes(factor);
    });

    if (relevantEvents.length === 0) {
      return 0;
    }

    const acceptedCount = relevantEvents.filter(
      (event) => event.feedback === "accepted",
    ).length;

    return acceptedCount / relevantEvents.length;
  }

  /**
   * Get feedback patterns for a user (public method)
   *
   * @param userId - User ID
   * @returns Array of feedback patterns
   */
  async getFeedbackPatterns(userId: string): Promise<FeedbackPattern[]> {
    return this.getStoredPatterns(userId);
  }

  /**
   * Clear all feedback data for a user
   *
   * @param userId - User ID
   */
  async clearFeedbackData(userId: string): Promise<void> {
    const eventsKey = `${this.FEEDBACK_EVENTS_KEY}:${userId}`;
    const patternsKey = `${this.FEEDBACK_PATTERNS_KEY}:${userId}`;

    await this.storage.removeItem(eventsKey);
    await this.storage.removeItem(patternsKey);
  }

  /**
   * Generate a unique ID for feedback events
   */
  private generateId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Date reviver for JSON.parse to handle Date objects
   */
  private dateReviver(key: string, value: any): any {
    if (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      return new Date(value);
    }
    return value;
  }
}

export default RecommendationLearningService;
