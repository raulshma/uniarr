import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  MetricsEngine,
  type ServiceMetrics,
  type AggregatedMetrics,
  type MetricDataPoint,
  type MetricType,
  type TimeRange,
} from "@/services/metrics/MetricsEngine";
import { STALE_TIME, CACHE_TIME, RETRY_CONFIG } from "@/hooks/queryConfig";

/**
 * Query key factory for metrics queries
 */
const metricsKeys = {
  base: ["metrics"] as const,
  service: (serviceId: string, timeRange: TimeRange) =>
    ["metrics", "service", serviceId, timeRange] as const,
  aggregated: (serviceIds: string[], timeRange: TimeRange) =>
    [
      "metrics",
      "aggregated",
      { serviceIds: [...serviceIds].sort(), timeRange },
    ] as const,
  history: (serviceId: string, metric: MetricType, timeRange: TimeRange) =>
    ["metrics", "history", serviceId, metric, timeRange] as const,
};

/**
 * Options for useServiceMetrics hook
 */
export interface UseServiceMetricsOptions {
  /**
   * Time range for metrics calculation
   */
  timeRange: TimeRange;

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Refetch interval in milliseconds. Defaults to 5 minutes.
   */
  refetchInterval?: number;
}

/**
 * Hook for fetching metrics for a single service
 *
 * Features:
 * - TanStack Query for metric data
 * - Support for time range selection
 * - Automatic calculation of derived metrics
 * - Configurable refetch intervals
 *
 * @param serviceId - ID of the service to fetch metrics for
 * @param options - Configuration options
 * @returns Query result with service metrics
 *
 * @example
 * ```tsx
 * const { data: metrics, isLoading } = useServiceMetrics('sonarr-1', {
 *   timeRange: {
 *     start: new Date(Date.now() - 24 * 60 * 60 * 1000),
 *     end: new Date(),
 *     preset: '24h',
 *   },
 * });
 * ```
 */
export function useServiceMetrics(
  serviceId: string,
  options: UseServiceMetricsOptions,
) {
  const {
    timeRange,
    enabled = true,
    refetchInterval = 5 * 60 * 1000,
  } = options;

  const metricsEngine = MetricsEngine.getInstance();
  const queryKey = metricsKeys.service(serviceId, timeRange);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ServiceMetrics> => {
      return await metricsEngine.calculateMetrics(serviceId, timeRange);
    },
    staleTime: STALE_TIME.LONG, // 5 minutes
    gcTime: CACHE_TIME.LONG, // 15 minutes
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: enabled && !!serviceId,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Options for useAggregatedMetrics hook
 */
export interface UseAggregatedMetricsOptions {
  /**
   * Array of service IDs to aggregate. If empty, aggregates all services.
   */
  serviceIds?: string[];

  /**
   * Time range for metrics calculation
   */
  timeRange: TimeRange;

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;

  /**
   * Refetch interval in milliseconds. Defaults to 5 minutes.
   */
  refetchInterval?: number;
}

/**
 * Hook for fetching aggregated metrics across multiple services
 *
 * @param options - Configuration options
 * @returns Query result with aggregated metrics
 *
 * @example
 * ```tsx
 * const { data: metrics, isLoading } = useAggregatedMetrics({
 *   serviceIds: ['sonarr-1', 'radarr-1'],
 *   timeRange: {
 *     start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 *     end: new Date(),
 *     preset: '7d',
 *   },
 * });
 * ```
 */
export function useAggregatedMetrics(options: UseAggregatedMetricsOptions) {
  const {
    serviceIds = [],
    timeRange,
    enabled = true,
    refetchInterval = 5 * 60 * 1000,
  } = options;

  const metricsEngine = MetricsEngine.getInstance();
  const queryKey = metricsKeys.aggregated(serviceIds, timeRange);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<AggregatedMetrics> => {
      return await metricsEngine.getAggregatedMetrics(serviceIds, timeRange);
    },
    staleTime: STALE_TIME.LONG,
    gcTime: CACHE_TIME.LONG,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Options for useMetricHistory hook
 */
export interface UseMetricHistoryOptions {
  /**
   * Type of metric to retrieve
   */
  metric: MetricType;

  /**
   * Time range for the history
   */
  timeRange: TimeRange;

  /**
   * Enable the query. Defaults to true.
   */
  enabled?: boolean;
}

/**
 * Hook for fetching metric history as time-series data
 *
 * @param serviceId - ID of the service
 * @param options - Configuration options
 * @returns Query result with metric history
 *
 * @example
 * ```tsx
 * const { data: history, isLoading } = useMetricHistory('sonarr-1', {
 *   metric: 'errors',
 *   timeRange: {
 *     start: new Date(Date.now() - 24 * 60 * 60 * 1000),
 *     end: new Date(),
 *     preset: '24h',
 *   },
 * });
 * ```
 */
export function useMetricHistory(
  serviceId: string,
  options: UseMetricHistoryOptions,
) {
  const { metric, timeRange, enabled = true } = options;

  const metricsEngine = MetricsEngine.getInstance();
  const queryKey = metricsKeys.history(serviceId, metric, timeRange);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<MetricDataPoint[]> => {
      return await metricsEngine.getMetricHistory(serviceId, metric, timeRange);
    },
    staleTime: STALE_TIME.LONG,
    gcTime: CACHE_TIME.LONG,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: enabled && !!serviceId,
    ...RETRY_CONFIG.DEFAULT,
  });
}

