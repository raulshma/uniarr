import type { Widget } from "@/services/widgets/WidgetService";

export interface Shortcut {
  id: string;
  label: string;
  icon: string; // Using string to avoid MaterialCommunityIcons type issues
  route: string;
  enabled: boolean;
}

export interface ShortcutsWidgetConfig {
  shortcuts: Shortcut[];
}

export interface ShortcutItemProps {
  shortcut: Shortcut;
  onPress: (shortcut: Shortcut) => void;
  disabled?: boolean;
  size?: "small" | "medium" | "large";
}

export interface ShortcutsWidgetProps {
  widget: Widget;
  onRefresh?: () => void;
  onEdit?: () => void;
}

// Default shortcuts configuration
export const DEFAULT_SHORTCUTS: Shortcut[] = [
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
];

// Additional optional shortcuts
export const OPTIONAL_SHORTCUTS: Shortcut[] = [
  {
    id: "services",
    label: "Services",
    icon: "server",
    route: "/(auth)/(tabs)/services",
    enabled: false,
  },
  {
    id: "downloads",
    label: "Downloads",
    icon: "download",
    route: "/(auth)/(tabs)/downloads",
    enabled: false,
  },
  {
    id: "settings",
    label: "Settings",
    icon: "cog",
    route: "/(auth)/(tabs)/settings",
    enabled: false,
  },
];
