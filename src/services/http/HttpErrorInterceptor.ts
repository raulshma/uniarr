/**
 * HTTP Error Interceptor Service
 *
 * Provides a reusable, maintainable HTTP error interceptor that ensures
 * all API calls across all connectors and services are automatically
 * captured and logged to the API error logger.
 *
 * This service integrates seamlessly with Axios interceptors and ensures:
 * - Consistent error handling and logging across all HTTP calls
 * - Minimal performance impact (async-first, non-blocking)
 * - Type safety with full TypeScript support
 * - Extensibility for custom error handling logic
 */

import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { apiErrorLogger } from "@/services/logger/ApiErrorLoggerService";
import { handleApiError, type ErrorContext } from "@/utils/error.utils";
import { logger } from "@/services/logger/LoggerService";

/**
 * Sanitize sensitive data location to valid enum value
 */
function sanitizeDataLocation(
  location: "headers" | "body" | "both" | null,
): "headers" | "body" | "both" {
  if (location === "headers" || location === "body" || location === "both") {
    return location;
  }
  return "body"; // Default fallback
}

/**
 * Configuration for HTTP error interception
 */
export interface HttpErrorInterceptorConfig {
  /**
   * Whether to automatically log errors to the API error logger
   * @default true
   */
  enableErrorLogging?: boolean;

  /**
   * Whether to include request/response bodies in error context (for debugging)
   * Warning: May log sensitive data if not careful
   * @default false
   */
  captureRequestBody?: boolean;
  captureResponseBody?: boolean;

  /**
   * Whether to include request headers in error context
   * Warning: May log authentication tokens if not careful
   * @default false
   */
  captureRequestHeaders?: boolean;

  /**
   * Custom callback for additional error handling
   */
  onErrorCapture?: (
    error: AxiosError,
    context: ErrorContext,
  ) => void | Promise<void>;

  /**
   * List of status codes or error codes to exclude from logging
   * Useful for expected errors that don't need to be tracked
   */
  excludeStatusCodes?: (number | string)[];

  /**
   * List of endpoints/paths to exclude from logging
   * Useful for health checks or polling endpoints
   */
  excludeEndpoints?: (string | RegExp)[];
}

/**
 * HTTP Error Interceptor Service
 *
 * Provides a singleton service for setting up Axios interceptors that
 * automatically capture and log API errors to the error logger.
 */
class HttpErrorInterceptor {
  private static instance: HttpErrorInterceptor | null = null;

  private defaultConfig: Required<HttpErrorInterceptorConfig> = {
    enableErrorLogging: true,
    captureRequestBody: false,
    captureResponseBody: false,
    captureRequestHeaders: false,
    onErrorCapture: (() => {}) as (
      error: AxiosError,
      context: ErrorContext,
    ) => void | Promise<void>,
    excludeStatusCodes: [
      401, // Often expected for auth failures
      403, // Often expected for permission denied
      404, // Often expected for resource not found
    ],
    excludeEndpoints: [/\/health\/?$/, /\/ping\/?$/],
  };

  static getInstance(): HttpErrorInterceptor {
    if (!HttpErrorInterceptor.instance) {
      HttpErrorInterceptor.instance = new HttpErrorInterceptor();
    }
    return HttpErrorInterceptor.instance;
  }

