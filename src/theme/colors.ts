import type { MD3Theme } from 'react-native-paper';

export type ThemeColors = MD3Theme['colors'];

export type CustomColorScheme = {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  background?: string;
  surface?: string;
  error?: string;
};

export const presetThemes: Record<string, CustomColorScheme> = {
  uniarr: {
    primary: '#8B6914',
    secondary: '#6B5E4F',
    tertiary: '#5A6B4A',
    background: '#FFFCF7',
    surface: '#FFFCF7',
    error: '#BA1A1A',
  },
  netflix: {
    primary: '#E50914',
    secondary: '#221F1F',
    tertiary: '#F5F5F1',
    background: '#000000',
    surface: '#141414',
    error: '#E50914',
  },
  plex: {
    primary: '#EBAF00',
    secondary: '#282A2D',
    tertiary: '#F5F6F7',
    background: '#1F1F1F',
    surface: '#2D2D2D',
    error: '#CB2600',
  },
  jellyfin: {
    primary: '#00A4DC',
    secondary: '#1E1E1E',
    tertiary: '#FFFFFF',
    background: '#101010',
    surface: '#1A1A1A',
    error: '#CC0000',
  },
  spotify: {
    primary: '#1DB954',
    secondary: '#121212',
    tertiary: '#B3B3B3',
    background: '#121212',
    surface: '#181818',
    error: '#FF4444',
  },
  youtube: {
    primary: '#FF0000',
    secondary: '#0F0F0F',
    tertiary: '#FFFFFF',
    background: '#0F0F0F',
    surface: '#181818',
    error: '#CC0000',
  },
};

/**
 * Generate a complete MD3 color palette from a custom color scheme
 */
export const generateThemeColors = (scheme: CustomColorScheme, isDark: boolean = false): ThemeColors => {
  // Generate color variations based on the primary color
  const generateColorVariations = (baseColor: string) => {
    // Simple color manipulation - in a real app, you'd use a proper color library
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const primaryContainer = `rgba(${Math.min(r + 40, 255)}, ${Math.min(g + 30, 255)}, ${Math.min(b + 20, 255)}, 0.3)`;
    const onPrimaryContainer = baseColor;

    return { primaryContainer, onPrimaryContainer };
  };

  const primary = scheme.primary || '#8B6914';
  const { primaryContainer, onPrimaryContainer } = generateColorVariations(primary);

  if (isDark) {
    return {
      primary: primary,
      onPrimary: '#FFFFFF',
      primaryContainer,
      onPrimaryContainer,
      secondary: scheme.secondary || '#6B5E4F',
      onSecondary: '#FFFFFF',
      secondaryContainer: `rgba(255, 255, 255, 0.1)`,
      onSecondaryContainer: scheme.tertiary || '#5A6B4A',
      tertiary: scheme.tertiary || '#5A6B4A',
      onTertiary: '#000000',
      tertiaryContainer: `rgba(255, 255, 255, 0.15)`,
      onTertiaryContainer: scheme.tertiary || '#5A6B4A',
      error: scheme.error || '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: `rgba(${scheme.error || '#BA1A1A'}, 0.3)`,
      onErrorContainer: scheme.error || '#BA1A1A',
      background: scheme.background || '#FFFCF7',
      onBackground: '#1C1B1F',
      surface: scheme.surface || '#FFFCF7',
      onSurface: '#1C1B1F',
      surfaceVariant: `rgba(255, 255, 255, 0.05)`,
      onSurfaceVariant: `rgba(255, 255, 255, 0.7)`,
      outline: `rgba(255, 255, 255, 0.3)`,
      outlineVariant: `rgba(255, 255, 255, 0.2)`,
      shadow: '#000000',
      scrim: '#000000',
      inverseSurface: `rgba(255, 255, 255, 0.1)`,
      inverseOnSurface: '#000000',
      inversePrimary: primary,
      surfaceDisabled: `rgba(255, 255, 255, 0.12)`,
      onSurfaceDisabled: `rgba(255, 255, 255, 0.38)`,
      backdrop: `rgba(0, 0, 0, 0.4)`,
      elevation: {
        level0: 'transparent',
        level1: scheme.surface || '#FFFCF7',
        level2: `rgba(255, 255, 255, 0.05)`,
        level3: `rgba(255, 255, 255, 0.08)`,
        level4: `rgba(255, 255, 255, 0.11)`,
        level5: `rgba(255, 255, 255, 0.14)`,
      },
    };
  } else {
    return {
      primary: primary,
      onPrimary: '#FFFFFF',
      primaryContainer,
      onPrimaryContainer,
      secondary: scheme.secondary || '#6B5E4F',
      onSecondary: '#000000',
      secondaryContainer: `rgba(0, 0, 0, 0.1)`,
      onSecondaryContainer: scheme.secondary || '#6B5E4F',
      tertiary: scheme.tertiary || '#5A6B4A',
      onTertiary: '#000000',
      tertiaryContainer: `rgba(0, 0, 0, 0.15)`,
      onTertiaryContainer: scheme.tertiary || '#5A6B4A',
      error: scheme.error || '#BA1A1A',
      onError: '#FFFFFF',
      errorContainer: `rgba(${scheme.error || '#BA1A1A'}, 0.3)`,
      onErrorContainer: scheme.error || '#BA1A1A',
      background: scheme.background || '#FFFCF7',
      onBackground: '#000000',
      surface: scheme.surface || '#FFFCF7',
      onSurface: '#1C1B1F',
      surfaceVariant: `rgba(0, 0, 0, 0.05)`,
      onSurfaceVariant: `rgba(0, 0, 0, 0.7)`,
      outline: `rgba(0, 0, 0, 0.3)`,
      outlineVariant: `rgba(0, 0, 0, 0.2)`,
      shadow: '#000000',
      scrim: '#000000',
      inverseSurface: `rgba(0, 0, 0, 0.1)`,
      inverseOnSurface: '#FFFFFF',
      inversePrimary: primary,
      surfaceDisabled: `rgba(0, 0, 0, 0.12)`,
      onSurfaceDisabled: `rgba(0, 0, 0, 0.38)`,
      backdrop: `rgba(0, 0, 0, 0.4)`,
      elevation: {
        level0: 'transparent',
        level1: scheme.surface || '#FFFCF7',
        level2: `rgba(0, 0, 0, 0.05)`,
        level3: `rgba(0, 0, 0, 0.08)`,
        level4: `rgba(0, 0, 0, 0.11)`,
        level5: `rgba(0, 0, 0, 0.14)`,
      },
    };
  }
};

