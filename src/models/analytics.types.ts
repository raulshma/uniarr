export interface AnalyticsDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

export interface LibraryGrowthData {
  date: string;
  sonarrSeries: number;
  radarrMovies: number;
  totalMedia: number;
}

export interface DownloadStatistics {
  date: string;
  completed: number;
  failed: number;
  totalSize: number; // in bytes
}

export interface RequestStatistics {
  date: string;
  approved: number;
  pending: number;
  denied: number;
}

export interface QualityProfileDistribution {
  qualityProfile: string;
  count: number;
  percentage: number;
}

export interface IndexerPerformance {
  indexerName: string;
  queries: number;
  grabs: number;
  successRate: number;
  avgResponseTime: number;
}

export interface ActivityTimes {
  hour: number;
  downloads: number;
  requests: number;
}

export interface AnalyticsSummary {
  libraryGrowth: LibraryGrowthData[];
  downloadStats: DownloadStatistics[];
  requestStats: RequestStatistics[];
  qualityDistribution: QualityProfileDistribution[];
  indexerPerformance: IndexerPerformance[];
  activityTimes: ActivityTimes[];
  dateRange: {
    start: Date;
    end: Date;
  };
}

export interface ExportData {
  summary: AnalyticsSummary;
  exportedAt: string;
  version: string;
}

export type ChartType = 'line' | 'bar' | 'pie' | 'doughnut';

export interface ChartData {
  labels: string[];
  datasets: Array<{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }>;
}

export interface ChartConfig {
  backgroundColor?: string;
  backgroundGradientFrom?: string;
  backgroundGradientFromOpacity?: number;
  backgroundGradientTo?: string;
  backgroundGradientToOpacity?: number;
  color?: (opacity: number) => string;
  labelColor?: (opacity: number) => string;
  strokeColor?: string;
  propsForDots?: {
    r?: string;
    strokeWidth?: string;
    stroke?: string;
  };
  propsForBackgroundLines?: {
    stroke?: string;
    strokeDasharray?: string;
  };
  propsForLabels?: {
    fontSize?: number;
    fontWeight?: string;
  };
}

export interface AnalyticsFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  services?: string[]; // service IDs to include
  chartTypes?: ChartType[];
}
