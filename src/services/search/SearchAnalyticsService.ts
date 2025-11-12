import { logger } from "@/services/logger/LoggerService";

/**
 * Analytics entry for a search operation
 */
export interface SearchAnalyticsEntry {
  timestamp: number;
  query: string;
  mediaTypes: string[];
  genres: string[];
  interpretationTime: number;
  searchTime: number;
  resultsCount: number;
  confidence?: number;
  success: boolean;
  error?: string;
  services: string[];
}

/**
 * Aggregated search analytics
 */
export interface SearchAnalytics {
  totalSearches: number;
  successfulSearches: number;
  failedSearches: number;
  successRate: number;
  averageInterpretationTime: number;
  averageSearchTime: number;
  averageResultsPerSearch: number;
  averageConfidence: number;
  uniqueQueries: number;
  mostCommonMediaTypes: Record<string, number>;
  mostCommonGenres: Record<string, number>;
  mostCommonServices: Record<string, number>;
  totalApiCalls: number;
  estimatedCost: number;
}

/**
 * Search analytics tracking service
 * Monitors usage patterns and API costs for AI search feature
 */
export class SearchAnalyticsService {
  private static instance: SearchAnalyticsService | null = null;

  private entries: SearchAnalyticsEntry[] = [];

  // Track whether analytics collection is enabled
  private isEnabled = true;

  // Estimated cost per API call (in dollars, rough estimate)
  private costPerCall = 0.0001; // $0.0001 per API call

  static getInstance(): SearchAnalyticsService {
    if (!SearchAnalyticsService.instance) {
      SearchAnalyticsService.instance = new SearchAnalyticsService();
    }
    return SearchAnalyticsService.instance;
  }

  /**
   * Enable/disable analytics collection
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    logger.info(`Search analytics ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Record a search operation
   */
  recordSearch(entry: Omit<SearchAnalyticsEntry, "timestamp">): void {
    if (!this.isEnabled) {
      return;
    }

    const fullEntry: SearchAnalyticsEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    this.entries.push(fullEntry);

    // Keep entries reasonable size (last 1000)
    if (this.entries.length > 1000) {
      this.entries = this.entries.slice(-1000);
    }

    logger.debug("Search recorded in analytics", {
      query: entry.query,
      success: entry.success,
      resultsCount: entry.resultsCount,
    });
  }

