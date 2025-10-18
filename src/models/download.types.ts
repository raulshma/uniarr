import type { ServiceConfig } from "./service.types";

/**
 * Download status types
 */
export type DownloadStatus =
  | "pending"
  | "downloading"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled"
  | "retrying";

/**
 * Download item metadata
 */
export interface DownloadItem {
  /** Unique identifier for the download */
  readonly id: string;

  /** Service configuration that owns this content */
  readonly serviceConfig: ServiceConfig;

  /** Content metadata */
  readonly content: {
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
    /** Content file size in bytes (if known) */
    readonly size?: number;
  };

  /** Download configuration */
  readonly download: {
    /** Source URL for the download */
    readonly sourceUrl: string;
    /** Local file path where the content will be saved */
    readonly localPath: string;
    /** File name for the downloaded content */
    readonly fileName: string;
    /** MIME type of the content */
    readonly mimeType?: string;
    /** File size in bytes (if known) */
    readonly size?: number;
    /** Optional checksum for integrity verification */
    readonly checksum?: string;
  };

  /** Download state information */
  readonly state: {
    /** Current download status */
    readonly status: DownloadStatus;
    /** Download progress (0-1) */
    readonly progress: number;
    /** Number of bytes downloaded */
    readonly bytesDownloaded: number;
    /** Total file size in bytes */
    readonly totalBytes: number;
    /** Current download speed in bytes per second */
    readonly downloadSpeed: number;
    /** Estimated time remaining in seconds */
    readonly eta: number;
    /** When the download was created */
    readonly createdAt: Date;
    /** When the download was last updated */
    readonly updatedAt: Date;
    /** When the download completed (if applicable) */
    readonly completedAt?: Date;
    /** Number of retry attempts */
    readonly retryCount: number;
    /** Maximum retry attempts allowed */
    readonly maxRetries: number;
    /** Error message if download failed */
    readonly errorMessage?: string;
    /** Whether the download can be resumed */
    readonly resumable: boolean;
  };
}

/**
 * Download queue configuration
 */
export interface DownloadQueueConfig {
  /** Maximum number of concurrent downloads */
  readonly maxConcurrentDownloads: number;
  /** Whether downloads are allowed on mobile data */
  readonly allowMobileData: boolean;
  /** Whether downloads should continue when app is backgrounded */
  readonly allowBackgroundDownloads: boolean;
  /** Default download directory */
  readonly defaultDownloadDirectory: string;
  /** Maximum total storage space to use for downloads (in bytes) */
  readonly maxStorageUsage: number;
}

/**
 * Download statistics
 */
export interface DownloadStats {
  /** Total number of downloads */
  readonly totalDownloads: number;
  /** Number of active downloads */
  readonly activeDownloads: number;
  /** Number of completed downloads */
  readonly completedDownloads: number;
  /** Number of failed downloads */
  readonly failedDownloads: number;
  /** Total bytes downloaded */
  readonly totalBytesDownloaded: number;
  /** Current download speed (sum of all active downloads) */
  readonly currentDownloadSpeed: number;
  /** Storage space used by downloads */
  readonly storageUsed: number;
  /** Storage space available */
  readonly storageAvailable: number;
}

/**
 * Download manager state
 */
export interface DownloadManagerState {
  /** All download items indexed by ID */
  readonly downloads: Map<string, DownloadItem>;
  /** Queue of pending downloads */
  readonly downloadQueue: string[];
  /** Set of actively downloading item IDs */
  readonly activeDownloads: Set<string>;
  /** Download configuration */
  readonly config: DownloadQueueConfig;
  /** Download statistics */
  readonly stats: DownloadStats;
}

/**
 * Download events emitted by the DownloadManager
 */
export type DownloadEvent =
  | { type: "downloadStarted"; downloadId: string }
  | {
      type: "downloadProgress";
      downloadId: string;
      progress: number;
      bytesDownloaded: number;
      speed: number;
      eta: number;
    }
  | { type: "downloadPaused"; downloadId: string }
  | { type: "downloadResumed"; downloadId: string }
  | { type: "downloadCompleted"; downloadId: string; localPath: string }
  | {
      type: "downloadFailed";
      downloadId: string;
      error: string;
      canRetry: boolean;
    }
  | { type: "downloadCancelled"; downloadId: string }
  | { type: "downloadRetrying"; downloadId: string; attempt: number }
  | { type: "queueUpdated"; queueSize: number }
  | { type: "storageWarning"; usage: number; limit: number };

/**
 * Download manager configuration options
 */
export interface DownloadManagerOptions {
  /** Custom download queue configuration */
  readonly queueConfig?: Partial<DownloadQueueConfig>;
  /** Event listener for download events */
  readonly onEvent?: (event: DownloadEvent) => void;
  /** Progress update interval in milliseconds */
  readonly progressUpdateInterval?: number;
  /** Whether to enable download persistence across app restarts */
  readonly enablePersistence?: boolean;
}

/**
 * Interface for download-capable connectors
 */
export interface IDownloadConnector {
  /** Check if the connector supports downloading the specified content */
  readonly canDownload: (contentId: string) => Promise<boolean>;

  /** Get download information for the specified content */
  readonly getDownloadInfo: (contentId: string) => Promise<{
    sourceUrl: string;
    fileName: string;
    mimeType?: string;
    size?: number;
    checksum?: string;
    resumable: boolean;
  }>;

  /** Get a preview or thumbnail URL for the content */
  readonly getContentThumbnail?: (
    contentId: string,
  ) => Promise<string | undefined>;

  /** Get metadata about the content */
  readonly getContentMetadata: (contentId: string) => Promise<{
    title: string;
    type: string;
    description?: string;
    duration?: number;
  }>;
}

/**
 * File system information for downloads
 */
export interface DownloadStorageInfo {
  /** Total storage space on device */
  readonly totalSpace: number;
  /** Available storage space */
  readonly freeSpace: number;
  /** Space used by downloads */
  readonly usedSpace: number;
  /** Download directory path */
  readonly downloadDirectory: string;
  /** Number of downloaded files */
  readonly fileCount: number;
  /** Size of largest downloaded file */
  readonly largestFileSize: number;
}

/**
 * Download history entry
 */
export interface DownloadHistoryEntry {
  /** Download ID */
  readonly id: string;
  /** Service name */
  readonly serviceName: string;
  /** Content title */
  readonly contentTitle: string;
  /** Content type */
  readonly contentType: string;
  /** File size */
  readonly fileSize: number;
  /** Download completion date */
  readonly completedAt: Date;
  /** Local file path */
  readonly localPath: string;
  /** Whether the file still exists */
  readonly fileExists: boolean;
}

/**
 * Download progress data from the file system
 */
export interface DownloadProgressData {
  /** Total bytes downloaded so far */
  readonly totalBytesWritten: number;
  /** Total bytes expected to download */
  readonly totalBytesExpectedToWrite: number;
}

/**
 * Download pause state from expo-file-system
 */
export interface DownloadPauseState {
  /** Indicates if the download was paused */
  readonly isFile?: boolean;
  /** Resume data */
  readonly pauseData?: string;
}

/**
 * Download resumable task interface - matches expo-file-system DownloadResumable
 */
export interface DownloadResumable {
  /** Resume the download */
  resumeAsync(): Promise<{ uri: string } | undefined>;
  /** Pause the download */
  pauseAsync(): Promise<DownloadPauseState>;
  /** Save the resumable state */
  savable(): Promise<{ url: string; fileUri: string }>;
}
