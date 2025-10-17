import { logger } from "@/services/logger/LoggerService";
import {
  selectDownloadNotificationsEnabled,
  selectFailedDownloadNotificationsEnabled,
  selectNotificationsEnabled,
  selectRequestNotificationsEnabled,
  selectServiceHealthNotificationsEnabled,
  selectCriticalHealthAlertsBypassQuietHours,
  useSettingsStore,
} from "@/store/settingsStore";
import {
  NOTIFICATION_CATEGORIES,
  type DownloadNotificationPayload,
  type FailedDownloadNotificationPayload,
  type RequestNotificationPayload,
  type ServiceHealthNotificationPayload,
} from "@/models/notification.types";
import { formatBytes } from "@/utils/torrent.utils";
import { quietHoursService } from "@/services/notifications/QuietHoursService";

const COMPLETED_CATEGORY = NOTIFICATION_CATEGORIES.downloads;
const FAILURE_CATEGORY = NOTIFICATION_CATEGORIES.failures;
const REQUEST_CATEGORY = NOTIFICATION_CATEGORIES.requests;
const SERVICE_CATEGORY = NOTIFICATION_CATEGORIES.serviceHealth;

class NotificationEventService {
  private static instance: NotificationEventService | null = null;

  static getInstance(): NotificationEventService {
    if (!NotificationEventService.instance) {
      NotificationEventService.instance = new NotificationEventService();
    }

    return NotificationEventService.instance;
  }

  async notifyDownloadCompleted(
    payload: DownloadNotificationPayload,
  ): Promise<void> {
    const state = useSettingsStore.getState();
    if (
      !selectNotificationsEnabled(state) ||
      !selectDownloadNotificationsEnabled(state)
    ) {
      return;
    }

    const sizeLabel = formatBytes(payload.torrent.size);

    const message = {
      title: `Download complete • ${payload.serviceName}`,
      body: `${payload.torrent.name} (${sizeLabel}) is ready to enjoy.`,
      category: COMPLETED_CATEGORY,
      data: {
        serviceId: payload.serviceId,
        torrentHash: payload.torrent.hash,
      },
    } as const;

    await quietHoursService.deliverNotification(
      COMPLETED_CATEGORY,
      message,
      `${payload.torrent.name} • ${sizeLabel}`,
    );
  }

  async notifyDownloadFailed(
    payload: FailedDownloadNotificationPayload,
  ): Promise<void> {
    const state = useSettingsStore.getState();
    if (
      !selectNotificationsEnabled(state) ||
      !selectFailedDownloadNotificationsEnabled(state)
    ) {
      return;
    }

    const reason = payload.reason ?? payload.torrent.state ?? "Unknown reason";

    const message = {
      title: `Download failed • ${payload.serviceName}`,
      body: `${payload.torrent.name} did not finish (${reason}).`,
      category: FAILURE_CATEGORY,
      data: {
        serviceId: payload.serviceId,
        torrentHash: payload.torrent.hash,
      },
    } as const;

    await quietHoursService.deliverNotification(
      FAILURE_CATEGORY,
      message,
      `${payload.torrent.name} → ${reason}`,
    );
  }

  async notifyNewRequest(payload: RequestNotificationPayload): Promise<void> {
    const state = useSettingsStore.getState();
    if (
      !selectNotificationsEnabled(state) ||
      !selectRequestNotificationsEnabled(state)
    ) {
      return;
    }

    const toRecord = (v: unknown): Record<string, unknown> | null =>
      v && typeof v === "object" ? (v as Record<string, unknown>) : null;
    const reqRecord = toRecord(payload.request) ?? {};
    const requestedByRecord = toRecord(reqRecord.requestedBy) ?? {};
    const requestedBy =
      (typeof requestedByRecord.username === "string" &&
        requestedByRecord.username) ??
      (typeof requestedByRecord.email === "string" &&
        requestedByRecord.email) ??
      "Someone";

    // Media title may be nested under media.mediaInfo or be present on the top-level
    const mediaObj = toRecord(reqRecord.media) ?? {};
    const mediaInfoObj = toRecord(mediaObj.mediaInfo) ?? {};
    const mediaTitle =
      (typeof mediaObj.title === "string" && mediaObj.title) ??
      (typeof mediaObj.name === "string" && mediaObj.name) ??
      (typeof mediaInfoObj.title === "string" && mediaInfoObj.title) ??
      "A new request";
    const mediaTypeLabel =
      typeof reqRecord.mediaType === "string" && reqRecord.mediaType === "movie"
        ? "Movie"
        : "Series";

    const message = {
      title: `${mediaTypeLabel} request • ${payload.serviceName}`,
      body: `${requestedBy} requested ${mediaTitle}.`,
      category: REQUEST_CATEGORY,
      data: {
        serviceId: payload.serviceId,
        requestId: (reqRecord.id as number) ?? undefined,
        mediaType:
          typeof reqRecord.mediaType === "string"
            ? reqRecord.mediaType
            : undefined,
      },
    } as const;

    await quietHoursService.deliverNotification(
      REQUEST_CATEGORY,
      message,
      `${requestedBy} → ${mediaTitle}`,
    );
  }

  async notifyServiceStatusChange(
    payload: ServiceHealthNotificationPayload,
  ): Promise<void> {
    const state = useSettingsStore.getState();
    if (
      !selectNotificationsEnabled(state) ||
      !selectServiceHealthNotificationsEnabled(state)
    ) {
      return;
    }

    const status = payload.health.status;
    const isOffline = status === "offline";
    const isDegraded = status === "degraded";
    const wasOffline = payload.previousStatus === "offline";

    if (status === payload.previousStatus) {
      return;
    }

    if (isOffline || isDegraded) {
      const label = isOffline ? "offline" : "degraded";
      const message = payload.health.message ?? "Check service connectivity.";

      const notification = {
        title: `${payload.serviceName} ${label}`,
        body: message,
        category: SERVICE_CATEGORY,
        data: {
          serviceId: payload.serviceId,
          status,
        },
      } as const;

      const bypassQuietHours =
        selectCriticalHealthAlertsBypassQuietHours(state) &&
        status === "offline";

      await quietHoursService.deliverNotification(
        SERVICE_CATEGORY,
        notification,
        `${payload.serviceName}: ${label}`,
        { bypassQuietHours },
      );
      return;
    }

    if (status === "healthy" && wasOffline) {
      const notification = {
        title: `${payload.serviceName} restored`,
        body: "Service connectivity has been restored.",
        category: SERVICE_CATEGORY,
        data: {
          serviceId: payload.serviceId,
          status,
        },
      } as const;

      await quietHoursService.deliverNotification(
        SERVICE_CATEGORY,
        notification,
        `${payload.serviceName}: restored`,
      );
      return;
    }
  }

  async notifyInitializationSkipped(reason: string): Promise<void> {
    await logger.warn("Notification event skipped.", {
      location: "NotificationEventService.notifyInitializationSkipped",
      reason,
    });
  }
}

export const notificationEventService = NotificationEventService.getInstance();
