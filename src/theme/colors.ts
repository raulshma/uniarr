import type { MD3Theme } from "react-native-paper";

export type ThemeColors = MD3Theme["colors"];

export type CustomColorScheme = {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  background?: string;
  surface?: string;
  surfaceVariant?: string;
  error?: string;
};

// Legacy aliases: map old brand-based preset keys to new neutral keys
// Map legacy/brand keys to the reduced set of presets.
// We intentionally consolidate many legacy aliases to a small set
// to keep the theme registry minimal while preserving common mappings.
export const presetKeyAliases: Record<string, string> = {
  netflix: "cinematicRed",
  plex: "goldenHour",
  jellyfin: "oceanic",
  spotify: "oceanic",
  youtube: "cinematicRed",
};

type PresetModeOverrides = {
  background: string;
  surface: string;
  surfaceVariant: string;
};

export type ThemePreset = {
  common: CustomColorScheme;
  modes: {
    light: PresetModeOverrides;
    dark: PresetModeOverrides;
  };
};

export const presetThemes: Record<string, ThemePreset> = {
  // Base/default brand theme
  // Base/default brand theme now maps to the Royal palette
  uniarr: {
    common: {
      primary: "#7E57C2",
      secondary: "#64748B",
      tertiary: "#4DB6AC",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#F8F7FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6E0F8",
      },
      dark: {
        background: "#14121B",
        surface: "#1F1C29",
        surfaceVariant: "#2A263C",
      },
    },
  },

  // A few curated alternatives users commonly expect
  cinematicRed: {
    common: {
      primary: "#E50914",
      secondary: "#221F1F",
      tertiary: "#F5F5F1",
      error: "#E50914",
    },
    modes: {
      light: {
        background: "#F5F5F5",
        surface: "#FFFFFF",
        surfaceVariant: "#E0E0E0",
      },
      dark: {
        background: "#000000",
        surface: "#141414",
        surfaceVariant: "#232323",
      },
    },
  },

  goldenHour: {
    common: {
      primary: "#EBAF00",
      secondary: "#282A2D",
      tertiary: "#F5F6F7",
      error: "#CB2600",
    },
    modes: {
      light: {
        background: "#F8F7F4",
        surface: "#FFFFFF",
        surfaceVariant: "#E4E2DC",
      },
      dark: {
        background: "#191A1D",
        surface: "#222327",
        surfaceVariant: "#2C2E34",
      },
    },
  },

  oceanic: {
    common: {
      primary: "#00A4DC",
      secondary: "#1E1E1E",
      tertiary: "#FFFFFF",
      error: "#CC0000",
    },
    modes: {
      light: {
        background: "#F7FAFF",
        surface: "#FFFFFF",
        surfaceVariant: "#D7E4F5",
      },
      dark: {
        background: "#091223",
        surface: "#101A30",
        surfaceVariant: "#1B2840",
      },
    },
  },
  // New palettes added per design request
  royal: {
    common: {
      primary: "#7E57C2",
      secondary: "#64748B",
      tertiary: "#4DB6AC",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#F8F7FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6E0F8",
      },
      dark: {
        background: "#14121B",
        surface: "#1F1C29",
        surfaceVariant: "#2A263C",
      },
    },
  },

  subzero: {
    common: {
      primary: "#03A9F4",
      secondary: "#607D8B",
      tertiary: "#FFCA28",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#F7FBFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E3F2FD",
      },
      dark: {
        background: "#0D161F",
        surface: "#131F2C",
        surfaceVariant: "#1B293A",
      },
    },
  },

  emerald: {
    common: {
      primary: "#4CAF50",
      secondary: "#757575",
      tertiary: "#2196F3",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#F6FFF7",
        surface: "#FFFFFF",
        surfaceVariant: "#E8F5E9",
      },
      dark: {
        background: "#101A10",
        surface: "#182518",
        surfaceVariant: "#223323",
      },
    },
  },

  slate: {
    common: {
      primary: "#607D8B",
      secondary: "#B0BEC5",
      tertiary: "#ECEFF1",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#FAFAFA",
        surface: "#FFFFFF",
        surfaceVariant: "#ECEFF1",
      },
      dark: {
        background: "#121212",
        surface: "#1E1E1E",
        surfaceVariant: "#2C2C2C",
      },
    },
  },

  sunset: {
    common: {
      primary: "#FF7043",
      secondary: "#5C6BC0",
      tertiary: "#FFCA28",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#FFF8F5",
        surface: "#FFFFFF",
        surfaceVariant: "#FBEAE3",
      },
      dark: {
        background: "#1B120E",
        surface: "#271A15",
        surfaceVariant: "#38251E",
      },
    },
  },

  // Preserve existing uniarr preset under a clear legacy key
  legacy: {
    common: {
      primary: "#8B6914",
      secondary: "#6B5E4F",
      tertiary: "#5A6B4A",
      error: "#BA1A1A",
    },
    modes: {
      light: {
        background: "#FFFCF7",
        surface: "#FFFAF0",
        surfaceVariant: "#E8E2D4",
      },
      dark: {
        background: "#1B1407",
        surface: "#241A0B",
        surfaceVariant: "#33240F",
      },
    },
  },
};

