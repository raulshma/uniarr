import { logger } from "@/services/logger/LoggerService";
import { storageAdapter } from "@/services/storage/StorageAdapter";

export type WidgetType =
  | "service-status"
  | "download-progress"
  | "recent-activity"
  | "statistics"
  | "calendar-preview"
  | "shortcuts"
  | "bookmarks"
  | "rss-feed"
  | "subreddit"
  | "hacker-news"
  | "weather"
  | "youtube"
  | "twitch"
  | "recommendations";

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  order: number;
  size: "small" | "medium" | "large";
  config?: Record<string, any>;
  lastUpdated?: string;
}

export interface WidgetDataEntry<T = any> {
  data: T;
  timestamp: number;
  expiresAt?: number;
  configSignature?: string;
}

export interface WidgetData {
  [widgetId: string]: WidgetDataEntry;
}

class WidgetService {
  private static instance: WidgetService | null = null;
  private readonly STORAGE_KEY = "WidgetService:widgets";
  private readonly DATA_KEY = "WidgetService:data";
  private widgets: Map<string, Widget> = new Map();
  private widgetData: WidgetData = {};
  private isInitialized = false;

  static getInstance(): WidgetService {
    if (!WidgetService.instance) {
      WidgetService.instance = new WidgetService();
    }
    return WidgetService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadWidgets();
      await this.loadWidgetData();
      this.isInitialized = true;
      logger.debug("[WidgetService] Initialized");
    } catch (error) {
      logger.error("[WidgetService] Failed to initialize", { error });
    }
  }

  private async loadWidgets(): Promise<void> {
    try {
      const serialized = await storageAdapter.getItem(this.STORAGE_KEY);
      if (serialized) {
        const widgets = JSON.parse(serialized) as Widget[];
        this.widgets.clear();
        widgets.forEach((widget) => this.widgets.set(widget.id, widget));
      } else {
        // Initialize with default widgets
        await this.createDefaultWidgets();
      }
    } catch (error) {
      logger.error("[WidgetService] Failed to load widgets", { error });
      await this.createDefaultWidgets();
    }
  }

  private async loadWidgetData(): Promise<void> {
    try {
      const serialized = await storageAdapter.getItem(this.DATA_KEY);
      if (serialized) {
        this.widgetData = JSON.parse(serialized) as WidgetData;
        // Clean up expired data
        await this.cleanupExpiredData();
      }
    } catch (error) {
      logger.error("[WidgetService] Failed to load widget data", { error });
      this.widgetData = {};
    }
  }

  private async createDefaultWidgets(): Promise<void> {
    const defaultWidgets: Widget[] = [
      {
        id: "service-status",
        type: "service-status",
        title: "Service Status",
        enabled: false,
        order: 0,
        size: "medium",
        config: {
          sourceMode: "global",
          serviceIds: [],
          showOfflineOnly: false,
        },
      },
      {
        id: "shortcuts",
        type: "shortcuts",
        title: "Shortcuts",
        enabled: true,
        order: 1,
        size: "medium",
        config: {
          shortcuts: [
            {
              id: "discover",
              label: "Discover",
              icon: "compass",
              route: "/discover",
              enabled: true,
            },
            {
              id: "search",
              label: "Search",
              icon: "magnify",
              route: "/dashboard/search",
              enabled: true,
            },
            {
              id: "calendar",
              label: "Calendar",
              icon: "calendar",
              route: "/calendar",
              enabled: true,
            },
            {
              id: "recently-added",
              label: "Recently Added",
              icon: "clock-outline",
              route: "/(auth)/recently-added",
              enabled: true,
            },
            {
              id: "recommendations",
              label: "For You",
              icon: "lightbulb-on-outline",
              route: "/(auth)/(tabs)/recommendations",
              enabled: true,
            },
            {
              id: "anime",
              label: "Anime Hub",
              icon: "play-circle",
              route: "/anime-hub",
              enabled: true,
            },
          ],
        },
      },
      {
        id: "download-progress",
        type: "download-progress",
        title: "Downloads",
        enabled: false,
        order: 2,
        size: "medium",
        config: {
          includeServiceIds: [],
          includeCompleted: false,
          maxItems: 6,
        },
      },
      {
        id: "recent-activity",
        type: "recent-activity",
        title: "Recent Activity",
        enabled: false,
        order: 3,
        size: "large",
        config: {
          sourceMode: "global",
          serviceIds: [],
          limit: 10,
        },
      },
      {
        id: "statistics",
        type: "statistics",
        title: "Statistics",
        enabled: false,
        order: 4,
        size: "large",
        config: {
          filter: "all",
          sourceMode: "global",
          serviceIds: [],
        },
      },
      {
        id: "calendar-preview",
        type: "calendar-preview",
        title: "Upcoming Releases",
        enabled: false,
        order: 5,
        size: "large",
        config: {
          daysAhead: 30,
          limit: 8,
          serviceTypes: ["sonarr", "radarr"],
        },
      },
      {
        id: "bookmarks",
        type: "bookmarks",
        title: "Bookmarks",
        enabled: false,
        order: 6,
        size: "medium",
        config: {
          bookmarks: [],
        },
      },
      {
        id: "rss-feed",
        type: "rss-feed",
        title: "News Headlines",
        enabled: false,
        order: 7,
        size: "large",
        config: {
          feeds: [],
          limit: 10,
        },
      },
      {
        id: "subreddit",
        type: "subreddit",
        title: "Reddit Highlights",
        enabled: false,
        order: 8,
        size: "large",
        config: {
          subreddits: [],
          sort: "hot",
          topTimeRange: "day",
          limit: 10,
        },
      },
      {
        id: "hacker-news",
        type: "hacker-news",
        title: "Hacker News",
        enabled: false,
        order: 9,
        size: "large",
        config: {
          feedType: "topstories",
          limit: 10,
        },
      },
      {
        id: "weather",
        type: "weather",
        title: "Local Weather",
        enabled: false,
        order: 10,
        size: "medium",
        config: {
          mode: "device",
          locations: [],
          units: "metric",
          forecastDays: 3,
        },
      },
      {
        id: "youtube",
        type: "youtube",
        title: "YouTube Uploads",
        enabled: false,
        order: 11,
        size: "large",
        config: {
          channelIds: [],
          limit: 6,
          itemsPerChannel: 3,
        },
      },
      {
        id: "twitch",
        type: "twitch",
        title: "Twitch Status",
        enabled: false,
        order: 12,
        size: "medium",
        config: {
          channelLogins: [],
          offlineMessage: "No channels are live right now.",
        },
      },
      {
        id: "recommendations",
        type: "recommendations",
        title: "For You",
        enabled: false,
        order: 13,
        size: "large",
        config: {
          limit: 3,
          includeHiddenGems: true,
        },
      },
    ];

    this.widgets.clear();
    defaultWidgets.forEach((widget) => this.widgets.set(widget.id, widget));
    await this.saveWidgets();
  }

  private async saveWidgets(): Promise<void> {
    try {
      const widgets = Array.from(this.widgets.values());
      await storageAdapter.setItem(this.STORAGE_KEY, JSON.stringify(widgets));
    } catch (error) {
      logger.error("[WidgetService] Failed to save widgets", { error });
    }
  }

  private async saveWidgetData(): Promise<void> {
    try {
      await storageAdapter.setItem(
        this.DATA_KEY,
        JSON.stringify(this.widgetData),
      );
    } catch (error) {
      logger.error("[WidgetService] Failed to save widget data", { error });
    }
  }

  private async cleanupExpiredData(): Promise<void> {
    const now = Date.now();
    let hasExpired = false;

    Object.entries(this.widgetData).forEach(([key, data]) => {
      if (data.expiresAt && data.expiresAt < now) {
        delete this.widgetData[key];
        hasExpired = true;
      }
    });

    if (hasExpired) {
      await this.saveWidgetData();
    }
  }

  // Public API methods

  async getWidgets(): Promise<Widget[]> {
    await this.ensureInitialized();
    return Array.from(this.widgets.values()).sort((a, b) => a.order - b.order);
  }

  async getWidget(id: string): Promise<Widget | undefined> {
    await this.ensureInitialized();
    return this.widgets.get(id);
  }

  async updateWidget(id: string, updates: Partial<Widget>): Promise<void> {
    await this.ensureInitialized();
    const widget = this.widgets.get(id);
    if (widget) {
      const updatedWidget = { ...widget, ...updates };
      this.widgets.set(id, updatedWidget);
      await this.saveWidgets();
    }
  }

  async toggleWidget(id: string): Promise<void> {
    await this.ensureInitialized();
    const widget = this.widgets.get(id);
    if (widget) {
      const updatedWidget = { ...widget, enabled: !widget.enabled };
      this.widgets.set(id, updatedWidget);
      await this.saveWidgets();
    }
  }

  async reorderWidgets(widgetIds: string[]): Promise<void> {
    await this.ensureInitialized();
    widgetIds.forEach((id, index) => {
      const widget = this.widgets.get(id);
      if (widget) {
        const updatedWidget = { ...widget, order: index };
        this.widgets.set(id, updatedWidget);
      }
    });
    await this.saveWidgets();
    // Note: We intentionally do NOT clear widget data here.
    // This allows widgets to display cached data immediately without showing a loading skeleton.
    // Fresh data will load in the background if needed.
  }

  async setWidgetData<T>(
    widgetId: string,
    data: T,
    options?: {
      ttlMs?: number;
      configSignature?: string;
    },
  ): Promise<void> {
    await this.ensureInitialized();
    const timestamp = Date.now();
    const expiresAt = options?.ttlMs ? timestamp + options.ttlMs : undefined;

    this.widgetData[widgetId] = {
      data,
      timestamp,
      expiresAt,
      configSignature: options?.configSignature,
    };

    await this.saveWidgetData();
  }

  async getWidgetData<T>(
    widgetId: string,
    configSignature?: string,
  ): Promise<T | null> {
    await this.ensureInitialized();
    const cached = this.widgetData[widgetId];

    if (!cached) {
      return null;
    }

    // Check if data has expired
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      delete this.widgetData[widgetId];
      await this.saveWidgetData();
      return null;
    }

    if (
      configSignature &&
      cached.configSignature &&
      cached.configSignature !== configSignature
    ) {
      delete this.widgetData[widgetId];
      await this.saveWidgetData();
      return null;
    }

    if (configSignature && !cached.configSignature) {
      delete this.widgetData[widgetId];
      await this.saveWidgetData();
      return null;
    }

    return cached.data as T;
  }

  async clearWidgetData(widgetId?: string): Promise<void> {
    await this.ensureInitialized();
    if (widgetId) {
      delete this.widgetData[widgetId];
    } else {
      this.widgetData = {};
    }
    await this.saveWidgetData();
  }

  async refreshWidgetData(widgetId: string): Promise<void> {
    // This would be implemented by each widget type
    // For now, just clear the cached data to force a refresh
    delete this.widgetData[widgetId];
    await this.saveWidgetData();
  }

  async resetToDefaults(): Promise<void> {
    await this.createDefaultWidgets();
    await this.clearWidgetData();
  }

  async restoreWidgets(widgets: Widget[]): Promise<void> {
    await this.ensureInitialized();
    try {
      // Replace current widgets with restored ones
      this.widgets.clear();
      widgets.forEach((widget) => this.widgets.set(widget.id, widget));
      await this.saveWidgets();

      // Clear widget cache data for fresh data on restore
      await this.clearWidgetData();

      logger.debug("[WidgetService] Widgets restored from backup", {
        widgetCount: widgets.length,
      });
    } catch (error) {
      logger.error("[WidgetService] Failed to restore widgets", { error });
      throw error;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  // Refresh widgets from storage without re-initializing the entire service
  async refreshWidgetsFromStorage(): Promise<void> {
    try {
      await this.loadWidgets();
      logger.debug("[WidgetService] Refreshed widgets from storage");
    } catch (error) {
      logger.error("[WidgetService] Failed to refresh widgets from storage", {
        error,
      });
    }
  }

  // Widget type specific methods

  getServiceStatusWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "service-status" && widget.enabled,
    );
  }

  getDownloadProgressWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "download-progress" && widget.enabled,
    );
  }

  getRecentActivityWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "recent-activity" && widget.enabled,
    );
  }

  getStatisticsWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "statistics" && widget.enabled,
    );
  }

  getCalendarPreviewWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "calendar-preview" && widget.enabled,
    );
  }

  getShortcutsWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "shortcuts" && widget.enabled,
    );
  }

  getBookmarksWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "bookmarks" && widget.enabled,
    );
  }

  getWeatherWidgets(): Widget[] {
    return Array.from(this.widgets.values()).filter(
      (widget) => widget.type === "weather" && widget.enabled,
    );
  }
}

export const widgetService = WidgetService.getInstance();
export { WidgetService };
