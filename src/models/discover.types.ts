import type { ServiceType } from "@/models/service.types";

export type DiscoverMediaKind = "series" | "movie";

export type DiscoverSource = "jellyseerr" | "sonarr" | "radarr" | "tmdb";

export interface DiscoverServiceSummary {
  id: string;
  name: string;
  type: ServiceType;
}

export interface FoundInLibrary {
  readonly serviceId: string;
  readonly name: string;
  readonly connectorType: "radarr" | "sonarr";
  readonly remoteId: number;
}

export interface DiscoverMediaItem {
  id: string;
  title: string;
  mediaType: DiscoverMediaKind;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  rating?: number;
  popularity?: number;
  releaseDate?: string;
  year?: number;
  /**
   * The original source service identifier (for example, Jellyseerr's internal media id).
   * Used to fetch richer details from the original provider when available.
   */
  sourceId?: number;
  tmdbId?: number;
  /** Number of votes / reviews reported by the source (if available). */
  voteCount?: number;
  /** The originating service id (e.g. jellyseerr connector id) for richer details. */
  sourceServiceId?: string;
  tvdbId?: number;
  imdbId?: string;
  source: DiscoverSource;
  /** Services where this item is already in the user's library (populated by lazy check). */
  foundInLibraries?: FoundInLibrary[];
}

export interface DiscoverSection {
  id: string;
  title: string;
  mediaType: DiscoverMediaKind;
  source: DiscoverSource;
  subtitle?: string;
  items: DiscoverMediaItem[];
}

export interface UnifiedDiscoverServices {
  sonarr: DiscoverServiceSummary[];
  radarr: DiscoverServiceSummary[];
  jellyseerr: DiscoverServiceSummary[];
}

export interface UnifiedDiscoverPayload {
  sections: DiscoverSection[];
  services: UnifiedDiscoverServices;
}

/**
 * Normalized release metadata shape shared across Radarr, Sonarr, Prowlarr, and QBittorrent.
 * Allows unified UI display of release candidates from multiple sources.
 */
export interface NormalizedRelease {
  id?: string | number;
  title?: string;
  indexer?: string;
  indexerId?: number;
  releaseGroup?: string;
  quality?: {
    name?: string;
    resolution?: number;
    source?: string;
  };
  /** Size in bytes */
  size?: number;
  seeders?: number | null;
  leechers?: number | null;
  downloadUrl?: string | null;
  magnetUrl?: string | null;
  infoUrl?: string | null;
  protocol?: string | null;
  publishDate?: string | null;
  /** Custom score for ranking (higher = better) */
  score?: number;
  /** Source connector: 'radarr' | 'sonarr' | 'prowlarr' | 'qbittorrent' */
  sourceConnector?: string;
}