const FALLBACK_PRIMARY = "#8B6914";
const FALLBACK_SECONDARY = "#6B5E4F";
const FALLBACK_TERTIARY = "#5A6B4A";
const FALLBACK_ERROR = "#BA1A1A";
const FALLBACK_LIGHT_BACKGROUND = "#FFFCF7";
const FALLBACK_LIGHT_SURFACE = "#FFFAF0";
const FALLBACK_LIGHT_SURFACE_VARIANT = "#E8E2D4";
const FALLBACK_DARK_BACKGROUND = "#1B1407";
const FALLBACK_DARK_SURFACE = "#241A0B";
const FALLBACK_DARK_SURFACE_VARIANT = "#33240F";

const clampChannel = (value: number): number =>
  Math.min(255, Math.max(0, Math.round(value)));

const normalizeHex = (color?: string): string | undefined => {
  if (!color || typeof color !== "string") {
    return undefined;
  }

  const trimmed = color.trim();
  if (!trimmed.startsWith("#")) {
    return undefined;
  }

  const hex = trimmed.slice(1);
  if (hex.length === 3) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
  }

  if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
    return `#${hex.toUpperCase()}`;
  }

  return undefined;
};

const hexToRgb = (color: string) => {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return undefined;
  }

  const hex = normalized.slice(1);
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return { r, g, b };
};

const rgbToHex = ({ r, g, b }: { r: number; g: number; b: number }): string =>
  `#${clampChannel(r).toString(16).padStart(2, "0")}${clampChannel(g)
    .toString(16)
    .padStart(
      2,
      "0",
    )}${clampChannel(b).toString(16).padStart(2, "0")}`.toUpperCase();

const mixColor = (color: string, mixWith: string, amount: number): string => {
  const baseRgb = hexToRgb(color);
  const mixRgb = hexToRgb(mixWith);

  if (!baseRgb || !mixRgb) {
    return normalizeHex(color) ?? FALLBACK_PRIMARY;
  }

  return rgbToHex({
    r: baseRgb.r + (mixRgb.r - baseRgb.r) * amount,
    g: baseRgb.g + (mixRgb.g - baseRgb.g) * amount,
    b: baseRgb.b + (mixRgb.b - baseRgb.b) * amount,
  });
};

const lightenColor = (color: string, amount: number): string =>
  mixColor(color, "#FFFFFF", amount);
const darkenColor = (color: string, amount: number): string =>
  mixColor(color, "#000000", amount);

const getRelativeLuminance = (color: string): number => {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return 0;
  }

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const getContrastRatio = (colorA: string, colorB: string): number => {
  const lA = getRelativeLuminance(colorA);
  const lB = getRelativeLuminance(colorB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
};

const getAccessibleOnColor = (background: string): string => {
  // Fallback quick-path
  const normalized = normalizeHex(background);
  if (!normalized) return "#000000";

  const contrastWhite = getContrastRatio(normalized, "#FFFFFF");
  const contrastBlack = getContrastRatio(normalized, "#000000");

  // Prefer a color that meets the 4.5:1 contrast requirement for normal text.
  if (contrastWhite >= 4.5) return "#FFFFFF";
  if (contrastBlack >= 4.5) return "#000000";

  // Otherwise choose the color with the higher contrast ratio.
  return contrastWhite >= contrastBlack ? "#FFFFFF" : "#000000";
};

const ensureDarkSurface = (
  color?: string,
  fallback: string = FALLBACK_DARK_SURFACE,
): string => {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return fallback;
  }

  return getRelativeLuminance(normalized) > 0.25
    ? darkenColor(normalized, 0.35)
    : normalized;
};

const ensureLightSurface = (
  color?: string,
  fallback: string = FALLBACK_LIGHT_SURFACE,
): string => {
  const normalized = normalizeHex(color);
  if (!normalized) {
    return fallback;
  }

  return getRelativeLuminance(normalized) < 0.6
    ? lightenColor(normalized, 0.35)
    : normalized;
};

