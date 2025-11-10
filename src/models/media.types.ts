/**
 * Media information for an episode file including codec and resolution details.
 */
export interface EpisodeMediaInfo {
  readonly videoCodec?: string;
  readonly audioCodec?: string;
  readonly audioChannels?: number;
  readonly resolution?: string;
  readonly videoBitrate?: number;
  readonly audioBitrate?: number;
  readonly videoFps?: number;
  readonly videoDynamicRange?: string;
  readonly videoBitDepth?: number;
  readonly scanType?: string;
  readonly subtitles?: string;
  readonly runTime?: string;
}

/**
 * Extended quality information for an episode file.
 */
export interface EpisodeQualityInfo {
  readonly id?: number;
  readonly name: string;
  readonly source?: string;
  readonly resolution?: number;
}

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
  /** Extended quality information for the downloaded episode file. */
  readonly qualityInfo?: EpisodeQualityInfo;
  /** Relative path to the episode file, if downloaded. */
  readonly relativePath?: string;
  /** Poster URL for the episode if available. */
  readonly posterUrl?: string;
  /** Size of the episode file in MB if downloaded. */
  readonly sizeInMB?: number;
  /** Media information (codec, resolution, bitrate, etc.) for the episode file. */
  readonly mediaInfo?: EpisodeMediaInfo;
  /** Release group of the episode file. */
  readonly releaseGroup?: string;
  /** Scene name of the episode file. */
  readonly sceneName?: string;
  /** Date the episode file was added. */
  readonly dateAdded?: string;
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
  /** Total size of all episode files on disk in MB. */
  readonly totalSizeOnDiskMB?: number;
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

// ===== MUSIC TYPES (FOR LIDARR) =====

/**
 * Representation of a music artist in Lidarr.
 */
export interface Artist {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly status: ArtistStatus;
  readonly ended: boolean;
  readonly artistName: string;
  readonly overview?: string;
  readonly disambiguation?: string;
  readonly foreignArtistId?: string;
  readonly path?: string;
  readonly qualityProfileId?: number;
  readonly metadataProfileId?: number;
  readonly monitored: boolean;
  readonly tags?: number[];
  readonly images?: ArtistImage[];
  readonly links?: ArtistLink[];
  readonly genres?: string[];
  readonly added?: string;
  readonly ratings?: ArtistRating;
  readonly albumCount?: number;
  readonly statistics?: ArtistStatistics;
  readonly posterUrl?: string;
  readonly fanartUrl?: string;
  readonly albums?: Album[];
}

/**
 * Artist status values.
 */
export type ArtistStatus =
  | "continuing"
  | "ended"
  | "upcoming"
  | "deleted"
  | "archived"
  | "tba"
  | string;

/**
 * Artist image information.
 */
export interface ArtistImage {
  readonly coverType:
    | "poster"
    | "fanart"
    | "banner"
    | "logo"
    | "clearlogo"
    | "disc";
  readonly url: string;
  readonly remoteUrl?: string;
}

/**
 * External links for artist.
 */
export interface ArtistLink {
  readonly url: string;
  readonly name: string;
}

/**
 * Artist rating information.
 */
export interface ArtistRating {
  readonly votes: number;
  readonly value: number;
}

/**
 * Statistics for an artist.
 */
export interface ArtistStatistics {
  readonly albumCount: number;
  readonly trackFileCount: number;
  readonly trackCount: number;
  readonly totalTrackCount: number;
  readonly sizeOnDisk: number;
  readonly percentOfTracks: number;
}

/**
 * Representation of an album in Lidarr.
 */