  /**
   * Setup error interceptor on an Axios instance
   *
   * @note Settings are captured at setup time
   * The enableErrorLogging and capture* flags are captured at the moment this method
   * is called. Runtime changes to settings will NOT affect already-setup instances.
   * This is intentional for performance reasons. If capture settings change, the app
   * must be restarted to apply the new settings to HTTP clients.
   *
   * @param axiosInstance The Axios instance to setup
   * @param config Configuration for error interception
   * @param context Optional error context that will be merged with each error
   *
   * @example
   * ```typescript
   * const client = axios.create({ baseURL: 'http://api.example.com' });
   * httpErrorInterceptor.setup(client, {
   *   enableErrorLogging: true,
   *   excludeStatusCodes: [404], // Don't log 404s
   * }, {
   *   serviceId: 'my-service',
   *   serviceType: 'custom',
   * });
   * ```
   */
  setup(
    axiosInstance: AxiosInstance,
    config?: HttpErrorInterceptorConfig,
    context?: ErrorContext,
  ): void {
    const mergedConfig = { ...this.defaultConfig, ...config };

    // Setup response error interceptor
    axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        // Check if error should be excluded
        if (this.shouldExcludeError(error, mergedConfig)) {
          return Promise.reject(error);
        }

        // Extract error context
        const errorContext = this.extractErrorContext(error, context);

        // Log error asynchronously without blocking
        if (mergedConfig.enableErrorLogging) {
          void this.captureError(error, errorContext, mergedConfig);
        }

        // Call custom handler if provided
        if (mergedConfig.onErrorCapture) {
          try {
            await mergedConfig.onErrorCapture(error, errorContext);
          } catch (callbackError) {
            void logger.warn("HTTP error callback failed.", {
              error: callbackError,
            });
          }
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Setup interceptor on multiple Axios instances
   *
   * @param axiosInstances Map of instances with optional configs
   * @param globalConfig Global configuration applied to all instances
   * @param globalContext Global error context applied to all instances
   *
   * @example
   * ```typescript
   * httpErrorInterceptor.setupMultiple(
   *   {
   *     'sonarr': sonarrClient,
   *     'radarr': radarrClient,
   *     'jellyfin': jellyfinClient,
   *   },
   *   { enableErrorLogging: true },
   *   { serviceType: 'arr' }
   * );
   * ```
   */
  setupMultiple(
    axiosInstances: Record<string, AxiosInstance>,
    globalConfig?: HttpErrorInterceptorConfig,
    globalContext?: ErrorContext,
  ): void {
    for (const [key, instance] of Object.entries(axiosInstances)) {
      this.setup(instance, globalConfig, {
        ...globalContext,
        serviceId: globalContext?.serviceId || key,
      });
    }
  }

  /**
   * Determine if an error should be excluded from logging
   */
  private shouldExcludeError(
    error: AxiosError,
    config: Required<HttpErrorInterceptorConfig>,
  ): boolean {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // Check excluded status codes
    if (status && config.excludeStatusCodes.includes(status)) {
      return true;
    }

    // Check excluded endpoints
    if (
      config.excludeEndpoints.some((endpoint) =>
        endpoint instanceof RegExp
          ? endpoint.test(url)
          : url.includes(endpoint),
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Extract error context from Axios error
   */
  private extractErrorContext(
    error: AxiosError,
    baseContext?: ErrorContext,
  ): ErrorContext {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const method = config?.method?.toUpperCase() || "UNKNOWN";
    const url = config?.url || error.config?.url || "unknown";

    return {
      ...baseContext,
      endpoint: url,
      operation: baseContext?.operation || `${method} ${url}`,
    };
  }

  /**
   * Capture error with optional body/header data and sensitive data detection
   */
  private async captureError(
    error: AxiosError,
    context: ErrorContext,
    config: Required<HttpErrorInterceptorConfig>,
  ): Promise<void> {
    try {
      // Convert Axios error to ApiError (handles all error normalization)
      const apiError = handleApiError(error, context);

      // Prepare detailed data for optional capture
      const details: {
        requestBody?: string;
        responseBody?: string;
        requestHeaders?: string;
      } = {};

      const detectedSensitivePatterns: string[] = [];
      let sensitiveDataLocation: "headers" | "body" | "both" | null = null;

      if (config.captureRequestBody && error.config?.data) {
        details.requestBody =
          typeof error.config.data === "string"
            ? error.config.data
            : JSON.stringify(error.config.data);

        // Check for sensitive patterns in body
        const bodySensitivePatterns = this.detectSensitivePatterns(
          details.requestBody,
        );
        if (bodySensitivePatterns.length > 0) {
          detectedSensitivePatterns.push(...bodySensitivePatterns);
          sensitiveDataLocation = "body";
        }
      }

      if (config.captureResponseBody && error.response?.data) {
        details.responseBody =
          typeof error.response.data === "string"
            ? error.response.data
            : JSON.stringify(error.response.data);

        // Check for sensitive patterns in response body
        const bodySensitivePatterns = this.detectSensitivePatterns(
          details.responseBody,
        );
        if (bodySensitivePatterns.length > 0) {
          detectedSensitivePatterns.push(...bodySensitivePatterns);
          sensitiveDataLocation =
            sensitiveDataLocation === "body" ? "both" : "body";
        }
      }

      if (config.captureRequestHeaders && error.config?.headers) {
        // Detect sensitive headers BEFORE filtering
        const headerSensitivePatterns = this.detectSensitiveHeaderPatterns(
          error.config.headers as Record<string, unknown>,
        );

        if (headerSensitivePatterns.length > 0) {
          detectedSensitivePatterns.push(...headerSensitivePatterns);
          if (sensitiveDataLocation === "body") {
            sensitiveDataLocation = "both";
          } else {
            sensitiveDataLocation = "headers";
          }
        }

        // Filter out sensitive headers from stored data
        const safeHeaders = this.filterSensitiveHeaders(
          error.config.headers as Record<string, unknown>,
        );
        details.requestHeaders = JSON.stringify(safeHeaders);
      }

      // Build sensitive data detection object if patterns were found
      const sensitiveDataDetection =
        detectedSensitivePatterns.length > 0
          ? {
              patterns: Array.from(new Set(detectedSensitivePatterns)), // Deduplicate
              location: sanitizeDataLocation(sensitiveDataLocation),
              timestamp: new Date().toISOString(),
            }
          : undefined;

      // Log error with details and sensitive data detection
      // The ApiErrorLoggerService will attach sensitiveDataDetection to the entry
      await apiErrorLogger.addError(
        apiError,
        context,
        0,
        details,
        sensitiveDataDetection,
      );
    } catch (captureError) {
      void logger.error("Failed to capture HTTP error.", {
        originalError: error.message,
        captureError,
      });
    }
  }

  /**
   * Detect sensitive patterns in text data (bodies)
   * Returns list of detected pattern names
   */
  private detectSensitivePatterns(data: string): string[] {
    const patterns = [
      {
        name: "api-key",
        regex: /[\'"]\s*(?:api[_-]?key|apikey)\s*[\'"]\s*:\s*[\'"]/i,
      },
      {
        name: "password",
        regex: /[\'"]\s*(?:password|passwd|pwd)\s*[\'"]\s*:\s*[\'"]/i,
      },
      {
        name: "secret",
        regex: /[\'"]\s*(?:secret|secret[_-]?key)\s*[\'"]\s*:\s*[\'"]/i,
      },
      {
        name: "token",
        regex: /[\'"]\s*(?:token|access[_-]?token|bearer)\s*[\'"]\s*:\s*[\'"]/i,
      },
      {
        name: "credentials",
        regex: /[\'"]\s*(?:credential|credentials|auth)\s*[\'"]\s*:\s*[\'"]/i,
      },
    ];

    const detected: string[] = [];
    for (const { name, regex } of patterns) {
      if (regex.test(data)) {
        detected.push(name);
      }
    }
    return detected;
  }

  /**
   * Detect sensitive header patterns
   * Returns list of detected header names
   */
  private detectSensitiveHeaderPatterns(
    headers: Record<string, unknown>,
  ): string[] {
    const sensitivePatterns = [
      /authorization/i,
      /auth/i,
      /token/i,
      /key/i,
      /secret/i,
      /password/i,
      /credential/i,
      /bearer/i,
      /x-api-key/i,
      /x-secret/i,
    ];

    const detected: string[] = [];
    for (const [headerName] of Object.entries(headers)) {
      for (const pattern of sensitivePatterns) {
        if (pattern.test(headerName)) {
          detected.push(headerName);
          break; // Only add header name once
        }
      }
    }
    return detected;
  }

  /**
   * Filter out sensitive headers that should not be logged
   */
  private filterSensitiveHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitivePatterns = [
      /authorization/i,
      /auth/i,
      /token/i,
      /key/i,
      /secret/i,
      /password/i,
      /credential/i,
      /bearer/i,
      /x-api-key/i,
      /x-secret/i,
    ];

    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(headers)) {
      const isSensitive = sensitivePatterns.some((pattern) =>
        pattern.test(key),
      );

      if (!isSensitive) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Update default configuration globally
   */
  setDefaultConfig(config: Partial<HttpErrorInterceptorConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }

  /**
   * Get current default configuration
   */
  getDefaultConfig(): Readonly<Required<HttpErrorInterceptorConfig>> {
    return { ...this.defaultConfig };
  }
}

export const httpErrorInterceptor = HttpErrorInterceptor.getInstance();
