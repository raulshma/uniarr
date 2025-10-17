import { isAxiosError, type AxiosError } from "axios";
import { logger } from "@/services/logger/LoggerService";
import { handleApiError, type ErrorContext } from "./error.utils";

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: unknown) => boolean;
  context?: ErrorContext;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, "context">> & {
  context: ErrorContext | undefined;
} = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryCondition: (error: unknown) => {
    // Retry on network errors and 5xx server errors
    if (!isAxiosError(error)) {
      return false;
    }

    const axiosError = error as AxiosError;

    // Network errors (no response)
    if (!axiosError.response) {
      return true;
    }

    // 5xx server errors
    const status = axiosError.response.status;
    return status >= 500;
  },
  context: undefined,
};

/**
 * Utility function for retrying operations with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }

      // Check if we should retry this error
      if (!opts.retryCondition(error)) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.baseDelay * Math.pow(opts.backoffFactor, attempt),
        opts.maxDelay,
      );

      const enhancedContext = {
        ...opts.context,
        attempt: attempt + 1,
        maxRetries: opts.maxRetries + 1,
        nextRetryIn: delay,
      };

      logger.warn("Operation failed, retrying with exponential backoff", {
        ...enhancedContext,
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted, handle the final error
  throw handleApiError(lastError, opts.context);
}

/**
 * Create a retry condition for specific HTTP status codes
 */
export function createStatusRetryCondition(...statuses: number[]) {
  return (error: unknown): boolean => {
    if (!isAxiosError(error)) {
      return false;
    }

    const status = (error as AxiosError).response?.status;
    return status !== undefined && statuses.includes(status);
  };
}

/**
 * Create a retry condition for network errors
 */
export const networkRetryCondition = (error: unknown): boolean => {
  if (!isAxiosError(error)) {
    return false;
  }

  const axiosError = error as AxiosError;

  // Network errors (no response)
  if (!axiosError.response) {
    return true;
  }

  // Common network-related status codes
  const networkStatuses = [408, 429, 500, 502, 503, 504];
  const status = axiosError.response.status;
  return status !== undefined && networkStatuses.includes(status);
};

/**
 * Retry condition for authentication errors (401/403)
 */
export const authRetryCondition = createStatusRetryCondition(401, 403);
