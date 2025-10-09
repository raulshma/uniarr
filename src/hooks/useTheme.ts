import { useMemo } from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

import {
  getAppTheme,
  defaultTheme,
  createCustomTheme,
  defaultCustomThemeConfig,
  type AppTheme
} from '@/constants/theme';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Custom hook that returns the appropriate app theme based on user preference and system theme.
 * If user selects 'system', it follows the system theme. Otherwise, it uses the selected theme.
 * Uses defaultTheme during initialization to prevent white flash.
 */
export const useTheme = (): AppTheme => {
  const systemColorScheme = useColorScheme();
  const themePreference = useSettingsStore((state) => state.theme);
  const customThemeConfig = useSettingsStore((state) => state.customThemeConfig);

  return useMemo(() => {
    // Use default theme if system color scheme is not available yet
    if (!systemColorScheme) {
      return defaultTheme;
    }

    let effectiveScheme: ColorSchemeName;

    switch (themePreference) {
      case 'light':
        effectiveScheme = 'light';
        break;
      case 'dark':
        effectiveScheme = 'dark';
        break;
      case 'system':
      default:
        effectiveScheme = systemColorScheme ?? 'dark';
        break;
    }

    // Check if we have a custom theme configuration
    if (customThemeConfig && customThemeConfig.preset !== 'uniarr') {
      // Use custom theme configuration
      return createCustomTheme(customThemeConfig, effectiveScheme === 'dark');
    }

    // Use standard theme
    return getAppTheme(effectiveScheme);
  }, [themePreference, systemColorScheme, customThemeConfig]);
};
