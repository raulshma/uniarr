import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { SonarrConnector } from "@/connectors/implementations/SonarrConnector";
import type { RadarrConnector } from "@/connectors/implementations/RadarrConnector";
import type { JellyseerrConnector } from "@/connectors/implementations/JellyseerrConnector";
import type { QBittorrentConnector } from "@/connectors/implementations/QBittorrentConnector";
import type { TransmissionConnector } from "@/connectors/implementations/TransmissionConnector";
import type { DelugeConnector } from "@/connectors/implementations/DelugeConnector";
import type { SABnzbdConnector } from "@/connectors/implementations/SABnzbdConnector";
import type {
  LidarrConnector,
  LidarrQueueItem,
} from "@/connectors/implementations/LidarrConnector";
import type { BazarrConnector } from "@/connectors/implementations/BazarrConnector";
import type { IConnector } from "@/connectors/base/IConnector";
import {
  useConnectorsStore,
  selectConnectorsByType,
} from "@/store/connectorsStore";
import { queryKeys } from "@/hooks/queryKeys";
import { useRecentlyAdded } from "@/hooks/useRecentlyAdded";
import { useServicesHealth } from "@/hooks/useServicesHealth";
import { useCalendar } from "@/hooks/useCalendar";
import type { Torrent, TorrentState } from "@/models/torrent.types";
import type { BazarrHistoryItem, BazarrQueueItem } from "@/models/bazarr.types";

import type {
  TimelineEvent,
  TimelineDay,
  TimelineFilter,
} from "@/models/timeline.types";
import type { ServiceType } from "@/models/service.types";

const EVENT_ICONS: Record<string, string> = {
  download_started: "download",
  download_completed: "check-circle",
  download_failed: "alert-circle",
  download_progress: "progress-download",
  new_show_added: "television-classic",
  new_movie_added: "filmstrip",
  episode_grabbed: "download",
  episode_imported: "import",
  movie_grabbed: "download",
  movie_imported: "import",
  queue_pending: "clock-outline",
  upcoming_release: "calendar-clock",
  service_online: "check-network",
  service_offline: "close-network",
  service_degraded: "network-strength-2-alert",
  update_available: "update",
  health_warning: "alert",
  health_error: "alert-octagon",
  request_pending: "clock-plus-outline",
  request_approved: "check-decagram",
  request_declined: "close-circle-outline",
  torrent_completed: "check-circle",
  torrent_started: "play",
  torrent_failed: "alert-circle",
  torrent_paused: "pause-circle",
  subtitle_downloaded: "subtitles",
  subtitle_missing: "subtitles-outline",
  album_grabbed: "download",
  album_imported: "import",
  artist_added: "music-note",
  playback_started: "play-circle",
  playback_stopped: "stop-circle",
  disk_space_low: "harddisk-alert",
};

const EVENT_COLORS: Record<string, string> = {
  download_started: "#4FC3F7",
  download_completed: "#66BB6A",
  download_failed: "#EF5350",
  download_progress: "#42A5F5",
  new_show_added: "#AB47BC",
  new_movie_added: "#FFA726",
  episode_grabbed: "#7E57C2",
  episode_imported: "#26A69A",
  movie_grabbed: "#FF7043",
  movie_imported: "#26C6DA",
  queue_pending: "#78909C",
  upcoming_release: "#5C6BC0",
  service_online: "#66BB6A",
  service_offline: "#EF5350",
  service_degraded: "#FFA726",
  update_available: "#42A5F5",
  health_warning: "#FFA726",
  health_error: "#EF5350",
  request_pending: "#FFA726",
  request_approved: "#66BB6A",
  request_declined: "#EF5350",
  torrent_completed: "#66BB6A",
  torrent_started: "#4FC3F7",
  torrent_failed: "#EF5350",
  torrent_paused: "#78909C",
  subtitle_downloaded: "#26C6DA",
  subtitle_missing: "#FFA726",
  album_grabbed: "#7E57C2",
  album_imported: "#26A69A",
  artist_added: "#AB47BC",
  playback_started: "#4FC3F7",
  playback_stopped: "#78909C",
  disk_space_low: "#EF5350",
};

