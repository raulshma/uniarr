import type { AppTheme } from "@/constants/theme";

/**
 * Standardized component utility functions for consistent patterns
 */

export interface BaseComponentProps {
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessible?: boolean;
  accessibilityRole?: string;
}

export interface ThemedComponentProps extends BaseComponentProps {
  theme?: AppTheme;
}

export interface CardComponentProps extends ThemedComponentProps {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  elevation?: number;
  contentPadding?: "xs" | "sm" | "md" | "lg" | "xl";
}

export interface ListItemComponentProps extends ThemedComponentProps {
  onPress?: () => void;
  onLongPress?: () => void;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  description?: string;
  disabled?: boolean;
}

/**
 * Spacing utilities based on theme
 */
export const getSpacing = (
  theme: AppTheme,
  size: "xs" | "sm" | "md" | "lg" | "xl",
) => {
  return theme.custom.spacing[size];
};

export const getContentPadding = (
  theme: AppTheme,
  padding: "xs" | "sm" | "md" | "lg" | "xl",
) => {
  const spacing = getSpacing(theme, padding);
  return {
    padding: spacing,
  };
};

/**
 * Standard elevation values
 */
export const ELEVATION = {
  NONE: 0,
  SUBTLE: 1,
  LOW: 2,
  MEDIUM: 4,
  HIGH: 8,
  VERY_HIGH: 12,
} as const;

/**
 * Standard border radius values
 */
export const BORDER_RADIUS = {
  NONE: 0,
  XS: 4,
  SM: 8,
  MD: 12,
  LG: 16,
  XL: 20,
  ROUND: 999, // For circular elements
} as const;

/**
 * Generate consistent accessibility props
 */
export const createAccessibilityProps = (
  label?: string,
  hint?: string,
  role?: "button" | "image" | "text" | "listitem" | "header",
) => {
  const props: BaseComponentProps = {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
  };

  if (role) {
    props.accessibilityRole = role;
  }

  return props;
};

/**
 * Generate test ID consistently
 */
export const createTestId = (component: string, id?: string) => {
  return id ? `${component}-${id}` : component;
};

/**
 * Standard card styles
 */
export const createCardStyles = (
  theme: AppTheme,
  elevation: number = ELEVATION.SUBTLE,
  contentPadding: "xs" | "sm" | "md" | "lg" | "xl" = "md",
) => {
  return {
    elevation,
    backgroundColor: theme.colors.surface,
    borderRadius: BORDER_RADIUS.MD,
    overflow: "hidden" as const,
    ...getContentPadding(theme, contentPadding),
  };
};

/**
 * Standard list item styles
 */
export const createListItemStyles = (
  theme: AppTheme,
  hasPressAction: boolean = false,
) => {
  return {
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.custom.spacing.sm,
    paddingHorizontal: theme.custom.spacing.md,
    borderRadius: BORDER_RADIUS.SM,
    ...(hasPressAction && {
      overflow: "hidden" as const,
    }),
  };
};

/**
 * Standard button styles
 */
export const createButtonStyles = (
  theme: AppTheme,
  variant: "contained" | "outlined" | "text" = "contained",
) => {
  const base = {
    borderRadius: BORDER_RADIUS.SM,
    paddingHorizontal: theme.custom.spacing.md,
    paddingVertical: theme.custom.spacing.sm,
  };

  switch (variant) {
    case "contained":
      return {
        ...base,
        backgroundColor: theme.colors.primary,
      };
    case "outlined":
      return {
        ...base,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: theme.colors.outline,
      };
    case "text":
      return {
        ...base,
        backgroundColor: "transparent",
      };
  }
};

/**
 * Component size presets
 */
export const COMPONENT_SIZES = {
  BUTTON: {
    SMALL: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 12,
      height: 32,
    },
    MEDIUM: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      fontSize: 14,
      height: 40,
    },
    LARGE: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      fontSize: 16,
      height: 48,
    },
  },
  AVATAR: {
    SMALL: 32,
    MEDIUM: 48,
    LARGE: 64,
    EXTRA_LARGE: 96,
  },
  ICON: {
    SMALL: 16,
    MEDIUM: 24,
    LARGE: 32,
    EXTRA_LARGE: 48,
  },
} as const;

/**
 * Standard loading states
 */
export interface LoadingStateProps {
  loading: boolean;
  error?: unknown;
  retry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
}

/**
 * Create consistent loading state props
 */
export const createLoadingStateProps = (
  loading: boolean,
  error?: unknown,
  retry?: () => void,
  empty?: boolean,
  emptyMessage?: string,
): LoadingStateProps => ({
  loading,
  error,
  retry,
  empty,
  emptyMessage: emptyMessage || "No data available",
});

/**
 * Animation duration constants
 */
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
  VERY_SLOW: 1000,
} as const;

/**
 * Standard animation easing
 */
export const ANIMATION_EASING = {
  EASE_IN: "easeIn",
  EASE_OUT: "easeOut",
  EASE_IN_OUT: "easeInOut",
  LINEAR: "linear",
} as const;

/**
 * Common component patterns
 */
export const COMPONENT_PATTERNS = {
  /**
   * Create a pressable component with consistent behavior
   */
  pressable: {
    android_ripple: {
      color: "rgba(0, 0, 0, 0.1)",
      borderless: false,
    },
    style: {
      overflow: "hidden" as const,
    },
  },

  /**
   * Create a card with shadow and elevation
   */
  card: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },

  /**
   * Create a list item with hover effect
   */
  listItem: {
    transition: {
      duration: ANIMATION_DURATION.FAST,
    },
  },
} as const;

/**
 * Theme-aware color utilities
 */
export const getColor = (
  theme: AppTheme,
  colorKey: keyof AppTheme["colors"],
) => {
  return theme.colors[colorKey];
};

export const getContrastColor = (theme: AppTheme, color: string) => {
  // Simple contrast calculation - could be enhanced
  return theme.dark ? "#FFFFFF" : "#000000";
};

/**
 * Responsive utilities
 */
export const createResponsiveProp = <T>(
  base: T,
  tablet?: T,
  desktop?: T,
): { base: T; tablet?: T; desktop?: T } => {
  return { base, tablet, desktop };
};

/**
 * Type guards for component props
 */
export const hasOnPress = (props: Record<string, unknown>): boolean => {
  return typeof props.onPress === "function";
};

export const isCardComponent = (props: Record<string, unknown>): boolean => {
  return (
    props.hasOwnProperty("elevation") ||
    props.hasOwnProperty("contentPadding") ||
    props.hasOwnProperty("disabled")
  );
};

export const isListItemComponent = (
  props: Record<string, unknown>,
): boolean => {
  return (
    props.hasOwnProperty("leading") ||
    props.hasOwnProperty("trailing") ||
    props.hasOwnProperty("description")
  );
};
