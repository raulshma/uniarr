import type { ColorSchemeName } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { darkColors, lightColors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type AppTheme = MD3Theme & {
  custom: {
    spacing: typeof spacing;
    typography: typeof typography;
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

export const lightTheme: AppTheme = createTheme(MD3LightTheme, lightColors);

export const darkTheme: AppTheme = createTheme(MD3DarkTheme, darkColors);

// Default theme for initialization - use dark theme as default to prevent white flash
export const defaultTheme: AppTheme = darkTheme;

export const getAppTheme = (scheme: ColorSchemeName): AppTheme =>
  scheme === 'dark' ? darkTheme : lightTheme;
