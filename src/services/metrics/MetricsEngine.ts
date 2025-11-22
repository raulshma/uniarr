import type { ServiceType } from "@/models/service.types";
import type { ServiceLog, ServiceLogLevel } from "@/models/logger.types";
import { HealthAggregationService } from "@/services/health/HealthAggregationService";
import { LogAggregationService } from "@/services/logs/LogAggregationService";
import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import { logger } from "@/services/logger/LoggerService";

/**
 * Time range for metrics calculation
 */
export interface TimeRange {
  start: Date;
  end: Date;
  preset?: "24h" | "7d" | "30d" | "custom";
}

/**
 * Uptime metrics for a service
 */
export interface UptimeMetric {
  percentage: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageLatency: number;
}

/**
 * Error metrics for a service
 */
export interface ErrorMetric {
  totalErrors: number;
  errorRate: number;
  errorsByLevel: Record<ServiceLogLevel, number>;
  topErrors: { message: string; count: number }[];
}

/**
 * Activity metrics for a service
 */
export interface ActivityMetric {
  // Arr services
  queueSize?: number;
  processedItems?: number;
  failedImports?: number;

  // Jellyfin
  activeStreams?: number;
  transcodingSessions?: number;

  // Download clients
  activeTorrents?: number;
  downloadSpeed?: number;
  uploadSpeed?: number;
  completionRate?: number;
}

/**
 * Performance metrics for a service
 */
export interface PerformanceMetric {
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestCount: number;
}

/**
 * Complete metrics for a service
 */
export interface ServiceMetrics {
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  timeRange: TimeRange;
  uptime: UptimeMetric;
  errors: ErrorMetric;
  activity: ActivityMetric;
  performance: PerformanceMetric;
}

/**
 * Aggregated metrics across multiple services
 */
export interface AggregatedMetrics {
  timeRange: TimeRange;
  services: ServiceMetrics[];
  overall: {
    averageUptime: number;
    totalErrors: number;
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    offlineServices: number;
  };
}

/**
 * Data point for time-series metrics
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Type of metric for history queries
 */
export type MetricType = "uptime" | "errors" | "latency" | "activity";

/**
 * Engine for calculating and aggregating service metrics
 */
export class MetricsEngine {
  private static instance: MetricsEngine | null = null;
  private healthService: HealthAggregationService;
  private logService: LogAggregationService;

  private constructor() {
    this.healthService = HealthAggregationService.getInstance();
    this.logService = LogAggregationService.getInstance();
  }

  /**
   * Get singleton instance of MetricsEngine
   */
  static getInstance(): MetricsEngine {
    if (!MetricsEngine.instance) {
      MetricsEngine.instance = new MetricsEngine();
    }
    return MetricsEngine.instance;
  }

  /**
   * Calculate metrics for an individual service
   * @param serviceId - ID of the service to calculate metrics for
   * @param timeRange - Time range for metric calculation
   * @returns Service metrics
   */
  async calculateMetrics(
    serviceId: string,
    timeRange: TimeRange,
  ): Promise<ServiceMetrics> {
    void logger.debug("Calculating metrics for service", {
      serviceId,
      timeRange,
    });

    const manager = ConnectorManager.getInstance();
    const connector = manager.getConnector(serviceId);

    if (!connector) {
      throw new Error(`Service not found: ${serviceId}`);
    }

    // Fetch logs for the time range
    const logs = await this.logService.fetchLogs([serviceId], {
      since: timeRange.start,
      until: timeRange.end,
    });

    // Calculate uptime metrics
    const uptime = await this.calculateUptimeMetric(serviceId, timeRange);

    // Calculate error metrics from logs
    const errors = this.calculateErrorMetric(logs.logs);

    // Calculate activity metrics (service-specific)
    const activity = await this.calculateActivityMetric(
      serviceId,
      connector.config.type,
    );

    // Calculate performance metrics from logs
    const performance = this.calculatePerformanceMetric(logs.logs);

    const metrics: ServiceMetrics = {
      serviceId: connector.config.id,
      serviceName: connector.config.name,
      serviceType: connector.config.type,
      timeRange,
      uptime,
      errors,
      activity,
      performance,
    };

    void logger.debug("Metrics calculation complete", {
      serviceId,
      uptime: uptime.percentage,
      totalErrors: errors.totalErrors,
    });

    return metrics;
  }

