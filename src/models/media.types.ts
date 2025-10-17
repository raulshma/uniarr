/**
 * Representation of a single Sonarr episode, matching the API v3 response shape.
 */
export interface Episode {
  /** Unique identifier assigned by Sonarr. */
  readonly id: number;
  /** Title of the episode. */
  readonly title: string;
  /** Optional overview/summary text. */
  readonly overview?: string;
  /** Season number the episode belongs to. */
  readonly seasonNumber: number;
  /** Episode number within the season. */
  readonly episodeNumber: number;
  /** Optional absolute index used for anime series. */
  readonly absoluteEpisodeNumber?: number;
  /** Local air date (yyyy-mm-dd) when available. */
  readonly airDate?: string;
  /** UTC air date for scheduling purposes. */
  readonly airDateUtc?: string;
  /** Episode runtime in minutes. */
  readonly runtime?: number;
  /** Indicates whether the episode is monitored for downloads. */
  readonly monitored: boolean;
  /** Whether Sonarr already has a file for the episode. */
  readonly hasFile: boolean;
  /** Identifier of the associated episode file when present. */
  readonly episodeFileId?: number;
  /** Quality assigned to the downloaded episode file. */
  readonly quality?: Quality;
  /** Relative path to the episode file, if downloaded. */
  readonly relativePath?: string;
  /** Poster URL for the episode if available. */
  readonly posterUrl?: string;
  /** Size of the episode file in MB if downloaded. */
  readonly sizeInMB?: number;
}

/**
 * Aggregated statistics returned for a season or series.
 */
export interface MediaStatistics {
  readonly episodeCount: number;
  readonly episodeFileCount: number;
  readonly percentOfEpisodes?: number;
}

/**
 * Representation of a season as returned by Sonarr.
 */
export interface Season {
  readonly id?: number;
  readonly seasonNumber: number;
  readonly monitored: boolean;
  readonly statistics?: MediaStatistics;
  readonly episodes?: Episode[];
  readonly posterUrl?: string;
}

/**
 * Representation of a Sonarr series.
 */
export interface Series {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly year?: number;
  readonly status: SeriesStatus;
  readonly overview?: string;
  readonly network?: string;
  readonly genres?: string[];
  readonly path?: string;
  readonly qualityProfileId?: number;
  readonly seasonFolder?: boolean;
  readonly monitored: boolean;
  readonly tvdbId?: number;
  readonly imdbId?: string;
  readonly tmdbId?: number;
  readonly traktId?: number;
  readonly cleanTitle?: string;
  readonly titleSlug?: string;
  readonly rootFolderPath?: string;
  readonly tags?: number[];
  readonly seasons?: Season[];
  readonly nextAiring?: string;
  readonly previousAiring?: string;
  readonly added?: string;
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly statistics?: MediaStatistics;
  readonly episodeCount?: number;
  readonly episodeFileCount?: number;
}

/**
 * Sonarr series status values.
 */
export type SeriesStatus =
  | "continuing"
  | "ended"
  | "upcoming"
  | "deleted"
  | "archived"
  | "tba"
  | string;

/**
 * Quality descriptor used by Sonarr quality profiles and episode file metadata.
 */
export interface Quality {
  readonly id: number;
  readonly name: string;
  readonly source?: string;
  readonly resolution?: number;
  readonly sort?: number;
}

/**
 * Entry in a Sonarr quality profile.
 */
export interface QualityProfileItem {
  readonly allowed: boolean;
  readonly quality: Quality;
}

/**
 * Sonarr quality profile definition used when adding new series.
 */
export interface QualityProfile {
  readonly id: number;
  readonly name: string;
  readonly upgradeAllowed?: boolean;
  readonly cutoff: Quality;
  readonly items: QualityProfileItem[];
}

/**
 * Root folder configuration within Sonarr where series can be stored.
 */
export interface RootFolder {
  readonly id: number;
  readonly path: string;
  readonly accessible?: boolean;
  readonly freeSpace?: number;
}

/**
 * Request payload for adding a series to Sonarr.
 */
export interface AddSeriesRequest {
  readonly tvdbId?: number;
  readonly tmdbId?: number;
  readonly title: string;
  readonly titleSlug?: string;
  readonly rootFolderPath: string;
  readonly qualityProfileId: number;
  readonly languageProfileId?: number;
  readonly monitored?: boolean;
  readonly seasonFolder?: boolean;
  readonly seriesType?: "standard" | "anime" | "daily";
  readonly tags?: number[];
  readonly searchNow?: boolean;
  readonly addOptions?: {
    readonly searchForMissingEpisodes?: boolean;
    readonly monitor?:
      | "all"
      | "future"
      | "existing"
      | "firstSeason"
      | "latestSeason"
      | "none";
  };
}
