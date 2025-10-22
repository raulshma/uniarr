import type { DensityMode } from "@/theme/spacing";

/**
 * Component size tokens for consistent dimensions across the app
 * These tokens replace hardcoded values found throughout components
 */

// Poster sizes based on common patterns found in MediaCard, Jellyfin details, etc.
export const posterSizes = {
  xs: 48, // Small thumbnails
  sm: 64, // List items
  md: 96, // Card posters (current POSTER_SMALL_WIDTH)
  lg: 120, // Grid posters
  xl: 160, // Detail view posters (current POSTER_SIZE)
  xxl: 200, // Hero posters
} as const;

// Avatar and icon sizes based on patterns in discover, settings, etc.
export const avatarSizes = {
  xs: 24, // Small avatars
  sm: 32, // List avatars
  md: 40, // Service status indicators
  lg: 48, // Profile avatars (current AVATAR_SIZE)
  xl: 64, // Large profile pictures
  xxl: 96, // Hero avatars
} as const;

// Icon sizes for consistent iconography
export const iconSizes = {
  xs: 12, // Inline icons
  sm: 16, // Button icons
  md: 20, // List icons
  lg: 24, // Section icons
  xl: 32, // Large icons
  xxl: 48, // Feature icons
  xxxl: 64, // Extra large icons
} as const;

// Touch target sizes following accessibility guidelines
export const touchSizes = {
  xs: 32, // Minimal touch target
  sm: 40, // Small buttons
  md: 44, // Standard buttons (iOS guideline)
  lg: 48, // Large buttons (Android guideline)
  xl: 56, // Extra large touch targets
} as const;

// Card and container dimensions
export const cardSizes = {
  height: {
    xs: 48, // Small cards
    sm: 64, // List cards
    md: 80, // Medium cards
    lg: 120, // Large cards
    xl: 160, // Extra large cards
  },
  width: {
    xs: 80, // Narrow cards
    sm: 120, // Small cards
    md: 160, // Medium cards
    lg: 200, // Large cards
    xl: 240, // Extra large cards
  },
} as const;

// Additional card dimensions for specific use cases
export const additionalCardSizes = {
  portrait: {
    width: 60, // Recent activity widget cards
    height: 80, // Recent activity widget cards
  },
} as const;

// Button dimensions
export const buttonSizes = {
  height: {
    xs: 28, // Small buttons
    sm: 32, // Compact buttons
    md: 40, // Standard buttons
    lg: 48, // Large buttons
    xl: 56, // Extra large buttons
  },
  padding: {
    xs: { horizontal: 8, vertical: 4 },
    sm: { horizontal: 12, vertical: 6 },
    md: { horizontal: 16, vertical: 8 },
    lg: { horizontal: 20, vertical: 12 },
    xl: { horizontal: 24, vertical: 16 },
  },
} as const;

// Border radius scale for consistent corner treatment
export const borderRadius = {
  none: 0,
  xs: 2, // Subtle rounding
  sm: 4, // Small elements
  md: 8, // Cards, buttons (current common value)
  lg: 12, // Large cards
  xl: 16, // Extra large cards
  xxl: 20, // Hero elements
  xxxl: 24, // Special elements
  round: 9999, // Fully circular
} as const;

// Common aspect ratios for media
export const aspectRatios = {
  poster: 2 / 3, // Standard movie poster (current POSTER_DEFAULT_ASPECT)
  thumbnail: 16 / 9, // Video thumbnails
  square: 1, // Square images
  portrait: 2 / 3, // Portrait orientation
  landscape: 3 / 2, // Landscape orientation
  wide: 21 / 9, // Ultra-wide
} as const;

// Gap sizes for consistent spacing between elements
export const gapSizes = {
  none: 0,
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
} as const;

// Line heights for consistent text spacing
export const lineHeights = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
  loose: 1.8,
} as const;

