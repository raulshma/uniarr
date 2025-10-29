import type { ColorSchemeName } from "react-native";
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from "react-native-paper";

import {
  darkColors,
  lightColors,
  generateThemeColors,
  type CustomColorScheme,
  presetThemes,
  presetKeyAliases,
  type ThemePreset,
} from "@/theme/colors";
import { generateSpacingScale, type DensityMode } from "@/theme/spacing";
import {
  generateTypographyScale,
  type FontScale,
  typography,
} from "@/theme/typography";
import { spacing } from "@/theme/spacing";
import { generateSizeTokens, borderRadius } from "@/constants/sizes";

export type FrostedEffectTokens = {
  blurIntensity: number;
  blurReductionFactor: number;
  blurTint: "light" | "dark";
  surfaceOverlayColor: string;
  surfaceBackgroundColor: string;
  surfaceBorderColor: string;
  surfaceBorderWidth: number;
  pillBackgroundColor: string;
};

export type CustomThemeConfig = {
  preset?: keyof typeof presetThemes;
  customColors?: Partial<CustomColorScheme>;
  oledEnabled?: boolean;
  fontScale: FontScale;
  densityMode: DensityMode;
  globalBorderRadius?: keyof typeof borderRadius;
  posterStyle: {
    borderRadius: number;
    shadowOpacity: number;
    shadowRadius: number;
  };
};

export type AppTheme = MD3Theme & {
  custom: {
    spacing: typeof spacing;
    typography: typeof typography;
    sizes: ReturnType<typeof generateSizeTokens>;
    config?: CustomThemeConfig;
    effects: {
      frosted: FrostedEffectTokens;
    };
  };
};

type RGBColor = { r: number; g: number; b: number };

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const parseHexColor = (input: string): RGBColor | undefined => {
  if (!input) {
    return undefined;
  }

  const normalized = input.trim();
  if (!normalized.startsWith("#")) {
    return undefined;
  }

  const hex = normalized.slice(1);
  if (hex.length === 3) {
    const rChar = hex.charAt(0);
    const gChar = hex.charAt(1);
    const bChar = hex.charAt(2);

    const r = Number.parseInt(rChar + rChar, 16);
    const g = Number.parseInt(gChar + gChar, 16);
    const b = Number.parseInt(bChar + bChar, 16);
    return { r, g, b };
  }

  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      return undefined;
    }
    return { r, g, b };
  }

  return undefined;
};

const parseRgbColor = (input: string): RGBColor | undefined => {
  const match = input.trim().match(/rgba?\s*\(([^)]+)\)/i);

  if (!match?.[1]) {
    return undefined;
  }

  const parts = match[1]
    .split(",")
    .map((part) => part.trim())
    .slice(0, 3);

  if (parts.length !== 3) {
    return undefined;
  }

  const [r, g, b] = parts.map((value) => Number.parseFloat(value)) as [
    number,
    number,
    number,
  ];

  if ([r, g, b].some((component) => Number.isNaN(component))) {
    return undefined;
  }

  return {
    r: clamp(Math.round(r), 0, 255),
    g: clamp(Math.round(g), 0, 255),
    b: clamp(Math.round(b), 0, 255),
  };
};

const colorToRgb = (input: string): RGBColor | undefined =>
  parseHexColor(input) ?? parseRgbColor(input);

const colorWithAlpha = (input: string, alpha: number): string => {
  const rgb = colorToRgb(input);
  if (!rgb) {
    return input;
  }

  const safeAlpha = clamp(Number.isFinite(alpha) ? alpha : 0.5, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${safeAlpha})`;
};

const createFrostedTokens = (
  colors: MD3Theme["colors"],
  isDark: boolean,
): FrostedEffectTokens => {
  const surfaceBackgroundAlpha = isDark ? 0.28 : 0.55;
  const overlayAlpha = isDark ? 0.32 : 0.4;
  const borderAlpha = isDark ? 0.55 : 0.25;
  const pillAlpha = isDark ? 0.22 : 0.3;

  const overlaySource = isDark ? colors.surfaceVariant : "#FFFFFF";

  return {
    blurIntensity: isDark ? 68 : 58,
    blurReductionFactor: isDark ? 16 : 18,
    blurTint: isDark ? "dark" : "light",
    surfaceOverlayColor: colorWithAlpha(overlaySource, overlayAlpha),
    surfaceBackgroundColor: colorWithAlpha(
      colors.surface,
      surfaceBackgroundAlpha,
    ),
    surfaceBorderColor: colorWithAlpha(colors.outlineVariant, borderAlpha),
    surfaceBorderWidth: 1,
    pillBackgroundColor: colorWithAlpha(overlaySource, pillAlpha),
  };
};

const createTheme = (
  baseTheme: MD3Theme,
  colors: MD3Theme["colors"],
): AppTheme => {
  const frosted = createFrostedTokens(colors, baseTheme.dark);

  return {
    ...baseTheme,
    colors,
    custom: {
      spacing,
      typography,
      sizes: generateSizeTokens(),
      effects: {
        frosted,
      },
    },
  };
};

/**
 * Create a custom theme from configuration
 */
export const createCustomTheme = (
  config: CustomThemeConfig,
  isDark: boolean = false,
): AppTheme => {
  // Determine color scheme
  const requestedPreset = config.preset ?? "uniarr";
  // Support legacy brand-based keys by mapping them to neutral keys
  const resolvedPresetKey =
    (presetKeyAliases[
      requestedPreset as string
    ] as keyof typeof presetThemes) ?? requestedPreset;
  const basePreset = (presetThemes[
    resolvedPresetKey as keyof typeof presetThemes
  ] ?? presetThemes.uniarr) as ThemePreset;
  const colorScheme: CustomColorScheme = {
    ...basePreset.common,
    ...config.customColors,
  };

  // Generate theme colors
  const colors = generateThemeColors(
    colorScheme,
    isDark,
    isDark ? basePreset.modes.dark : basePreset.modes.light,
    config.oledEnabled,
  );

  // Generate typography, spacing, and size scales
  const typographyScale = generateTypographyScale(config.fontScale);
  const spacingScale = generateSpacingScale(config.densityMode);
  const sizeScale = generateSizeTokens(
    config.densityMode,
    config.globalBorderRadius,
  );

  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...baseTheme,
    colors,
    custom: {
      spacing: spacingScale,
      typography: typographyScale,
      sizes: sizeScale,
      config,
      effects: {
        frosted: createFrostedTokens(colors, isDark),
      },
    },
  };
};

export const lightTheme: AppTheme = createTheme(MD3LightTheme, lightColors);

export const darkTheme: AppTheme = createTheme(MD3DarkTheme, darkColors);

// Default theme for initialization - use dark theme as default to prevent white flash
export const defaultTheme: AppTheme = darkTheme;

export const getAppTheme = (scheme: ColorSchemeName): AppTheme =>
  scheme === "dark" ? darkTheme : lightTheme;

// Default custom theme configuration
export const defaultCustomThemeConfig: CustomThemeConfig = {
  preset: "uniarr",
  oledEnabled: false,
  fontScale: "medium",
  densityMode: "comfortable",
  globalBorderRadius: "md",
  posterStyle: {
    borderRadius: 8,
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
};
