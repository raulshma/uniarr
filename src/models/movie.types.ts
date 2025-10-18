import type { Quality } from "./media.types";

/**
 * Radarr movie image reference supplied by the API.
 */
export interface MovieImage {
  readonly coverType: string;
  readonly url?: string;
  readonly remoteUrl?: string;
}

/**
 * Rating metadata as returned by Radarr.
 */
export interface MovieRatings {
  readonly value?: number;
  readonly votes?: number;
  readonly type?: string;
}

/**
 * Quality revision data for downloaded movie files.
 */
export interface MovieQualityRevision {
  readonly version?: number;
  readonly real?: number;
  readonly isRepack?: boolean;
}

/**
 * Quality descriptor for a Radarr movie file.
 */
export interface MovieFileQuality {
  readonly quality?: Quality;
  readonly revision?: MovieQualityRevision;
}

/**
 * Metadata about the downloaded movie file, when available.
 */
export interface MovieFile {
  readonly id: number;
  readonly relativePath?: string;
  readonly size?: number;
  readonly quality?: MovieFileQuality;
  readonly dateAdded?: string;
  readonly sceneName?: string;
}

/**
 * Aggregated statistics for a Radarr movie.
 */
export interface MovieStatistics {
  readonly movieFileCount?: number;
  readonly sizeOnDisk?: number;
  readonly percentAvailable?: number;
}

/**
 * Representation of a Radarr movie entity used throughout the app.
 */
export interface Movie {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly year?: number;
  readonly status?: string;
  readonly overview?: string;
  readonly studio?: string;
  readonly genres?: string[];
  readonly path?: string;
  readonly qualityProfileId?: number;
  readonly monitored: boolean;
  readonly hasFile: boolean;
  readonly isAvailable?: boolean;
  readonly minimumAvailability?: string;
  readonly runtime?: number;
  readonly certification?: string;
  readonly imdbId?: string;
  readonly tmdbId?: number;
  readonly titleSlug?: string;
  readonly website?: string;
  readonly inCinemas?: string;
  readonly digitalRelease?: string;
  readonly physicalRelease?: string;
  readonly releaseDate?: string;
  readonly tags?: number[];
  readonly posterUrl?: string;
  readonly backdropUrl?: string;
  readonly ratings?: MovieRatings;
  readonly statistics?: MovieStatistics;
  readonly movieFile?: MovieFile;
  readonly images?: MovieImage[];
}

/**
 * Request payload required to add a movie in Radarr.
 */
export interface AddMovieRequest {
  readonly title: string;
  readonly tmdbId: number;
  readonly year?: number;
  readonly titleSlug?: string;
  readonly qualityProfileId: number;
  readonly rootFolderPath: string;
  readonly monitored: boolean;
  readonly minimumAvailability?: string;
  readonly tags?: number[];
  readonly searchOnAdd?: boolean;
  readonly searchForMovie?: boolean;
  readonly images?: MovieImage[];
  readonly path?: string;
}

/**
 * Representation of a Radarr queue entry.
 */
export interface RadarrQueueItem {
  readonly id: number;
  readonly movieId: number;
  readonly title?: string;
  readonly status?: string;
  readonly trackedDownloadState?: string;
  readonly trackedDownloadStatus?: string;
  readonly protocol?: string;
  readonly size?: number;
  readonly sizeleft?: number;
  readonly timeleft?: string;
}
