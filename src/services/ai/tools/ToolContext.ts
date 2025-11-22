import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { UnifiedSearchService } from "@/services/search/UnifiedSearchService";
import type { UnifiedSearchResult } from "@/models/search.types";
import { ToolError, ToolErrorCategory } from "./types";

/**
 * Provides shared context and utilities for all AI tools.
 * Implements singleton pattern to ensure consistent access to services.
 *
 * The context provides:
 * - Access to ConnectorManager for service interactions
 * - Access to UnifiedSearchService for media search
 * - Helper methods for date parsing, formatting, and error handling
 *
 * @example
 * ```typescript
 * const context = ToolContext.getInstance();
 * const connectorManager = context.getConnectorManager();
 * const searchService = context.getSearchService();
 * ```
 */
export class ToolContext {
  private static instance: ToolContext | null = null;

  private readonly connectorManager: ConnectorManager;
  private readonly searchService: UnifiedSearchService;

  private constructor() {
    this.connectorManager = ConnectorManager.getInstance();
    this.searchService = UnifiedSearchService.getInstance();
  }

  /**
   * Get the singleton instance of the ToolContext
   */
  static getInstance(): ToolContext {
    if (!ToolContext.instance) {
      ToolContext.instance = new ToolContext();
    }

    return ToolContext.instance;
  }

  /**
   * Get the ConnectorManager instance for accessing service connectors.
   *
   * @returns The ConnectorManager singleton
   *
   * @example
   * ```typescript
   * const manager = context.getConnectorManager();
   * const sonarrConnector = manager.getConnectorsByType('sonarr')[0];
   * ```
   */
  getConnectorManager(): ConnectorManager {
    return this.connectorManager;
  }

  /**
   * Get the UnifiedSearchService instance for searching media.
   *
   * @returns The UnifiedSearchService singleton
   *
   * @example
   * ```typescript
   * const searchService = context.getSearchService();
   * const results = await searchService.search('Breaking Bad');
   * ```
   */
  getSearchService(): UnifiedSearchService {
    return this.searchService;
  }

  /**
   * Parse a relative date string into a Date object.
   * Supports natural language expressions like "today", "tomorrow", "this week", etc.
   *
   * @param dateStr - Date string (ISO format or relative expression)
   * @returns Parsed Date object
   * @throws {ToolError} If the date string is invalid
   *
   * @example
   * ```typescript
   * const today = context.parseRelativeDate('today');
   * const tomorrow = context.parseRelativeDate('tomorrow');
   * const nextWeek = context.parseRelativeDate('next week');
   * const isoDate = context.parseRelativeDate('2024-12-25');
   * ```
   */
  parseRelativeDate(dateStr: string): Date {
    const normalized = dateStr.trim().toLowerCase();
    const now = new Date();

    // Reset time to start of day for consistent date comparisons
    const startOfDay = (date: Date): Date => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      return d;
    };

