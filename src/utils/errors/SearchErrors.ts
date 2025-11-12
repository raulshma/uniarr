/**
 * Custom error types for search operations
 */

/**
 * Base search error
 */
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

/**
 * Invalid API key error
 */
export class InvalidApiKeyError extends SearchError {
  constructor(provider: string, details?: Record<string, any>) {
    super(
      `Invalid API key for provider: ${provider}`,
      "INVALID_API_KEY",
      details,
    );
    this.name = "InvalidApiKeyError";
  }
}

/**
 * Network error during search
 */
export class SearchNetworkError extends SearchError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "NETWORK_ERROR", details);
    this.name = "SearchNetworkError";
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends SearchError {
  constructor(
    public retryAfterMs: number,
    details?: Record<string, any>,
  ) {
    super(
      `Rate limit exceeded. Retry after ${retryAfterMs}ms`,
      "RATE_LIMIT_EXCEEDED",
      details,
    );
    this.name = "RateLimitError";
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends SearchError {
  constructor(
    serviceId: string,
    message?: string,
    details?: Record<string, any>,
  ) {
    super(
      message || `Service ${serviceId} is unavailable`,
      "SERVICE_UNAVAILABLE",
      details,
    );
    this.name = "ServiceUnavailableError";
  }
}

/**
 * Invalid query format error
 */
export class InvalidQueryError extends SearchError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "INVALID_QUERY", details);
    this.name = "InvalidQueryError";
  }
}

/**
 * Timeout error during search
 */
export class SearchTimeoutError extends SearchError {
  constructor(
    public timeoutMs: number,
    serviceId?: string,
    details?: Record<string, any>,
  ) {
    super(
      `Search timed out after ${timeoutMs}ms${serviceId ? ` for service ${serviceId}` : ""}`,
      "TIMEOUT",
      details,
    );
    this.name = "SearchTimeoutError";
  }
}

/**
 * Provider error (e.g., API returns error)
 */
export class SearchProviderError extends SearchError {
  constructor(
    provider: string,
    public statusCode?: number,
    message?: string,
    details?: Record<string, any>,
  ) {
    super(
      message || `Provider ${provider} returned an error`,
      "PROVIDER_ERROR",
      details,
    );
    this.name = "SearchProviderError";
  }
}

/**
 * No results found error
 */
export class NoResultsError extends SearchError {
  constructor(query: string, details?: Record<string, any>) {
    super(`No results found for query: "${query}"`, "NO_RESULTS", details);
    this.name = "NoResultsError";
  }
}

/**
 * Unknown error during search
 */
export class UnknownSearchError extends SearchError {
  constructor(
    message: string,
    originalError?: Error,
    details?: Record<string, any>,
  ) {
    super(`Unknown search error: ${message}`, "UNKNOWN_ERROR", {
      ...details,
      originalError: originalError?.message,
      originalStack: originalError?.stack,
    });
    this.name = "UnknownSearchError";
  }
}

/**
 * Error handler utility for search operations
 */