  /**
   * Get aggregated metrics across multiple services
   * @param serviceIds - Array of service IDs to aggregate. If empty, aggregates all services.
   * @param timeRange - Time range for metric calculation
   * @returns Aggregated metrics
   */
  async getAggregatedMetrics(
    serviceIds: string[],
    timeRange: TimeRange,
  ): Promise<AggregatedMetrics> {
    void logger.debug("Calculating aggregated metrics", {
      serviceCount: serviceIds.length,
      timeRange,
    });

    const manager = ConnectorManager.getInstance();
    const connectors =
      serviceIds.length > 0
        ? serviceIds
            .map((id) => manager.getConnector(id))
            .filter((c) => c !== undefined)
        : manager.getAllConnectors();

    // Calculate metrics for each service in parallel
    const metricsResults = await Promise.allSettled(
      connectors.map((connector) =>
        this.calculateMetrics(connector.config.id, timeRange),
      ),
    );

    // Collect successful metrics
    const serviceMetrics: ServiceMetrics[] = [];
    for (const result of metricsResults) {
      if (result.status === "fulfilled") {
        serviceMetrics.push(result.value);
      }
    }

    // Get current health status for overall stats
    const health = await this.healthService.aggregateHealth(
      connectors.map((c) => c.config.id),
    );

    // Calculate overall statistics
    const totalServices = serviceMetrics.length;
    const averageUptime =
      totalServices > 0
        ? serviceMetrics.reduce((sum, m) => sum + m.uptime.percentage, 0) /
          totalServices
        : 0;
    const totalErrors = serviceMetrics.reduce(
      (sum, m) => sum + m.errors.totalErrors,
      0,
    );

    const healthyServices = health.services.filter(
      (s) => s.status === "healthy",
    ).length;
    const degradedServices = health.services.filter(
      (s) => s.status === "degraded",
    ).length;
    const offlineServices = health.services.filter(
      (s) => s.status === "offline",
    ).length;

    const aggregated: AggregatedMetrics = {
      timeRange,
      services: serviceMetrics,
      overall: {
        averageUptime,
        totalErrors,
        totalServices,
        healthyServices,
        degradedServices,
        offlineServices,
      },
    };

    void logger.debug("Aggregated metrics calculation complete", {
      totalServices,
      averageUptime,
      totalErrors,
    });

    return aggregated;
  }

  /**
   * Get metric history as time-series data
   * @param serviceId - ID of the service
   * @param metric - Type of metric to retrieve
   * @param timeRange - Time range for the history
   * @returns Array of metric data points
   */
  async getMetricHistory(
    serviceId: string,
    metric: MetricType,
    timeRange: TimeRange,
  ): Promise<MetricDataPoint[]> {
    void logger.debug("Getting metric history", {
      serviceId,
      metric,
      timeRange,
    });

    // Fetch logs for the time range
    const logs = await this.logService.fetchLogs([serviceId], {
      since: timeRange.start,
      until: timeRange.end,
    });

    // Group logs into time buckets (hourly for 24h, daily for 7d/30d)
    const bucketSize = this.getBucketSize(timeRange);
    const buckets = this.groupLogsByTimeBucket(logs.logs, bucketSize);

    // Calculate metric for each bucket
    const dataPoints: MetricDataPoint[] = [];

    for (const [timestamp, bucketLogs] of buckets.entries()) {
      let value = 0;

      switch (metric) {
        case "errors":
          value = bucketLogs.filter(
            (log) => log.level === "error" || log.level === "fatal",
          ).length;
          break;

        case "uptime":
          // For uptime, we'd need health check data, so we'll approximate from logs
          // If there are any logs, assume service was up
          value = bucketLogs.length > 0 ? 100 : 0;
          break;

        case "latency":
          // Latency would need to be extracted from log metadata if available
          value = 0; // Placeholder
          break;

        case "activity":
          // Activity is the number of log entries
          value = bucketLogs.length;
          break;
      }

      dataPoints.push({
        timestamp: new Date(timestamp),
        value,
      });
    }

    // Sort by timestamp
    dataPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    void logger.debug("Metric history retrieved", {
      serviceId,
      metric,
      dataPointCount: dataPoints.length,
    });

    return dataPoints;
  }

