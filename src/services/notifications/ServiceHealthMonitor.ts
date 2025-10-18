import { ConnectorManager } from "@/connectors/manager/ConnectorManager";
import type { SystemHealth } from "@/connectors/base/IConnector";
import { notificationEventService } from "@/services/notifications/NotificationEventService";
import { logger } from "@/services/logger/LoggerService";
import { useSettingsStore } from "@/store/settingsStore";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class ServiceHealthMonitor {
  private static instance: ServiceHealthMonitor | null = null;

  private timer: ReturnType<typeof setInterval> | null = null;

  private readonly lastStatuses = new Map<string, SystemHealth["status"]>();

  private isChecking = false;

  private hasBootstrapped = false;

  static getInstance(): ServiceHealthMonitor {
    if (!ServiceHealthMonitor.instance) {
      ServiceHealthMonitor.instance = new ServiceHealthMonitor();
    }

    return ServiceHealthMonitor.instance;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    void this.runCheck();

    this.timer = setInterval(() => {
      void this.runCheck();
    }, DEFAULT_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async runCheck(): Promise<void> {
    if (this.isChecking) {
      return;
    }

    const { notificationsEnabled, serviceHealthNotificationsEnabled } =
      useSettingsStore.getState();
    if (!notificationsEnabled || !serviceHealthNotificationsEnabled) {
      return;
    }

    this.isChecking = true;

    try {
      const manager = ConnectorManager.getInstance();

      if (!this.hasBootstrapped) {
        try {
          await manager.loadSavedServices();
          this.hasBootstrapped = true;
        } catch (error) {
          await logger.error(
            "Failed to bootstrap connectors for health monitoring.",
            {
              location: "ServiceHealthMonitor.runCheck",
              error: error instanceof Error ? error.message : String(error),
            },
          );
          return;
        }
      }

      const connectors = manager.getAllConnectors();
      if (connectors.length === 0) {
        return;
      }

      await Promise.all(
        connectors.map(async (connector) => {
          try {
            const health = await connector.getHealth();
            const previousStatus = this.lastStatuses.get(connector.config.id);

            await notificationEventService.notifyServiceStatusChange({
              serviceId: connector.config.id,
              serviceName: connector.config.name,
              health,
              previousStatus,
            });

            this.lastStatuses.set(connector.config.id, health.status);
          } catch (error) {
            await logger.error("Service health check failed.", {
              location: "ServiceHealthMonitor.runCheck",
              serviceId: connector.config.id,
              serviceType: connector.config.type,
              error: error instanceof Error ? error.message : String(error),
            });

            const previousStatus = this.lastStatuses.get(connector.config.id);
            await notificationEventService.notifyServiceStatusChange({
              serviceId: connector.config.id,
              serviceName: connector.config.name,
              health: {
                status: "offline",
                message: "Service health check failed.",
                lastChecked: new Date(),
              },
              previousStatus,
            });

            this.lastStatuses.set(connector.config.id, "offline");
          }
        }),
      );
    } finally {
      this.isChecking = false;
    }
  }
}

export const serviceHealthMonitor = ServiceHealthMonitor.getInstance();
