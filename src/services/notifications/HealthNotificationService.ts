import type { HealthMessage } from "@/models/logger.types";
import type { NotificationMessage } from "@/models/notification.types";
import { logger } from "@/services/logger/LoggerService";
import { quietHoursService } from "@/services/notifications/QuietHoursService";
import { storageAdapter } from "@/services/storage/StorageAdapter";
import {
  selectCriticalHealthAlertsBypassQuietHours,
  selectNotificationsEnabled,
  selectServiceHealthNotificationsEnabled,
  useSettingsStore,
} from "@/store/settingsStore";

const STORAGE_KEY = "HealthNotificationService:state";
const SERVICE_CATEGORY = "serviceHealth" as const;

/**
 * Tracks the last notification state for a service to detect changes
 */
interface ServiceNotificationState {
  serviceId: string;
  serviceName: string;
  lastStatus: "healthy" | "degraded" | "offline" | "unknown";
  lastCriticalMessageIds: string[];
  lastNotificationTimestamp: number;
}

/**
 * Persisted state for the health notification service
 */
interface HealthNotificationServiceState {
  services: Record<string, ServiceNotificationState>;
}

/**
 * Service for managing health-related notifications
 *
 * Responsibilities:
 * - Detect critical health messages and trigger notifications
 * - Group notifications by service to avoid spam
 * - Send resolution notifications when issues are resolved
 * - Integrate with quiet hours settings
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5
 */
export class HealthNotificationService {
  private static instance: HealthNotificationService | null = null;
  private isInitialized = false;
  private state: HealthNotificationServiceState = { services: {} };

  private constructor() {}

  /**
   * Get singleton instance of HealthNotificationService
   */
  static getInstance(): HealthNotificationService {
    if (!HealthNotificationService.instance) {
      HealthNotificationService.instance = new HealthNotificationService();
    }
    return HealthNotificationService.instance;
  }

  /**
   * Initialize the service and load persisted state
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.loadState();
    this.isInitialized = true;

    void logger.debug("HealthNotificationService initialized", {
      location: "HealthNotificationService.initialize",
      trackedServices: Object.keys(this.state.services).length,
    });
  }

  /**
   * Process health messages for a service and send notifications if needed
   *
   * @param serviceId - ID of the service
   * @param serviceName - Name of the service
   * @param currentStatus - Current health status
   * @param messages - Current health messages
   */
  async processHealthUpdate(
    serviceId: string,
    serviceName: string,
    currentStatus: "healthy" | "degraded" | "offline" | "unknown",
    messages: HealthMessage[],
  ): Promise<void> {
    await this.initialize();

    const settings = useSettingsStore.getState();
    if (
      !selectNotificationsEnabled(settings) ||
      !selectServiceHealthNotificationsEnabled(settings)
    ) {
      return;
    }

    const previousState = this.state.services[serviceId];
    const criticalMessages = this.detectCriticalMessages(messages);

    // Detect status changes
    const statusChanged =
      previousState !== undefined && previousState.lastStatus !== currentStatus;
    const wasOffline = previousState?.lastStatus === "offline";
    const isNowHealthy = currentStatus === "healthy";
    const isNowOfflineOrDegraded =
      currentStatus === "offline" || currentStatus === "degraded";

    // Send resolution notification if service recovered from offline
    if (statusChanged && wasOffline && isNowHealthy) {
      await this.sendResolutionNotification(serviceId, serviceName);
    }

    // Send critical issue notifications
    if (isNowOfflineOrDegraded) {
      const newCriticalMessages = this.getNewCriticalMessages(
        criticalMessages,
        previousState?.lastCriticalMessageIds ?? [],
      );

      if (newCriticalMessages.length > 0) {
        await this.sendCriticalHealthNotification(
          serviceId,
          serviceName,
          currentStatus,
          newCriticalMessages,
        );
      }
    }

    // Update state
    this.state.services[serviceId] = {
      serviceId,
      serviceName,
      lastStatus: currentStatus,
      lastCriticalMessageIds: criticalMessages.map((m) => m.id),
      lastNotificationTimestamp: Date.now(),
    };

    await this.saveState();
  }

  /**
   * Detect critical health messages (error or critical severity)
   * Requirement 8.1: Critical health message detection
   */
  private detectCriticalMessages(messages: HealthMessage[]): HealthMessage[] {
    return messages.filter(
      (msg) => msg.severity === "critical" || msg.severity === "error",
    );
  }

