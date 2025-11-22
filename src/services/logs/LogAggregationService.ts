import type {
  ServiceLog,
  LogQueryOptions,
  ServiceLogLevel,
} from "@/models/logger.types";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";

/**
 * Aggregated logs from multiple services
 */
export interface AggregatedLogs {
  logs: ServiceLog[];
  totalCount: number;
  hasMore: boolean;
  services: string[];
  timeRange: { start: Date; end: Date };
}

/**
 * Options for searching logs
 */
export interface LogSearchOptions extends LogQueryOptions {
  serviceIds?: string[];
  caseSensitive?: boolean;
  highlightMatches?: boolean;
}

/**
 * Detected pattern in logs
 */
export interface LogPattern {
  id: string;
  pattern: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedServices: string[];
  severity: ServiceLogLevel;
  exampleLogs: ServiceLog[];
}

/**
 * Service for aggregating and analyzing logs from multiple services
 */
export class LogAggregationService {
  private static instance: LogAggregationService | null = null;

  // Pre-compiled regex patterns for better performance
  private static readonly TIMESTAMP_PATTERN =
    /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g;
  private static readonly TIME_PATTERN = /\d{2}:\d{2}:\d{2}/g;
  private static readonly UUID_PATTERN =
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  private static readonly NUMBER_PATTERN =
    /\b\d+(\.\d+)?\s*(KB|MB|GB|TB|ms|s|min|h)?\b/gi;
  private static readonly IP_PATTERN =
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
  private static readonly WINDOWS_PATH_PATTERN = /[A-Za-z]:\\[\w\\\-. ]+/g;
  private static readonly UNIX_PATH_PATTERN = /\/[\w\/\-. ]+/g;
  private static readonly URL_PATTERN = /https?:\/\/[^\s]+/g;
  private static readonly WHITESPACE_PATTERN = /\s+/g;

  private constructor() {}

  /**
   * Get singleton instance of LogAggregationService
   */
  static getInstance(): LogAggregationService {
    if (!LogAggregationService.instance) {
      LogAggregationService.instance = new LogAggregationService();
    }
    return LogAggregationService.instance;
  }

