import type { Torrent } from "@/models/torrent.types";

const TORRENT_PAUSED_STATES: ReadonlySet<Torrent["state"]> = new Set([
  "pausedDL",
  "pausedUP",
]);
const TORRENT_ACTIVE_STATES: ReadonlySet<Torrent["state"]> = new Set([
  "downloading",
  "forcedDL",
  "forcedMetaDL",
  "metaDL",
  "stalledDL",
  "queuedDL",
  "checkingDL",
  "checkingUP",
  "allocating",
]);
const TORRENT_COMPLETED_STATES: ReadonlySet<Torrent["state"]> = new Set([
  "uploading",
  "forcedUP",
  "stalledUP",
  "queuedUP",
  "checkingUP",
]);

export const isTorrentPausedState = (state: Torrent["state"]): boolean =>
  TORRENT_PAUSED_STATES.has(state);

export const isTorrentPaused = (torrent: Torrent): boolean =>
  isTorrentPausedState(torrent.state);

export const isTorrentActive = (torrent: Torrent): boolean => {
  if (isTorrentPaused(torrent)) {
    return false;
  }

  if (torrent.progress >= 1) {
    return false;
  }

  if (TORRENT_ACTIVE_STATES.has(torrent.state)) {
    return true;
  }

  return torrent.downloadSpeed > 0;
};

export const isTorrentCompleted = (torrent: Torrent): boolean => {
  if (torrent.progress >= 1) {
    return true;
  }

  return TORRENT_COMPLETED_STATES.has(torrent.state);
};

export const deriveTorrentStatusLabel = (torrent: Torrent): string => {
  const normalized = torrent.state.toLowerCase();

  switch (normalized) {
    case "downloading":
    case "forceddl":
      return "Downloading";
    case "pauseddl":
    case "pausedup":
      return "Paused";
    case "stalleddl":
      return "Stalled";
    case "uploading":
    case "forcedup":
      return "Seeding";
    case "queueddl":
    case "queuedup":
      return "Queued";
    case "checkingdl":
    case "checkingup":
    case "checkingresumedata":
      return "Checking";
    case "metadl":
    case "forcedmetadl":
      return "Metadata";
    case "allocating":
      return "Allocating";
    case "missingfiles":
      return "Missing files";
    case "error":
      return "Error";
    case "stalledup":
      return "Seeding (stalled)";
    default:
      return "Unknown";
  }
};

export const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes === 0) {
    return "0 B";
  }

  const absolute = Math.abs(bytes);
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = absolute;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 ? 0 : 1;
  const formatted = (bytes < 0 ? -value : value).toFixed(precision);
  return `${formatted} ${units[unitIndex]}`;
};

export const formatSpeed = (bytesPerSecond: number): string =>
  `${formatBytes(bytesPerSecond)}/s`;

export const formatEta = (eta: number): string => {
  if (!Number.isFinite(eta) || eta < 0) {
    return "∞";
  }

  if (eta === 0) {
    return "Done";
  }

  const hours = Math.floor(eta / 3600);
  const minutes = Math.floor((eta % 3600) / 60);
  const seconds = Math.floor(eta % 60);

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }

  return `${seconds}s`;
};
