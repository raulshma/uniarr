import type { ColorSchemeName } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import {
  darkColors,
  lightColors,
  generateThemeColors,
  type CustomColorScheme,
  presetThemes
} from '@/theme/colors';
import { generateSpacingScale, type DensityMode } from '@/theme/spacing';
import { generateTypographyScale, type FontScale, typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export type CustomThemeConfig = {
  preset?: keyof typeof presetThemes;
  customColors?: Partial<CustomColorScheme>;
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
    config?: CustomThemeConfig;
  };
};

const createTheme = (baseTheme: MD3Theme, colors: MD3Theme['colors']): AppTheme => ({
  ...baseTheme,
  colors,
  custom: {
    spacing,
    typography,
  },
});

/**
 * Create a custom theme from configuration
 */
export const createCustomTheme = (
  config: CustomThemeConfig,
  isDark: boolean = false
): AppTheme => {
  // Determine color scheme
  const baseScheme = config.preset ? presetThemes[config.preset] : presetThemes.uniarr;
  const colorScheme: CustomColorScheme = {
    ...baseScheme,
    ...config.customColors,
  };

  // Generate theme colors
  const colors = generateThemeColors(colorScheme, isDark);

  // Generate typography and spacing scales
  const typographyScale = generateTypographyScale(config.fontScale);
  const spacingScale = generateSpacingScale(config.densityMode);

  const baseTheme = isDark ? MD3DarkTheme : MD3LightTheme;

  return {
    ...baseTheme,
    colors,
    custom: {
      spacing: spacingScale,
      typography: typographyScale,
      config,
    },
  };
};

export const lightTheme: AppTheme = createTheme(MD3LightTheme, lightColors);

export const darkTheme: AppTheme = createTheme(MD3DarkTheme, darkColors);

// Default theme for initialization - use dark theme as default to prevent white flash
export const defaultTheme: AppTheme = darkTheme;

export const getAppTheme = (scheme: ColorSchemeName): AppTheme =>
  scheme === 'dark' ? darkTheme : lightTheme;

// Default custom theme configuration
export const defaultCustomThemeConfig: CustomThemeConfig = {
  preset: 'uniarr',
  fontScale: 'medium',
  densityMode: 'comfortable',
  posterStyle: {
    borderRadius: 8,
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
};