const CATEGORY_MAP: Record<string, string> = {
  download_started: "downloads",
  download_completed: "downloads",
  download_failed: "downloads",
  download_progress: "downloads",
  new_show_added: "library",
  new_movie_added: "library",
  episode_grabbed: "downloads",
  episode_imported: "library",
  movie_grabbed: "downloads",
  movie_imported: "library",
  queue_pending: "downloads",
  upcoming_release: "schedule",
  service_online: "system",
  service_offline: "system",
  service_degraded: "system",
  update_available: "system",
  health_warning: "system",
  health_error: "system",
  request_pending: "requests",
  request_approved: "requests",
  request_declined: "requests",
  torrent_completed: "downloads",
  torrent_started: "downloads",
  torrent_failed: "downloads",
  torrent_paused: "downloads",
  subtitle_downloaded: "library",
  subtitle_missing: "library",
  album_grabbed: "downloads",
  album_imported: "library",
  artist_added: "library",
  playback_started: "library",
  playback_stopped: "library",
  disk_space_low: "system",
};

const HISTORY_EVENT_TYPE_MAP: Record<
  string,
  { type: string; category: string }
> = {
  grabFolder: { type: "episode_grabbed", category: "downloads" },
  downloadFolderImported: {
    type: "episode_imported",
    category: "library",
  },
  downloadFailed: { type: "download_failed", category: "downloads" },
  episodeFileDeleted: { type: "download_failed", category: "downloads" },
};

const RADARR_HISTORY_EVENT_TYPE_MAP: Record<
  string,
  { type: string; category: string }
> = {
  movieFileRenamed: { type: "movie_imported", category: "library" },
  movieFolderImported: { type: "movie_imported", category: "library" },
  downloadFolderImported: { type: "movie_imported", category: "library" },
  downloadFailed: { type: "download_failed", category: "downloads" },
  movieFileDeleted: { type: "download_failed", category: "downloads" },
  movieGrabbed: { type: "movie_grabbed", category: "downloads" },
};

const LIDARR_HISTORY_EVENT_MAP: Record<
  string,
  { type: string; category: string }
> = {
  albumGrabbed: { type: "album_grabbed", category: "downloads" },
  downloadFolderImported: { type: "album_imported", category: "library" },
  trackImported: { type: "album_imported", category: "library" },
  downloadFailed: { type: "download_failed", category: "downloads" },
};

function makeEvent(partial: {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  timestamp: number;
  serviceId: string;
  serviceName: string;
  serviceType: ServiceType;
  posterUrl?: string;
  contentId?: number;
  route?: string;
  progress?: number;
}): TimelineEvent {
  const type = partial.type as TimelineEvent["type"];
  return {
    ...partial,
    type,
    category: CATEGORY_MAP[partial.type] as TimelineEvent["category"],
    icon: EVENT_ICONS[partial.type] ?? "information",
    color: EVENT_COLORS[partial.type] ?? "#78909C",
  };
}

