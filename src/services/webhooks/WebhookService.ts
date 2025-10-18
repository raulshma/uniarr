import AsyncStorage from "@react-native-async-storage/async-storage";

import { logger } from "@/services/logger/LoggerService";

export type WebhookEvent = {
  id: string;
  eventType: string;
  source: string;
  timestamp: number;
  data: any;
  processed: boolean;
  createdAt: Date;
};

export type WebhookNotification = {
  id: string;
  title: string;
  body: string;
  data: any;
  timestamp: number;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
  actions?: {
    id: string;
    title: string;
    action: () => void;
  }[];
};

export type WebhookConfig = {
  enabled: boolean;
  endpoint: string;
  secret?: string;
  events: string[];
  retryAttempts: number;
  timeout: number;
};

class WebhookService {
  private static instance: WebhookService | null = null;
  private readonly STORAGE_KEY = "WebhookService:config";
  private readonly EVENTS_KEY = "WebhookService:events";
  private readonly NOTIFICATIONS_KEY = "WebhookService:notifications";

  private config: WebhookConfig = {
    enabled: false,
    endpoint: "",
    events: [],
    retryAttempts: 3,
    timeout: 10000,
  };

  private eventQueue: WebhookEvent[] = [];
  private notifications: WebhookNotification[] = [];
  private isProcessing = false;
  private listeners: Map<string, (event: WebhookEvent) => void> = new Map();

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  async initialize(): Promise<void> {
    try {
      await this.loadConfig();
      await this.loadEvents();
      await this.loadNotifications();

      if (this.config.enabled) {
        logger.info("[WebhookService] Initialized with webhooks enabled");
        this.startProcessing();
      }
    } catch (error) {
      logger.error("[WebhookService] Failed to initialize", { error });
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error("[WebhookService] Failed to load config", { error });
    }
  }