/**
 * Hook to create a time range from a preset
 *
 * @param preset - Time range preset ('24h', '7d', '30d')
 * @returns Time range object
 *
 * @example
 * ```tsx
 * const timeRange = useTimeRangePreset('24h');
 * ```
 */
export function useTimeRangePreset(preset: "24h" | "7d" | "30d"): TimeRange {
  return useMemo(() => {
    const end = new Date();
    const start = new Date();

    switch (preset) {
      case "24h":
        start.setHours(start.getHours() - 24);
        break;
      case "7d":
        start.setDate(start.getDate() - 7);
        break;
      case "30d":
        start.setDate(start.getDate() - 30);
        break;
    }

    return { start, end, preset };
  }, [preset]);
}

/**
 * Hook to create a custom time range
 *
 * @param start - Start date
 * @param end - End date
 * @returns Time range object
 *
 * @example
 * ```tsx
 * const timeRange = useCustomTimeRange(
 *   new Date('2024-01-01'),
 *   new Date('2024-01-31')
 * );
 * ```
 */
export function useCustomTimeRange(start: Date, end: Date): TimeRange {
  return useMemo(() => {
    return { start, end, preset: "custom" };
  }, [start, end]);
}

/**
 * Hook to manually refresh metrics
 *
 * @returns Callback to refresh metric data
 *
 * @example
 * ```tsx
 * const refreshMetrics = useRefreshMetrics();
 *
 * <Button onPress={() => refreshMetrics('sonarr-1', timeRange)}>
 *   Refresh
 * </Button>
 * ```
 */
export function useRefreshMetrics() {
  const queryClient = useQueryClient();

  return useCallback(
    async (serviceId: string, timeRange: TimeRange) => {
      const queryKey = metricsKeys.service(serviceId, timeRange);
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient],
  );
}

/**
 * Hook to calculate derived metrics from service metrics
 *
 * @param metrics - Service metrics data
 * @returns Derived metrics
 *
 * @example
 * ```tsx
 * const { data: metrics } = useServiceMetrics('sonarr-1', { timeRange });
 * const derived = useDerivedMetrics(metrics);
 * ```
 */
export function useDerivedMetrics(metrics: ServiceMetrics | undefined) {
  return useMemo(() => {
    if (!metrics) {
      return null;
    }

    // Calculate additional derived metrics
    const uptimeStatus =
      metrics.uptime.percentage >= 99
        ? "excellent"
        : metrics.uptime.percentage >= 95
          ? "good"
          : metrics.uptime.percentage >= 90
            ? "fair"
            : "poor";

    const errorStatus =
      metrics.errors.errorRate < 1
        ? "excellent"
        : metrics.errors.errorRate < 5
          ? "good"
          : metrics.errors.errorRate < 10
            ? "fair"
            : "poor";

    const hasActivity =
      (metrics.activity.queueSize ?? 0) > 0 ||
      (metrics.activity.processedItems ?? 0) > 0 ||
      (metrics.activity.activeStreams ?? 0) > 0 ||
      (metrics.activity.activeTorrents ?? 0) > 0;

    return {
      uptimeStatus,
      errorStatus,
      hasActivity,
      isHealthy: uptimeStatus === "excellent" && errorStatus === "excellent",
      needsAttention: uptimeStatus === "poor" || errorStatus === "poor",
    };
  }, [metrics]);
}

/**
 * Hook to format metric values for display
 *
 * @param value - Metric value
 * @param type - Type of metric
 * @returns Formatted string
 *
 * @example
 * ```tsx
 * const formatted = useFormatMetric(99.5, 'percentage');
 * // Returns: "99.5%"
 * ```
 */
export function useFormatMetric(
  value: number | undefined,
  type: "percentage" | "count" | "rate" | "bytes" | "speed",
): string {
  return useMemo(() => {
    if (value === undefined || value === null) {
      return "N/A";
    }

    switch (type) {
      case "percentage":
        return `${value.toFixed(1)}%`;

      case "count":
        return value.toLocaleString();

      case "rate":
        return `${value.toFixed(2)}/s`;

      case "bytes":
        if (value < 1024) return `${value.toFixed(0)} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        if (value < 1024 * 1024 * 1024)
          return `${(value / (1024 * 1024)).toFixed(1)} MB`;
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;

      case "speed":
        if (value < 1024) return `${value.toFixed(0)} B/s`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB/s`;
        if (value < 1024 * 1024 * 1024)
          return `${(value / (1024 * 1024)).toFixed(1)} MB/s`;
        return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;

      default:
        return value.toString();
    }
  }, [value, type]);
}
