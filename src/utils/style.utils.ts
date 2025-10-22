import type { AppTheme } from "@/constants/theme";
import type { SpacingScale } from "@/theme/spacing";
import { gapSizes } from "@/constants/sizes";

/**
 * Style utilities for consistent spacing, layout, and styling patterns
 * These helpers make it easier to apply design tokens consistently
 */

/**
 * Apply spacing to multiple sides
 */
export const applySpacing = (
  spacing: SpacingScale,
  options: {
    top?: keyof SpacingScale;
    right?: keyof SpacingScale;
    bottom?: keyof SpacingScale;
    left?: keyof SpacingScale;
    horizontal?: keyof SpacingScale;
    vertical?: keyof SpacingScale;
    all?: keyof SpacingScale;
  },
) => {
  const style: any = {};

  if (options.all) {
    style.padding = spacing[options.all];
  }

  if (options.horizontal) {
    style.paddingHorizontal = spacing[options.horizontal];
  }

  if (options.vertical) {
    style.paddingVertical = spacing[options.vertical];
  }

  if (options.top) {
    style.paddingTop = spacing[options.top];
  }

  if (options.right) {
    style.paddingRight = spacing[options.right];
  }

  if (options.bottom) {
    style.paddingBottom = spacing[options.bottom];
  }

  if (options.left) {
    style.paddingLeft = spacing[options.left];
  }

  return style;
};

/**
 * Apply margin spacing
 */
export const applyMargin = (
  spacing: SpacingScale,
  options: {
    top?: keyof SpacingScale;
    right?: keyof SpacingScale;
    bottom?: keyof SpacingScale;
    left?: keyof SpacingScale;
    horizontal?: keyof SpacingScale;
    vertical?: keyof SpacingScale;
    all?: keyof SpacingScale;
  },
) => {
  const style: any = {};

  if (options.all) {
    style.margin = spacing[options.all];
  }

  if (options.horizontal) {
    style.marginHorizontal = spacing[options.horizontal];
  }

  if (options.vertical) {
    style.marginVertical = spacing[options.vertical];
  }

  if (options.top) {
    style.marginTop = spacing[options.top];
  }

  if (options.right) {
    style.marginRight = spacing[options.right];
  }

  if (options.bottom) {
    style.marginBottom = spacing[options.bottom];
  }

  if (options.left) {
    style.marginLeft = spacing[options.left];
  }

  return style;
};

/**
 * Create flex layout with gap
 */
export const createFlexLayout = (
  direction: "row" | "column" = "column",
  gapSize: keyof typeof gapSizes = "md",
  options: {
    align?: "flex-start" | "center" | "flex-end" | "stretch";
    justify?:
      | "flex-start"
      | "center"
      | "flex-end"
      | "space-between"
      | "space-around"
      | "space-evenly";
    wrap?: "wrap" | "nowrap";
  } = {},
) => {
  return {
    flexDirection: direction,
    gap: gapSizes[gapSize],
    alignItems: options.align,
    justifyContent: options.justify,
    flexWrap: options.wrap,
  };
};

/**
 * Create common layout patterns
 */
export const createLayoutStyles = (spacing: SpacingScale) => ({
  // Card layouts
  card: {
    ...applySpacing(spacing, { all: "md" }),
    borderRadius: 8, // Will be updated to use theme tokens
  },

  // List item layouts
  listItem: {
    ...applySpacing(spacing, { horizontal: "md", vertical: "sm" }),
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: gapSizes.md,
  },

  // Section layouts
  section: {
    ...applySpacing(spacing, { all: "lg" }),
  },

  // Header layouts
  header: {
    ...applySpacing(spacing, { horizontal: "lg", vertical: "md" }),
  },

  // Content layouts
  content: {
    ...applySpacing(spacing, { all: "md" }),
  },

  // Button layouts
  buttonRow: {
    ...createFlexLayout("row", "md", {
      justify: "flex-end",
      align: "center",
    }),
    ...applySpacing(spacing, { top: "lg" }),
  },

  // Form layouts
  formField: {
    ...applySpacing(spacing, { vertical: "sm" }),
  },

  formSection: {
    ...applySpacing(spacing, { vertical: "lg" }),
  },
});

/**
 * Create responsive sizing utility
 */
export const createResponsiveSize = (
  smallScreen: number,
  mediumScreen: number,
  largeScreen: number,
) => {
  // This would ideally use screen dimensions, but for now returns medium
  return mediumScreen;
};

/**
 * Apply conditional styling based on theme
 */
export const createThemedStyle = (
  theme: AppTheme,
  styles: {
    light?: any;
    dark?: any;
    common?: any;
  },
) => {
  return {
    ...styles.common,
    ...(theme.dark ? styles.dark : styles.light),
  };
};

/**
 * Create animation transition styles
 */
export const createTransitionStyles = {
  // Common transitions
  smooth: {
    transitionDuration: "200ms",
    transitionTimingFunction: "ease-in-out",
  },

  quick: {
    transitionDuration: "150ms",
    transitionTimingFunction: "ease-out",
  },

  slow: {
    transitionDuration: "300ms",
    transitionTimingFunction: "ease-in-out",
  },
};

/**
 * Helper to create consistent pressable styles
 */
export const createPressableStyles = (
  theme: AppTheme,
  baseStyle: any = {},
  pressedStyle: any = {},
) => ({
  default: {
    ...baseStyle,
    opacity: 1,
  },
  pressed: {
    ...baseStyle,
    ...pressedStyle,
    opacity: 0.8,
  },
});

/**
 * Create container styles that respect safe areas
 */
export const createSafeContainerStyles = (spacing: SpacingScale) => ({
  fullScreen: {
    flex: 1,
    paddingTop: spacing.lg, // Will be updated with safe area insets
  },

  withHeader: {
    flex: 1,
    paddingTop: spacing.xxxl, // Will be updated with safe area + header
  },

  contentOnly: {
    flex: 1,
    ...applySpacing(spacing, { all: "md" }),
  },
});

/**
 * Utility to apply theme-aware borders
 */
export const createBorderStyles = (
  theme: AppTheme,
  width: number = 1,
  color?: string,
) => ({
  borderWidth: width,
  borderColor: color || theme.colors.outline,
  borderStyle: "solid" as const,
});

/**
 * Helper to convert old spacing values to theme tokens
 */
export const convertLegacySpacing = (
  legacyValue: number,
): keyof SpacingScale => {
  // Map common hardcoded values to theme tokens
  const spacingMap: Record<number, keyof SpacingScale> = {
    0: "none",
    2: "xxxs",
    4: "xxs",
    8: "xs",
    12: "sm",
    16: "md",
    20: "lg",
    24: "lg",
    32: "xl",
    40: "xxl",
    56: "xxxl",
    80: "xxxxl",
  };

  return spacingMap[legacyValue] || "md"; // Default to medium if not found
};

/**
 * Helper to convert old border radius values to tokens
 */
export const convertLegacyBorderRadius = (legacyValue: number) => {
  const radiusMap: Record<number, string> = {
    0: "none",
    2: "xs",
    4: "sm",
    8: "md",
    12: "lg",
    16: "xl",
    20: "xxl",
    24: "xxxl",
  };

  return radiusMap[legacyValue] || "md";
};
