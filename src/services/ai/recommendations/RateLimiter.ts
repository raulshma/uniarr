/**
 * Rate Limiter for AI Recommendation Requests
 *
 * Implements rate limiting to prevent excessive API calls to AI services.
 * Uses a sliding window algorithm to track requests per user.
 *
 * Features:
 * - Per-user rate limiting
 * - Configurable limits (requests per minute/hour)
 * - Exponential backoff for retries
 * - Automatic cleanup of old timestamps
 */

import { RateLimitError } from "./errors";
import { logger } from "@/services/logger/LoggerService";

interface RateLimitConfig {
  /** Maximum requests per minute per user */
  maxRequestsPerMinute: number;
  /** Maximum requests per hour per user */
  maxRequestsPerHour: number;
  /** Base delay for exponential backoff (milliseconds) */
  baseBackoffDelay: number;
  /** Maximum backoff delay (milliseconds) */
  maxBackoffDelay: number;
}

interface UserRateLimitState {
  /** Timestamps of recent requests */
  timestamps: number[];
  /** Number of consecutive rate limit hits */
  consecutiveHits: number;
  /** When the rate limit will reset */
  resetAt?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 2,
  maxRequestsPerHour: 10,
  baseBackoffDelay: 1000, // 1 second
  maxBackoffDelay: 60000, // 60 seconds
};