  private async loadEvents(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.EVENTS_KEY);
      if (stored) {
        this.eventQueue = JSON.parse(stored).map((e: any) => ({
          ...e,
          createdAt: new Date(e.createdAt),
        }));
      }
    } catch (error) {
      logger.error("[WebhookService] Failed to load events", { error });
    }
  }

  private async loadNotifications(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.NOTIFICATIONS_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      }
    } catch (error) {
      logger.error("[WebhookService] Failed to load notifications", { error });
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      logger.error("[WebhookService] Failed to save config", { error });
    }
  }

  private async saveEvents(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.EVENTS_KEY,
        JSON.stringify(this.eventQueue),
      );
    } catch (error) {
      logger.error("[WebhookService] Failed to save events", { error });
    }
  }

  private async saveNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        this.NOTIFICATIONS_KEY,
        JSON.stringify(this.notifications),
      );
    } catch (error) {
      logger.error("[WebhookService] Failed to save notifications", { error });
    }
  }

  // Public API methods

  async updateConfig(updates: Partial<WebhookConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();

    if (this.config.enabled && !this.isProcessing) {
      this.startProcessing();
    } else if (!this.config.enabled && this.isProcessing) {
      this.stopProcessing();
    }
  }

  getConfig(): WebhookConfig {
    return { ...this.config };
  }

  async processWebhook(payload: any, signature?: string): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      // Verify signature if provided
      if (signature && this.config.secret) {
        const isValid = await this.verifySignature(payload, signature);
        if (!isValid) {
          logger.warn("[WebhookService] Invalid webhook signature");
          return false;
        }
      }

      // Create event
      const event: WebhookEvent = {
        id: this.generateId(),
        eventType: payload.eventType || payload.event || "unknown",
        source: payload.source || "unknown",
        timestamp: Date.now(),
        data: payload,
        processed: false,
        createdAt: new Date(),
      };

      // Add to queue
      this.eventQueue.push(event);
      await this.saveEvents();

      // Trigger notification
      await this.createNotificationFromEvent(event);

      // Notify listeners
      this.notifyListeners(event);

      logger.info("[WebhookService] Webhook processed", {
        eventType: event.eventType,
        source: event.source,
      });

      return true;
    } catch (error) {
      logger.error("[WebhookService] Failed to process webhook", { error });
      return false;
    }
  }

  async getNotifications(limit = 50): Promise<WebhookNotification[]> {
    return this.notifications
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(
      (n) => n.id === notificationId,
    );
    if (notification && !notification.read) {
      notification.read = true;
      await this.saveNotifications();
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    this.notifications.forEach((n) => (n.read = true));
    await this.saveNotifications();
  }

  async clearNotifications(): Promise<void> {
    this.notifications = [];
    await this.saveNotifications();
  }

  async getUnreadCount(): Promise<number> {
    return this.notifications.filter((n) => !n.read).length;
  }

  // Event listeners
  addEventListener(
    eventType: string,
    callback: (event: WebhookEvent) => void,
  ): string {
    const listenerId = this.generateId();
    this.listeners.set(listenerId, callback);
    return listenerId;
  }

  removeEventListener(listenerId: string): void {
    this.listeners.delete(listenerId);
  }

  // Private methods

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private async verifySignature(
    payload: any,
    signature: string,
  ): Promise<boolean> {
    // Implement signature verification based on your webhook provider
    // This is a placeholder implementation
    // Note: In a real implementation, you'd use a proper crypto library
    // For now, this is a basic placeholder
    return true; // Placeholder - implement proper verification
  }

  private async createNotificationFromEvent(
    event: WebhookEvent,
  ): Promise<void> {
    const notification = await this.createNotification(event);
    if (notification) {
      this.notifications.unshift(notification);

      // Keep only last 100 notifications
      if (this.notifications.length > 100) {
        this.notifications = this.notifications.slice(0, 100);
      }

      await this.saveNotifications();
    }
  }

  private async createNotification(
    event: WebhookEvent,
  ): Promise<WebhookNotification | null> {
    switch (event.eventType) {
      case "Download":
        return {
          id: this.generateId(),
          title: "Download Started",
          body: `${event.data.title || "Item"} started downloading`,
          data: event.data,
          timestamp: event.timestamp,
          read: false,
          type: "info",
        };

      case "DownloadComplete":
        return {
          id: this.generateId(),
          title: "Download Complete",
          body: `${event.data.title || "Item"} has finished downloading`,
          data: event.data,
          timestamp: event.timestamp,
          read: false,
          type: "success",
        };

      case "SeriesAdd":
        return {
          id: this.generateId(),
          title: "Series Added",
          body: `${event.data.title || "Series"} has been added to your library`,
          data: event.data,
          timestamp: event.timestamp,
          read: false,
          type: "success",
        };

      case "MovieAdd":
        return {
          id: this.generateId(),
          title: "Movie Added",
          body: `${event.data.title || "Movie"} has been added to your library`,
          data: event.data,
          timestamp: event.timestamp,
          read: false,
          type: "success",
        };

      case "Test":
        return {
          id: this.generateId(),
          title: "Test Notification",
          body: "Webhook test successful",
          data: event.data,
          timestamp: event.timestamp,
          read: false,
          type: "info",
        };

      default:
        return null;
    }
  }

  private notifyListeners(event: WebhookEvent): void {
    this.listeners.forEach((callback, listenerId) => {
      try {
        callback(event);
      } catch (error) {
        logger.error("[WebhookService] Listener error", { listenerId, error });
      }
    });
  }

  private startProcessing(): void {
    this.isProcessing = true;
    logger.info("[WebhookService] Started processing webhooks");
  }

  private stopProcessing(): void {
    this.isProcessing = false;
    logger.info("[WebhookService] Stopped processing webhooks");
  }

  async clearEventHistory(): Promise<void> {
    this.eventQueue = [];
    await this.saveEvents();
  }

  getEventStats() {
    return {
      totalEvents: this.eventQueue.length,
      processedEvents: this.eventQueue.filter((e) => e.processed).length,
      pendingEvents: this.eventQueue.filter((e) => !e.processed).length,
      notifications: this.notifications.length,
      unreadNotifications: this.notifications.filter((n) => !n.read).length,
    };
  }
}

export const webhookService = WebhookService.getInstance();
export { WebhookService };