export interface Album {
  readonly id: number;
  readonly title: string;
  readonly sortTitle?: string;
  readonly releaseDate?: string;
  readonly albumType: AlbumType;
  readonly status: AlbumStatus;
  readonly overview?: string;
  readonly disambiguation?: string;
  readonly foreignAlbumId?: string;
  readonly artistId: number;
  readonly artist?: Artist;
  readonly qualityProfileId?: number;
  readonly monitored: boolean;
  readonly anyReleaseOk: boolean;
  readonly profileId?: number;
  readonly path?: string;
  readonly tags?: number[];
  readonly images?: AlbumImage[];
  readonly links?: AlbumLink[];
  readonly genres?: string[];
  readonly added?: string;
  readonly ratings?: AlbumRating;
  readonly trackCount?: number;
  readonly releaseCount?: number;
  readonly statistics?: AlbumStatistics;
  readonly posterUrl?: string;
  readonly fanartUrl?: string;
  readonly tracks?: Track[];
}

/**
 * Album type values.
 */
export type AlbumType =
  | "Album"
  | "EP"
  | "Single"
  | "Broadcast"
  | "Other"
  | "Compilation"
  | "Soundtrack"
  | "Spokenword"
  | "Interview"
  | "Audiobook"
  | "Live"
  | "Remix"
  | "DJ-mix"
  | "Mixtape/Street"
  | string;

/**
 * Album status values.
 */
export type AlbumStatus =
  | "announced"
  | "inCinemas"
  | "released"
  | "deleted"
  | "tba"
  | string;

/**
 * Album image information.
 */
export interface AlbumImage {
  readonly coverType: "cover" | "disc" | "logo" | "backdrop";
  readonly url: string;
  readonly remoteUrl?: string;
}

/**
 * External links for album.
 */
export interface AlbumLink {
  readonly url: string;
  readonly name: string;
}

/**
 * Album rating information.
 */
export interface AlbumRating {
  readonly votes: number;
  readonly value: number;
}

/**
 * Statistics for an album.
 */
export interface AlbumStatistics {
  readonly trackFileCount: number;
  readonly trackCount: number;
  readonly sizeOnDisk: number;
  readonly percentOfTracks: number;
}

/**
 * Representation of a track in Lidarr.
 */
export interface Track {
  readonly id: number;
  readonly title: string;
  readonly duration?: number;
  readonly mediumNumber?: number;
  readonly trackNumber?: number;
  readonly absoluteTrackNumber?: number;
  readonly artistId: number;
  readonly artist?: Artist;
  readonly albumId: number;
  readonly album?: Album;
  readonly releaseId?: number;
  readonly mediumId?: number;
  readonly hasFile: boolean;
  readonly trackFileId?: number;
  readonly quality?: Quality;
  readonly monitored: boolean;
  readonly ratings?: TrackRating;
  readonly genre?: string;
  readonly relativePath?: string;
  readonly sizeInMB?: number;
}

/**
 * Track rating information.
 */
export interface TrackRating {
  readonly votes: number;
  readonly value: number;
}

/**
 * Request payload for adding an artist to Lidarr.
 */
export interface AddArtistRequest {
  readonly foreignArtistId: string;
  readonly artistName: string;
  readonly overview?: string;
  readonly path: string;
  readonly qualityProfileId: number;
  readonly metadataProfileId: number;
  readonly monitored?: boolean;
  readonly rootFolderPath: string;
  readonly tags?: number[];
  readonly searchNow?: boolean;
  readonly addOptions?: {
    readonly monitor: "all" | "new" | "none" | "missing";
    readonly searchForMissingAlbums?: boolean;
  };
}

/**
 * Quality profile for music.
 */
export interface MusicQualityProfile {
  readonly id: number;
  readonly name: string;
  readonly upgradeAllowed?: boolean;
  readonly cutoff?: Quality;
  readonly items?: MusicQualityProfileItem[];
}

/**
 * Quality profile item for music.
 */
export interface MusicQualityProfileItem {
  readonly allowed: boolean;
  readonly quality?: Quality;
  readonly items?: MusicQualityProfileItem[];
}

/**
 * Metadata profile for music.
 */
export interface MetadataProfile {
  readonly id: number;
  readonly name: string;
  readonly primaryAlbumType: AlbumType;
  readonly secondaryAlbumTypes: AlbumType[];
}