  /**
   * Fetch and aggregate logs from multiple services
   * @param serviceIds - Array of service IDs to query. If empty, queries all services.
   * @param options - Query options for filtering and pagination
   * @returns Aggregated logs with metadata
   */
  async fetchLogs(
    serviceIds: string[],
    options: LogQueryOptions = {},
  ): Promise<AggregatedLogs> {
    const manager = ConnectorManager.getInstance();
    const connectors =
      serviceIds.length > 0
        ? serviceIds
            .map((id) => manager.getConnector(id))
            .filter((c) => c !== undefined)
        : manager.getAllConnectors();

    void logger.debug("Fetching logs from services", {
      serviceCount: connectors.length,
      serviceIds: connectors.map((c) => c.config.id),
      options,
    });

    // Query all services in parallel
    const logResults = await Promise.allSettled(
      connectors.map(async (connector) => {
        if (!connector) {
          return {
            serviceId: "unknown",
            logs: [],
          };
        }

        // Skip services that don't support log retrieval
        if (!connector.getLogs) {
          void logger.debug("Service does not support log retrieval", {
            serviceId: connector.config.id,
            serviceType: connector.config.type,
          });
          return {
            serviceId: connector.config.id,
            logs: [],
          };
        }

        try {
          const logs = await connector.getLogs(options);
          return {
            serviceId: connector.config.id,
            logs,
          };
        } catch (error) {
          void logger.error("Failed to get logs for service", {
            serviceId: connector.config.id,
            serviceType: connector.config.type,
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            serviceId: connector.config.id,
            logs: [],
          };
        }
      }),
    );

    // Collect all logs
    const allLogs: ServiceLog[] = [];
    const serviceSet = new Set<string>();

    for (const result of logResults) {
      if (result.status === "fulfilled") {
        const { serviceId, logs } = result.value;
        allLogs.push(...logs);
        if (logs.length > 0) {
          serviceSet.add(serviceId);
        }
      }
    }

    // Sort logs by timestamp (newest first)
    allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Calculate time range
    const timeRange = this.calculateTimeRange(allLogs);

    // Apply pagination if limit is specified
    const limit = options.limit || allLogs.length;
    const startIndex = options.startIndex || 0;
    const paginatedLogs = allLogs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < allLogs.length;

    void logger.debug("Log aggregation complete", {
      totalLogs: allLogs.length,
      returnedLogs: paginatedLogs.length,
      serviceCount: serviceSet.size,
      hasMore,
    });

    return {
      logs: paginatedLogs,
      totalCount: allLogs.length,
      hasMore,
      services: Array.from(serviceSet),
      timeRange,
    };
  }

  /**
   * Search logs with case-insensitive matching and optional highlighting
   * @param query - Search query string
   * @param options - Search options including filters and highlighting
   * @returns Filtered logs matching the search query
   */
  async searchLogs(
    query: string,
    options: LogSearchOptions = {},
  ): Promise<ServiceLog[]> {
    void logger.debug("Searching logs", {
      query,
      caseSensitive: options.caseSensitive,
      highlightMatches: options.highlightMatches,
      serviceIds: options.serviceIds,
    });

    // Fetch logs from specified services
    const serviceIds = options.serviceIds || [];
    const aggregatedLogs = await this.fetchLogs(serviceIds, options);

    // If query is empty, return all logs
    if (!query.trim()) {
      return aggregatedLogs.logs;
    }

    // Perform case-insensitive search by default
    const caseSensitive = options.caseSensitive ?? false;
    const searchQuery = caseSensitive ? query : query.toLowerCase();

    // Filter logs that match the query
    const matchedLogs = aggregatedLogs.logs.filter((log) => {
      const searchableText = caseSensitive
        ? `${log.message} ${log.logger || ""} ${log.method || ""} ${log.exception || ""}`
        : `${log.message} ${log.logger || ""} ${log.method || ""} ${log.exception || ""}`.toLowerCase();

      return searchableText.includes(searchQuery);
    });

    // Apply highlighting if requested
    if (options.highlightMatches) {
      return matchedLogs.map((log) =>
        this.highlightMatches(log, query, caseSensitive),
      );
    }

    void logger.debug("Search complete", {
      query,
      matchedCount: matchedLogs.length,
      totalCount: aggregatedLogs.logs.length,
    });

    return matchedLogs;
  }

  /**
   * Export logs to JSON or text format
   * @param logs - Logs to export
   * @param format - Export format ('json' or 'text')
   * @returns Formatted string representation of logs
   */
  async exportLogs(
    logs: ServiceLog[],
    format: "json" | "text",
  ): Promise<string> {
    void logger.debug("Exporting logs", {
      logCount: logs.length,
      format,
    });

    if (format === "json") {
      return JSON.stringify(logs, null, 2);
    }

    // Text format
    const lines = logs.map((log) => {
      const timestamp = log.timestamp.toISOString();
      const level = log.level.toUpperCase().padEnd(5);
      const service = log.serviceName.padEnd(15);
      const message = log.message;
      const exception = log.exception ? `\n  Exception: ${log.exception}` : "";

      return `[${timestamp}] ${level} ${service} ${message}${exception}`;
    });

    return lines.join("\n");
  }

  /**
   * Analyze logs for recurring patterns using fuzzy matching
   * Optimized for performance with large datasets
   * @param logs - Logs to analyze
   * @returns Detected patterns with frequency and metadata
   */
  async analyzePatterns(logs: ServiceLog[]): Promise<LogPattern[]> {
    void logger.debug("Analyzing log patterns", {
      logCount: logs.length,
    });

    // Early exit for empty or single log
    if (logs.length < 2) {
      return [];
    }

    // Group logs by normalized message patterns
    const patternMap = new Map<string, ServiceLog[]>();

    // Cache normalized patterns to avoid redundant normalization
    const normalizedCache = new Map<string, string>();

    for (const log of logs) {
      // Check cache first
      let normalizedPattern = normalizedCache.get(log.message);

      if (!normalizedPattern) {
        normalizedPattern = this.normalizeLogMessage(log.message);
        normalizedCache.set(log.message, normalizedPattern);
      }

      const existing = patternMap.get(normalizedPattern);
      if (existing) {
        existing.push(log);
      } else {
        patternMap.set(normalizedPattern, [log]);
      }
    }

    // Convert to LogPattern objects
    const patterns: LogPattern[] = [];
    let patternIdCounter = 0;

    for (const [pattern, matchingLogs] of patternMap.entries()) {
      // Only include patterns that occur more than once
      if (matchingLogs.length < 2) {
        continue;
      }

      // Sort by timestamp to get first and last occurrence
      const sortedLogs = matchingLogs.sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
      );

      // Get unique services using Set for better performance
      const serviceSet = new Set<string>();
      const levelSet = new Set<ServiceLogLevel>();

      for (const log of matchingLogs) {
        serviceSet.add(log.serviceId);
        levelSet.add(log.level);
      }

      // Determine severity (use highest severity from matching logs)
      const severity = this.getHighestSeverity(Array.from(levelSet));

      // Take up to 3 example logs
      const exampleLogs = sortedLogs.slice(0, 3);

      // Get first and last log (we know sortedLogs has at least 2 items due to the filter above)
      const firstLog = sortedLogs[0];
      const lastLog = sortedLogs[sortedLogs.length - 1];

      if (!firstLog || !lastLog) {
        continue; // Skip if we can't get timestamps
      }

      patterns.push({
        id: `pattern-${patternIdCounter++}`,
        pattern,
        count: matchingLogs.length,
        firstOccurrence: firstLog.timestamp,
        lastOccurrence: lastLog.timestamp,
        affectedServices: Array.from(serviceSet),
        severity,
        exampleLogs,
      });
    }

    // Sort patterns by count (most frequent first)
    patterns.sort((a, b) => b.count - a.count);

    void logger.debug("Pattern analysis complete", {
      patternCount: patterns.length,
      totalLogs: logs.length,
      uniquePatterns: patternMap.size,
    });

    return patterns;
  }