const ensureVariantSurface = (
  surface: string,
  isDark: boolean,
  fallback: string,
): string => {
  const normalizedFallback = normalizeHex(fallback);
  if (normalizedFallback) {
    return normalizedFallback;
  }

  const base = normalizeHex(surface) ?? surface;
  return isDark ? lightenColor(base, 0.14) : darkenColor(base, 0.14);
};

/**
 * Generate a complete MD3 color palette from a custom color scheme
 */
export const generateThemeColors = (
  scheme: CustomColorScheme,
  isDark: boolean = false,
  modeOverrides?: PresetModeOverrides,
  oledEnabled: boolean = false,
): ThemeColors => {
  const primary = normalizeHex(scheme.primary) ?? FALLBACK_PRIMARY;
  const secondary = normalizeHex(scheme.secondary) ?? FALLBACK_SECONDARY;
  const tertiary = normalizeHex(scheme.tertiary) ?? FALLBACK_TERTIARY;
  const error = normalizeHex(scheme.error) ?? FALLBACK_ERROR;

  const defaultMode =
    modeOverrides ??
    (isDark
      ? {
          background: FALLBACK_DARK_BACKGROUND,
          surface: FALLBACK_DARK_SURFACE,
          surfaceVariant: FALLBACK_DARK_SURFACE_VARIANT,
        }
      : {
          background: FALLBACK_LIGHT_BACKGROUND,
          surface: FALLBACK_LIGHT_SURFACE,
          surfaceVariant: FALLBACK_LIGHT_SURFACE_VARIANT,
        });

  // OLED mode: force pure black background in dark mode
  const background =
    isDark && oledEnabled
      ? "#000000"
      : (normalizeHex(scheme.background) ??
        normalizeHex(defaultMode.background) ??
        (isDark ? FALLBACK_DARK_BACKGROUND : FALLBACK_LIGHT_BACKGROUND));

  // Adjust surface colors for OLED mode to maintain visual hierarchy
  let effectiveSurfaceMode = defaultMode;
  if (isDark && oledEnabled) {
    // Create OLED-optimized surface colors that work well with pure black background
    effectiveSurfaceMode = {
      background: "#000000",
      surface: "#141414", // Slightly raised from pure black
      surfaceVariant: "#1E1E1E", // More raised for better hierarchy
    };
  }

  const surface = isDark
    ? ensureDarkSurface(
        scheme.surface ?? effectiveSurfaceMode.surface,
        effectiveSurfaceMode.surface,
      )
    : ensureLightSurface(
        scheme.surface ?? effectiveSurfaceMode.surface,
        effectiveSurfaceMode.surface,
      );
  const surfaceVariant =
    normalizeHex(scheme.surfaceVariant) ??
    ensureVariantSurface(surface, isDark, effectiveSurfaceMode.surfaceVariant);

  const secondaryContainer = isDark
    ? lightenColor(secondary, 0.25)
    : darkenColor(secondary, 0.12);
  const tertiaryContainer = isDark
    ? lightenColor(tertiary, 0.25)
    : darkenColor(tertiary, 0.12);
  const primaryContainer = isDark
    ? lightenColor(primary, 0.28)
    : darkenColor(primary, 0.18);
  const errorContainer = isDark
    ? lightenColor(error, 0.3)
    : darkenColor(error, 0.1);

  const onPrimary = getAccessibleOnColor(primary);
  const onSecondary = getAccessibleOnColor(secondary);
  const onTertiary = getAccessibleOnColor(tertiary);
  const onError = getAccessibleOnColor(error);
  const onPrimaryContainer = getAccessibleOnColor(primaryContainer);
  const onSecondaryContainer = getAccessibleOnColor(secondaryContainer);
  const onTertiaryContainer = getAccessibleOnColor(tertiaryContainer);
  const onErrorContainer = getAccessibleOnColor(errorContainer);

  const onBackground = getAccessibleOnColor(background);
  const onSurface = getAccessibleOnColor(surface);
  const onSurfaceVariant = getAccessibleOnColor(surfaceVariant);

  const surfaceDisabled = isDark
    ? "rgba(255, 255, 255, 0.12)"
    : "rgba(0, 0, 0, 0.12)";
  const onSurfaceDisabled = isDark
    ? "rgba(255, 255, 255, 0.38)"
    : "rgba(0, 0, 0, 0.38)";

  const outline = isDark
    ? lightenColor(surfaceVariant, 0.25)
    : darkenColor(surfaceVariant, 0.25);
  const outlineVariant = isDark
    ? lightenColor(surfaceVariant, 0.15)
    : darkenColor(surfaceVariant, 0.15);

  const inverseSurface = isDark
    ? lightenColor(surface, 0.3)
    : darkenColor(surface, 0.3);
  const inverseOnSurface = getAccessibleOnColor(inverseSurface);
  const inversePrimary = isDark
    ? lightenColor(primary, 0.4)
    : darkenColor(primary, 0.4);

  const elevationBase = isDark
    ? lightenColor(surface, 0.05)
    : darkenColor(surface, 0.05);

  return {
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    secondary,
    onSecondary,
    secondaryContainer,
    onSecondaryContainer,
    tertiary,
    onTertiary,
    tertiaryContainer,
    onTertiaryContainer,
    error,
    onError,
    errorContainer,
    onErrorContainer,
    background,
    onBackground,
    surface,
    onSurface,
    surfaceVariant,
    onSurfaceVariant,
    outline,
    outlineVariant,
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface,
    inverseOnSurface,
    inversePrimary,
    surfaceDisabled,
    onSurfaceDisabled,
    backdrop: "rgba(0, 0, 0, 0.4)",
    elevation: {
      level0: "transparent",
      level1: elevationBase,
      level2: isDark ? lightenColor(surface, 0.09) : darkenColor(surface, 0.09),
      level3: isDark ? lightenColor(surface, 0.12) : darkenColor(surface, 0.12),
      level4: isDark ? lightenColor(surface, 0.15) : darkenColor(surface, 0.15),
      level5: isDark ? lightenColor(surface, 0.18) : darkenColor(surface, 0.18),
    },
  } satisfies ThemeColors;
};

