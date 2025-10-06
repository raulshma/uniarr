import type { SystemHealth } from '@/connectors/base/IConnector';
import type { JellyseerrRequest } from '@/models/jellyseerr.types';
import type { Torrent } from '@/models/torrent.types';

export type NotificationCategory = 'downloads' | 'requests' | 'serviceHealth' | 'failures';

export const NOTIFICATION_CATEGORIES: Record<NotificationCategory, NotificationCategory> = {
  downloads: 'downloads',
  requests: 'requests',
  serviceHealth: 'serviceHealth',
  failures: 'failures',
};

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

export interface FailedDownloadNotificationPayload extends DownloadNotificationPayload {
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
  readonly previousStatus?: SystemHealth['status'];
}
