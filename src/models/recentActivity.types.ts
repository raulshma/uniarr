import type { ServiceType } from "@/models/service.types";

export type RecentActivityItem = {
  /** Unique identifier for UI keying (cross-service aggregation key) */
  id: string;
  /** Canonical title of the media */
  title: string;
  /** Episode string (e.g., "S01E05") or "Movie" */
  episode: string;
  /** Show/series title (same as title for movies) */
  show: string;
  /** Relative time string (e.g., "2h ago") */
  date: string;
  /** Timestamp in milliseconds (for sorting) */
  timestamp?: number;
  /** Poster image URL */
  image?: string;
  /** Numeric content ID used for navigation (series/movie/item id) */
  contentId: number;
  /** List of service types where this item originated */
  serviceTypes: ServiceType[];
  /** List of service instance IDs (connector config IDs) where this item was found */
  originServiceIds: string[];
  /** Rich origin metadata for multi-origin selection */
  originServices: {
    serviceId: string;
    serviceType: ServiceType;
    serviceName?: string;
  }[];
  /** External IDs for cross-service deduplication */
  externalIds?: {
    tmdb?: number;
    imdb?: string;
    tvdb?: number;
  };
  /** Flag indicating if this is episodic content */
  isEpisode?: boolean;
  /** Episode metadata for episodic content */
  episodeInfo?: {
    seriesId?: number;
    seasonNumber?: number;
    episodeNumber?: number;
  };
};
