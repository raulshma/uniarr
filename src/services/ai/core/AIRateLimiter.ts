import { logger } from "@/services/logger/LoggerService";

/**
 * Rate limiting configuration per AI provider
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  searchInterpretationsPerDay: number;
  recommendationsPerDay: number;
}

/**
 * Default rate limits for AI API calls
 */
const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  requestsPerMinute: 10,
  requestsPerDay: 200,
  searchInterpretationsPerDay: 100,
  recommendationsPerDay: 50,
};

/**
 * Tracks rate limit metrics for a specific operation type
 */
interface RateLimitMetrics {
  minuteCount: number;
  dayCount: number;
  lastMinuteReset: number;
  lastDayReset: number;
}

/**
 * Rate limiter for AI API calls with per-minute and per-day limits
 */
export class AIRateLimiter {
  private static instance: AIRateLimiter | null = null;

  private config: RateLimitConfig = DEFAULT_RATE_LIMITS;

  private requestMetrics: RateLimitMetrics = {
    minuteCount: 0,
    dayCount: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: Date.now(),
  };

  private requestQueue: (() => Promise<any>)[] = [];
  private isProcessingQueue = false;

  static getInstance(): AIRateLimiter {
    if (!AIRateLimiter.instance) {
      AIRateLimiter.instance = new AIRateLimiter();
    }
    return AIRateLimiter.instance;
  }

  /**
   * Configure rate limits
   */
  configure(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug("AI rate limiter configured", {
      config: this.config,
    });
  }

  /**
   * Check if a request can be made
   */
  canMakeRequest(
    operationType: "search" | "recommendation" | "generic" = "generic",
  ): {
    allowed: boolean;
    message?: string;
    retryAfterMs?: number;
  } {
    this.resetMetricsIfNeeded();

    // Check per-minute limit
    if (this.requestMetrics.minuteCount >= this.config.requestsPerMinute) {
      const nextMinuteReset = this.requestMetrics.lastMinuteReset + 60_000;
      const retryAfterMs = Math.max(0, nextMinuteReset - Date.now());
      return {
        allowed: false,
        message: `Rate limit exceeded: ${this.config.requestsPerMinute} requests per minute`,
        retryAfterMs,
      };
    }

    // Check per-day limit
    if (this.requestMetrics.dayCount >= this.config.requestsPerDay) {
      const nextDayReset = this.requestMetrics.lastDayReset + 24 * 60 * 60_000;
      const retryAfterMs = Math.max(0, nextDayReset - Date.now());
      return {
        allowed: false,
        message: `Rate limit exceeded: ${this.config.requestsPerDay} requests per day`,
        retryAfterMs,
      };
    }

    // Check operation-specific limits
    if (
      operationType === "search" &&
      this.requestMetrics.dayCount >= this.config.searchInterpretationsPerDay
    ) {
      const nextDayReset = this.requestMetrics.lastDayReset + 24 * 60 * 60_000;
      const retryAfterMs = Math.max(0, nextDayReset - Date.now());
      return {
        allowed: false,
        message: `Search interpretation limit exceeded: ${this.config.searchInterpretationsPerDay} per day`,
        retryAfterMs,
      };
    }

    if (
      operationType === "recommendation" &&
      this.requestMetrics.dayCount >= this.config.recommendationsPerDay
    ) {
      const nextDayReset = this.requestMetrics.lastDayReset + 24 * 60 * 60_000;
      const retryAfterMs = Math.max(0, nextDayReset - Date.now());
      return {
        allowed: false,
        message: `Recommendation limit exceeded: ${this.config.recommendationsPerDay} per day`,
        retryAfterMs,
      };
    }

    return { allowed: true };
  }

  /**
   * Execute a request with rate limiting
   */
  async executeWithLimit<T>(
    fn: () => Promise<T>,
    operationType: "search" | "recommendation" | "generic" = "generic",
  ): Promise<T> {
    const check = this.canMakeRequest(operationType);

    if (!check.allowed) {
      const error = new Error(check.message || "Rate limit exceeded");
      logger.warn("AI rate limit exceeded", {
        operationType,
        message: check.message,
        retryAfterMs: check.retryAfterMs,
      });
      throw error;
    }

    try {
      const result = await fn();
      this.recordRequest();
      return result;
    } catch (error) {
      // Don't count failed requests against rate limit
      logger.debug("Request failed, not counting against rate limit", {
        operationType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Queue a request to be executed with rate limiting
   */
  async queueRequest<T>(
    fn: () => Promise<T>,
    operationType: "search" | "recommendation" | "generic" = "generic",
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeWithLimit(fn, operationType);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Get current rate limit metrics
   */
  getMetrics(): {
    requestsThisMinute: number;
    requestsThisDay: number;
    minuteLimit: number;
    dayLimit: number;
    minutePercentage: number;
    dayPercentage: number;
  } {
    this.resetMetricsIfNeeded();

    return {
      requestsThisMinute: this.requestMetrics.minuteCount,
      requestsThisDay: this.requestMetrics.dayCount,
      minuteLimit: this.config.requestsPerMinute,
      dayLimit: this.config.requestsPerDay,
      minutePercentage:
        (this.requestMetrics.minuteCount / this.config.requestsPerMinute) * 100,
      dayPercentage:
        (this.requestMetrics.dayCount / this.config.requestsPerDay) * 100,
    };
  }

  /**
   * Get warning status if approaching limits
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const metrics = this.getMetrics();

    // Warn if 80% of minute limit reached
    if (metrics.minutePercentage >= 80) {
      warnings.push(
        `Approaching minute rate limit: ${metrics.requestsThisMinute}/${metrics.minuteLimit}`,
      );
    }

    // Warn if 80% of day limit reached
    if (metrics.dayPercentage >= 80) {
      warnings.push(
        `Approaching daily rate limit: ${metrics.requestsThisDay}/${metrics.dayLimit}`,
      );
    }

    return warnings;
  }

  /**
   * Reset rate limit metrics (useful for testing)
   */
  reset(): void {
    this.requestMetrics = {
      minuteCount: 0,
      dayCount: 0,
      lastMinuteReset: Date.now(),
      lastDayReset: Date.now(),
    };
    logger.debug("AI rate limiter metrics reset");
  }

  private recordRequest(): void {
    this.requestMetrics.minuteCount += 1;
    this.requestMetrics.dayCount += 1;
  }

  private resetMetricsIfNeeded(): void {
    const now = Date.now();

    // Reset minute counter if a minute has passed
    if (now - this.requestMetrics.lastMinuteReset >= 60_000) {
      this.requestMetrics.minuteCount = 0;
      this.requestMetrics.lastMinuteReset = now;
    }

    // Reset day counter if a day has passed
    if (now - this.requestMetrics.lastDayReset >= 24 * 60 * 60_000) {
      this.requestMetrics.dayCount = 0;
      this.requestMetrics.lastDayReset = now;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const fn = this.requestQueue.shift();
        if (fn) {
          try {
            await fn();
          } catch (error) {
            logger.error("Error processing queued request", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Add small delay between queued requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
}
