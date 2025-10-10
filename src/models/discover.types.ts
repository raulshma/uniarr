import type { ServiceType } from '@/models/service.types';

export type DiscoverMediaKind = 'series' | 'movie';

export type DiscoverSource = 'jellyseerr' | 'sonarr' | 'radarr';

export interface DiscoverServiceSummary {
  id: string;
  name: string;
  type: ServiceType;
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
  tmdbId?: number;
  tvdbId?: number;
  imdbId?: string;
  source: DiscoverSource;
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