  /**
   * Get aggregated analytics
   */
  getAnalytics(): SearchAnalytics {
    if (this.entries.length === 0) {
      return {
        totalSearches: 0,
        successfulSearches: 0,
        failedSearches: 0,
        successRate: 0,
        averageInterpretationTime: 0,
        averageSearchTime: 0,
        averageResultsPerSearch: 0,
        averageConfidence: 0,
        uniqueQueries: 0,
        mostCommonMediaTypes: {},
        mostCommonGenres: {},
        mostCommonServices: {},
        totalApiCalls: 0,
        estimatedCost: 0,
      };
    }

    const successful = this.entries.filter((e) => e.success);
    const failed = this.entries.filter((e) => !e.success);

    // Count unique queries
    const uniqueQueries = new Set(this.entries.map((e) => e.query)).size;

    // Aggregate media types
    const mediaTypeCounts: Record<string, number> = {};
    this.entries.forEach((e) => {
      e.mediaTypes.forEach((mt) => {
        mediaTypeCounts[mt] = (mediaTypeCounts[mt] || 0) + 1;
      });
    });

    // Aggregate genres
    const genreCounts: Record<string, number> = {};
    this.entries.forEach((e) => {
      e.genres.forEach((g) => {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    });

    // Aggregate services
    const serviceCounts: Record<string, number> = {};
    this.entries.forEach((e) => {
      e.services.forEach((s) => {
        serviceCounts[s] = (serviceCounts[s] || 0) + 1;
      });
    });

    // Calculate averages
    const averageInterpretationTime =
      successful.length > 0
        ? successful.reduce((sum, e) => sum + e.interpretationTime, 0) /
          successful.length
        : 0;

    const averageSearchTime =
      successful.length > 0
        ? successful.reduce((sum, e) => sum + e.searchTime, 0) /
          successful.length
        : 0;

    const averageResultsPerSearch =
      successful.length > 0
        ? successful.reduce((sum, e) => sum + e.resultsCount, 0) /
          successful.length
        : 0;

    const averageConfidence =
      successful.filter((e) => e.confidence !== undefined).length > 0
        ? successful.reduce((sum, e) => sum + (e.confidence || 0), 0) /
          successful.filter((e) => e.confidence !== undefined).length
        : 0;

    // Calculate cost (rough estimate)
    const totalApiCalls = this.entries.length;
    const estimatedCost = totalApiCalls * this.costPerCall;

    return {
      totalSearches: this.entries.length,
      successfulSearches: successful.length,
      failedSearches: failed.length,
      successRate:
        this.entries.length > 0
          ? (successful.length / this.entries.length) * 100
          : 0,
      averageInterpretationTime,
      averageSearchTime,
      averageResultsPerSearch,
      averageConfidence,
      uniqueQueries,
      mostCommonMediaTypes: this.getSorted(mediaTypeCounts),
      mostCommonGenres: this.getSorted(genreCounts),
      mostCommonServices: this.getSorted(serviceCounts),
      totalApiCalls,
      estimatedCost,
    };
  }

  /**
   * Get analytics for a specific date range
   */
  getAnalyticsByDateRange(startTime: number, endTime: number): SearchAnalytics {
    const filtered = this.entries.filter(
      (e) => e.timestamp >= startTime && e.timestamp <= endTime,
    );

    if (filtered.length === 0) {
      return {
        totalSearches: 0,
        successfulSearches: 0,
        failedSearches: 0,
        successRate: 0,
        averageInterpretationTime: 0,
        averageSearchTime: 0,
        averageResultsPerSearch: 0,
        averageConfidence: 0,
        uniqueQueries: 0,
        mostCommonMediaTypes: {},
        mostCommonGenres: {},
        mostCommonServices: {},
        totalApiCalls: 0,
        estimatedCost: 0,
      };
    }

    // Temporarily replace entries, calculate, then restore
    const originalEntries = this.entries;
    this.entries = filtered;
    const analytics = this.getAnalytics();
    this.entries = originalEntries;

    return analytics;
  }

  /**
   * Get recent searches
   */
  getRecentSearches(limit: number = 10): SearchAnalyticsEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  /**
   * Get failed searches
   */
  getFailedSearches(limit: number = 10): SearchAnalyticsEntry[] {
    return this.entries
      .filter((e) => !e.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Export analytics to JSON
   */
  exportToJson(): string {
    return JSON.stringify(
      {
        analytics: this.getAnalytics(),
        entries: this.entries,
        exportedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.entries = [];
    logger.info("Search analytics cleared");
  }

  /**
   * Get warning messages based on analytics
   */
  getWarnings(): string[] {
    const warnings: string[] = [];
    const analytics = this.getAnalytics();

    // Warn if success rate is low
    if (analytics.totalSearches > 10 && analytics.successRate < 50) {
      warnings.push("Low search success rate detected");
    }

    // Warn if average interpretation time is high
    if (analytics.averageInterpretationTime > 5000) {
      warnings.push("Slow AI interpretation detected");
    }

    // Warn if estimated cost is high
    if (analytics.estimatedCost > 10) {
      warnings.push("High estimated API costs");
    }

    return warnings;
  }

  /**
   * Set cost per API call (for more accurate cost tracking)
   */
  setCostPerCall(cost: number): void {
    this.costPerCall = cost;
    logger.debug("Analytics cost per call updated", { cost });
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  private getSorted(counts: Record<string, number>): Record<string, number> {
    const sorted: Record<string, number> = {};
    Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .forEach(([key, value]) => {
        sorted[key] = value;
      });
    return sorted;
  }
}
