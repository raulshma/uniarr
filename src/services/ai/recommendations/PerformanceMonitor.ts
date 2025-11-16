/**
 * Performance Monitor for Recommendation System
 *
 * Tracks and logs performance metrics for recommendation operations.
 * Monitors cache hit response time, fresh generation time, and context building time.
 *
 * Performance Targets:
 * - Cache hit response: < 500ms
 * - Fresh generation: < 15 seconds
 * - Context building: < 2 seconds
 */

import { logger } from "@/services/logger/LoggerService";
import { StorageBackendManager } from "@/services/storage/MMKVStorage";

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  userId: string;
  metadata?: Record<string, any>;
}

interface PerformanceStats {
  operation: string;
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  targetDuration: number;
  targetMet: number;
  targetMissed: number;
}

const METRICS_KEY_PREFIX = "recommendation:performance_metrics";
const MAX_METRICS_STORED = 1000; // Keep last 1000 metrics per operation

/**
 * Performance targets for different operations
 */
const PERFORMANCE_TARGETS = {
  cacheHit: 500, // 500ms
  freshGeneration: 15000, // 15 seconds
  contextBuilding: 2000, // 2 seconds
  availabilityCheck: 2000, // 2 seconds per service
  feedbackRecording: 1000, // 1 second
} as const;

