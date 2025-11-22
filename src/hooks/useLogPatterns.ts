import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import {
  LogAggregationService,
  type LogPattern,
} from "@/services/logs/LogAggregationService";
import type { ServiceLog, LogQueryOptions } from "@/models/logger.types";
import { STALE_TIME, CACHE_TIME, RETRY_CONFIG } from "@/hooks/queryConfig";

/**
 * Query key factory for pattern queries
 */
const patternKeys = {
  base: ["patterns"] as const,
  analyze: (serviceIds: string[], options?: LogQueryOptions) =>
    [
      "patterns",
      "analyze",
      { serviceIds: [...serviceIds].sort(), options },
    ] as const,
};

/**
 * Options for useLogPatterns hook
 */
export interface UseLogPatternsOptions extends LogQueryOptions {
  /**
   * Array of service IDs to analyze. If empty, analyzes all services.
   */
  serviceIds?: string[];

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Minimum pattern count to include. Defaults to 2.
   */
  minCount?: number;

  /**
   * Maximum number of patterns to return. Defaults to unlimited.
   */
  maxPatterns?: number;
}

/**
 * Hook for analyzing log patterns with fuzzy matching
 *
 * Features:
 * - TanStack Query for pattern analysis
 * - Support for pattern selection and filtering
 * - Automatic pattern detection with fuzzy matching
 * - Configurable minimum count and max patterns
 *
 * @param options - Configuration options
 * @returns Query result with detected patterns
 *
 * @example
 * ```tsx
 * const { data: patterns, isLoading } = useLogPatterns({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   level: ['error', 'warn'],
 *   minCount: 3,
 *   maxPatterns: 10,
 * });
 * ```
 */
