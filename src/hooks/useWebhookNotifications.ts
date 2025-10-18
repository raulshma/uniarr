import { useEffect, useState, useCallback } from "react";
import { Alert, Platform } from "react-native";

import {
  webhookService,
  type WebhookNotification,
  type WebhookConfig,
} from "@/services/webhooks/WebhookService";
import { logger } from "@/services/logger/LoggerService";

export interface UseWebhookNotificationsOptions {
  /**
   * Auto-load notifications on mount
   * @default true
   */
  autoLoad?: boolean;
  /**
   * Limit number of notifications to load
   * @default 50
   */
  limit?: number;
  /**
   * Show alert for new notifications
   * @default false
   */
  showAlerts?: boolean;
}

/**
 * Hook for managing webhook notifications
 * Provides real-time updates and notification handling
 */
export const useWebhookNotifications = (
  options: UseWebhookNotificationsOptions = {},
) => {
  const { autoLoad = true, limit = 50, showAlerts = false } = options;

  const [notifications, setNotifications] = useState<WebhookNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<WebhookConfig | null>(null);
  const [listenerId, setListenerId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const loadedNotifications = await webhookService.getNotifications(limit);
      const unreadCount = await webhookService.getUnreadCount();
      setNotifications(loadedNotifications);
      setUnreadCount(unreadCount);
    } catch (error) {
      logger.error("Failed to load webhook notifications", { error });
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const loadConfig = useCallback(async () => {
    try {
      const webhookConfig = webhookService.getConfig();
      setConfig(webhookConfig);
    } catch (error) {
      logger.error("Failed to load webhook config", { error });
    }
  }, []);
  // Load initial data
  useEffect(() => {
    if (autoLoad) {
      loadNotifications();
      loadConfig();
    }

    return () => {
      if (listenerId) {
        webhookService.removeEventListener(listenerId);
      }
    };
  }, [autoLoad, listenerId, loadConfig, loadNotifications]);

  // Set up event listener for real-time updates
  useEffect(() => {
    const setupListener = async () => {
      try {
        const id = webhookService.addEventListener(
          "new-notification",
          async (event) => {
            // Reload notifications when new webhook is processed
            await loadNotifications();

            if (showAlerts && Platform.OS !== "web") {
              // Show simple alert for new webhook events
              Alert.alert(
                "New Webhook Event",
                `${event.eventType} event received from ${event.source}`,
                [{ text: "OK" }],
              );
            }
          },
        );
        setListenerId(id);
      } catch (error) {
        logger.error("Failed to setup webhook listener", { error });
      }
    };

    setupListener();
  }, [loadNotifications, showAlerts]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await webhookService.markNotificationRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      logger.error("Failed to mark notification as read", { error });
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await webhookService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error("Failed to mark all notifications as read", { error });
    }
  }, []);

  const clearNotifications = useCallback(async () => {
    try {
      await webhookService.clearNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      logger.error("Failed to clear notifications", { error });
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const updateConfig = useCallback(async (updates: Partial<WebhookConfig>) => {
    try {
      await webhookService.updateConfig(updates);
      const newConfig = webhookService.getConfig();
      setConfig(newConfig);
    } catch (error) {
      logger.error("Failed to update webhook config", { error });
    }
  }, []);

  const testWebhook = useCallback(async () => {
    try {
      const testPayload = {
        eventType: "Test",
        source: "UniArr",
        message: "Test webhook from UniArr",
        timestamp: new Date().toISOString(),
      };

      const success = await webhookService.processWebhook(testPayload);

      if (showAlerts) {
        Alert.alert(
          success ? "Success" : "Failed",
          success
            ? "Test webhook sent successfully"
            : "Failed to send test webhook",
        );
      }

      return success;
    } catch (error) {
      logger.error("Failed to test webhook", { error });
      if (showAlerts) {
        Alert.alert("Error", "Failed to send test webhook");
      }
      return false;
    }
  }, [showAlerts]);

  const getUnreadNotifications = useCallback(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  const getNotificationsByType = useCallback(
    (type: string) => {
      return notifications.filter((n) => n.data.eventType === type);
    },
    [notifications],
  );

  return {
    // Data
    notifications,
    unreadCount,
    isLoading,
    config,

    // Actions
    markAsRead,
    markAllAsRead,
    clearNotifications,
    refreshNotifications,
    updateConfig,
    testWebhook,

    // Derived data
    unreadNotifications: getUnreadNotifications(),
    notificationsByType: (type: string) => getNotificationsByType(type),

    // Stats
    stats: {
      total: notifications.length,
      unread: unreadCount,
      byType: notifications.reduce(
        (acc, n) => {
          const type = n.data.eventType || "unknown";
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
  };
};