export class SearchErrorHandler {
  /**
   * Parse and categorize an error
   */
  static categorizeError(error: unknown): {
    type: string;
    message: string;
    code: string;
    suggestion?: string;
    retryable: boolean;
    retryAfterMs?: number;
  } {
    if (error instanceof RateLimitError) {
      return {
        type: "RATE_LIMIT",
        message: error.message,
        code: error.code,
        suggestion: `Wait ${Math.ceil(error.retryAfterMs / 1000)} seconds before retrying`,
        retryable: true,
        retryAfterMs: error.retryAfterMs,
      };
    }

    if (error instanceof InvalidApiKeyError) {
      return {
        type: "INVALID_CREDENTIALS",
        message: error.message,
        code: error.code,
        suggestion: "Please check your API key and try again",
        retryable: false,
      };
    }

    if (error instanceof SearchNetworkError) {
      return {
        type: "NETWORK",
        message: error.message,
        code: error.code,
        suggestion: "Check your internet connection and try again",
        retryable: true,
        retryAfterMs: 5000,
      };
    }

    if (error instanceof SearchTimeoutError) {
      return {
        type: "TIMEOUT",
        message: error.message,
        code: error.code,
        suggestion: "The search took too long. Try with a simpler query",
        retryable: true,
        retryAfterMs: 3000,
      };
    }

    if (error instanceof ServiceUnavailableError) {
      return {
        type: "SERVICE_UNAVAILABLE",
        message: error.message,
        code: error.code,
        suggestion:
          "The service is temporarily unavailable. Please try again later",
        retryable: true,
        retryAfterMs: 10000,
      };
    }

    if (error instanceof InvalidQueryError) {
      return {
        type: "INVALID_QUERY",
        message: error.message,
        code: error.code,
        suggestion: "Try using different search terms",
        retryable: false,
      };
    }

    if (error instanceof SearchProviderError) {
      return {
        type: "PROVIDER_ERROR",
        message: error.message,
        code: error.code,
        suggestion: "There was an issue with the search provider",
        retryable: !!(error.statusCode && error.statusCode >= 500), // Server errors are retryable
        retryAfterMs: 5000,
      };
    }

    if (error instanceof NoResultsError) {
      return {
        type: "NO_RESULTS",
        message: error.message,
        code: error.code,
        suggestion: "Try using different search terms or filters",
        retryable: false,
      };
    }

    if (error instanceof SearchError) {
      return {
        type: "SEARCH_ERROR",
        message: error.message,
        code: error.code,
        suggestion: "An error occurred during search",
        retryable: false,
      };
    }

    if (error instanceof Error) {
      return {
        type: "UNKNOWN",
        message: error.message,
        code: "UNKNOWN_ERROR",
        suggestion: "An unexpected error occurred",
        retryable: false,
      };
    }

    return {
      type: "UNKNOWN",
      message: String(error),
      code: "UNKNOWN_ERROR",
      suggestion: "An unexpected error occurred",
      retryable: false,
    };
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(error: unknown): string {
    const categorized = this.categorizeError(error);
    let message = categorized.message;

    if (categorized.suggestion) {
      message += `. ${categorized.suggestion}`;
    }

    return message;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: unknown): boolean {
    return this.categorizeError(error).retryable;
  }

  /**
   * Get retry delay for an error
   */
  static getRetryDelay(error: unknown, attemptNumber: number = 0): number {
    const categorized = this.categorizeError(error);

    if (categorized.retryAfterMs) {
      return categorized.retryAfterMs;
    }

    // Exponential backoff for retryable errors
    if (categorized.retryable) {
      return Math.min(1000 * Math.pow(2, attemptNumber), 30000);
    }

    return 0;
  }

  /**
   * Validate query before search
   */
  static validateQuery(query: string): void {
    if (!query || query.trim().length === 0) {
      throw new InvalidQueryError("Query cannot be empty");
    }

    if (query.trim().length < 2) {
      throw new InvalidQueryError("Query must be at least 2 characters long");
    }

    if (query.length > 500) {
      throw new InvalidQueryError("Query cannot exceed 500 characters");
    }
  }

  /**
   * Validate API key format
   */
  static validateApiKey(apiKey: string, provider: string): void {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new InvalidApiKeyError(provider, { provided: false });
    }

    // Provider-specific validation
    switch (provider.toLowerCase()) {
      case "google":
        if (apiKey.length < 20) {
          throw new InvalidApiKeyError(provider, { reason: "invalid_format" });
        }
        break;

      case "openai":
        if (!apiKey.startsWith("sk-")) {
          throw new InvalidApiKeyError(provider, { reason: "invalid_format" });
        }
        break;

      case "anthropic":
        if (!apiKey.startsWith("sk-ant-")) {
          throw new InvalidApiKeyError(provider, { reason: "invalid_format" });
        }
        break;

      default:
        // Generic validation
        if (apiKey.length < 10) {
          throw new InvalidApiKeyError(provider, { reason: "too_short" });
        }
    }
  }
}