// Slider and input control sizes
export const controlSizes = {
  slider: {
    height: 6,
    borderRadius: 3,
  },
  switch: {
    height: 24,
    width: 44,
  },
  progress: {
    height: 4,
    borderRadius: 2,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
} as const;

export type SizeToken = (typeof posterSizes)[keyof typeof posterSizes];
export type AvatarSize = (typeof avatarSizes)[keyof typeof avatarSizes];
export type IconSize = (typeof iconSizes)[keyof typeof iconSizes];
export type TouchSize = (typeof touchSizes)[keyof typeof touchSizes];
export type BorderRadiusToken =
  (typeof borderRadius)[keyof typeof borderRadius];
export type AspectRatioToken = (typeof aspectRatios)[keyof typeof aspectRatios];

/**
 * Generate size tokens adjusted for density mode
 */
export const generateSizeTokens = (
  density: DensityMode = "comfortable",
  globalBorderRadius?: keyof typeof borderRadius,
) => {
  const densityFactors = {
    compact: 0.875, // 12.5% smaller
    comfortable: 1.0, // Default size
    spacious: 1.125, // 12.5% larger
  };

  const factor = densityFactors[density];

  const scaleSize = (size: number): number => Math.round(size * factor);

  return {
    posterSizes: Object.fromEntries(
      Object.entries(posterSizes).map(([key, value]) => [
        key,
        scaleSize(value),
      ]),
    ) as typeof posterSizes,
    avatarSizes: Object.fromEntries(
      Object.entries(avatarSizes).map(([key, value]) => [
        key,
        scaleSize(value),
      ]),
    ) as typeof avatarSizes,
    iconSizes: Object.fromEntries(
      Object.entries(iconSizes).map(([key, value]) => [key, scaleSize(value)]),
    ) as typeof iconSizes,
    touchSizes: Object.fromEntries(
      Object.entries(touchSizes).map(([key, value]) => [key, scaleSize(value)]),
    ) as typeof touchSizes,
    cardSizes: {
      height: Object.fromEntries(
        Object.entries(cardSizes.height).map(([key, value]) => [
          key,
          scaleSize(value),
        ]),
      ) as typeof cardSizes.height,
      width: Object.fromEntries(
        Object.entries(cardSizes.width).map(([key, value]) => [
          key,
          scaleSize(value),
        ]),
      ) as typeof cardSizes.width,
    },
    buttonSizes: {
      height: Object.fromEntries(
        Object.entries(buttonSizes.height).map(([key, value]) => [
          key,
          scaleSize(value),
        ]),
      ) as typeof buttonSizes.height,
      padding: buttonSizes.padding, // Padding scales with spacing system
    },
    borderRadius: Object.fromEntries(
      Object.entries(borderRadius).map(([key, value]) => {
        // Use globalBorderRadius as the default for 'md' if specified
        if (
          key === "md" &&
          globalBorderRadius &&
          borderRadius[globalBorderRadius]
        ) {
          return [key, scaleSize(borderRadius[globalBorderRadius])];
        }
        return key === "none" || key === "round"
          ? [key, value]
          : [key, scaleSize(value)];
      }),
    ) as typeof borderRadius,
    gapSizes: Object.fromEntries(
      Object.entries(gapSizes).map(([key, value]) => [key, scaleSize(value)]),
    ) as typeof gapSizes,
    controlSizes: {
      slider: {
        height: scaleSize(controlSizes.slider.height),
        borderRadius: scaleSize(controlSizes.slider.borderRadius),
      },
      switch: {
        height: scaleSize(controlSizes.switch.height),
        width: scaleSize(controlSizes.switch.width),
      },
      progress: {
        height: scaleSize(controlSizes.progress.height),
        borderRadius: scaleSize(controlSizes.progress.borderRadius),
      },
      indicator: {
        width: scaleSize(controlSizes.indicator.width),
        height: scaleSize(controlSizes.indicator.height),
        borderRadius: scaleSize(controlSizes.indicator.borderRadius),
      },
    },
    additionalCardSizes: {
      portrait: {
        width: scaleSize(additionalCardSizes.portrait.width),
        height: scaleSize(additionalCardSizes.portrait.height),
      },
    },
  };
};
