import type { SystemHealth } from "@/connectors/base/IConnector";
import type { components } from "@/connectors/client-schemas/jellyseerr-openapi";
import type { Torrent } from "@/models/torrent.types";
type JellyseerrRequest = components["schemas"]["MediaRequest"];

export type NotificationCategory =
  | "downloads"
  | "requests"
  | "serviceHealth"
  | "failures";

export const NOTIFICATION_CATEGORIES: Record<
  NotificationCategory,
  NotificationCategory
> = {
  downloads: "downloads",
  requests: "requests",
  serviceHealth: "serviceHealth",
  failures: "failures",
};

export type QuietHoursDay =
  | "sun"
  | "mon"
  | "tue"
  | "wed"
  | "thu"
  | "fri"
  | "sat";

export type QuietHoursPreset =
  | "weeknights"
  | "weekends"
  | "everyday"
  | "custom";

export interface QuietHoursConfig {
  readonly enabled: boolean;
  readonly start: string; // HH:mm in 24h format
  readonly end: string; // HH:mm in 24h format
  readonly days: QuietHoursDay[];
  readonly preset: QuietHoursPreset;
}

export interface NotificationMessage {
  readonly title: string;
  readonly body: string;
  readonly category: NotificationCategory;
  readonly data?: Record<string, unknown>;
}

export interface DownloadNotificationPayload {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly torrent: Torrent;
}

export interface FailedDownloadNotificationPayload
  extends DownloadNotificationPayload {
  readonly reason?: string;
}

export interface RequestNotificationPayload {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly request: JellyseerrRequest;
}

export interface ServiceHealthNotificationPayload {
  readonly serviceId: string;
  readonly serviceName: string;
  readonly health: SystemHealth;
  readonly previousStatus?: SystemHealth["status"];
}