/**
 * Monitor and track performance metrics for recommendation operations
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private storage: StorageBackendManager;
  private activeTimers: Map<string, number> = new Map();

  private constructor() {
    this.storage = StorageBackendManager.getInstance();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing an operation
   * @param operationId - Unique identifier for this operation instance
   * @returns Timer ID for stopping the timer
   */
  startTimer(operationId: string): string {
    const timerId = `${operationId}_${Date.now()}`;
    this.activeTimers.set(timerId, Date.now());
    return timerId;
  }

  /**
   * Stop timing an operation and record the metric
   * @param timerId - Timer ID returned from startTimer
   * @param operation - Operation type (cacheHit, freshGeneration, contextBuilding)
   * @param userId - User ID for the operation
   * @param metadata - Additional metadata to store with the metric
   */
  async stopTimer(
    timerId: string,
    operation: keyof typeof PERFORMANCE_TARGETS,
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<number> {
    const startTime = this.activeTimers.get(timerId);

    if (!startTime) {
      void logger.warn("Timer not found", { timerId });
      return 0;
    }

    const duration = Date.now() - startTime;
    this.activeTimers.delete(timerId);

    // Record the metric
    await this.recordMetric({
      operation,
      duration,
      timestamp: new Date(),
      userId,
      metadata,
    });

    // Check if target was met
    const target = PERFORMANCE_TARGETS[operation];
    const targetMet = duration <= target;

    if (!targetMet) {
      void logger.warn("Performance target missed", {
        operation,
        duration,
        target,
        userId,
        metadata,
      });
    } else {
      void logger.debug("Performance target met", {
        operation,
        duration,
        target,
        userId,
      });
    }

    return duration;
  }

  /**
   * Record a performance metric
   */
  private async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const key = this.getMetricsKey(metric.operation);
      const adapter = this.storage.getAdapter();

      // Get existing metrics
      const stored = await adapter.getItem(key);
      const metrics: PerformanceMetric[] = stored ? JSON.parse(stored) : [];

      // Add new metric
      metrics.push(metric);

      // Keep only the most recent metrics
      if (metrics.length > MAX_METRICS_STORED) {
        metrics.splice(0, metrics.length - MAX_METRICS_STORED);
      }

      // Store updated metrics
      await adapter.setItem(key, JSON.stringify(metrics));

      void logger.debug("Performance metric recorded", {
        operation: metric.operation,
        duration: metric.duration,
        userId: metric.userId,
      });
    } catch (error) {
      void logger.error("Failed to record performance metric", {
        operation: metric.operation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get performance statistics for an operation
   * @param operation - Operation type to get stats for
   * @param timeWindowMs - Time window to analyze (default: last 24 hours)
   * @returns Performance statistics
   */
  async getStats(
    operation: keyof typeof PERFORMANCE_TARGETS,
    timeWindowMs: number = 24 * 60 * 60 * 1000,
  ): Promise<PerformanceStats | null> {
    try {
      const key = this.getMetricsKey(operation);
      const adapter = this.storage.getAdapter();
      const stored = await adapter.getItem(key);

      if (!stored) {
        return null;
      }

      const allMetrics: PerformanceMetric[] = JSON.parse(stored);

      // Filter metrics within time window
      const cutoffTime = Date.now() - timeWindowMs;
      const metrics = allMetrics.filter(
        (m) => new Date(m.timestamp).getTime() >= cutoffTime,
      );

      if (metrics.length === 0) {
        return null;
      }

      // Calculate statistics
      const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
      const target = PERFORMANCE_TARGETS[operation];

      const stats: PerformanceStats = {
        operation,
        count: metrics.length,
        averageDuration:
          durations.reduce((sum, d) => sum + d, 0) / durations.length,
        minDuration: durations[0]!,
        maxDuration: durations[durations.length - 1]!,
        p50Duration: this.percentile(durations, 50),
        p95Duration: this.percentile(durations, 95),
        p99Duration: this.percentile(durations, 99),
        targetDuration: target,
        targetMet: metrics.filter((m) => m.duration <= target).length,
        targetMissed: metrics.filter((m) => m.duration > target).length,
      };

      return stats;
    } catch (error) {
      void logger.error("Failed to get performance stats", {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all performance statistics
   * @param timeWindowMs - Time window to analyze (default: last 24 hours)
   * @returns Map of operation to statistics
   */
  async getAllStats(
    timeWindowMs: number = 24 * 60 * 60 * 1000,
  ): Promise<Map<string, PerformanceStats>> {
    const statsMap = new Map<string, PerformanceStats>();

    for (const operation of Object.keys(
      PERFORMANCE_TARGETS,
    ) as (keyof typeof PERFORMANCE_TARGETS)[]) {
      const stats = await this.getStats(operation, timeWindowMs);
      if (stats) {
        statsMap.set(operation, stats);
      }
    }

    return statsMap;
  }

  /**
   * Get recent metrics for an operation
   * @param operation - Operation type
   * @param limit - Maximum number of metrics to return
   * @returns Recent metrics
   */
  async getRecentMetrics(
    operation: keyof typeof PERFORMANCE_TARGETS,
    limit: number = 100,
  ): Promise<PerformanceMetric[]> {
    try {
      const key = this.getMetricsKey(operation);
      const adapter = this.storage.getAdapter();
      const stored = await adapter.getItem(key);

      if (!stored) {
        return [];
      }

      const metrics: PerformanceMetric[] = JSON.parse(stored);

      // Return most recent metrics
      return metrics.slice(-limit);
    } catch (error) {
      void logger.error("Failed to get recent metrics", {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Clear all performance metrics
   */
  async clearMetrics(): Promise<void> {
    try {
      const adapter = this.storage.getAdapter();
      const allKeys = await adapter.getAllKeys();
      const metricsKeys = allKeys.filter((key) =>
        key.startsWith(METRICS_KEY_PREFIX),
      );

      await Promise.all(metricsKeys.map((key) => adapter.removeItem(key)));

      void logger.info("Performance metrics cleared", {
        count: metricsKeys.length,
      });
    } catch (error) {
      void logger.error("Failed to clear performance metrics", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clear metrics for a specific operation
   */
  async clearMetricsForOperation(
    operation: keyof typeof PERFORMANCE_TARGETS,
  ): Promise<void> {
    try {
      const key = this.getMetricsKey(operation);
      const adapter = this.storage.getAdapter();
      await adapter.removeItem(key);

      void logger.info("Performance metrics cleared for operation", {
        operation,
      });
    } catch (error) {
      void logger.error("Failed to clear metrics for operation", {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Log performance summary
   */
  async logPerformanceSummary(
    timeWindowMs: number = 24 * 60 * 60 * 1000,
  ): Promise<void> {
    const allStats = await this.getAllStats(timeWindowMs);

    void logger.info("Performance Summary", {
      timeWindowHours: timeWindowMs / (60 * 60 * 1000),
      operations: Array.from(allStats.entries()).map(([operation, stats]) => ({
        operation,
        count: stats.count,
        avgDuration: `${stats.averageDuration.toFixed(0)}ms`,
        p95Duration: `${stats.p95Duration.toFixed(0)}ms`,
        target: `${stats.targetDuration}ms`,
        targetMetRate: `${((stats.targetMet / stats.count) * 100).toFixed(1)}%`,
      })),
    });
  }

  /**
   * Get performance target for an operation
   */
  getTarget(operation: keyof typeof PERFORMANCE_TARGETS): number {
    return PERFORMANCE_TARGETS[operation];
  }

  /**
   * Check if a duration meets the target for an operation
   */
  meetsTarget(
    operation: keyof typeof PERFORMANCE_TARGETS,
    duration: number,
  ): boolean {
    return duration <= PERFORMANCE_TARGETS[operation];
  }

  // Private helper methods

  private getMetricsKey(operation: string): string {
    return `${METRICS_KEY_PREFIX}:${operation}`;
  }

  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;

    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    if (lower === upper) {
      return sortedArray[lower]!;
    }

    return sortedArray[lower]! * (1 - weight) + sortedArray[upper]! * weight;
  }
}

export default PerformanceMonitor;