export class RateLimiter {
  private static instance: RateLimiter;
  private config: RateLimitConfig;
  private userStates: Map<string, UserRateLimitState> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupInterval();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: Partial<RateLimitConfig>): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter(config);
    }
    return RateLimiter.instance;
  }

  /**
   * Check if a request is allowed for a user
   * @param userId - User ID to check
   * @throws RateLimitError if rate limit exceeded
   */
  async checkRateLimit(userId: string): Promise<void> {
    const now = Date.now();
    const state = this.getUserState(userId);

    // Clean old timestamps
    const oneHourAgo = now - 60 * 60 * 1000;
    state.timestamps = state.timestamps.filter((t) => t > oneHourAgo);

    // Check minute limit
    const oneMinuteAgo = now - 60 * 1000;
    const recentMinute = state.timestamps.filter((t) => t > oneMinuteAgo);

    if (recentMinute.length >= this.config.maxRequestsPerMinute) {
      state.consecutiveHits++;
      const resetAt = now + 60 * 1000; // Reset in 1 minute
      state.resetAt = resetAt;

      void logger.warn("Rate limit exceeded (per minute)", {
        userId,
        requestsInMinute: recentMinute.length,
        limit: this.config.maxRequestsPerMinute,
        resetAt,
      });

      throw new RateLimitError(
        `Too many requests. Please wait a moment. Limit: ${this.config.maxRequestsPerMinute} requests per minute.`,
        resetAt,
        {
          userId,
          requestsInMinute: recentMinute.length,
          limit: this.config.maxRequestsPerMinute,
        },
      );
    }

    // Check hour limit
    const recentHour = state.timestamps.filter((t) => t > oneHourAgo);

    if (recentHour.length >= this.config.maxRequestsPerHour) {
      state.consecutiveHits++;
      const resetAt = now + 60 * 60 * 1000; // Reset in 1 hour
      state.resetAt = resetAt;

      void logger.warn("Rate limit exceeded (per hour)", {
        userId,
        requestsInHour: recentHour.length,
        limit: this.config.maxRequestsPerHour,
        resetAt,
      });

      throw new RateLimitError(
        `Hourly limit reached. Please try again later. Limit: ${this.config.maxRequestsPerHour} requests per hour.`,
        resetAt,
        {
          userId,
          requestsInHour: recentHour.length,
          limit: this.config.maxRequestsPerHour,
        },
      );
    }

    // Request allowed - record timestamp
    state.timestamps.push(now);
    state.consecutiveHits = 0;
    state.resetAt = undefined;

    void logger.debug("Rate limit check passed", {
      userId,
      requestsInMinute: recentMinute.length,
      requestsInHour: recentHour.length,
    });
  }

  /**
   * Calculate exponential backoff delay based on consecutive hits
   * @param userId - User ID
   * @returns Delay in milliseconds
   */
  getBackoffDelay(userId: string): number {
    const state = this.getUserState(userId);
    const delay = Math.min(
      this.config.baseBackoffDelay * Math.pow(2, state.consecutiveHits),
      this.config.maxBackoffDelay,
    );

    void logger.debug("Calculated backoff delay", {
      userId,
      consecutiveHits: state.consecutiveHits,
      delay,
    });

    return delay;
  }

  /**
   * Get time until rate limit resets for a user
   * @param userId - User ID
   * @returns Milliseconds until reset, or null if not rate limited
   */
  getTimeUntilReset(userId: string): number | null {
    const state = this.userStates.get(userId);
    if (!state || !state.resetAt) {
      return null;
    }

    const now = Date.now();
    return Math.max(0, state.resetAt - now);
  }

  /**
   * Check if a user is currently rate limited
   * @param userId - User ID
   * @returns True if rate limited
   */
  isRateLimited(userId: string): boolean {
    const timeUntilReset = this.getTimeUntilReset(userId);
    return timeUntilReset !== null && timeUntilReset > 0;
  }

  /**
   * Reset rate limit state for a user
   * @param userId - User ID
   */
  reset(userId: string): void {
    this.userStates.delete(userId);
    void logger.debug("Rate limit state reset", { userId });
  }

  /**
   * Reset all rate limit states
   */
  resetAll(): void {
    this.userStates.clear();
    void logger.info("All rate limit states reset");
  }

  /**
   * Update rate limit configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    void logger.info("Rate limit configuration updated", {
      config: this.config,
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RateLimitConfig> {
    return { ...this.config };
  }

  /**
   * Get rate limit statistics for a user
   * @param userId - User ID
   * @returns Statistics object
   */
  getStats(userId: string): {
    requestsInLastMinute: number;
    requestsInLastHour: number;
    remainingMinute: number;
    remainingHour: number;
    isRateLimited: boolean;
    resetAt: number | null;
  } {
    const now = Date.now();
    const state = this.getUserState(userId);

    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const requestsInLastMinute = state.timestamps.filter(
      (t) => t > oneMinuteAgo,
    ).length;
    const requestsInLastHour = state.timestamps.filter(
      (t) => t > oneHourAgo,
    ).length;

    return {
      requestsInLastMinute,
      requestsInLastHour,
      remainingMinute: Math.max(
        0,
        this.config.maxRequestsPerMinute - requestsInLastMinute,
      ),
      remainingHour: Math.max(
        0,
        this.config.maxRequestsPerHour - requestsInLastHour,
      ),
      isRateLimited: this.isRateLimited(userId),
      resetAt: state.resetAt || null,
    };
  }

  // Private helper methods

  private getUserState(userId: string): UserRateLimitState {
    let state = this.userStates.get(userId);
    if (!state) {
      state = {
        timestamps: [],
        consecutiveHits: 0,
      };
      this.userStates.set(userId, state);
    }
    return state;
  }

  private startCleanupInterval(): void {
    // Clean up old state every 5 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupOldStates();
      },
      5 * 60 * 1000,
    );
  }

  private cleanupOldStates(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [userId, state] of this.userStates.entries()) {
      // Remove timestamps older than 1 hour
      state.timestamps = state.timestamps.filter((t) => t > oneHourAgo);

      // Remove state if no recent activity
      if (state.timestamps.length === 0 && !state.resetAt) {
        this.userStates.delete(userId);
      }
    }

    void logger.debug("Rate limiter cleanup completed", {
      activeUsers: this.userStates.size,
    });
  }

  /**
   * Stop cleanup interval (for testing or shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

export default RateLimiter;
