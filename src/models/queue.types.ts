import type { components } from "@/connectors/client-schemas/sonarr-openapi";

// Import SonarrQueueItem from SonarrConnector
export type { SonarrQueueItem } from "@/connectors/implementations/SonarrConnector";

// Extended queue item with more properties for UI
export interface DetailedSonarrQueueItem {
  id: number;
  seriesId?: number | null;
  episodeId?: number | null;
  seasonNumber?: number | null;
  status: components["schemas"]["QueueStatus"];
  protocol?: components["schemas"]["DownloadProtocol"];
  languages?: components["schemas"]["Language"][] | null;
  quality?: components["schemas"]["QualityModel"] | null;
  downloadId?: string | null;
  size?: number;
  sizeleft?: number;
  timeleft?: string | null;
  series?: components["schemas"]["SeriesResource"] | null;
  episode?: components["schemas"]["EpisodeResource"] | null;
  errorMessage?: string | null;
  added?: string | null;
  customFormatScore?: number;
  downloadClient?: string | null;
  indexer?: string | null;
  outputPath?: string | null;
  title?: string | null;
  trackedDownloadStatus?: components["schemas"]["TrackedDownloadStatus"];
  trackedDownloadState?: components["schemas"]["TrackedDownloadState"];
  episodeHasFile?: boolean;
  downloadClientHasPostImportCategory?: boolean;
  // Additional computed properties for UI
  progress?: number;
  speed?: string;
  timeRemaining?: string;
  // Expanded series and episode info
  seriesTitle?: string;
  seriesPosterUrl?: string;
  episodeTitle?: string;
  episodeAirDate?: string;
  episodeNumber?: number;
  statusMessages?: components["schemas"]["TrackedDownloadStatusMessage"][];
}

// Queue status options
export type QueueStatus = components["schemas"]["QueueStatus"];

// Queue filters
export interface QueueFilters {
  status?: QueueStatus[];
  protocol?: components["schemas"]["DownloadProtocol"][];
  includeUnknownSeriesItems?: boolean;
  includeSeries?: boolean;
  includeEpisode?: boolean;
  seriesIds?: number[];
  languages?: number[];
  quality?: number[];
}

// Queue actions
export interface QueueAction {
  id?: number;
  ids?: number[];
  removeFromClient?: boolean;
  blocklist?: boolean;
  skipRedownload?: boolean;
  changeCategory?: boolean;
}

// Sort options for queue
export interface QueueSortOptions {
  sortKey?: string;
  sortDirection?: "ascending" | "descending";
}

// Queue page info for pagination
export interface QueuePageInfo {
  page: number;
  pageSize: number;
  totalRecords: number;
  sortKey?: string;
  sortDirection?: "ascending" | "descending";
}

// Queuery parameters for API calls
export interface QueueQueryOptions extends QueueFilters, QueueSortOptions {
  page?: number;
  pageSize?: number;
}