export const lightColors: ThemeColors = {
  primary: '#8B6914',
  onPrimary: '#FFFFFF',
  primaryContainer: '#F5E6A3',
  onPrimaryContainer: '#2A1F00',
  secondary: '#6B5E4F',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#F2E5D4',
  onSecondaryContainer: '#251A0F',
  tertiary: '#5A6B4A',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#DDE8C8',
  onTertiaryContainer: '#161F0A',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',
  background: '#FFFCF7',
  onBackground: '#1F1C17',
  surface: '#FFFCF7',
  onSurface: '#1F1C17',
  surfaceVariant: '#E8E2D4',
  onSurfaceVariant: '#49473A',
  outline: '#7A7667',
  outlineVariant: '#CBC6B5',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#34302A',
  inverseOnSurface: '#F8F0E6',
  inversePrimary: '#C49B2D',
  surfaceDisabled: 'rgba(31, 28, 23, 0.12)',
  onSurfaceDisabled: 'rgba(31, 28, 23, 0.38)',
  backdrop: 'rgba(52, 48, 42, 0.4)',
  elevation: {
    level0: 'transparent',
    level1: '#F7F2E8',
    level2: '#ECE7DD',
    level3: '#E1DBC8',
    level4: '#D6D0BD',
    level5: '#CCC5B2',
  },
};

export const darkColors: ThemeColors = {
  primary: '#C49B2D',
  onPrimary: '#FFFFFF',
  primaryContainer: '#3A2F1D',
  onPrimaryContainer: '#F5E6A3',
  secondary: '#8B7D6B',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#2A2520',
  onSecondaryContainer: '#A69B8C',
  tertiary: '#A8C8A8',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#2A3A2A',
  onTertiaryContainer: '#B8D8B8',
  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  background: '#1F1F1F',
  onBackground: '#E8E8E8',
  surface: '#2A2A2A',
  onSurface: '#E8E8E8',
  surfaceVariant: '#333333',
  onSurfaceVariant: '#C7C7C7',
  outline: '#8B7D6B',
  outlineVariant: '#494949',
  shadow: '#000000',
  scrim: '#000000',
  inverseSurface: '#E8E8E8',
  inverseOnSurface: '#1F1F1F',
  inversePrimary: '#C49B2D',
  surfaceDisabled: 'rgba(232, 232, 232, 0.12)',
  onSurfaceDisabled: 'rgba(232, 232, 232, 0.38)',
  backdrop: 'rgba(31, 31, 31, 0.4)',
  elevation: {
    level0: 'transparent',
    level1: '#2A2A2A',
    level2: '#333333',
    level3: '#3A3A3A',
    level4: '#404040',
    level5: '#494949',
  },
};
