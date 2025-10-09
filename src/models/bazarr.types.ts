// Bazarr API Types

export interface BazarrMovie {
  readonly id: number;
  readonly radarrId?: number;
  readonly imdbId?: string;
  readonly title: string;
  readonly year?: number;
  readonly path?: string;
  readonly tmdbId?: number;
  readonly languages?: BazarrLanguage[];
  readonly subtitles?: BazarrSubtitle[];
  readonly missingSubtitles?: BazarrMissingSubtitle[];
  readonly profileId?: number;
  readonly sceneName?: string;
  readonly monitored: boolean;
  readonly audioLanguage?: string;
}

export interface BazarrEpisode {
  readonly id: number;
  readonly sonarrSeriesId?: number;
  readonly sonarrEpisodeId?: number;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly title: string;
  readonly season?: number;
  readonly episode?: number;
  readonly path?: string;
  readonly languages?: BazarrLanguage[];
  readonly subtitles?: BazarrSubtitle[];
  readonly missingSubtitles?: BazarrMissingSubtitle[];
  readonly profileId?: number;
  readonly sceneName?: string;
  readonly monitored: boolean;
  readonly audioLanguage?: string;
}

export interface BazarrSubtitle {
  readonly id: number;
  readonly path?: string;
  readonly language: BazarrLanguage;
  readonly provider?: string;
  readonly subtitlePath?: string;
  readonly uploader?: string;
  readonly dateAdded?: string;
  readonly movieFileId?: number;
  readonly episodeFileId?: number;
  readonly type?: 'movie' | 'episode';
  readonly forced?: boolean;
  readonly hi?: boolean; // Hearing Impaired
}

export interface BazarrMissingSubtitle {
  readonly id: number;
  readonly language: BazarrLanguage;
  readonly provider?: string;
  readonly type?: 'movie' | 'episode';
  readonly forced?: boolean;
  readonly hi?: boolean;
  readonly movieFileId?: number;
  readonly episodeFileId?: number;
}

export interface BazarrLanguage {
  readonly code2: string;
  readonly code3?: string;
  readonly name: string;
  readonly enabled?: boolean;
}

export interface BazarrProvider {
  readonly id: number;
  readonly name: string;
  readonly enabled: boolean;
  readonly settings?: Record<string, any>;
}

export interface BazarrProfile {
  readonly id: number;
  readonly name: string;
  readonly languages: BazarrLanguage[];
  readonly providers?: BazarrProvider[];
}

export interface BazarrSystemStatus {
  readonly version?: string;
  readonly databaseVersion?: number;
  readonly pythonVersion?: string;
  readonly bazarrVersion?: string;
  readonly operatingSystem?: string;
  readonly uptime?: string;
}

export interface BazarrQueueItem {
  readonly id: number;
  readonly name: string;
  readonly language: BazarrLanguage;
  readonly provider: string;
  readonly timestamp: string;
  readonly type: 'movie' | 'episode';
  readonly forced?: boolean;
  readonly hi?: boolean;
}

export interface BazarrHistoryItem {
  readonly id: number;
  readonly action: string;
  readonly timestamp: string;
  readonly description: string;
  readonly language?: BazarrLanguage;
  readonly provider?: string;
  readonly movieId?: number;
  readonly episodeId?: number;
}

export interface BazarrSearchResult {
  readonly id: number;
  readonly name: string;
  readonly language: BazarrLanguage;
  readonly provider: string;
  readonly score?: number;
  readonly url?: string;
  readonly releaseInfo?: string;
  readonly forced?: boolean;
  readonly hi?: boolean;
}

// Request/Response types for API calls
export interface BazarrSearchRequest {
  readonly id: number;
  readonly language: string;
  readonly forced?: boolean;
  readonly hi?: boolean;
}

export interface BazarrDownloadRequest {
  readonly id: number;
  readonly subtitleId: number;
}

export interface BazarrStatistics {
  readonly moviesTotal?: number;
  readonly episodesTotal?: number;
  readonly subtitlesTotal?: number;
  readonly missingSubtitles?: number;
}