    // Handle relative date expressions
    switch (normalized) {
      case "today":
        return startOfDay(now);

      case "tomorrow":
        return startOfDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));

      case "yesterday":
        return startOfDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));

      case "this week": {
        // Start of current week (Sunday)
        const day = now.getDay();
        const diff = now.getDate() - day;
        return startOfDay(new Date(now.setDate(diff)));
      }

      case "next week": {
        // Start of next week (Sunday)
        const day = now.getDay();
        const diff = now.getDate() - day + 7;
        return startOfDay(new Date(now.setDate(diff)));
      }

      case "this month": {
        // Start of current month
        return startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      }

      case "next month": {
        // Start of next month
        return startOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 1));
      }

      case "this year": {
        // Start of current year
        return startOfDay(new Date(now.getFullYear(), 0, 1));
      }

      case "next year": {
        // Start of next year
        return startOfDay(new Date(now.getFullYear() + 1, 0, 1));
      }

      default: {
        // Try to parse as ISO date or standard date format
        const parsed = Date.parse(dateStr);

        if (Number.isNaN(parsed)) {
          throw new ToolError(
            `Invalid date string: "${dateStr}"`,
            ToolErrorCategory.INVALID_PARAMETERS,
            'Please provide a valid date in ISO format (YYYY-MM-DD) or use relative expressions like "today", "tomorrow", "this week", "next month".',
            { providedDate: dateStr },
          );
        }

        return startOfDay(new Date(parsed));
      }
    }
  }

  /**
   * Format a media search result into a concise, LLM-friendly string.
   * Includes key information like title, year, overview, and service details.
   *
   * @param result - The search result to format
   * @returns Formatted string representation
   *
   * @example
   * ```typescript
   * const formatted = context.formatMediaResult(searchResult);
   * // Returns: "Breaking Bad (2008) - A high school chemistry teacher..."
   * ```
   */
  formatMediaResult(result: UnifiedSearchResult): string {
    const parts: string[] = [];

    // Title and year
    if (result.year) {
      parts.push(`${result.title} (${result.year})`);
    } else {
      parts.push(result.title);
    }

    // Media type
    parts.push(`[${result.mediaType}]`);

    // Service information
    parts.push(`via ${result.serviceName}`);

    // Library status
    if (result.isInLibrary) {
      parts.push("(in library)");
    } else if (result.isRequested) {
      parts.push("(requested)");
    } else if (result.isAvailable) {
      parts.push("(available)");
    }

    // Rating
    if (result.rating !== undefined) {
      parts.push(`Rating: ${result.rating.toFixed(1)}/10`);
    }

    let formatted = parts.join(" ");

    // Add overview if available (truncated to 150 chars)
    if (result.overview) {
      const truncated =
        result.overview.length > 150
          ? `${result.overview.substring(0, 150)}...`
          : result.overview;
      formatted += `\n  ${truncated}`;
    }

    return formatted;
  }

  /**
   * Format multiple media results into a numbered list.
   *
   * @param results - Array of search results to format
   * @param maxResults - Maximum number of results to include (default: 10)
   * @returns Formatted string with numbered list
   *
   * @example
   * ```typescript
   * const formatted = context.formatMediaResults(results, 5);
   * // Returns:
   * // 1. Breaking Bad (2008) [series] via Sonarr (in library)
   * // 2. Better Call Saul (2015) [series] via Sonarr
   * // ...
   * ```
   */
  formatMediaResults(
    results: UnifiedSearchResult[],
    maxResults: number = 10,
  ): string {
    if (results.length === 0) {
      return "No results found.";
    }

    const limited = results.slice(0, maxResults);
    const formatted = limited
      .map((result, index) => {
        const resultStr = this.formatMediaResult(result);
        // Add number prefix to first line only
        const lines = resultStr.split("\n");
        lines[0] = `${index + 1}. ${lines[0]}`;
        return lines.join("\n");
      })
      .join("\n\n");

    if (results.length > maxResults) {
      return `${formatted}\n\n... and ${results.length - maxResults} more results`;
    }

    return formatted;
  }

  /**
   * Format an error into a user-friendly message.
   * Handles ToolError instances specially to include actionable suggestions.
   *
   * @param error - The error to format
   * @returns User-friendly error message
   *
   * @example
   * ```typescript
   * try {
   *   // ... some operation
   * } catch (error) {
   *   const message = context.formatError(error);
   *   return { success: false, error: message };
   * }
   * ```
   */
  formatError(error: unknown): string {
    if (error instanceof ToolError) {
      return error.toUserMessage();
    }

    if (error instanceof Error) {
      // Remove stack traces and technical details
      const message = error.message.split("\n")[0];
      return `An error occurred: ${message}`;
    }

    return "An unexpected error occurred. Please try again.";
  }

  /**
   * Create a ToolError for a service not configured scenario.
   *
   * @param serviceType - The type of service that is not configured
   * @returns ToolError with appropriate message and category
   *
   * @example
   * ```typescript
   * if (!connector) {
   *   throw context.createServiceNotConfiguredError('sonarr');
   * }
   * ```
   */
  createServiceNotConfiguredError(serviceType: string): ToolError {
    return new ToolError(
      `${serviceType} service is not configured`,
      ToolErrorCategory.SERVICE_NOT_CONFIGURED,
      `Please add a ${serviceType} service in Settings > Services to use this feature.`,
      { serviceType },
    );
  }

  /**
   * Create a ToolError for an authentication failure.
   *
   * @param serviceType - The type of service that failed authentication
   * @param serviceName - The name of the specific service instance
   * @returns ToolError with appropriate message and category
   *
   * @example
   * ```typescript
   * if (authFailed) {
   *   throw context.createAuthFailedError('sonarr', 'My Sonarr');
   * }
   * ```
   */
  createAuthFailedError(serviceType: string, serviceName: string): ToolError {
    return new ToolError(
      `Authentication failed for ${serviceName}`,
      ToolErrorCategory.AUTH_FAILED,
      `Please check the API key and credentials for ${serviceName} in Settings > Services.`,
      { serviceType, serviceName },
    );
  }

  /**
   * Create a ToolError for a service unavailable scenario.
   *
   * @param serviceType - The type of service that is unavailable
   * @param serviceName - The name of the specific service instance
   * @param details - Additional error details
   * @returns ToolError with appropriate message and category
   *
   * @example
   * ```typescript
   * if (timeout) {
   *   throw context.createServiceUnavailableError('sonarr', 'My Sonarr', 'Connection timeout');
   * }
   * ```
   */
  createServiceUnavailableError(
    serviceType: string,
    serviceName: string,
    details?: string,
  ): ToolError {
    const message = details
      ? `${serviceName} is unavailable: ${details}`
      : `${serviceName} is unavailable`;

    return new ToolError(
      message,
      ToolErrorCategory.SERVICE_UNAVAILABLE,
      "Please check your network connection and ensure the service is running. If you're using a VPN, try disconnecting it.",
      { serviceType, serviceName, details },
    );
  }

  /**
   * Check if a tool action is destructive and determine its severity level.
   * Destructive actions include operations that delete, remove, or unmonitor content.
   *
   * @param toolName - The name of the tool being invoked
   * @param params - The parameters passed to the tool
   * @returns Object with isDestructive flag and severity level, or null if not destructive
   *
   * @example
   * ```typescript
   * const result = context.isDestructiveAction('manage_downloads', { action: 'remove' });
   * if (result) {
   *   console.log(`Destructive action detected: ${result.severity} severity`);
   * }
   * ```
   */
  isDestructiveAction(
    toolName: string,
    params: Record<string, unknown>,
  ): { isDestructive: true; severity: "low" | "medium" | "high" } | null {
    // Define destructive actions by tool name and parameters
    const destructivePatterns: {
      toolName: string;
      paramCheck?: (params: Record<string, unknown>) => boolean;
      severity: "low" | "medium" | "high";
    }[] = [
      // Download management - remove action
      {
        toolName: "manage_downloads",
        paramCheck: (p) => p.action === "remove",
        severity: "medium",
      },
      // Media management - delete or unmonitor
      {
        toolName: "manage_media",
        paramCheck: (p) => p.action === "delete" || p.action === "unmonitor",
        severity: "high",
      },
      // Bulk operations - typically high severity
      {
        toolName: "bulk_remove_downloads",
        severity: "high",
      },
      {
        toolName: "bulk_delete_media",
        severity: "high",
      },
      // Service control - restart/shutdown
      {
        toolName: "control_service",
        paramCheck: (p) => p.action === "restart" || p.action === "shutdown",
        severity: "low",
      },
      // File operations
      {
        toolName: "delete_files",
        severity: "high",
      },
      // Queue management - clear queue
      {
        toolName: "manage_queue",
        paramCheck: (p) => p.action === "clear" || p.action === "remove",
        severity: "medium",
      },
    ];

    // Check if the tool and parameters match any destructive pattern
    for (const pattern of destructivePatterns) {
      if (pattern.toolName === toolName) {
        // If no param check is defined, the tool is always destructive
        if (!pattern.paramCheck) {
          return { isDestructive: true, severity: pattern.severity };
        }

        // Check if parameters match the destructive pattern
        if (pattern.paramCheck(params)) {
          return { isDestructive: true, severity: pattern.severity };
        }
      }
    }

    return null;
  }

  /**
   * Reset the singleton instance.
   * Primarily used for testing purposes.
   */
  static resetInstance(): void {
    if (ToolContext.instance) {
      ToolContext.instance = null;
    }
  }
}
