import type {
  AnalyticsSummary,
  LibraryGrowthData,
  DownloadStatistics,
  RequestStatistics,
  QualityProfileDistribution,
  IndexerPerformance,
  ActivityTimes,
} from "@/models/analytics.types";

/**
 * Stub implementations for analytics dependencies
 * These provide mock data for demonstration when actual services aren't connected
 */

export class AnalyticsStubs {
  /**
   * Stub implementation for library growth data
   * In real implementation, this would fetch from Sonarr/Radarr APIs
   */
  public static generateStubLibraryGrowth(
    startDate: Date,
    endDate: Date,
  ): LibraryGrowthData[] {
    const data: LibraryGrowthData[] = [];
    const currentDate = new Date(startDate);

    // Simulate gradual library growth
    let seriesCount = 150;
    let moviesCount = 400;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);

      // Add some random growth each day
      const seriesGrowth = Math.floor(Math.random() * 3); // 0-2 new series per day
      const moviesGrowth = Math.floor(Math.random() * 5); // 0-4 new movies per day

      seriesCount += seriesGrowth;
      moviesCount += moviesGrowth;

      data.push({
        date: dateStr,
        sonarrSeries: seriesCount,
        radarrMovies: moviesCount,
        totalMedia: seriesCount + moviesCount,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }

  /**
   * Stub implementation for download statistics
   * In real implementation, this would fetch from download clients (qBittorrent, Transmission, etc.)
   */
  public static generateStubDownloadStatistics(
    startDate: Date,
    endDate: Date,
  ): DownloadStatistics[] {
    const data: DownloadStatistics[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);

      // Simulate realistic download patterns
      const baseCompleted = 8; // Base downloads per day
      const baseFailed = 1; // Base failures per day
      const avgSize = 2.5 * 1024 * 1024 * 1024; // 2.5GB average

      // Add some variance based on day of week (more downloads on weekends)
      const dayOfWeek = currentDate.getDay();
      const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.5 : 1;

      const completed = Math.floor(
        (baseCompleted + Math.random() * 12) * weekendMultiplier,
      );
      const failed = Math.floor((baseFailed + Math.random() * 2) * 0.8);

      data.push({
        date: dateStr,
        completed,
        failed,
        totalSize: completed * avgSize,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }

  /**
   * Stub implementation for request statistics
   * In real implementation, this would fetch from Jellyseerr API
   */
  public static generateStubRequestStatistics(
    startDate: Date,
    endDate: Date,
  ): RequestStatistics[] {
    const data: RequestStatistics[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().slice(0, 10);

      // Simulate request patterns
      const pending = Math.floor(Math.random() * 8) + 2; // 2-10 pending requests
      const approved = Math.floor(Math.random() * 6) + 1; // 1-7 approved
      const denied = Math.floor(Math.random() * 2); // 0-2 denied

      data.push({
        date: dateStr,
        approved,
        pending,
        denied,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }

  /**
   * Stub implementation for quality distribution
   * In real implementation, this would analyze Sonarr/Radarr data
   */
  public static generateStubQualityDistribution(): QualityProfileDistribution[] {
    return [
      { qualityProfile: "4K UHD", count: 45, percentage: 15.0 },
      { qualityProfile: "1080p BluRay", count: 120, percentage: 40.0 },
      { qualityProfile: "1080p Web-DL", count: 75, percentage: 25.0 },
      { qualityProfile: "720p Web-DL", count: 45, percentage: 15.0 },
      { qualityProfile: "SD", count: 15, percentage: 5.0 },
    ];
  }

  /**
   * Stub implementation for indexer performance
   * In real implementation, this would fetch from Prowlarr API
   */
  public static generateStubIndexerPerformance(): IndexerPerformance[] {
    return [
      {
        indexerName: "RARBG",
        queries: 2500,
        grabs: 875,
        successRate: 35.0,
        avgResponseTime: 180,
      },
      {
        indexerName: "1337x",
        queries: 1800,
        grabs: 540,
        successRate: 30.0,
        avgResponseTime: 220,
      },
      {
        indexerName: "The Pirate Bay",
        queries: 1200,
        grabs: 300,
        successRate: 25.0,
        avgResponseTime: 350,
      },
      {
        indexerName: "YTS",
        queries: 900,
        grabs: 360,
        successRate: 40.0,
        avgResponseTime: 140,
      },
      {
        indexerName: "TorrentGalaxy",
        queries: 1500,
        grabs: 525,
        successRate: 35.0,
        avgResponseTime: 200,
      },
    ];
  }

  /**
   * Stub implementation for activity times
   * In real implementation, this would analyze historical download/request patterns
   */
  public static generateStubActivityTimes(): ActivityTimes[] {
    const activityTimes: ActivityTimes[] = [];

    for (let hour = 0; hour < 24; hour++) {
      // Simulate activity patterns (more downloads in evening, more requests during work hours)
      let downloads = 2; // Base downloads
      let requests = 1; // Base requests

      if (hour >= 18 && hour <= 23) {
        // Evening hours - more downloads
        downloads += Math.floor(Math.random() * 8) + 3;
        requests += Math.floor(Math.random() * 3) + 1;
      } else if (hour >= 9 && hour <= 17) {
        // Work hours - more requests
        downloads += Math.floor(Math.random() * 4) + 1;
        requests += Math.floor(Math.random() * 5) + 2;
      } else if (hour >= 0 && hour <= 6) {
        // Night hours - minimal activity
        downloads += Math.floor(Math.random() * 2);
        requests += Math.floor(Math.random() * 1);
      } else {
        // Morning hours - moderate activity
        downloads += Math.floor(Math.random() * 3) + 1;
        requests += Math.floor(Math.random() * 3) + 1;
      }

      activityTimes.push({
        hour,
        downloads,
        requests,
      });
    }

    return activityTimes;
  }

  /**
   * Generate complete stub analytics summary
   */
  public static generateStubAnalyticsSummary(
    startDate?: Date,
    endDate?: Date,
  ): AnalyticsSummary {
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    return {
      libraryGrowth: this.generateStubLibraryGrowth(start, end),
      downloadStats: this.generateStubDownloadStatistics(start, end),
      requestStats: this.generateStubRequestStatistics(start, end),
      qualityDistribution: this.generateStubQualityDistribution(),
      indexerPerformance: this.generateStubIndexerPerformance(),
      activityTimes: this.generateStubActivityTimes(),
      dateRange: { start, end },
    };
  }
}
