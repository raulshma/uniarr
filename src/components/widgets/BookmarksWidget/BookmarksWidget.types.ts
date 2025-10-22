import type { Widget } from "@/services/widgets/WidgetService";

export interface Bookmark {
  id: string;
  label: string;
  url: string;
  icon: {
    type: "material-icon" | "cdn-icon" | "image-url"; // icon source
    value: string; // icon name, CDN path, or image URL
    backgroundColor?: string; // background color for the icon
    textColor?: string; // text color for the icon
  };
  enabled: boolean;
  healthCheck?: HealthCheckConfig;
}

export interface HealthCheckConfig {
  enabled: boolean;
  interval: number; // in seconds, default 300 (5 minutes)
  healthyCodes: number[]; // HTTP codes considered healthy, default [200, 201, 204, 301, 302]
  timeout: number; // in milliseconds, default 5000
}

export interface BookmarkHealth {
  bookmarkId: string;
  status: "healthy" | "unhealthy" | "loading" | "unknown"; // unknown = never checked
  lastChecked?: number; // timestamp
  statusCode?: number;
  errorMessage?: string;
}

export interface BookmarksWidgetConfig {
  bookmarks: Bookmark[];
  healthCheckEnabled: boolean;
}

export interface BookmarkItemProps {
  bookmark: Bookmark;
  health?: BookmarkHealth;
  onPress: (bookmark: Bookmark) => void;
  onLongPress?: (bookmark: Bookmark) => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
}

export interface BookmarksWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

// Default health check configuration
export const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  enabled: true,
  interval: 300, // 5 minutes
  healthyCodes: [200, 201, 204, 301, 302],
  timeout: 5000,
};

// Sensible defaults for common bookmark types
export const COMMON_HEALTH_CODES = {
  ALL: [200, 201, 204, 301, 302],
  WEB: [200, 301, 302],
  API: [200, 201, 204],
  REDIRECT: [301, 302, 307, 308],
  LENIENT: [200, 201, 204, 301, 302, 307, 308, 401, 403], // includes auth errors as "up"
};