export const lightColors: ThemeColors = {
  primary: "#8B6914",
  onPrimary: "#FFFFFF",
  primaryContainer: "#F5E6A3",
  onPrimaryContainer: "#2A1F00",
  secondary: "#6B5E4F",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#F2E5D4",
  onSecondaryContainer: "#251A0F",
  tertiary: "#5A6B4A",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#DDE8C8",
  onTertiaryContainer: "#161F0A",
  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",
  background: "#FFFCF7",
  onBackground: "#1F1C17",
  surface: "#FFFCF7",
  onSurface: "#1F1C17",
  surfaceVariant: "#E8E2D4",
  onSurfaceVariant: "#49473A",
  outline: "#7A7667",
  outlineVariant: "#CBC6B5",
  shadow: "#000000",
  scrim: "#000000",
  inverseSurface: "#34302A",
  inverseOnSurface: "#F8F0E6",
  inversePrimary: "#C49B2D",
  surfaceDisabled: "rgba(31, 28, 23, 0.12)",
  onSurfaceDisabled: "rgba(31, 28, 23, 0.38)",
  backdrop: "rgba(52, 48, 42, 0.4)",
  elevation: {
    level0: "transparent",
    level1: "#F7F2E8",
    level2: "#ECE7DD",
    level3: "#E1DBC8",
    level4: "#D6D0BD",
    level5: "#CCC5B2",
  },
};

export const darkColors: ThemeColors = {
  primary: "#C49B2D",
  onPrimary: "#FFFFFF",
  primaryContainer: "#3A2F1D",
  onPrimaryContainer: "#F5E6A3",
  secondary: "#8B7D6B",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#2A2520",
  onSecondaryContainer: "#A69B8C",
  tertiary: "#A8C8A8",
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#2A3A2A",
  onTertiaryContainer: "#B8D8B8",
  error: "#FFB4AB",
  onError: "#690005",
  errorContainer: "#93000A",
  onErrorContainer: "#FFDAD6",
  background: "#1F1F1F",
  onBackground: "#E8E8E8",
  surface: "#2A2A2A",
  onSurface: "#E8E8E8",
  surfaceVariant: "#333333",
  onSurfaceVariant: "#C7C7C7",
  outline: "#8B7D6B",
  outlineVariant: "#494949",
  shadow: "#000000",
  scrim: "#000000",
  inverseSurface: "#E8E8E8",
  inverseOnSurface: "#1F1F1F",
  inversePrimary: "#C49B2D",
  surfaceDisabled: "rgba(232, 232, 232, 0.12)",
  onSurfaceDisabled: "rgba(232, 232, 232, 0.38)",
  backdrop: "rgba(31, 31, 31, 0.4)",
  elevation: {
    level0: "transparent",
    level1: "#2A2A2A",
    level2: "#333333",
    level3: "#3A3A3A",
    level4: "#404040",
    level5: "#494949",
  },
};
