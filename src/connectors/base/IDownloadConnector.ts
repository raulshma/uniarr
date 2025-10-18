import type { ServiceConfig } from "@/models/service.types";

/**
 * Download capability information for a content item
 */
export interface DownloadCapability {
  /** Whether the content can be downloaded */
  readonly canDownload: boolean;
  /** The download format (e.g., 'mp4', 'mkv', 'mp3') */
  readonly format?: string;
  /** Available quality options */
  readonly qualityOptions?: readonly QualityOption[];
  /** Estimated file size */
  readonly estimatedSize?: number;
  /** Whether the download supports resuming */
  readonly resumable: boolean;
  /** Any restrictions or requirements */
  readonly restrictions?: readonly string[];
  /** Whether this is a series that requires episode selection */
  readonly isSeries?: boolean;
  /** Number of episodes available for series */
  readonly episodeCount?: number;
}

/**
 * Quality option for downloadable content
 */
export interface QualityOption {
  /** Display name for the quality option */
  readonly label: string;
  /** The quality value (e.g., '1080p', '720p', '320kbps') */
  readonly value: string;
  /** Estimated file size for this quality */
  readonly estimatedSize?: number;
  /** The download URL for this quality */
  readonly url: string;
}

/**
 * Content metadata for downloads
 */
export interface DownloadContentMetadata {
  /** Content identifier from the service */
  readonly id: string;
  /** Content title */
  readonly title: string;
  /** Content type (movie, episode, music, etc.) */
  readonly type: string;
  /** Optional content description */
  readonly description?: string;
  /** Optional thumbnail/poster URL */
  readonly thumbnailUrl?: string;
  /** Content duration in seconds (if applicable) */
  readonly duration?: number;
  /** Release year (if applicable) */
  readonly year?: number;
  /** Series/season/episode information for TV shows */
  readonly seriesInfo?: {
    readonly seriesName: string;
    readonly season: number;
    readonly episode: number;
    readonly episodeTitle?: string;
  };
}

/**
 * Download information for a content item
 */
export interface DownloadInfo {
  /** Source URL for the download */
  readonly sourceUrl: string;
  /** Suggested file name for the download */
  readonly fileName: string;
  /** MIME type of the content */
  readonly mimeType?: string;
  /** Total file size in bytes (if known) */
  readonly size?: number;
  /** Content checksum for integrity verification */
  readonly checksum?: string;
  /** Whether the download supports resuming */
  readonly resumable: boolean;
  /** Additional HTTP headers needed for the download */
  readonly headers?: Record<string, string>;
  /** Authentication cookies or tokens */
  readonly auth?: {
    readonly cookies?: string;
    readonly token?: string;
    readonly type?: "bearer" | "basic" | "custom";
  };
}

/**
 * Interface for download-capable connectors
 */
export interface IDownloadConnector {
  /**
   * Check if the connector supports downloading content in general
   */
  readonly supportsDownloads: boolean;

  /**
   * Check if a specific content item can be downloaded
   * @param contentId - The content identifier from the service
   * @returns Promise resolving to download capability information
   */
  readonly canDownload: (contentId: string) => Promise<DownloadCapability>;

  /**
   * Get download information for a specific content item
   * @param contentId - The content identifier from the service
   * @param quality - Optional quality preference
   * @returns Promise resolving to download information
   */
  readonly getDownloadInfo: (
    contentId: string,
    quality?: string,
  ) => Promise<DownloadInfo>;

  /**
   * Get metadata about a content item for download purposes
   * @param contentId - The content identifier from the service
   * @returns Promise resolving to content metadata
   */
  readonly getContentMetadata: (
    contentId: string,
  ) => Promise<DownloadContentMetadata>;

  /**
   * Get a preview or thumbnail URL for the content
   * @param contentId - The content identifier from the service
   * @param options - Options for thumbnail generation
   * @returns Promise resolving to thumbnail URL or undefined
   */
  readonly getContentThumbnail?: (
    contentId: string,
    options?: { readonly width?: number; readonly height?: number },
  ) => Promise<string | undefined>;

  /**
   * Get available download quality options for a content item
   * @param contentId - The content identifier from the service
   * @returns Promise resolving to available quality options
   */
  readonly getDownloadQualities?: (
    contentId: string,
  ) => Promise<readonly QualityOption[]>;

  /**
   * Get episodes for a TV series
   * @param seriesId - The series identifier from the service
   * @returns Promise resolving to list of episodes
   */
  readonly getSeriesEpisodes?: (
    seriesId: string,
  ) => Promise<readonly unknown[]>;

  /**
   * Validate that a download URL is still valid and accessible
   * @param downloadUrl - The URL to validate
   * @returns Promise resolving to true if the URL is valid
   */
  readonly validateDownloadUrl?: (downloadUrl: string) => Promise<boolean>;

  /**
   * Refresh an expiring download URL
   * @param contentId - The content identifier from the service
   * @param currentUrl - The current (expiring) URL
   * @returns Promise resolving to a new download URL
   */
  readonly refreshDownloadUrl?: (
    contentId: string,
    currentUrl: string,
  ) => Promise<string>;

  /**
   * Get download requirements or restrictions for the user
   * @param contentId - The content identifier from the service
   * @returns Promise resolving to an array of requirement descriptions
   */
  readonly getDownloadRequirements?: (
    contentId: string,
  ) => Promise<readonly string[]>;
}

/**
 * Type guard to check if a connector supports downloads
 */
export function isDownloadConnector(
  connector: unknown,
): connector is IDownloadConnector {
  return (
    typeof connector === "object" &&
    connector !== null &&
    "supportsDownloads" in connector &&
    typeof (connector as any).supportsDownloads === "boolean" &&
    (connector as any).supportsDownloads === true &&
    "canDownload" in connector &&
    typeof (connector as any).canDownload === "function" &&
    "getDownloadInfo" in connector &&
    typeof (connector as any).getDownloadInfo === "function" &&
    "getContentMetadata" in connector &&
    typeof (connector as any).getContentMetadata === "function"
  );
}

/**
 * Extended service configuration with download settings
 */
export interface DownloadServiceConfig extends ServiceConfig {
  /** Download-specific settings for this service */
  readonly downloadSettings?: {
    /** Whether to prefer the highest quality */
    readonly preferHighestQuality?: boolean;
    /** Default quality preference */
    readonly defaultQuality?: string;
    /** Whether to include subtitles if available */
    readonly includeSubtitles?: boolean;
    /** Preferred subtitle languages */
    readonly subtitleLanguages?: readonly string[];
    /** Whether to verify download integrity */
    readonly verifyIntegrity?: boolean;
    /** Custom download directory for this service */
    readonly customDownloadDirectory?: string;
    /** Maximum concurrent downloads for this service */
    readonly maxConcurrentDownloads?: number;
  };
}