  /**
   * Get new critical messages that haven't been notified yet
   * Requirement 8.2: Notification grouping by service
   */
  private getNewCriticalMessages(
    currentMessages: HealthMessage[],
    previousMessageIds: string[],
  ): HealthMessage[] {
    return currentMessages.filter(
      (msg) => !previousMessageIds.includes(msg.id),
    );
  }

  /**
   * Send notification for critical health issues
   * Requirements 8.1, 8.2, 8.5
   */
  private async sendCriticalHealthNotification(
    serviceId: string,
    serviceName: string,
    status: "offline" | "degraded" | "unknown",
    messages: HealthMessage[],
  ): Promise<void> {
    const settings = useSettingsStore.getState();
    const bypassQuietHours =
      selectCriticalHealthAlertsBypassQuietHours(settings) &&
      status === "offline";

    // Group messages by service (already grouped since we're processing one service)
    const messageCount = messages.length;
    const statusLabel = status === "offline" ? "offline" : "degraded";

    // Build notification body
    let body: string;
    if (messageCount === 0) {
      body = `Service is ${statusLabel}`;
    } else if (messageCount === 1) {
      body = messages[0]!.message;
    } else {
      // Show first message and indicate there are more
      body = `${messages[0]!.message} (+${messageCount - 1} more issue${messageCount > 2 ? "s" : ""})`;
    }

    const notification: NotificationMessage = {
      title: `${serviceName} ${statusLabel}`,
      body,
      category: SERVICE_CATEGORY,
      data: {
        serviceId,
        status,
        messageCount,
        messageIds: messages.map((m) => m.id),
      },
    };

    const summary = `${serviceName}: ${statusLabel} (${messageCount} issue${messageCount > 1 ? "s" : ""})`;

    await quietHoursService.deliverNotification(
      SERVICE_CATEGORY,
      notification,
      summary,
      { bypassQuietHours },
    );

    void logger.info("Critical health notification sent", {
      location: "HealthNotificationService.sendCriticalHealthNotification",
      serviceId,
      serviceName,
      status,
      messageCount,
      bypassQuietHours,
    });
  }

  /**
   * Send notification when a service health issue is resolved
   * Requirement 8.3: Resolution notification logic
   */
  private async sendResolutionNotification(
    serviceId: string,
    serviceName: string,
  ): Promise<void> {
    const notification: NotificationMessage = {
      title: `${serviceName} restored`,
      body: "Service connectivity has been restored.",
      category: SERVICE_CATEGORY,
      data: {
        serviceId,
        status: "healthy",
        isResolution: true,
      },
    };

    const summary = `${serviceName}: restored`;

    await quietHoursService.deliverNotification(
      SERVICE_CATEGORY,
      notification,
      summary,
    );

    void logger.info("Resolution notification sent", {
      location: "HealthNotificationService.sendResolutionNotification",
      serviceId,
      serviceName,
    });
  }

  /**
   * Load persisted state from storage
   */
  private async loadState(): Promise<void> {
    try {
      const raw = await storageAdapter.getItem(STORAGE_KEY);
      if (!raw) {
        this.state = { services: {} };
        return;
      }

      const parsed = JSON.parse(raw) as Partial<HealthNotificationServiceState>;
      this.state = {
        services: parsed.services || {},
      };

      void logger.debug("Health notification state loaded", {
        location: "HealthNotificationService.loadState",
        serviceCount: Object.keys(this.state.services).length,
      });
    } catch (error) {
      this.state = { services: {} };
      void logger.warn("Failed to load health notification state", {
        location: "HealthNotificationService.loadState",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    try {
      await storageAdapter.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (error) {
      void logger.warn("Failed to save health notification state", {
        location: "HealthNotificationService.saveState",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Clear all tracked state (useful for testing or reset)
   */
  async clearState(): Promise<void> {
    this.state = { services: {} };
    await this.saveState();

    void logger.info("Health notification state cleared", {
      location: "HealthNotificationService.clearState",
    });
  }

  /**
   * Get the current state for a service (useful for debugging)
   */
  getServiceState(serviceId: string): ServiceNotificationState | undefined {
    return this.state.services[serviceId];
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this.isInitialized = false;
    this.state = { services: {} };

    void logger.debug("HealthNotificationService disposed", {
      location: "HealthNotificationService.dispose",
    });
  }
}

export const healthNotificationService =
  HealthNotificationService.getInstance();
