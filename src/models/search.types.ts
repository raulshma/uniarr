import type { ServiceType } from '@/models/service.types';

export type UnifiedSearchMediaType =
  | 'series'
  | 'movie'
  | 'music'
  | 'request'
  | 'unknown';

export interface UnifiedSearchExternalIds {
  readonly tmdbId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly musicBrainzId?: string;
  readonly serviceNativeId?: number | string;
}

export interface UnifiedSearchResult {
  readonly id: string;
  readonly title: string;
  readonly overview?: string;
  readonly releaseDate?: string;
  readonly year?: number;
  readonly runtime?: number;
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly rating?: number;
  readonly popularity?: number;
  readonly mediaType: UnifiedSearchMediaType;
  readonly serviceType: ServiceType;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly isInLibrary?: boolean;
  readonly isRequested?: boolean;
  readonly isAvailable?: boolean;
  readonly externalIds?: UnifiedSearchExternalIds;
  readonly extra?: Record<string, unknown>;
}

export interface UnifiedSearchError {
  readonly serviceId: string;
  readonly serviceType: ServiceType;
  readonly message: string;
  readonly code?: string;
}

export interface UnifiedSearchResponse {
  readonly results: UnifiedSearchResult[];
  readonly errors: UnifiedSearchError[];
  readonly durationMs: number;
}

export interface SearchHistoryEntry {
  readonly term: string;
  readonly lastSearchedAt: string;
  readonly serviceIds?: string[];
  readonly mediaTypes?: UnifiedSearchMediaType[];
}

export interface SearchableServiceSummary {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceType: ServiceType;
}

export interface UnifiedSearchOptions {
  readonly serviceIds?: string[];
  readonly mediaTypes?: UnifiedSearchMediaType[];
  readonly limitPerService?: number;
}
