/**
 * Base error class for recommendation system errors
 */
export class RecommendationError extends Error {
  /**
   * Error code for categorization
   */
  public readonly code: string;

  /**
   * Whether the error is recoverable (can retry)
   */
  public readonly recoverable: boolean;

  /**
   * Additional metadata about the error
   */
  public readonly metadata?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    recoverable: boolean = true,
    metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RecommendationError";
    this.code = code;
    this.recoverable = recoverable;
    this.metadata = metadata;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RecommendationError);
    }
  }

  /**
   * Format error message with metadata
   */
  public formatMessage(): string {
    let formatted = `[${this.code}] ${this.message}`;

    if (this.metadata && Object.keys(this.metadata).length > 0) {
      const metadataStr = Object.entries(this.metadata)
        .map(([key, value]) => `${key}: ${String(value)}`)
        .join(", ");
      formatted += ` (${metadataStr})`;
    }

    return formatted;
  }

  /**
   * Extract metadata as a plain object
   */
  public getMetadata(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
      ...(this.metadata || {}),
    };
  }
}

/**
 * Error thrown when AI service fails to generate recommendations
 */
export class AIServiceError extends RecommendationError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "AI_SERVICE_ERROR", true, metadata);
    this.name = "AIServiceError";
  }
}

/**
 * Error thrown when building user context fails
 */
export class ContextBuildError extends RecommendationError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "CONTEXT_BUILD_ERROR", true, metadata);
    this.name = "ContextBuildError";
  }
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends RecommendationError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "CACHE_ERROR", true, metadata);
    this.name = "CacheError";
  }
}

/**
 * Error thrown when rate limits are exceeded
 */
export class RateLimitError extends RecommendationError {
  /**
   * When the rate limit will reset (timestamp)
   */
  public readonly resetAt?: number;

  constructor(
    message: string,
    resetAt?: number,
    metadata?: Record<string, unknown>,
  ) {
    super(
      message,
      "RATE_LIMIT_ERROR",
      true,
      resetAt ? { ...metadata, resetAt } : metadata,
    );
    this.name = "RateLimitError";
    this.resetAt = resetAt;
  }

  /**
   * Get seconds until rate limit resets
   */
  public getSecondsUntilReset(): number | null {
    if (!this.resetAt) {
      return null;
    }

    const now = Date.now();
    const diff = this.resetAt - now;
    return Math.max(0, Math.ceil(diff / 1000));
  }
}

/**
 * Type guard to check if error is a RecommendationError
 */
export function isRecommendationError(
  error: unknown,
): error is RecommendationError {
  return error instanceof RecommendationError;
}

/**
 * Type guard to check if error is an AIServiceError
 */
export function isAIServiceError(error: unknown): error is AIServiceError {
  return error instanceof AIServiceError;
}

/**
 * Type guard to check if error is a ContextBuildError
 */
export function isContextBuildError(
  error: unknown,
): error is ContextBuildError {
  return error instanceof ContextBuildError;
}

/**
 * Type guard to check if error is a CacheError
 */
export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

/**
 * Type guard to check if error is a RateLimitError
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError;
}

/**
 * Helper to extract user-friendly error message
 */
export function getRecommendationErrorMessage(error: unknown): string {
  if (isRecommendationError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred while generating recommendations.";
}
