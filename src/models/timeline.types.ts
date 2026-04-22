import type { ServiceType } from "@/models/service.types";

export type TimelineEventType =
  | "download_started"
  | "download_completed"
  | "download_failed"
  | "download_progress"
  | "new_show_added"
  | "new_movie_added"
  | "episode_grabbed"
  | "episode_imported"
  | "movie_grabbed"
  | "movie_imported"
  | "queue_pending"
  | "upcoming_release"
  | "service_online"
  | "service_offline"
  | "service_degraded"
  | "update_available"
  | "health_warning"
  | "health_error"
  | "request_pending"
  | "request_approved"
  | "request_declined"
  | "torrent_completed"
  | "torrent_started"
  | "torrent_failed"
  | "torrent_paused"
  | "subtitle_downloaded"
  | "subtitle_missing"
  | "album_grabbed"
  | "album_imported"
  | "artist_added"
  | "playback_started"
  | "playback_stopped"
  | "disk_space_low";

export type TimelineEventCategory =
  | "downloads"
  | "library"
  | "schedule"
  | "system"
  | "requests";

export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly category: TimelineEventCategory;
  readonly title: string;
  readonly subtitle?: string;
  readonly description?: string;
  readonly timestamp: number;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly serviceType: ServiceType;
  readonly icon: string;
  readonly color: string;
  readonly progress?: number;
  readonly posterUrl?: string;
  readonly contentId?: number;
  readonly route?: string;
}

export interface TimelineDay {
  readonly date: string;
  readonly label: string;
  readonly events: TimelineEvent[];
}

export interface TimelineFilter {
  categories: TimelineEventCategory[];
  serviceIds: string[];
}
