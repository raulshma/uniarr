import { Platform } from "react-native";
import type { MD3Theme } from "react-native-paper";

/**
 * Elevation and shadow tokens for consistent depth perception
 * Replaces hardcoded shadow values found throughout components
 */

// Material Design 3 elevation levels
export const elevationLevels = {
  none: 0,
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
  level4: 4,
  level5: 5,
} as const;

// Android elevation values
export const androidElevation = {
  none: 0,
  level0: 0,
  level1: 1,
  level2: 2,
  level3: 3,
  level4: 4,
  level5: 5,
} as const;

// iOS shadow properties for each elevation level
export const iosShadows = {
  none: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  level0: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  level1: {
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  level2: {
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  level3: {
    shadowOpacity: 0.19,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  level4: {
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  level5: {
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
} as const;

// Component-specific elevation mappings
export const componentElevation: Record<string, ElevationLevel> = {
  // Widget components
  widget: "level2",
  widgetCard: "level2",
  widgetHeader: "level1",

  // Media components
  mediaCard: "level2",
  poster: "level2",
  avatar: "level1",

  // Navigation and interaction elements
  navigationBar: "level3",
  tabBar: "level3",
  floatingButton: "level4",
  modal: "level5",
  dialog: "level4",

  // Form elements
  button: "level1",
  buttonPressed: "level2",
  input: "level1",
  inputFocused: "level2",

  // Surface elements
  card: "level1",
  chip: "level1",
  surface: "level1",

  // List items
  listItem: "level1",
  listHeader: "level2",

  // Special elements
  hero: "level3",
  featured: "level4",
};

export type ElevationLevel = keyof typeof elevationLevels;
export type ComponentElevation = keyof typeof componentElevation;

/**
 * Platform-specific shadow style for a given elevation level
 */
export const getShadowStyle = (
  elevation: ElevationLevel,
  isDark: boolean = false,
) => {
  const shadowOpacity = isDark ? 0.3 : 1; // Reduce shadow opacity in dark mode

  if (Platform.OS === "android") {
    return {
      elevation: androidElevation[elevation],
    };
  }

  const shadow = iosShadows[elevation];
  return {
    shadowColor: "#000",
    shadowOpacity: shadow.shadowOpacity * shadowOpacity,
    shadowRadius: shadow.shadowRadius,
    shadowOffset: shadow.shadowOffset,
  };
};

/**
 * Get elevation style for a specific component type
 */
export const getComponentElevation = (
  component: ComponentElevation,
  theme: MD3Theme,
  pressed: boolean = false,
) => {
  let baseElevation = componentElevation[component];

  // Handle pressed state for interactive elements
  if (pressed && (component === "button" || component === "chip")) {
    baseElevation = "level2";
  }

  if (!baseElevation) {
    baseElevation = "level0";
  }

  const shadowStyle = getShadowStyle(baseElevation, theme.dark);

  return shadowStyle;
};

/**
 * Complete elevation style object with all necessary properties
 */
export const createElevationStyle = (
  elevation: ElevationLevel,
  theme: MD3Theme,
  backgroundColor?: string,
) => {
  const shadowStyle = getShadowStyle(elevation, theme.dark);

  return {
    ...shadowStyle,
    backgroundColor: backgroundColor || theme.colors.surface,
    // Add border to better define edges in light mode
    ...(theme.dark && Platform.OS === "ios"
      ? {
          borderWidth: 0.5,
          borderColor: theme.colors.outline,
        }
      : {}),
  };
};

/**
 * Helper to get elevation for widget components based on their current hardcoded values
 */
export const mapWidgetElevation = (
  currentShadowOpacity: number,
): ElevationLevel => {
  if (currentShadowOpacity <= 0) return "none";
  if (currentShadowOpacity <= 0.12) return "level1";
  if (currentShadowOpacity <= 0.18) return "level2";
  if (currentShadowOpacity <= 0.22) return "level3";
  return "level4";
};
