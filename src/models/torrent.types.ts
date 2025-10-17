export type TorrentState =
  | "error"
  | "missingFiles"
  | "uploading"
  | "stalledUP"
  | "queuedUP"
  | "pausedUP"
  | "checkingUP"
  | "checkingResumeData"
  | "forcedUP"
  | "allocating"
  | "downloading"
  | "metaDL"
  | "stalledDL"
  | "checkingDL"
  | "queuedDL"
  | "pausedDL"
  | "forcedDL"
  | "forcedMetaDL"
  | "moving"
  | "unknown";

/**
 * Normalised representation of a qBittorrent torrent.
 */
export interface Torrent {
  readonly hash: string;
  readonly name: string;
  readonly state: TorrentState;
  readonly category?: string;
  readonly tags?: string[];
  readonly progress: number;
  readonly size: number;
  readonly downloaded: number;
  readonly uploaded: number;
  readonly ratio: number;
  readonly downloadSpeed: number;
  readonly uploadSpeed: number;
  readonly eta: number;
  readonly addedOn?: number;
  readonly completedOn?: number;
  readonly seedingTime?: number;
  readonly lastActivity?: number;
  readonly seeds?: {
    readonly connected: number;
    readonly total: number;
  };
  readonly peers?: {
    readonly connected: number;
    readonly total: number;
  };
  readonly availability?: number;
}

/**
 * Aggregated transfer statistics returned by qBittorrent.
 */
export interface TorrentTransferInfo {
  readonly downloadSpeed: number;
  readonly uploadSpeed: number;
  readonly dhtNodes: number;
  readonly connectionStatus: "connected" | "firewalled" | "disconnected";
}