async function fetchSonarrHistory(
  connectors: SonarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const response = await connector.getHistory({
        page: 1,
        pageSize: 25,
      });

      const records = response?.records ?? [];
      for (const record of records) {
        const mapped = HISTORY_EVENT_TYPE_MAP[record.eventType ?? ""];
        if (!mapped) continue;

        const seriesTitle =
          (record.series as any)?.title ?? record.series?.title ?? "Unknown";
        const episodeLabel = record.episode
          ? `S${String(record.episode.seasonNumber ?? 0).padStart(2, "0")}E${String(record.episode.episodeNumber ?? 0).padStart(2, "0")}`
          : "";

        events.push(
          makeEvent({
            id: `sonarr-history-${connector.config.id}-${record.id}`,
            type: mapped.type,
            title:
              mapped.type === "episode_imported"
                ? `${seriesTitle} imported`
                : mapped.type === "episode_grabbed"
                  ? `${seriesTitle} grabbed`
                  : `${seriesTitle} failed`,
            subtitle: episodeLabel
              ? `${episodeLabel} - ${record.episode?.title ?? ""}`
              : undefined,
            timestamp: record.date
              ? new Date(record.date).getTime()
              : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "sonarr",
            posterUrl: (record.series as any)?.images?.find(
              (img: any) => img.coverType === "poster",
            )?.remoteUrl,
            contentId: record.seriesId ?? undefined,
            route: record.seriesId
              ? `/(auth)/sonarr/${connector.config.id}/series/${record.seriesId}`
              : undefined,
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchRadarrHistory(
  connectors: RadarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const response = await connector.getHistory({
        page: 1,
        pageSize: 25,
      });

      const records = response?.records ?? [];
      for (const record of records) {
        const mapped = RADARR_HISTORY_EVENT_TYPE_MAP[record.eventType ?? ""];
        if (!mapped) continue;

        const movieTitle =
          (record.movie as any)?.title ?? record.movie?.title ?? "Unknown";

        events.push(
          makeEvent({
            id: `radarr-history-${connector.config.id}-${record.id}`,
            type: mapped.type,
            title:
              mapped.type === "movie_imported"
                ? `${movieTitle} imported`
                : mapped.type === "movie_grabbed"
                  ? `${movieTitle} grabbed`
                  : `${movieTitle} failed`,
            timestamp: record.date
              ? new Date(record.date).getTime()
              : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "radarr",
            posterUrl: (record.movie as any)?.images?.find(
              (img: any) => img.coverType === "poster",
            )?.remoteUrl,
            contentId: record.movieId ?? undefined,
            route: record.movieId
              ? `/(auth)/radarr/${connector.config.id}/movies/${record.movieId}`
              : undefined,
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchSonarrQueue(
  connectors: SonarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const queueItems = await connector.getQueue();

      for (const item of queueItems) {
        const isDownloading = item.status === "downloading";
        const isPaused = item.status === "paused";
        const isCompleted = item.status === "completed";

        let eventType: string;
        if (isCompleted) {
          eventType = "download_completed";
        } else if (isPaused || item.status === "queued") {
          eventType = "queue_pending";
        } else if (isDownloading) {
          eventType = "download_progress";
        } else {
          eventType = "download_started";
        }

        const progress =
          item.size && item.size > 0
            ? Math.round((1 - (item.sizeleft ?? 0) / item.size) * 100)
            : undefined;

        const seriesTitle = item.seriesTitle ?? "Unknown";

        events.push(
          makeEvent({
            id: `sonarr-queue-${connector.config.id}-${item.id}`,
            type: eventType,
            title: seriesTitle,
            subtitle: isDownloading
              ? `Downloading${progress != null ? ` - ${progress}%` : ""}`
              : isPaused
                ? "Paused"
                : isCompleted
                  ? "Completed"
                  : "Queued",
            timestamp: Date.now() - (queueItems.indexOf(item) + 1) * 60000,
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "sonarr",
            progress,
            route: item.seriesId
              ? `/(auth)/sonarr/${connector.config.id}/series/${item.seriesId}`
              : undefined,
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchRadarrQueue(
  connectors: RadarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const queueItems = await connector.getQueue();

      for (const item of queueItems) {
        const isDownloading = item.status === "downloading";
        const isPaused = item.status === "paused";
        const isCompleted = item.status === "completed";

        let eventType: string;
        if (isCompleted) {
          eventType = "download_completed";
        } else if (isPaused || item.status === "queued") {
          eventType = "queue_pending";
        } else if (isDownloading) {
          eventType = "download_progress";
        } else {
          eventType = "download_started";
        }

        const progress =
          item.size && item.size > 0
            ? Math.round((1 - (item.sizeleft ?? 0) / item.size) * 100)
            : undefined;

        const movieTitle = item.title ?? "Unknown";

        events.push(
          makeEvent({
            id: `radarr-queue-${connector.config.id}-${item.id}`,
            type: eventType,
            title: movieTitle,
            subtitle: isDownloading
              ? `Downloading${progress != null ? ` - ${progress}%` : ""}`
              : isPaused
                ? "Paused"
                : isCompleted
                  ? "Completed"
                  : "Queued",
            timestamp: Date.now() - (queueItems.indexOf(item) + 1) * 60000,
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "radarr",
            progress,
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchJellyseerrRequests(
  connectors: JellyseerrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const response = await connector.getRequests({ take: 25 });
      const requests = response?.items ?? [];

      for (const request of requests) {
        let eventType: string;
        switch (request.status) {
          case 1:
            eventType = "request_pending";
            break;
          case 2:
            eventType = "request_approved";
            break;
          case 3:
            eventType = "request_declined";
            break;
          default:
            continue;
        }

        const media = request.media as any;
        const title =
          media?.externalServiceSlug ??
          media?.externalServiceId ??
          `Request #${request.id}`;
        const mediaType =
          (request as any).type ?? media?.mediaType ?? "unknown";
        const requestedBy = (request as any).requestedBy?.displayName;

        events.push(
          makeEvent({
            id: `jellyseerr-req-${connector.config.id}-${request.id}`,
            type: eventType,
            title: `${title}`,
            subtitle: `${mediaType === "movie" ? "Movie" : "TV Show"}${requestedBy ? ` requested by ${requestedBy}` : ""}`,
            timestamp: request.createdAt
              ? new Date(request.createdAt).getTime()
              : request.updatedAt
                ? new Date(request.updatedAt).getTime()
                : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "jellyseerr",
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchTorrentClientEvents(
  connectors: IConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const torrents: Torrent[] = await (connector as any).getTorrents();

      for (const torrent of torrents.slice(0, 30)) {
        const state = torrent.state as string;
        let eventType: string;
        let subtitle: string;

        if (
          state === "downloading" ||
          state === "stalledDL" ||
          state === "forcedDL" ||
          state === "metaDL"
        ) {
          eventType = "torrent_started";
          subtitle = `Downloading - ${Math.round(torrent.progress * 100)}%`;
        } else if (
          state === "uploading" ||
          state === "stalledUP" ||
          state === "forcedUP" ||
          state === "queuedUP"
        ) {
          eventType = "torrent_completed";
          subtitle = "Seeding";
        } else if (state === "pausedDL" || state === "pausedUP") {
          eventType = "torrent_paused";
          subtitle = "Paused";
        } else if (state === "error" || state === "missingFiles") {
          eventType = "torrent_failed";
          subtitle = "Error";
        } else {
          eventType = "torrent_started";
          subtitle = state;
        }

        const timestamp = torrent.addedOn
          ? torrent.addedOn * 1000
          : torrent.completedOn
            ? torrent.completedOn * 1000
            : Date.now();

        events.push(
          makeEvent({
            id: `torrent-${connector.config.id}-${torrent.hash}`,
            type: eventType,
            title: torrent.name,
            subtitle,
            timestamp,
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: connector.config.type,
            progress: Math.round(torrent.progress * 100),
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchBazarrEvents(
  connectors: BazarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const [historyItems, queueItems] = await Promise.all([
        connector.getHistory().catch(() => [] as BazarrHistoryItem[]),
        connector.getQueue().catch(() => [] as BazarrQueueItem[]),
      ]);

      for (const item of historyItems.slice(0, 20)) {
        const actionNum =
          typeof item.action === "string"
            ? parseInt(item.action, 10)
            : item.action;
        const actionLabel =
          actionNum === 1
            ? "downloaded"
            : actionNum === 2
              ? "synced"
              : String(item.action);

        events.push(
          makeEvent({
            id: `bazarr-history-${connector.config.id}-${item.id}`,
            type: "subtitle_downloaded",
            title: `Subtitle ${actionLabel}`,
            subtitle: `${item.description ?? ""}${item.language ? ` (${item.language.name})` : ""}`,
            timestamp: item.timestamp
              ? new Date(item.timestamp).getTime()
              : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "bazarr",
          }),
        );
      }

      for (const item of queueItems) {
        events.push(
          makeEvent({
            id: `bazarr-queue-${connector.config.id}-${item.id}`,
            type: "subtitle_missing",
            title: `${item.name} - missing subtitle`,
            subtitle: `${item.language.name}${item.provider ? ` via ${item.provider}` : ""}`,
            timestamp: item.timestamp
              ? new Date(item.timestamp).getTime()
              : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "bazarr",
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchLidarrEvents(
  connectors: LidarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  for (const connector of connectors) {
    try {
      const [queueResult, historyResponse] = await Promise.all([
        connector.getQueue().catch((): LidarrQueueItem[] => []),
        connector.getHistory({ page: 1, pageSize: 15 }).catch(() => ({
          records: [],
        })),
      ]);
      const queueItems: LidarrQueueItem[] = queueResult;

      for (const item of queueItems) {
        const isDownloading = item.status === "downloading";
        const isCompleted = item.status === "completed";
        const isFailed = item.status === "failed" || item.status === "warning";

        let eventType: string;
        if (isCompleted) {
          eventType = "download_completed";
        } else if (isFailed) {
          eventType = "download_failed";
        } else if (isDownloading) {
          eventType = "download_progress";
        } else {
          eventType = "queue_pending";
        }

        const artistName = item.artistName ?? "Unknown Artist";
        const albumTitle = item.albumTitle ?? "";

        events.push(
          makeEvent({
            id: `lidarr-queue-${connector.config.id}-${item.id}`,
            type: eventType,
            title: albumTitle ? `${artistName} - ${albumTitle}` : artistName,
            subtitle: isDownloading
              ? "Downloading"
              : isCompleted
                ? "Completed"
                : isFailed
                  ? "Failed"
                  : "Queued",
            timestamp: Date.now() - (queueItems.indexOf(item) + 1) * 60000,
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "lidarr",
            progress:
              item.size && item.size > 0
                ? Math.round((1 - (item.sizeleft ?? 0) / item.size) * 100)
                : undefined,
          }),
        );
      }

      const records = (historyResponse as any)?.records ?? [];
      for (const record of records) {
        const mapped = LIDARR_HISTORY_EVENT_MAP[record.eventType ?? ""];
        if (!mapped) continue;

        const artistName = (record as any).artist?.name ?? "Unknown Artist";
        const albumTitle = (record as any).album?.title ?? "";

        events.push(
          makeEvent({
            id: `lidarr-history-${connector.config.id}-${record.id}`,
            type: mapped.type,
            title: albumTitle ? `${artistName} - ${albumTitle}` : artistName,
            subtitle:
              mapped.type === "album_imported"
                ? "Album imported"
                : mapped.type === "album_grabbed"
                  ? "Album grabbed"
                  : "Download failed",
            timestamp: record.date
              ? new Date(record.date).getTime()
              : Date.now(),
            serviceId: connector.config.id,
            serviceName: connector.config.name,
            serviceType: "lidarr",
          }),
        );
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

async function fetchRootFolderEvents(
  sonarrConnectors: SonarrConnector[],
  radarrConnectors: RadarrConnector[],
  lidarrConnectors: LidarrConnector[],
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  const LOW_SPACE_THRESHOLD = 5 * 1024 * 1024 * 1024; // 5 GB

  const allConnectors = [
    ...sonarrConnectors.map((c) => ({
      connector: c as any,
      type: "sonarr" as ServiceType,
    })),
    ...radarrConnectors.map((c) => ({
      connector: c as any,
      type: "radarr" as ServiceType,
    })),
    ...lidarrConnectors.map((c) => ({
      connector: c as any,
      type: "lidarr" as ServiceType,
    })),
  ];

  for (const { connector, type } of allConnectors) {
    try {
      const folders = await connector.getRootFolders();
      for (const folder of folders) {
        if (
          folder.accessible &&
          typeof folder.freeSpace === "number" &&
          folder.freeSpace < LOW_SPACE_THRESHOLD
        ) {
          const freeGB = (folder.freeSpace / (1024 * 1024 * 1024)).toFixed(1);
          events.push(
            makeEvent({
              id: `disk-${connector.config.id}-${folder.id ?? folder.path}`,
              type: "disk_space_low",
              title: `Low disk space on ${connector.config.name}`,
              subtitle: `${folder.path} - ${freeGB} GB free`,
              timestamp: Date.now(),
              serviceId: connector.config.id,
              serviceName: connector.config.name,
              serviceType: type,
            }),
          );
        }
      }
    } catch {
      // skip failed connectors
    }
  }

  return events;
}

function buildServiceHealthEvents(
  services: {
    serviceId: string;
    config: { name: string; type: ServiceType; enabled: boolean };
    status: string;
    version?: string;
  }[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const service of services) {
    if (!service.config.enabled) continue;

    let eventType: string;
    if (service.status === "online") {
      eventType = "service_online";
    } else if (service.status === "offline") {
      eventType = "service_offline";
    } else {
      eventType = "service_degraded";
    }

    events.push(
      makeEvent({
        id: `health-${service.serviceId}`,
        type: eventType,
        title: `${service.config.name}`,
        subtitle: service.version
          ? `v${service.version} - ${service.status}`
          : service.status,
        timestamp: Date.now(),
        serviceId: service.serviceId,
        serviceName: service.config.name,
        serviceType: service.config.type,
        route: `/(auth)/settings/services-health`,
      }),
    );
  }

  return events;
}

function buildUpcomingEvents(
  releases: {
    id: string;
    title: string;
    releaseDate: string;
    status: string;
    posterUrl?: string;
    serviceId?: string;
    serviceType?: string;
    type: string;
    seriesId?: string;
  }[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0] ?? "";

  const upcoming = releases
    .filter((r) => r.releaseDate >= todayStr && r.status === "upcoming")
    .slice(0, 15);

  for (const release of upcoming) {
    events.push(
      makeEvent({
        id: `upcoming-${release.id}`,
        type: "upcoming_release",
        title: release.title,
        subtitle: `Airing ${new Date(release.releaseDate).toLocaleDateString()}`,
        timestamp: new Date(release.releaseDate).getTime(),
        serviceId: release.serviceId ?? "unknown",
        serviceName: release.serviceType ?? "unknown",
        serviceType: (release.serviceType as ServiceType) ?? "sonarr",
        posterUrl: release.posterUrl,
        contentId: release.seriesId ? Number(release.seriesId) : undefined,
        route:
          release.serviceId &&
          release.serviceType === "sonarr" &&
          release.seriesId
            ? `/(auth)/sonarr/${release.serviceId}/series/${release.seriesId}`
            : undefined,
      }),
    );
  }

  return events;
}

function buildRecentlyAddedEvents(
  items: {
    id: string;
    title: string;
    type: string;
    addedDate: string;
    posterUrl?: string;
    serviceName: string;
    serviceId: string;
  }[],
): TimelineEvent[] {
  return items.map((item) =>
    makeEvent({
      id: `recent-${item.id}`,
      type: item.type === "series" ? "new_show_added" : "new_movie_added",
      title: `${item.title} added`,
      subtitle: `via ${item.serviceName}`,
      timestamp: new Date(item.addedDate).getTime(),
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      serviceType: item.type === "series" ? "sonarr" : "radarr",
      posterUrl: item.posterUrl,
    }),
  );
}

function groupEventsByDay(events: TimelineEvent[]): TimelineDay[] {
  const dayMap = new Map<string, TimelineEvent[]>();

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);

  for (const event of sorted) {
    const date = new Date(event.timestamp);
    const key = date.toISOString().split("T")[0] ?? "unknown";

    if (!dayMap.has(key)) {
      dayMap.set(key, []);
    }
    dayMap.get(key)!.push(event);
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0] ?? "";
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0] ?? "";

  const days: TimelineDay[] = [];
  for (const [dateKey, dayEvents] of dayMap) {
    let label: string;
    if (dateKey === todayStr) {
      label = "Today";
    } else if (dateKey === yesterdayStr) {
      label = "Yesterday";
    } else {
      label = new Date(dateKey).toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    }

    days.push({ date: dateKey, label, events: dayEvents });
  }

  return days;
}

export const useTimelineEvents = (filter?: TimelineFilter) => {
  const sonarrConnectors = useConnectorsStore(
    selectConnectorsByType("sonarr"),
  ) as SonarrConnector[];
  const radarrConnectors = useConnectorsStore(
    selectConnectorsByType("radarr"),
  ) as RadarrConnector[];
  const jellyseerrConnectors = useConnectorsStore(
    selectConnectorsByType("jellyseerr"),
  ) as JellyseerrConnector[];
  const qbittorrentConnectors = useConnectorsStore(
    selectConnectorsByType("qbittorrent"),
  );
  const transmissionConnectors = useConnectorsStore(
    selectConnectorsByType("transmission"),
  );
  const delugeConnectors = useConnectorsStore(selectConnectorsByType("deluge"));
  const sabnzbdConnectors = useConnectorsStore(
    selectConnectorsByType("sabnzbd"),
  );
  const bazarrConnectors = useConnectorsStore(
    selectConnectorsByType("bazarr"),
  ) as BazarrConnector[];
  const lidarrConnectors = useConnectorsStore(
    selectConnectorsByType("lidarr"),
  ) as LidarrConnector[];
  const { recentlyAdded } = useRecentlyAdded();
  const { services, isLoading: healthLoading } = useServicesHealth();
  const { releases } = useCalendar();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [queryKeys.activity.base, "timeline"],
    queryFn: async () => {
      const manager = ConnectorManager.getInstance();
      await manager.loadSavedServices();

      const torrentConnectors = [
        ...qbittorrentConnectors,
        ...transmissionConnectors,
        ...delugeConnectors,
        ...sabnzbdConnectors,
      ];

      const [
        sonarrHistory,
        radarrHistory,
        sonarrQueue,
        radarrQueue,
        jellyseerrRequests,
        torrentEvents,
        bazarrEvents,
        lidarrEvents,
        diskEvents,
      ] = await Promise.all([
        fetchSonarrHistory(sonarrConnectors),
        fetchRadarrHistory(radarrConnectors),
        fetchSonarrQueue(sonarrConnectors),
        fetchRadarrQueue(radarrConnectors),
        fetchJellyseerrRequests(jellyseerrConnectors),
        fetchTorrentClientEvents(torrentConnectors),
        fetchBazarrEvents(bazarrConnectors),
        fetchLidarrEvents(lidarrConnectors),
        fetchRootFolderEvents(
          sonarrConnectors,
          radarrConnectors,
          lidarrConnectors,
        ),
      ]);

      return [
        ...sonarrHistory,
        ...radarrHistory,
        ...sonarrQueue,
        ...radarrQueue,
        ...jellyseerrRequests,
        ...torrentEvents,
        ...bazarrEvents,
        ...lidarrEvents,
        ...diskEvents,
      ];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const allEvents = useMemo(() => {
    const queryEvents = data ?? [];
    const healthEvents = buildServiceHealthEvents(services);
    const upcomingEvents = buildUpcomingEvents(releases);
    const recentEvents = buildRecentlyAddedEvents(recentlyAdded.items);

    const combined = [
      ...queryEvents,
      ...healthEvents,
      ...upcomingEvents,
      ...recentEvents,
    ];

    if (!filter) return combined;

    return combined.filter((event) => {
      if (
        filter.categories.length > 0 &&
        !filter.categories.includes(event.category)
      ) {
        return false;
      }
      if (
        filter.serviceIds.length > 0 &&
        !filter.serviceIds.includes(event.serviceId)
      ) {
        return false;
      }
      return true;
    });
  }, [data, services, releases, recentlyAdded.items, filter]);

  const days = useMemo(() => groupEventsByDay(allEvents), [allEvents]);

  const stats = useMemo(() => {
    const downloading = allEvents.filter(
      (e) => e.type === "download_progress" || e.type === "torrent_started",
    ).length;
    const queued = allEvents.filter(
      (e) => e.type === "queue_pending" || e.type === "torrent_paused",
    ).length;
    const completed = allEvents.filter(
      (e) => e.type === "download_completed" || e.type === "torrent_completed",
    ).length;
    const failed = allEvents.filter(
      (e) => e.type === "download_failed" || e.type === "torrent_failed",
    ).length;
    const upcoming = allEvents.filter(
      (e) => e.type === "upcoming_release",
    ).length;
    const offline = allEvents.filter(
      (e) => e.type === "service_offline",
    ).length;
    const pendingRequests = allEvents.filter(
      (e) => e.type === "request_pending",
    ).length;
    const subtitles = allEvents.filter(
      (e) => e.type === "subtitle_downloaded" || e.type === "subtitle_missing",
    ).length;
    const lowDisk = allEvents.filter((e) => e.type === "disk_space_low").length;

    return {
      downloading,
      queued,
      completed,
      failed,
      upcoming,
      offline,
      pendingRequests,
      subtitles,
      lowDisk,
    };
  }, [allEvents]);

  return {
    events: allEvents,
    days,
    stats,
    isLoading: isLoading || healthLoading,
    isFetching,
    refetch,
  };
};