  /**
   * Calculate uptime metrics for a service
   */
  private async calculateUptimeMetric(
    serviceId: string,
    timeRange: TimeRange,
  ): Promise<UptimeMetric> {
    // In a real implementation, we would track health check history
    // For now, we'll use current health status and estimate
    try {
      const health = await this.healthService.getServiceHealth(serviceId);

      // Estimate based on current status
      const isHealthy = health.status === "healthy";
      const percentage = isHealthy
        ? 99.9
        : health.status === "degraded"
          ? 95.0
          : 0.0;

      // Estimate checks based on time range (assuming 1 check per minute)
      const durationMs = timeRange.end.getTime() - timeRange.start.getTime();
      const totalChecks = Math.floor(durationMs / 60000); // 1 check per minute
      const successfulChecks = Math.floor((totalChecks * percentage) / 100);
      const failedChecks = totalChecks - successfulChecks;

      return {
        percentage,
        totalChecks,
        successfulChecks,
        failedChecks,
        averageLatency: 0, // Would need to track actual latency
      };
    } catch (error) {
      void logger.error("Failed to calculate uptime metric", {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        percentage: 0,
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        averageLatency: 0,
      };
    }
  }

  /**
   * Calculate error metrics from logs
   */
  private calculateErrorMetric(logs: ServiceLog[]): ErrorMetric {
    const errorLogs = logs.filter(
      (log) =>
        log.level === "error" || log.level === "fatal" || log.level === "warn",
    );

    // Count errors by level
    const errorsByLevel: Record<ServiceLogLevel, number> = {
      trace: 0,
      debug: 0,
      info: 0,
      warn: 0,
      error: 0,
      fatal: 0,
    };

    for (const log of errorLogs) {
      errorsByLevel[log.level] = (errorsByLevel[log.level] || 0) + 1;
    }

    // Find top errors by message pattern
    const errorCounts = new Map<string, number>();
    for (const log of errorLogs) {
      const normalizedMessage = this.normalizeErrorMessage(log.message);
      errorCounts.set(
        normalizedMessage,
        (errorCounts.get(normalizedMessage) || 0) + 1,
      );
    }

    const topErrors = Array.from(errorCounts.entries())
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalErrors = errorLogs.length;
    const errorRate = logs.length > 0 ? (totalErrors / logs.length) * 100 : 0;

    return {
      totalErrors,
      errorRate,
      errorsByLevel,
      topErrors,
    };
  }

  /**
   * Calculate activity metrics (service-specific)
   */
  private async calculateActivityMetric(
    serviceId: string,
    serviceType: ServiceType,
  ): Promise<ActivityMetric> {
    const manager = ConnectorManager.getInstance();
    const connector = manager.getConnector(serviceId);

    if (!connector) {
      return {};
    }

    const activity: ActivityMetric = {};

    try {
      // Service-specific activity metrics
      switch (serviceType) {
        case "sonarr":
        case "radarr":
        case "lidarr":
          // For Arr services, we could fetch queue and history
          // This would require additional connector methods
          activity.queueSize = 0; // Placeholder
          activity.processedItems = 0; // Placeholder
          activity.failedImports = 0; // Placeholder
          break;

        case "jellyfin":
          // For Jellyfin, we could fetch active sessions
          activity.activeStreams = 0; // Placeholder
          activity.transcodingSessions = 0; // Placeholder
          break;

        case "qbittorrent":
        case "transmission":
        case "deluge":
          // For download clients, we could fetch torrent stats
          activity.activeTorrents = 0; // Placeholder
          activity.downloadSpeed = 0; // Placeholder
          activity.uploadSpeed = 0; // Placeholder
          activity.completionRate = 0; // Placeholder
          break;
      }
    } catch (error) {
      void logger.error("Failed to calculate activity metrics", {
        serviceId,
        serviceType,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return activity;
  }

  /**
   * Calculate performance metrics from logs
   */
  private calculatePerformanceMetric(logs: ServiceLog[]): PerformanceMetric {
    // In a real implementation, we would extract response times from logs
    // For now, we'll return placeholder values
    const requestCount = logs.length;

    return {
      averageResponseTime: 0, // Would need to extract from logs
      p95ResponseTime: 0, // Would need to calculate from response times
      p99ResponseTime: 0, // Would need to calculate from response times
      requestCount,
    };
  }

  /**
   * Normalize error message for grouping
   */
  private normalizeErrorMessage(message: string): string {
    return (
      message
        // Remove timestamps
        .replace(/\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "")
        .replace(/\d{2}:\d{2}:\d{2}/g, "")
        // Remove numbers
        .replace(/\b\d+\b/g, "")
        // Remove UUIDs
        .replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          "",
        )
        // Normalize whitespace
        .replace(/\s+/g, " ")
        .trim()
        // Take first 100 characters
        .substring(0, 100)
    );
  }

  /**
   * Get appropriate bucket size based on time range
   */
  private getBucketSize(timeRange: TimeRange): number {
    const durationMs = timeRange.end.getTime() - timeRange.start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours <= 24) {
      // For 24h or less, use 1-hour buckets
      return 60 * 60 * 1000;
    } else if (durationHours <= 168) {
      // For 7 days or less, use 6-hour buckets
      return 6 * 60 * 60 * 1000;
    } else {
      // For longer periods, use 1-day buckets
      return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Group logs into time buckets
   */
  private groupLogsByTimeBucket(
    logs: ServiceLog[],
    bucketSize: number,
  ): Map<number, ServiceLog[]> {
    const buckets = new Map<number, ServiceLog[]>();

    for (const log of logs) {
      const timestamp = log.timestamp.getTime();
      const bucketTimestamp = Math.floor(timestamp / bucketSize) * bucketSize;

      const bucket = buckets.get(bucketTimestamp) || [];
      bucket.push(log);
      buckets.set(bucketTimestamp, bucket);
    }

    return buckets;
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    void logger.debug("MetricsEngine disposed");
  }
}