export function useLogPatterns(options: UseLogPatternsOptions = {}) {
  const {
    serviceIds = [],
    enabled = true,
    minCount = 2,
    maxPatterns,
    ...queryOptions
  } = options;

  const logService = LogAggregationService.getInstance();
  const queryKey = patternKeys.analyze(serviceIds, queryOptions);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<LogPattern[]> => {
      // Fetch logs for analysis
      const aggregatedLogs = await logService.fetchLogs(
        serviceIds,
        queryOptions,
      );

      // Analyze patterns
      let patterns = await logService.analyzePatterns(aggregatedLogs.logs);

      // Filter by minimum count
      patterns = patterns.filter((pattern) => pattern.count >= minCount);

      // Limit number of patterns if specified
      if (maxPatterns && maxPatterns > 0) {
        patterns = patterns.slice(0, maxPatterns);
      }

      return patterns;
    },
    staleTime: STALE_TIME.LONG, // 5 minutes
    gcTime: CACHE_TIME.LONG, // 15 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Hook for filtering logs by a selected pattern
 *
 * @param logs - Array of logs to filter
 * @param selectedPattern - Pattern to filter by
 * @returns Filtered logs matching the pattern
 *
 * @example
 * ```tsx
 * const { data: logs } = useServiceLogs({ serviceIds: ['sonarr-1'] });
 * const { data: patterns } = useLogPatterns({ serviceIds: ['sonarr-1'] });
 * const [selectedPattern, setSelectedPattern] = useState<LogPattern | null>(null);
 *
 * const filteredLogs = useFilterLogsByPattern(
 *   logs?.logs || [],
 *   selectedPattern
 * );
 * ```
 */
export function useFilterLogsByPattern(
  logs: ServiceLog[],
  selectedPattern: LogPattern | null,
): ServiceLog[] {
  return useMemo(() => {
    if (!selectedPattern) {
      return logs;
    }

    // Get the example log IDs from the pattern
    const exampleLogIds = new Set(
      selectedPattern.exampleLogs.map((log) => log.id),
    );

    // Filter logs that match the pattern
    // We'll use a simple approach: normalize the log message and compare with the pattern
    return logs.filter((log) => {
      // If this log is in the example logs, include it
      if (exampleLogIds.has(log.id)) {
        return true;
      }

      // Otherwise, normalize and compare
      const normalizedMessage = normalizeLogMessage(log.message);
      return normalizedMessage === selectedPattern.pattern;
    });
  }, [logs, selectedPattern]);
}

/**
 * Hook for pattern selection state management
 *
 * @returns Pattern selection state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   selectedPattern,
 *   selectPattern,
 *   clearSelection,
 *   isPatternSelected,
 * } = usePatternSelection();
 *
 * <PatternList
 *   patterns={patterns}
 *   onSelect={selectPattern}
 *   selectedId={selectedPattern?.id}
 * />
 * ```
 */
export function usePatternSelection() {
  const [selectedPattern, setSelectedPattern] = useState<LogPattern | null>(
    null,
  );

  const selectPattern = useCallback((pattern: LogPattern) => {
    setSelectedPattern(pattern);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPattern(null);
  }, []);

  const isPatternSelected = useCallback(
    (patternId: string) => {
      return selectedPattern?.id === patternId;
    },
    [selectedPattern],
  );

  return {
    selectedPattern,
    selectPattern,
    clearSelection,
    isPatternSelected,
  };
}

/**
 * Hook to manually refresh pattern analysis
 *
 * @returns Callback to refresh pattern data
 *
 * @example
 * ```tsx
 * const refreshPatterns = useRefreshPatterns();
 *
 * <Button onPress={() => refreshPatterns(['sonarr-1'])}>
 *   Refresh Patterns
 * </Button>
 * ```
 */
export function useRefreshPatterns() {
  const queryClient = useQueryClient();

  return useCallback(
    async (serviceIds: string[] = [], options?: LogQueryOptions) => {
      const queryKey = patternKeys.analyze(serviceIds, options);
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );
}

/**
 * Hook to get pattern statistics
 *
 * @param patterns - Array of patterns
 * @returns Pattern statistics
 *
 * @example
 * ```tsx
 * const { data: patterns } = useLogPatterns({ serviceIds: ['sonarr-1'] });
 * const stats = usePatternStats(patterns);
 * ```
 */
export function usePatternStats(patterns: LogPattern[] | undefined) {
  return useMemo(() => {
    if (!patterns || patterns.length === 0) {
      return {
        totalPatterns: 0,
        totalOccurrences: 0,
        mostFrequent: null,
        criticalPatterns: 0,
        errorPatterns: 0,
        warningPatterns: 0,
        affectedServices: [],
      };
    }

    const totalPatterns = patterns.length;
    const totalOccurrences = patterns.reduce(
      (sum, pattern) => sum + pattern.count,
      0,
    );
    const mostFrequent = patterns[0] || null; // Patterns are sorted by count

    const criticalPatterns = patterns.filter(
      (p) => p.severity === "fatal" || p.severity === "error",
    ).length;
    const errorPatterns = patterns.filter((p) => p.severity === "error").length;
    const warningPatterns = patterns.filter(
      (p) => p.severity === "warn",
    ).length;

    // Get unique affected services
    const serviceSet = new Set<string>();
    for (const pattern of patterns) {
      for (const serviceId of pattern.affectedServices) {
        serviceSet.add(serviceId);
      }
    }
    const affectedServices = Array.from(serviceSet);

    return {
      totalPatterns,
      totalOccurrences,
      mostFrequent,
      criticalPatterns,
      errorPatterns,
      warningPatterns,
      affectedServices,
    };
  }, [patterns]);
}

/**
 * Hook to filter patterns by severity
 *
 * @param patterns - Array of patterns
 * @param severity - Severity level to filter by
 * @returns Filtered patterns
 *
 * @example
 * ```tsx
 * const { data: patterns } = useLogPatterns({ serviceIds: ['sonarr-1'] });
 * const errorPatterns = useFilterPatternsBySeverity(patterns, 'error');
 * ```
 */
export function useFilterPatternsBySeverity(
  patterns: LogPattern[] | undefined,
  severity: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | null,
): LogPattern[] {
  return useMemo(() => {
    if (!patterns || !severity) {
      return patterns || [];
    }

    return patterns.filter((pattern) => pattern.severity === severity);
  }, [patterns, severity]);
}

/**
 * Hook to filter patterns by service
 *
 * @param patterns - Array of patterns
 * @param serviceId - Service ID to filter by
 * @returns Filtered patterns
 *
 * @example
 * ```tsx
 * const { data: patterns } = useLogPatterns({ serviceIds: ['sonarr-1', 'radarr-1'] });
 * const sonarrPatterns = useFilterPatternsByService(patterns, 'sonarr-1');
 * ```
 */
export function useFilterPatternsByService(
  patterns: LogPattern[] | undefined,
  serviceId: string | null,
): LogPattern[] {
  return useMemo(() => {
    if (!patterns || !serviceId) {
      return patterns || [];
    }

    return patterns.filter((pattern) =>
      pattern.affectedServices.includes(serviceId),
    );
  }, [patterns, serviceId]);
}

/**
 * Hook to sort patterns by different criteria
 *
 * @param patterns - Array of patterns
 * @param sortBy - Sort criteria
 * @returns Sorted patterns
 *
 * @example
 * ```tsx
 * const { data: patterns } = useLogPatterns({ serviceIds: ['sonarr-1'] });
 * const sortedPatterns = useSortPatterns(patterns, 'recent');
 * ```
 */
export function useSortPatterns(
  patterns: LogPattern[] | undefined,
  sortBy: "frequency" | "recent" | "oldest" | "severity",
): LogPattern[] {
  return useMemo(() => {
    if (!patterns) {
      return [];
    }

    const sorted = [...patterns];

    switch (sortBy) {
      case "frequency":
        // Already sorted by frequency from the service
        return sorted;

      case "recent":
        return sorted.sort(
          (a, b) => b.lastOccurrence.getTime() - a.lastOccurrence.getTime(),
        );

      case "oldest":
        return sorted.sort(
          (a, b) => a.firstOccurrence.getTime() - b.firstOccurrence.getTime(),
        );

      case "severity":
        const severityOrder = {
          fatal: 0,
          error: 1,
          warn: 2,
          info: 3,
          debug: 4,
          trace: 5,
        };
        return sorted.sort(
          (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
        );

      default:
        return sorted;
    }
  }, [patterns, sortBy]);
}

/**
 * Normalize a log message for pattern matching
 * This should match the normalization logic in LogAggregationService
 */
function normalizeLogMessage(message: string): string {
  return (
    message
      // Replace timestamps (various formats)
      .replace(
        /\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g,
        "<TIMESTAMP>",
      )
      .replace(/\d{2}:\d{2}:\d{2}/g, "<TIME>")
      // Replace UUIDs
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "<UUID>",
      )
      // Replace numbers (file sizes, IDs, counts, etc.)
      .replace(/\b\d+(\.\d+)?\s*(KB|MB|GB|TB|ms|s|min|h)?\b/gi, "<NUMBER>")
      // Replace IP addresses
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<IP>")
      // Replace file paths
      .replace(/[A-Za-z]:\\[\w\\\-. ]+/g, "<PATH>")
      .replace(/\/[\w\/\-. ]+/g, "<PATH>")
      // Replace URLs
      .replace(/https?:\/\/[^\s]+/g, "<URL>")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