  /**
   * Normalize a log message for pattern matching by replacing variable data
   * This implements fuzzy matching by removing timestamps, IDs, numbers, etc.
   * Optimized with pre-compiled regex patterns
   */
  private normalizeLogMessage(message: string): string {
    return (
      message
        // Replace timestamps (various formats)
        .replace(LogAggregationService.TIMESTAMP_PATTERN, "<TIMESTAMP>")
        .replace(LogAggregationService.TIME_PATTERN, "<TIME>")
        // Replace UUIDs
        .replace(LogAggregationService.UUID_PATTERN, "<UUID>")
        // Replace numbers (file sizes, IDs, counts, etc.)
        .replace(LogAggregationService.NUMBER_PATTERN, "<NUMBER>")
        // Replace IP addresses
        .replace(LogAggregationService.IP_PATTERN, "<IP>")
        // Replace file paths
        .replace(LogAggregationService.WINDOWS_PATH_PATTERN, "<PATH>")
        .replace(LogAggregationService.UNIX_PATH_PATTERN, "<PATH>")
        // Replace URLs
        .replace(LogAggregationService.URL_PATTERN, "<URL>")
        // Normalize whitespace
        .replace(LogAggregationService.WHITESPACE_PATTERN, " ")
        .trim()
    );
  }

  /**
   * Highlight search matches in a log entry
   */
  private highlightMatches(
    log: ServiceLog,
    query: string,
    caseSensitive: boolean,
  ): ServiceLog {
    const highlightText = (text: string | undefined): string | undefined => {
      if (!text) return text;

      const searchQuery = caseSensitive ? query : query.toLowerCase();
      const searchText = caseSensitive ? text : text.toLowerCase();

      // Find all match positions
      const matches: { start: number; end: number }[] = [];
      let pos = 0;

      while (pos < searchText.length) {
        const index = searchText.indexOf(searchQuery, pos);
        if (index === -1) break;

        matches.push({
          start: index,
          end: index + query.length,
        });

        pos = index + query.length;
      }

      // If no matches, return original text
      if (matches.length === 0) return text;

      // Build highlighted text
      let result = "";
      let lastEnd = 0;

      for (const match of matches) {
        result += text.substring(lastEnd, match.start);
        result += `<mark>${text.substring(match.start, match.end)}</mark>`;
        lastEnd = match.end;
      }

      result += text.substring(lastEnd);

      return result;
    };

    const highlightedMessage = highlightText(log.message);
    const highlightedException = highlightText(log.exception);
    const highlightedLogger = highlightText(log.logger);
    const highlightedMethod = highlightText(log.method);

    return {
      ...log,
      message: highlightedMessage ?? log.message,
      exception: highlightedException ?? log.exception,
      logger: highlightedLogger ?? log.logger,
      method: highlightedMethod ?? log.method,
    };
  }

  /**
   * Calculate time range from logs
   */
  private calculateTimeRange(logs: ServiceLog[]): { start: Date; end: Date } {
    if (logs.length === 0) {
      const now = new Date();
      return { start: now, end: now };
    }

    const timestamps = logs.map((log) => log.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      start: new Date(minTime),
      end: new Date(maxTime),
    };
  }

  /**
   * Get the highest severity level from a list of levels
   */
  private getHighestSeverity(levels: ServiceLogLevel[]): ServiceLogLevel {
    const severityOrder: ServiceLogLevel[] = [
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
    ];

    for (const severity of severityOrder) {
      if (levels.includes(severity)) {
        return severity;
      }
    }

    return "info";
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    void logger.debug("LogAggregationService disposed");
  }
}
