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
import { generateSizeTokens } from "@/constants/sizes";

export type CustomThemeConfig = {
  preset?: keyof typeof presetThemes;
  customColors?: Partial<CustomColorScheme>;
  oledEnabled?: boolean;
  fontScale: FontScale;
  densityMode: DensityMode;
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
  };
};

const createTheme = (
  baseTheme: MD3Theme,
  colors: MD3Theme["colors"],
): AppTheme => ({
  ...baseTheme,
  colors,
  custom: {
    spacing,
    typography,
    sizes: generateSizeTokens(),
  },
});

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
  const sizeScale = generateSizeTokens(config.densityMode);

  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...baseTheme,
    colors,
    custom: {
      spacing: spacingScale,
      typography: typographyScale,
      sizes: sizeScale,
      config,
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
  posterStyle: {
    borderRadius: 8,
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
};
