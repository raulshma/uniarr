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
export const presetKeyAliases: Record<string, string> = {
  netflix: "cinematicRed",
  plex: "goldenHour",
  jellyfin: "oceanic",
  spotify: "forest",
  youtube: "vividRed",
  hbomax: "velvet",
  disney: "wonder",
  primevideo: "azure",
  hulu: "fresh",
  emby: "ember",
  trakt: "tracker",
  kodi: "cobalt",
  appletv: "modern",
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
  uniarr: {
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
  forest: {
    common: {
      primary: "#1DB954",
      secondary: "#121212",
      tertiary: "#B3B3B3",
      error: "#FF4444",
    },
    modes: {
      light: {
        background: "#F5FFF8",
        surface: "#FFFFFF",
        surfaceVariant: "#DDEEE4",
      },
      dark: {
        background: "#121212",
        surface: "#181818",
        surfaceVariant: "#212121",
      },
    },
  },
  vividRed: {
    common: {
      primary: "#FF0000",
      secondary: "#0F0F0F",
      tertiary: "#FFFFFF",
      error: "#CC0000",
    },
    modes: {
      light: {
        background: "#FFFFFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E5E5E5",
      },
      dark: {
        background: "#0F0F0F",
        surface: "#171717",
        surfaceVariant: "#212121",
      },
    },
  },
  velvet: {
    common: {
      primary: "#5B2D90",
      secondary: "#000000",
      tertiary: "#F3EAFE",
      error: "#D7263D",
    },
    modes: {
      light: {
        background: "#FBF7FF",
        surface: "#FFFFFF",
        surfaceVariant: "#EDE5F6",
      },
      dark: {
        background: "#0A0710",
        surface: "#141018",
        surfaceVariant: "#221827",
      },
    },
  },
  wonder: {
    common: {
      primary: "#113CCF",
      secondary: "#FFFFFF",
      tertiary: "#DCEBFF",
      error: "#B00020",
    },
    modes: {
      light: {
        background: "#F6FAFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6F0FF",
      },
      dark: {
        background: "#07102A",
        surface: "#0E1A36",
        surfaceVariant: "#12243F",
      },
    },
  },
  azure: {
    common: {
      primary: "#00A8E4",
      secondary: "#0B0B0B",
      tertiary: "#F1FBFF",
      error: "#FFB300",
    },
    modes: {
      light: {
        background: "#F3FBFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6F5FB",
      },
      dark: {
        background: "#071219",
        surface: "#0E1A22",
        surfaceVariant: "#16232D",
      },
    },
  },
  fresh: {
    common: {
      primary: "#1CE783",
      secondary: "#000000",
      tertiary: "#E8FFF3",
      error: "#FF4C4C",
    },
    modes: {
      light: {
        background: "#F7FFFB",
        surface: "#FFFFFF",
        surfaceVariant: "#EAFCEF",
      },
      dark: {
        background: "#07120C",
        surface: "#0E1B14",
        surfaceVariant: "#16281E",
      },
    },
  },
  ember: {
    common: {
      primary: "#E64135",
      secondary: "#1C1C1C",
      tertiary: "#FFFFFF",
      error: "#A40000",
    },
    modes: {
      light: {
        background: "#FFF8F7",
        surface: "#FFFFFF",
        surfaceVariant: "#F6E9E7",
      },
      dark: {
        background: "#0B0A0A",
        surface: "#141313",
        surfaceVariant: "#241D1D",
      },
    },
  },
  tracker: {
    common: {
      primary: "#1A8FE3",
      secondary: "#0F1720",
      tertiary: "#E9F5FF",
      error: "#E03A3A",
    },
    modes: {
      light: {
        background: "#F5FBFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6F2FB",
      },
      dark: {
        background: "#071022",
        surface: "#0D1B2B",
        surfaceVariant: "#152636",
      },
    },
  },
  cobalt: {
    common: {
      primary: "#0099FF",
      secondary: "#0E0E0E",
      tertiary: "#E8F7FF",
      error: "#FF3B30",
    },
    modes: {
      light: {
        background: "#F3FAFF",
        surface: "#FFFFFF",
        surfaceVariant: "#E6F6FF",
      },
      dark: {
        background: "#071015",
        surface: "#0D151B",
        surfaceVariant: "#162027",
      },
    },
  },
  modern: {
    common: {
      primary: "#0F1720",
      secondary: "#FFFFFF",
      tertiary: "#A9B3BD",
      error: "#FF3B30",
    },
    modes: {
      light: {
        background: "#FAFBFC",
        surface: "#FFFFFF",
        surfaceVariant: "#EFEFF2",
      },
      dark: {
        background: "#08090B",
        surface: "#0F1113",
        surfaceVariant: "#1A1C1E",
      },
    },
  },
  minimal: {
    common: {
      primary: "#445566",
      secondary: "#1A1D21",
      tertiary: "#E5E9F0",
      error: "#D14343",
    },
    modes: {
      light: {
        background: "#F4F6F8",
        surface: "#FFFFFF",
        surfaceVariant: "#E4E8EE",
      },
      dark: {
        background: "#0F1115",
        surface: "#161A20",
        surfaceVariant: "#1F2630",
      },
    },
  },
  midnightDune: {
    common: {
      primary: "#CF8A3F",
      secondary: "#101014",
      tertiary: "#F5E2C8",
      error: "#E05A33",
    },
    modes: {
      light: {
        background: "#FFF7ED",
        surface: "#FFFFFF",
        surfaceVariant: "#F0E1CF",
      },
      dark: {
        background: "#140E07",
        surface: "#1C140B",
        surfaceVariant: "#2A1F13",
      },
    },
  },
  neonArcade: {
    common: {
      primary: "#FF5EE3",
      secondary: "#131424",
      tertiary: "#70F8FF",
      error: "#FF3366",
    },
    modes: {
      light: {
        background: "#F5F7FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E3E7FF",
      },
      dark: {
        background: "#050511",
        surface: "#11112A",
        surfaceVariant: "#1E1E3D",
      },
    },
  },
  calmSlate: {
    common: {
      primary: "#4A6FA5",
      secondary: "#243042",
      tertiary: "#AFC3DC",
      error: "#E05858",
    },
    modes: {
      light: {
        background: "#F3F6FB",
        surface: "#FFFFFF",
        surfaceVariant: "#E1E7F1",
      },
      dark: {
        background: "#10151D",
        surface: "#171E28",
        surfaceVariant: "#212B39",
      },
    },
  },
  sunrise: {
    common: {
      primary: "#F76C5E",
      secondary: "#2E2A40",
      tertiary: "#F9C784",
      error: "#D9384A",
    },
    modes: {
      light: {
        background: "#FFF6F0",
        surface: "#FFFFFF",
        surfaceVariant: "#F4DED4",
      },
      dark: {
        background: "#1B1220",
        surface: "#241827",
        surfaceVariant: "#302237",
      },
    },
  },
  twilight: {
    common: {
      primary: "#7A4FFF",
      secondary: "#151528",
      tertiary: "#D2B7FF",
      error: "#FF5A7C",
    },
    modes: {
      light: {
        background: "#F6F4FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E7E1FF",
      },
      dark: {
        background: "#0C0B1A",
        surface: "#17142A",
        surfaceVariant: "#221E3A",
      },
    },
  },
  aurora: {
    common: {
      primary: "#3AB795",
      secondary: "#0F2027",
      tertiary: "#81E3D7",
      error: "#FF6F59",
    },
    modes: {
      light: {
        background: "#F4FFFB",
        surface: "#FFFFFF",
        surfaceVariant: "#DDF5EE",
      },
      dark: {
        background: "#071815",
        surface: "#0E241F",
        surfaceVariant: "#163530",
      },
    },
  },
  desertBloom: {
    common: {
      primary: "#D35D32",
      secondary: "#3B291D",
      tertiary: "#F2D9B1",
      error: "#C44536",
    },
    modes: {
      light: {
        background: "#FFF3E6",
        surface: "#FFFFFF",
        surfaceVariant: "#F2DEC8",
      },
      dark: {
        background: "#1B0E06",
        surface: "#25150B",
        surfaceVariant: "#322011",
      },
    },
  },
  arctic: {
    common: {
      primary: "#2E9CCA",
      secondary: "#1B263B",
      tertiary: "#9AD4F1",
      error: "#FF4F5E",
    },
    modes: {
      light: {
        background: "#F1F8FD",
        surface: "#FFFFFF",
        surfaceVariant: "#DDEBF6",
      },
      dark: {
        background: "#0A111E",
        surface: "#121C2E",
        surfaceVariant: "#1C2940",
      },
    },
  },
  retroWave: {
    common: {
      primary: "#FF77E9",
      secondary: "#060C27",
      tertiary: "#7DF9FF",
      error: "#FF4060",
    },
    modes: {
      light: {
        background: "#F4F5FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E5E7FF",
      },
      dark: {
        background: "#05051A",
        surface: "#111133",
        surfaceVariant: "#1D1D45",
      },
    },
  },
  focus: {
    common: {
      primary: "#4674FF",
      secondary: "#131923",
      tertiary: "#9DB2FF",
      error: "#F1574A",
    },
    modes: {
      light: {
        background: "#F3F6FF",
        surface: "#FFFFFF",
        surfaceVariant: "#E1E6F8",
      },
      dark: {
        background: "#090E18",
        surface: "#121A28",
        surfaceVariant: "#1C2434",
      },
    },
  },
  noirContrast: {
    common: {
      primary: "#FFFFFF",
      secondary: "#000000",
      tertiary: "#9A9A9A",
      error: "#FF4A4A",
    },
    modes: {
      light: {
        background: "#FFFFFF",
        surface: "#F5F5F5",
        surfaceVariant: "#E0E0E0",
      },
      dark: {
        background: "#000000",
        surface: "#0F0F0F",
        surfaceVariant: "#1C1C1C",
      },
    },
  },
  warmPaper: {
    common: {
      primary: "#C27A32",
      secondary: "#2F2415",
      tertiary: "#F2E5D5",
      error: "#D1495B",
    },
    modes: {
      light: {
        background: "#FFF9F2",
        surface: "#FFFFFF",
        surfaceVariant: "#F0E4D5",
      },
      dark: {
        background: "#150C04",
        surface: "#1D1309",
        surfaceVariant: "#291C11",
      },
    },
  },
  terminal: {
    common: {
      primary: "#00FF88",
      secondary: "#0A0F0C",
      tertiary: "#65FFA6",
      error: "#FF5C57",
    },
    modes: {
      light: {
        background: "#F4FFF8",
        surface: "#FFFFFF",
        surfaceVariant: "#DDF7E7",
      },
      dark: {
        background: "#020905",
        surface: "#07140A",
        surfaceVariant: "#112015",
      },
    },
  },
  pastel: {
    common: {
      primary: "#FF9EB5",
      secondary: "#3F4A5A",
      tertiary: "#B6E2FF",
      error: "#FF6F91",
    },
    modes: {
      light: {
        background: "#FFF5F8",
        surface: "#FFFFFF",
        surfaceVariant: "#F1E3F0",
      },
      dark: {
        background: "#161822",
        surface: "#1F2230",
        surfaceVariant: "#2B2F40",
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
